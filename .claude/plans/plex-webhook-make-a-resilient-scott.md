# Plex Webhooks (Issue #40)

## Context

Issue #40 asks for the backend to receive Plex webhooks so a user's watch
status stays in sync with what they actually watch via Plex, starting with
just the `media.scrobble` event (fired when Plex considers an item "watched,"
generally >90% played). Frontend work is explicitly out of scope for now.

The codebase already has two comparable external-integration features —
Trakt (OAuth-based sync) and Flexget (credential-based remote import) — each
living in its own `src/<domain>/` module with a per-user integration row in
Postgres via Prisma, a Fastify route plugin, and a service layer that calls
into the existing, shared watch-recording services
(`src/watch/watch-service.ts`, `src/tv-shows/tv-watch-service.ts`). Plex
webhooks fit the same shape, with one twist: Plex has no OAuth/API-key
concept and sends webhook POSTs with **no authentication at all**, so the
new route has to identify the target user itself rather than relying on the
existing JWT-based `authenticate` preHandler.

The goal of this change is to add a `src/plex/` module that: lets a logged-in
user obtain a unique webhook URL for their account, receives Plex's
`multipart/form-data` webhook POSTs at that URL, filters for scrobble events,
resolves the watched movie/episode to an internal TMDB id, and records it
using the existing watch services — reusing as much existing infrastructure
as possible rather than inventing new patterns.

## Confirmed decisions

- **Auth model**: opaque per-user token embedded in the webhook URL path
  (`POST /api/plex/webhook/:token`), generated via an authenticated
  `POST /api/plex/integration` route — mirrors how Trakt/Flexget integrations
  are created, and is the only way to obtain a webhook token without frontend
  work.
- **TV idempotency**: add a new day-bucketed watch method to
  `tv-watch-service.ts` (mirroring the movie side's
  `createWatchEntryIfMissingForDay`), since the existing `markEpisodeWatched`
  only dedupes on an exact timestamp match and Plex's scrobble payload has no
  real watched-timestamp, making duplicate scrobble deliveries likely to
  create duplicate history rows otherwise.
- **Shared Plex servers**: a webhook URL maps to exactly one Velara user, with
  no check against the payload's `Account.id`. If a household runs one Plex
  server with multiple Plex accounts, all of their scrobbles will be recorded
  against whichever one Velara user configured the webhook. This is an
  accepted, documented limitation for this iteration — not solved now.
- **Webhook URL shape returned to the caller**: return just the token (or the
  `/api/plex/webhook/:token` path), not a fully-qualified URL — there's no
  existing `PUBLIC_BASE_URL`-style env var in the backend, and adding one is
  unnecessary scope for a backend-only change with no frontend consumer yet.

## Implementation

### 1. Dependencies

Add `@fastify/multipart` to `packages/backend/package.json` — Plex POSTs
`multipart/form-data` (a `payload` field containing JSON, and an optional
`thumb` image field), and no multipart parser exists in this backend today.

### 2. Prisma schema (`packages/backend/prisma/schema.prisma`)

New model, alongside `TraktIntegration`/`FlexgetIntegration`:

```prisma
model PlexIntegration {
  id           Int      @id @default(autoincrement())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       Int      @unique
  webhookToken String   @unique
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Add the matching back-relation field on `User` (same style as
`traktIntegration`/`flexgetIntegration`). After editing, run
`npm run db:generate` then `npm run db:migrate` (per root `package.json`).

Add `Plex = 'plex'` to the `WatchSource` enum in `src/watch/watch-source.ts`.

### 3. New module: `src/plex/`

**`plex.types.ts`** — lenient/passthrough zod schema for the parsed webhook
JSON, validating only what's consumed (`event`, `Metadata.type`,
`Metadata.Guid[].id`, `Metadata.parentIndex`, `Metadata.index`), using
`.loose()` at each object level so unrelated Plex payload fields don't break
validation if Plex adds/changes fields.

**`plex-guid.ts`** — pure helper functions, unit-testable with no mocks:
- `parsePlexGuid(guid: string)` — parses `"imdb://tt1234567"` /
  `"tmdb://12345"` / `"tvdb://67890"` into `{ source, id }`, returns `null`
  for anything else (notably the primary `Metadata.guid` field, which is a
  `plex://movie/...` URI and must never be parsed by this function).
- `findGuid(guids, source)` — finds the first `Metadata.Guid[]` entry
  matching a given source.

**`plex-service.ts`** — `createPlexService({ logger })`, mirroring
`createTraktService`'s factory shape:
- `getIntegration(userId)` / `createOrRotateIntegration(userId)` (generates
  the token via `crypto.randomBytes(32).toString('hex')`, upserts) /
  `deleteIntegration(userId)` — same shape as Trakt/Flexget's integration
  CRUD.
- `getIntegrationByToken(webhookToken)` — resolves a webhook token to its
  owning integration/userId; used by the unauthenticated webhook route.
- `handleWebhookPayload(userId, payload)` — no-ops unless
  `payload.event === 'media.scrobble'`, otherwise delegates to:
- `handleScrobbleEvent(userId, metadata)`:
  - **movie**: prefer `tmdb://` guid directly; fall back to `imdb://` guid via
    `createMovieService({ logger }).findMovieByImdbId(...)`; log + no-op if
    neither resolves. Record via
    `createWatchService({ logger }).createWatchEntryIfMissingForDay(tmdbId, userId, new Date(), WatchSource.Plex)`.
  - **episode**: resolve series TMDB id the same way, via a new
    `findTvShowByExternalId` (see below) for the imdb/tvdb fallback; requires
    `parentIndex`/`index` (season/episode) present, else log + no-op. Record
    via the new day-bucketed TV method (see §4).
  - any other `Metadata.type` (e.g. `track`): log debug, no-op.
- Never throws for "couldn't resolve this item" cases — only for genuinely
  unexpected failures (e.g. TMDB request errors) — so Plex doesn't see 5xx
  and retry-storm the endpoint for content we simply can't match.

**`plex-routes.ts`** — `plexRoutes: FastifyPluginCallbackZod`, registered at
prefix `/api/plex` in `src/index.ts`:
- `GET/POST/DELETE /integration` — authenticated (`preHandler: authenticate`),
  same response shape convention as Trakt's integration routes. `POST`
  creates or rotates the token.
- `POST /webhook/:token` — **unauthenticated** (Plex cannot send a JWT).
  Looks up the integration by token (404 if unknown), parses the multipart
  request via `request.parts()` (registering `@fastify/multipart` scoped to
  this plugin only, `attachFieldsToBody: false`), reading the `payload` text
  field and explicitly draining the `thumb` file part
  (`await part.toBuffer()`, discarded) so the request doesn't hang.
  `JSON.parse`s the payload, validates with `plexWebhookPayloadSchema.parse`
  (a `ZodError` here is already handled as 400 by the global error handler),
  then calls `plexService.handleWebhookPayload`. Always returns 200 once the
  payload is structurally valid, regardless of whether the event was acted
  on.

**`plex-guid.spec.ts`**, **`plex-service.spec.ts`** — unit tests following
`trakt-service.spec.ts`'s mocking conventions (`vi.mock` for `registry.js`,
`prisma.js`, and the movie/watch/tv-watch service modules). Cover: non-scrobble
events no-op; movie resolution via `tmdb://` guid directly vs. `imdb://`
fallback vs. unresolved; episode resolution and missing season/episode
no-op; guid parsing edge cases (including confirming `plex://...` is never
matched).

### 4. Existing files to modify

- **`src/tv-shows/tv-watch-service.ts`** — add a new day-bucketed method
  (e.g. `createEpisodeWatchEntryIfMissingForDay`), mirroring the movie side's
  `createWatchEntryIfMissingForDay` in `src/watch/watch-service.ts`, so
  repeat Plex scrobbles for the same episode on the same day don't create
  duplicate `TvWatchHistory` rows. Purely additive — `markEpisodeWatched`'s
  existing behavior/signature is untouched, so this is low-risk even though
  the file is also used by Trakt sync.
- **`src/tv-shows/tv-show-service.ts`** — add `findTvShowByExternalId(externalId, externalSource: 'imdb_id' | 'tvdb_id')`,
  mirroring `movie-service.ts`'s `findMovieByImdbId` (same TMDB `find/{id}`
  endpoint, reading `tv_results` instead of `movie_results`). Add the
  corresponding result type alongside wherever `FindMovieByImdbResult` is
  defined in the movies module, for consistency.
- **`src/watch/watch-source.ts`** — add `Plex = 'plex'`.
- **`src/index.ts`** — import and register `plexRoutes` with
  `{ prefix: '/api/plex' }`, alongside the other route registrations.
- **`packages/backend/prisma/schema.prisma`** — `PlexIntegration` model + back-relation.
- **`packages/backend/package.json`** — add `@fastify/multipart`.

## Verification

1. `npm run lint`, `npm run test`, `npm run build` from repo root.
2. `npm run db:generate` / `npm run db:migrate` after the schema change, to
   confirm the migration applies cleanly.
3. Manual end-to-end check against the running dev backend
   (`npm run start:dev`):
   - Register/log in as a test user, call `POST /api/plex/integration`
     (with a valid JWT) to obtain a webhook token.
   - Send a simulated Plex webhook with `curl -F payload='{"event":"media.scrobble","Metadata":{"type":"movie","Guid":[{"id":"tmdb://..."}]}}' http://localhost:<port>/api/plex/webhook/<token>`
     and confirm a `WatchEntry`/`WatchHistory` row is created for that user
     via `GET` on the existing movies/watch endpoints or a direct DB check.
   - Repeat the same request and confirm no duplicate `WatchHistory` row is
     created (idempotency check).
   - Send a `media.play` event and confirm it's accepted (200) but produces
     no watch-service side effects.
   - Send a request to an unknown token and confirm a 404.
   - Repeat the movie case for a TV episode payload (`Metadata.type: "episode"`,
     `parentIndex`/`index` set) and confirm `TvWatchEntry`/`TvWatchHistory`
     are created correctly, with the same duplicate-delivery check.

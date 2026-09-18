# Show Currently Playing Card (Issue #42)

## Context

Issue #42 asks for a "currently playing" card, shown in the footer on every
page, reflecting the logged-in user's Plex playback state — updated live from
the `media.play`, `media.pause`, `media.resume`, and `media.stop` webhook
events.

The backend already receives Plex webhooks (built for Issue #40): a per-user
`PlexIntegration` row holds a webhook token, `POST /api/plex/webhook/:token`
resolves the user from that token, and `plex-service.ts` currently handles
exactly one event, `media.scrobble`, by resolving the played item to a TMDB
id (via `plex-guid.ts`'s `findGuid`, plus a `PlexClient.libraryMetadata()`
call for episodes) and writing a permanent `WatchHistory`/`TvWatchHistory`
row. `media.play`/`pause`/`resume`/`stop` currently hit an early-return debug
log and are otherwise ignored.

This feature adds a second, parallel event path alongside scrobble handling:
play/pause/resume/stop update an **ephemeral, per-user "now playing" state**
that the frontend polls and renders as a footer card. Per user decision, this
state must never touch `WatchHistory`/`WatchEntry` — the scrobble path stays
exactly as-is and is the sole source of permanent history.

## Confirmed decisions

- **Placement**: new sticky footer, rendered from `Layout.tsx`, visible on
  every page, hidden entirely when nothing is playing.
- **Live updates**: polling via React Query `refetchInterval` against a new
  `GET /api/plex/now-playing` endpoint. No WebSocket/SSE — none of that infra
  exists in the backend today, and this is the first hook to use
  `refetchInterval` (existing hooks only use `staleTime`).
- **Scope**: per-user only — a logged-in user sees only their own Plex
  session, via their own `PlexIntegration`.
- **History writes are untouched**: play/pause/resume/stop update only the
  ephemeral now-playing state. `handleScrobbleEvent` /
  `handleMovieScrobble` / `handleEpisodeScrobble` and the
  `media.scrobble` → `WatchHistory` write path are not modified in behavior.
- **Persistence**: in-memory only, not a new Prisma table. Losing now-playing
  state on a backend restart is acceptable — the card just disappears until
  the next Plex event. `docker-compose.yml` runs a single backend instance,
  so there's no multi-process fan-out problem to solve, and a DB row
  wouldn't actually fix the "missed `media.stop`" staleness problem anyway
  (see risks).

## Backend changes

### 1. `packages/backend/src/plex/plex.types.ts` — extend webhook schemas

Add fields needed to resolve and display now-playing state. All schemas stay
`.loose()`, so this is additive and doesn't risk existing scrobble parsing:

```ts
export const plexMetadataSchema = z.object({
  type: z.string(),
  Guid: z.array(plexGuidSchema).optional(),
  parentIndex: z.number().optional(),
  index: z.number().optional(),
  grandparentRatingKey: z.string().optional(),
  title: z.string().optional(),
  grandparentTitle: z.string().optional(),
  viewOffset: z.number().optional(),
  duration: z.number().optional(),
}).loose();

export const plexSessionSchema = z.object({ id: z.string().optional() }).loose();

export const plexWebhookPayloadSchema = z.object({
  event: z.string(),
  Metadata: plexMetadataSchema.optional(),
  Session: plexSessionSchema.optional(),
}).loose();
```

Also add the `NowPlayingResponse` DTO (discriminated union so the frontend
can narrow on `isPlaying`), mirroring the field-naming already used by
`HistoryItem` (`posterPath`, `stillPath`, `seriesTmdbId`, etc.):

```ts
export type NowPlayingResponse =
  | { isPlaying: false }
  | {
      isPlaying: true;
      status: 'playing' | 'paused';
      mediaType: 'movie' | 'episode';
      title: string;
      posterPath: string | null;
      tmdbId?: number;
      seriesTmdbId?: string;
      seriesName?: string;
      seasonNumber?: number;
      episodeNumber?: number;
      episodeName?: string;
      stillPath?: string | null;
      viewOffsetMs: number | null;
      durationMs: number | null;
      updatedAt: string;
    };
```

**Poster art**: resolve via TMDB (`movie-service.getMovieDetails` →
`posterPath`; `tv-show-service.getTvSeason` → episode `stillPath`), not
Plex's own `thumb` field — Plex's `thumb` is a path on the user's own Plex
server and would need authenticated proxying through
`PLEX_SERVER_URL`/token just to render a footer thumbnail. TMDB art is
already what `HistoryCard` renders, so this keeps the frontend consistent
and avoids a new dependency on Plex-server reachability for movies (which
today don't need `plexClient` at all).

### 2. `packages/backend/src/plex/plex-service.ts` — event dispatch + store

**Extract shared TMDB-resolution logic** out of `handleMovieScrobble` /
`handleEpisodeScrobble` into two private resolver functions, since the
now-playing path needs the identical resolution (guid → TMDB id for movies;
`grandparentRatingKey` → `plexClient.libraryMetadata` → guid → series TMDB id
for episodes) but must not call `watchService`/`tvWatchService`:

```ts
async function resolveMovieTmdbId(metadata, logger): Promise<number | null>
async function resolveEpisodeIdentity(metadata, logger):
  Promise<{ seriesTmdbId: string; seasonNumber: number; episodeNumber: number } | null>
```

`handleMovieScrobble`/`handleEpisodeScrobble` become thin wrappers around
these resolvers plus the existing `watchService`/`tvWatchService` calls —
external behavior and log messages unchanged, so existing scrobble tests in
`plex-service.spec.ts` keep passing without modification.

**In-memory store**: a `Map<number, NowPlayingState>` keyed by `userId`,
declared as a closure variable inside `createPlexService()` (same lifetime
as the existing `plexClient` variable) — not true module scope, so each
`createPlexService()` call in tests gets its own isolated map with no reset
boilerplate needed, while the single real call in `plex-routes.ts` gives the
running app one shared map.

```ts
interface NowPlayingState {
  status: 'playing' | 'paused';
  mediaType: 'movie' | 'episode';
  sessionKey: string | null;
  title: string;
  posterPath: string | null;
  tmdbId?: number;
  seriesTmdbId?: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  stillPath?: string | null;
  viewOffsetMs: number | null;
  durationMs: number | null;
  updatedAt: Date;
}
```

**Dispatch** — extend `handleWebhookPayload`'s single scrobble check into an
explicit branch, adding a `NOW_PLAYING_EVENTS` set:

```ts
const NOW_PLAYING_EVENTS = new Set(['media.play', 'media.pause', 'media.resume', 'media.stop']);

async handleWebhookPayload(userId, payload) {
  if (payload.event === SCROBBLE_EVENT) {
    if (!payload.Metadata) { logger.warn(...); return; }
    await handleScrobbleEvent(userId, payload.Metadata);
    return;
  }
  if (NOW_PLAYING_EVENTS.has(payload.event)) {
    await handleNowPlayingEvent(userId, payload.event, payload, logger);
    return;
  }
  logger.debug({ userId, event: payload.event }, 'Ignoring unsupported Plex webhook event');
}
```

`handleNowPlayingEvent` behavior:
- `media.stop` → delete the user's map entry immediately; no metadata
  resolution needed, so this is robust even against a malformed/sparse stop
  payload.
- `media.play` / `media.resume` → resolve TMDB identity via the extracted
  resolvers, fetch title/poster from `movie-service`/`tv-show-service`, set
  `status: 'playing'`, `map.set(userId, {...})`.
- `media.pause` → if an entry already exists, just flip `status: 'paused'`
  and update `viewOffsetMs`/`updatedAt` without re-resolving TMDB (avoids an
  extra fetch on every pause). If no entry exists yet, fall through to the
  full resolve path.

Add a new `getNowPlaying(userId)` method to the returned service object:

```ts
getNowPlaying(userId: number): NowPlayingResponse {
  const state = nowPlayingByUser.get(userId);
  if (!state || isStale(state)) return { isPlaying: false };
  return { isPlaying: true, ...state, updatedAt: state.updatedAt.toISOString() };
}
```

`isStale` compares `Date.now() - state.updatedAt.getTime()` against a
10-minute threshold — well above the polling interval, so only a genuinely
abandoned session (e.g. a missed `media.stop`) gets hidden. This is a
read-time check, no background timer/cron needed.

### 3. `packages/backend/src/plex/plex-routes.ts` — new endpoint

```ts
fastify.get('/now-playing', { preHandler: authenticate }, async (request, reply) => {
  return reply.send(plexService.getNowPlaying(request.user.userId));
});
```

Full path `GET /api/plex/now-playing` (prefix already registered in
`index.ts`). No body/params to validate beyond existing `authenticate`.

### 4. `packages/backend/src/plex/plex-service.spec.ts` — extend

- Extend existing `movie-service.js`/`tv-show-service.js` mocks (or add a
  `tv-show-service.js` mock if not already present) for the poster-lookup
  calls.
- New `describe('handleWebhookPayload — now playing events')` covering:
  play/resume for movie and episode (asserts `getNowPlaying` shape after),
  pause reusing an existing entry without a second TMDB resolve, resume
  flipping back, stop clearing the entry (including with missing
  `Metadata`), unresolvable guid leaving state as `{ isPlaying: false }`.
- **Regression guard**: for every now-playing test case, assert
  `createWatchEntryIfMissingForDay`/`createEpisodeWatchEntryIfMissingForDay`
  mocks are `not.toHaveBeenCalled()` — this is what proves now-playing never
  writes history.
- Re-run existing `media.scrobble` tests unmodified to confirm the resolver
  extraction didn't change behavior.
- Staleness test via `vi.useFakeTimers`: set a `media.play`, advance past the
  threshold, assert `getNowPlaying` returns `{ isPlaying: false }` without a
  `stop` event.

No dedicated `plex-routes.spec.ts` — no route-level spec file exists for any
other route today (thin-routes convention), so stay consistent.

## Frontend changes

### 5. `packages/frontend/src/types/now-playing.ts` (new)

Mirror the backend `NowPlayingResponse` discriminated union exactly.

### 6. `packages/frontend/src/services/plex-api.ts` (new)

```ts
export async function fetchNowPlaying(): Promise<NowPlayingResponse> {
  return apiRequest<NowPlayingResponse>('/api/plex/now-playing');
}
```

Follows the existing `apiRequest<T>()` wrapper pattern from
`services/api-client.ts` (credentials included, throws `ApiError` on
non-2xx).

### 7. `packages/frontend/src/hooks/useNowPlaying.ts` (new)

```tsx
export function useNowPlaying() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['plex', 'now-playing'],
    queryFn: fetchNowPlaying,
    enabled: !!user,
    refetchInterval: 7000,
  });
}
```

`enabled: !!user` (via the existing `useAuth` hook, same one `Header.tsx`
uses) means it never polls on public/login pages. 7s polling: the endpoint
is an in-memory map lookup behind auth middleware — negligible server cost —
so the interval is chosen purely for UX feel (play/pause toggles visibly
within one interaction, without being needlessly chatty).

### 8. `packages/frontend/src/components/layout/Footer.tsx` (new)

```tsx
export default function Footer() {
  const { data } = useNowPlaying();
  if (!data?.isPlaying) return null;
  return (
    <footer className="fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur">
      <NowPlayingCard state={data} />
    </footer>
  );
}
```

Renders nothing when idle, so it never reserves footer space on pages where
nothing is playing.

### 9. `packages/frontend/src/components/layout/NowPlayingCard.tsx` (new)

Presentational component taking the narrowed `isPlaying: true` state as a
prop. Renders poster/still thumbnail, title (`S{season}E{episode} ·
{episodeName}` for episodes, matching `HistoryCard`'s existing S/E format),
a play/pause status icon (lucide `Play`/`Pause`), and a thin progress bar
from `viewOffsetMs / durationMs`. Links to `/movies/:tmdbId` or
`/tv/:seriesTmdbId`, matching `HistoryCard`'s existing link pattern.

### 10. `packages/frontend/src/components/layout/Layout.tsx` — mount it

```tsx
export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 pb-24">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
```

`pb-24` added unconditionally to `<main>` as headroom for the fixed footer,
avoiding the need to thread playing-state into `Layout` just to
conditionally pad.

## Known risks / accepted limitations

- **Missed `media.stop`** (crash, network blip) leaves a stale "still
  playing" card until the 10-minute read-time staleness check hides it.
- **Multiple simultaneous Plex sessions for one user** (e.g. phone + TV):
  last-writer-wins in the `Map`; a `stop` on one session can clear another's
  still-active card. `sessionKey` is stored for future-proofing but no
  multi-session UI is built now — out of scope for this issue's acceptance
  criteria.
- **Out-of-order webhook delivery** (rare, no ordering guarantee over HTTP):
  self-corrects on the next real event; not worth building sequencing for.
- **Episode now-playing when `PLEX_SERVER_URL`/`PLEX_SERVER_TOKEN` are
  unset**: silently no-ops with a warn log, identical to the existing
  scrobble limitation. Movies are unaffected since they don't need
  `plexClient`.

## Verification

1. `npm run lint`, `npm run test`, `npm run build` from root.
2. Backend: run the new `plex-service.spec.ts` cases; confirm existing
   scrobble tests still pass unmodified.
3. Manual/local: configure a `PlexIntegration`, send simulated webhook POSTs
   (via `curl -F payload='{"event":"media.play","Metadata":{...}}'
   http://localhost:<port>/api/plex/webhook/<token>`) for play → pause →
   resume → stop, and confirm `GET /api/plex/now-playing` (authenticated)
   reflects each transition.
4. Frontend: run the app, log in, trigger the above webhook sequence, and
   confirm the footer card appears within one poll interval, updates its
   play/pause icon, and disappears on stop. Confirm it does not appear when
   logged out or when nothing is playing.

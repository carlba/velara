# Project Guidelines

## Overview

## Structure & dependency graph

Velara is an npm-workspaces monorepo (`packages/*`) for a full-stack movie/TV tracker: a Fastify
backend and a React (Vite) frontend, sharing no code package today — the frontend calls the backend
only over HTTP.

```
velara/
├── packages/
│   ├── backend/    → Fastify + Prisma API (packages/backend/src)
│   └── frontend/   → React + Vite SPA (packages/frontend/src)
├── docs/           → third-party API references (Trakt, Flexget, Plex webhook payloads)
├── specs/          → freeform feature specs (e.g. rating-scale-and-half-star.md)
└── docker-compose.yml, Dockerfile  → postgres + app containers
```

Root `package.json` only orchestrates workspaces (`npm run build/lint/test` fan out via
`--workspaces`); there is no shared root `src`.

### Backend (`packages/backend/src`)

Layering is consistent across every feature folder: **routes → service(s) → Prisma / external
client**. Routes are thin Fastify plugins that validate with zod and call one or more
`create*Service()` factories; services hold the business logic and are the only layer that touches
`prisma` or outbound HTTP clients.

- `index.ts` — composition root. Registers Fastify plugins (helmet, cors, cookie, jwt), mounts every
  `*-routes.ts` under its `/api/*` prefix, and starts `trakt-scheduler`.
- `registry.ts` — process-wide singletons: `config` (parsed env, via `lib/config.ts` + `schema.ts`)
  and `LOGGER` (pino, via `lib/logger.ts`). Nearly every other module imports `LOGGER`/`config` from
  here rather than re-reading env.
- `lib/` — cross-cutting utilities: `prisma.ts` (the shared `PrismaClient` instance), `config.ts` /
  `schema.ts` (zod-validated env), `logger.ts`, `http-error.ts`.
- `auth/` — `auth-service` (bcrypt + JWT) backs `auth-middleware` (`authenticate` preHandler used by
  almost every other route file) and `auth-routes` (`/api/auth`).
- `movies/` — `movie-service` is the hub: it calls `tmdb-client` and `omdb-client` (outbound `got`
  clients for TMDB/OMDb) and is consumed by `movie-routes`. `user-data-service` layers per-user
  state (watched/rating/review/comment) over a movie via `watch-service`, `ratings/rating-service`,
  `reviews/review-service`, `comments/comment-service`. `import-service` /`export-service` handle
  Filmtipset/Trakt-dump import and Letterboxd-style export.
- `tv-shows/` — mirrors `movies/` for series: `tv-show-service` (TMDB TV data) +
  `tv-user-data-service`, `tv-watch-service`, `tv-rating-service`, `tv-review-service`,
  `tv-comment-service`, all behind `tv-show-routes`.
- `watch/watch-source.ts` — shared enum/type for where a watch event originated (manual, Trakt,
  Plex, Flexget); imported by `movies/import-service`, `watch/watch-service`,
  `tv-shows/tv-watch-service`, `trakt/trakt-service`, and `plex/plex-service` so all watch-history
  writers agree on provenance.
- `trakt/` — `trakt-service` syncs Trakt history (using `watch-source`); `trakt-scheduler` runs it
  on an interval from `index.ts`; `trakt-dump-service` parses Trakt data-export files (used by
  `movies/import-service`); `trakt-routes` exposes OAuth + manual-sync endpoints.
- `plex/` — `plex-client` (got) + `plex-guid` (Plex GUID → TMDB id parsing) back `plex-service`,
  which handles incoming Plex webhook scrobble events (`plex-routes`) and writes watch history via
  `watch-source`.
- `flexget/` — `flexget-service` talks to a self-hosted Flexget instance for download automation
  (`flexget-routes`).
- `lists/` — user-curated lists (`list-service`, `list-routes`); items reference movies/shows by id.
- `history/` — read-only aggregated watch-history feed (`history-service`, `history-routes`) that
  merges movie + TV watch entries for the frontend's History page.
- `prisma/schema.prisma` — source of truth for the data model (`User`, movie tables
  `WatchEntry`/`WatchHistory`/`Rating`/`Review`/`Comment`, their `Tv*` equivalents, `List`/
  `ListItem`, and per-integration tables `TraktIntegration`/`PlexIntegration`/
  `FlexgetIntegration`/`ListIntegration`). Run `npm run db:migrate` (backend) after schema edits.

### Frontend (`packages/frontend/src`)

- `main.tsx` → `App.tsx` — React Router route table (`/movies`, `/tv`, `/lists`, `/history`,
  `/profile`, `/login`, `/register`, `/trakt-callback`), all nested under
  `components/layout/Layout`.
- `pages/<feature>/` — one page component per route; pages compose hooks + components, holding no
  fetch logic themselves.
- `hooks/` — React Query hooks (`useMovies`, `useTvShows`, `useHistory`, `useUserMovieData`,
  `useUserTvData`, `useMovieComments`, `useTvComments`, …) plus non-data hooks `useAuth` (auth
  context) and `useTheme` (dark mode). Each data hook wraps exactly one `services/*-api.ts` module.
- `services/*-api.ts` — one file per backend route prefix (`movies-api` ↔ `/api/movies`,
  `tv-shows-api` ↔ `/api/tv`, `lists-api`, `history-api`, `trakt-api`, `flexget-api`, `auth-api`,
  `comments-api`, `tv-comments-api`, `user-data-api`, `user-tv-data-api`); all go through the shared
  `services/api-client.ts` (fetch wrapper with credentials + base URL).
- `components/<feature>/` — presentational components grouped by domain (`movies/`, `tv-shows/`,
  `history/`, `lists/`, `layout/`); `components/ui/` is the shadcn/ui primitive set (owned,
  generated source — edit in place, don't hand-roll new primitives there).
- `types/` — shared TS types mirroring backend response shapes per domain (`movie.ts`, `tv-show.ts`,
  `list.ts`, `history.ts`, `user.ts`).
- `lib/utils.ts` (shadcn `cn()` helper) and `lib/query-params.ts` (URL search-param helpers used
  with `useSearchParams`).

### Cross-cutting dependency flow

```
frontend/pages → frontend/hooks (React Query) → frontend/services/*-api → HTTP → backend routes
backend routes → backend services → backend/lib (prisma, config, logger) + external clients
                                   ↘ watch/watch-source.ts (shared provenance type)
external clients: tmdb-client, omdb-client, plex-client, trakt (REST), flexget (REST) — all via `got`
```

When adding a new domain feature, follow the existing folder shape: `<domain>-types.ts` →
`<domain>-service.ts` (+ `.spec.ts`) → `<domain>-routes.ts` on the backend, and
`services/<domain>-api.ts` → `hooks/use<Domain>.ts` → `pages/<domain>/` on the frontend.

## TypeScript & code style

### Clean code principles

- Use meaningful names for variables, functions, parameters, and classes.

- Keep functions small and focused on a single responsibility.

- Extract magic numbers and strings into named constants.

- Prefer positive conditionals: `if (isValid)` instead of `if (!isInvalid)`.

- Use fewer than three parameters when possible. If more are needed, use an options object.

- Avoid duplicated logic by extracting shared helper functions.

- Comment why a decision was made, not what the code already shows.

### TypeScript rules

- Use strict TypeScript and follow the root `tsconfig.json` (extended by every package).

- Prefer `interface` for object shapes and `type` for unions, intersections, and aliases.

- Avoid `any`; use `unknown` when the type is uncertain and narrow it explicitly.

- Use `const` by default, and use `let` only when reassignment is necessary.

- Prefer explicit return types on exported functions.

- Use ESM imports and exports (`verbatimModuleSyntax` is on — include file extensions in relative
  imports, e.g. `./schema.js`).

- Prefer named exports over default exports.

### Naming conventions

| Construct              | Convention                      | Example                                 |
| ---------------------- | ------------------------------- | --------------------------------------- |
| Variables / parameters | camelCase, descriptive nouns    | `userResponse`, `retryCount`            |
| Functions              | camelCase, verb phrases         | `fetchUserProfile`, `parseErrorMessage` |
| Classes / interfaces   | PascalCase                      | `HttpClient`, `UserRepository`          |
| Constants              | UPPER_SNAKE_CASE (module-level) | `MAX_RETRY_ATTEMPTS`                    |
| Types                  | PascalCase                      | `ApiResponse`, `RequestOptions`         |
| Files                  | kebab-case                      | `user-service.ts`, `parse-response.ts`  |

## Testing

- Use Vitest and colocate test files with source files using `.spec.ts` (e.g. `greet.ts` +
  `greet.spec.ts`).

- Write behavior-focused tests, not implementation tests.

- Prefer `vi.mock` for external dependencies and avoid mocking internals.

- Cover edge cases and error paths, not just the happy path.

- Each package runs its own Vitest config — there is no aggregated root test runner beyond
  `npm run test`.

## Error handling

- Never swallow errors with empty `catch` blocks.

- Wrap third-party errors with context before rethrowing.

- Validate external inputs at system boundaries: API responses, environment variables, CLI args.

## Verification checklist

Before considering a change done:

1. `npm run lint`, `npm run test`, `npm run build` from root equivalents when working in a single
   package).

2. Update `README.md` if the change affects documented usage or structure.

# Part B — Conditional conventions

These apply once the corresponding capability is added to the template. Follow them at that point;
their absence today isn't a signal to avoid them.

## HTTP client usage

_Applies whenever any package needs to make outbound HTTP calls._

- Use [`got`](https://github.com/sindresorhus/got) as the HTTP client.

- Do not use `fetch`, `axios`, or `node-fetch`.

- Prefer `got.extend()` for shared base URLs, headers, and retry logic.

- Type responses with `got<ResponseType>(url, options)`.

- Catch `HTTPError` and rethrow it with contextual information.

```ts
import got, { HTTPError } from 'got';

const apiClient = got.extend({
  prefixUrl: 'https://api.example.com',
  responseType: 'json',
});

async function fetchUser(userId: string): Promise<User> {
  try {
    return await apiClient.get<User>(`users/${userId}`).json();
  } catch (error) {
    if (error instanceof HTTPError) {
      throw new Error(`Failed to fetch user ${userId}: ${error.response.statusCode}`);
    }
    throw error;
  }
}
```

## Backend / API apps

_Applies when this template is specialized into a project with an HTTP backend — e.g. a future
`apps/backend` package._

- Prefer TypeScript on Node.js for backend services.

- Validate routes using zod:

  ```typescript
  import fastify from 'fastify';
  import {
    ZodTypeProvider,
    serializerCompiler,
    validatorCompiler,
  } from 'fastify-type-provider-zod';

  const app = fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const exampleSchema = {
    body: z.object({
      name: z.string(),
      age: z.number(),
    }),
    response: {
      200: z.object({
        id: z.string(),
        name: z.string(),
      }),
    },
  };

  app.post('/user', { schema: exampleSchema }, async (req, reply) => {
    const { id, name } = await service.create(req.body);
    return { id, name };
    // Types are inferred from the Zod schema.
  });
  ```

- Keep route handlers thin and delegate business logic services

- Register a single global error handler with `app.setErrorHandler()` rather than try/catch in each
  route. It's the only place that turns an error into an HTTP response:

  ```ts
  app.setErrorHandler((error: Error, request, reply) => {
    if (error instanceof ApiError) {
      request.log.warn({ err: error, statusCode: error.statusCode }, error.message);
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }

    if ('validation' in error) {
      request.log.warn({ err: error }, 'Request validation failed');
      reply.status(400).send({ error: 'Invalid request', details: error.validation });
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    reply.status(500).send({ error: 'Internal server error' });
  });

  app.setNotFoundHandler((request, reply) => {
    request.log.warn({ url: request.url, method: request.method }, 'Route not found');
    reply.status(404).send({ error: `Route not found: ${request.method} ${request.url}` });
  });
  ```

  Always log through `request.log` (or a `.child()` of it) rather than a bare top-level logger —
  it's pre-bound with per-request context (request id, route, method), so a log line for an error
  can be traced back to the request that caused it. Pass the error under the `err` key so pino's
  default serializer expands the stack trace instead of just `error.message`.

  Async route handlers can just `throw` — Fastify awaits the handler promise and routes any
  rejection to `setErrorHandler` automatically, so no per-route try/catch is needed. Unmatched
  routes (404s) go through `app.setNotFoundHandler()` instead, which is registered separately.

- Do not introduce NestJS, Express, or other frameworks unless explicitly requested or already in
  use.

- Always configure database access via a single full connection URI (e.g. `DATABASE_URL`,
  `postgresql://user:password@host:5432/dbname`) rather than separate `DB_HOST`/`DB_PORT`/`DB_USER`/
  `DB_PASSWORD`/`DB_NAME` variables. Validate it as one `z.string().url()` (or driver-specific
  refinement) field in the zod env schema and pass it straight to the DB client/driver, which
  already accepts a URI — don't split it apart and reassemble it. A single var is easier to rotate,
  matches what most hosting providers (Render, Railway, Neon, RDS, Docker Compose, etc.) inject, and
  avoids the schema drifting out of sync with the driver's own URI parsing.

- Favor clear types, explicit interfaces, and predictable module boundaries.

- Optimize for maintainability, testability, and low operational complexity.

- Add a `.http` file for the project with examples on how to interact with the API. The format
  should be in [httpYac](https://httpyac.github.io) format

  ```http
  ### List all X Entities
  @app_token = {{$dotenv APP_TOKEN}}
  POST http://homeassistant:8123/api/services/homeassistant/reload_all
  Authorization: Bearer {{app_token}}
  Content-Type: application/json

  ### Description
  @app_token = {{$dotenv APP_TOKEN}}
  POST http://homeassistant`:8123/api/services/homeassistant/restart
  Authorization: Bearer {{hass_token}}
  Content-Type: application/json
  ```

## Frontend / Web UI apps

_Applies when this template is specialized into a fullstack project with a web UI — e.g. a future
`apps/frontend` package._

- Use React with TypeScript as the standard for all web UI work.

- Use [shadcn/ui](https://ui.shadcn.com) as the primary component library; add components via
  `npx shadcn@latest add <component>` and own the generated source in `src/components/ui/`.

- Use Tailwind CSS utility classes for all styling; avoid plain CSS files unless Tailwind cannot
  express the style.

- Use shadcn/ui's built-in CSS variables and `tailwind.config` theme extension to define colors,
  typography, and spacing consistently; do not hardcode color values.

- Design responsive layouts using Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, etc.); every
  UI must work on mobile, tablet, and desktop.

- Do not introduce MUI, Chakra UI, Ant Design, or other component libraries unless explicitly
  requested.

- Keep components small and focused on a single responsibility; move business logic into custom
  hooks or service modules.

- Use React Router for client-side routing when navigation is required. If query params are used,
  use the [`useSearchParams`](https://reactrouter.com/api/hooks/useSearchParams) hook.

- Prefer functional components and React hooks; do not use class components.

- Lift state only as far as needed; prefer local component state or context over global state
  libraries unless the app clearly requires it.

- Follow accessible HTML patterns; shadcn/ui is built on Radix UI primitives which provide ARIA
  support — supplement with explicit labels where needed.

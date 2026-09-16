# Export watch history & ratings to Letterboxd CSV (Issue #39)

## Context

GitHub Issue #39 asks for a way to export a user's movie watch history (including
rewatches) and ratings to a Letterboxd-compatible CSV, so the data can be imported into
Letterboxd. This complements the recently-added Trakt import work (`3e60072`, `5547762`)
which established `WatchHistory` as the source of truth for individual viewing events
(including rewatches) and `Rating.score` as an integer 1–10 scale (`5482674`, half-star
support via `score * 2`). This plan implements the reverse direction: reading that same
data back out in Letterboxd's diary CSV format.

Open questions were resolved with the user before planning:
- **Rating placement**: every `Rating` record always becomes its own standalone CSV row
  (`Title`/`Year`/`Rating10`, no `WatchedDate`/`Rewatch`), independent of watch history.
  Ratings are never attached to a diary/viewing row. This was simplified from an earlier
  draft that attached the rating to the most-recent viewing row — the separate-row
  approach removes the "which viewing gets the rating" bookkeeping entirely and gives
  ratings and diary rows one shared code path regardless of whether the movie was watched.
- **Unwatched-but-rated movies**: included as a rating row (empty `WatchedDate`) — this
  now falls out naturally as the same case as any other rating, no special branch needed.

## Data model (existing, no migration needed)

- `WatchEntry` (`packages/backend/prisma/schema.prisma:46`) — one row per
  `(tmdbId, userId)`, aggregate `latestWatchedAt`.
- `WatchHistory` (`schema.prisma:59`) — one row per individual viewing, FK'd via
  `watchEntryId`. This is where rewatches live.
- `Rating` (`schema.prisma:75`) — one row per `(tmdbId, userId)`, `score: Int` (1–10).
- No local `Movie` table — title/year/imdbId are fetched live from TMDB per `tmdbId` via
  `createMovieService().getMovieDetails(tmdbId)`
  (`packages/backend/src/movies/movie-service.ts`), which returns
  `{ tmdbId, title, releaseDate, externalRatings: { imdbId }, ... }`. Year is derived via
  `releaseDate.slice(0, 4)`.

No bulk "all ratings/watch history for a user" query exists yet — new Prisma calls are
needed (see below).

## Backend

### New file: `packages/backend/src/movies/export-service.ts`

Follows the existing service factory pattern (`createExportService(options?: ServiceOptions)`,
same shape as `packages/backend/src/movies/user-data-service.ts` and
`packages/backend/src/ratings/rating-service.ts`: `import { prisma } from '../lib/prisma.js'`,
`import { LOGGER } from '../registry.js'`).

Core logic in `buildLetterboxdRows(userId)`:

1. Fetch in parallel:
   `prisma.watchEntry.findMany({ where: { userId }, include: { watchHistory: { orderBy: { watchedAt: 'asc' } } } })`
   and `prisma.rating.findMany({ where: { userId } })`.
2. Resolve TMDB details for the union of all tmdbIds appearing in either result set via
   `Promise.all(ids.map(id => movieService.getMovieDetails(id)))`, catching per-movie
   failures (log + skip that movie) rather than failing the whole export.
3. **Diary rows**: for each `WatchEntry`, emit one CSV row per `WatchHistory` entry
   (already sorted ascending): `Rewatch = index > 0`, `WatchedDate` set, `Rating10` always
   empty.
4. **Rating rows**: for each `Rating`, emit one standalone CSV row: `Title`/`Year`/
   `Rating10 = score`, `WatchedDate = ''`, `Rewatch = ''` — regardless of whether the
   movie also has watch history. No cross-referencing between the two result sets needed.
5. `exportLetterboxdCsv(userId)` calls `buildLetterboxdRows` then serializes to CSV text.

Because diary rows and rating rows are independent, a watched-and-rated movie now
naturally produces both its viewing row(s) and a separate rating row — no shared state or
"is this the last viewing" tracking required.

CSV columns (fixed order): `tmdbID, Title, Year, WatchedDate, Rewatch, Rating10`.

**CSV writer**: use the [`csv-stringify`](https://csv.js.org/stringify/) library (add as a
new backend dependency) rather than hand-rolling. It's the sibling package to `csv-parse`
(already a backend dependency, same maintainer/API family), so it's a natural, convention-
consistent addition. Use its sync API (`import { stringify } from 'csv-stringify/sync'`,
mirroring the existing `import { parse } from 'csv-parse/sync'` usage in
`import-service.ts`), with `columns: CSV_HEADERS` for the header row and a custom `escape`/
`quote` config to match Letterboxd's non-standard quoting (backslash-escaped internal
quotes, per the issue's notes, rather than RFC 4180 double-double-quote escaping) — check
`csv-stringify`'s options for an `escape` override (it supports a custom escape character);
if it can't be made to produce exactly `\"` for embedded quotes, fall back to post-processing
its RFC 4180 output or configuring `quoted: true` with `escape: '\\'`.

Empty state (no watch history, no ratings) naturally produces a header-only CSV — no
special-casing required.

TV shows are excluded by construction (the query never touches `TvWatchEntry`/`TvRating`).

### Modify: `packages/backend/src/movies/movie-routes.ts`

Add `GET /export/letterboxd` (no zod schema needed — no params/query/body), placed before
the `/:tmdbId` route for readability (Fastify's router prioritizes static segments
regardless of order, but colocating avoids reader confusion):

```ts
fastify.get('/export/letterboxd', { preHandler: authenticate }, async (request, reply) => {
  const exportService = createExportService({ logger: request.log });
  const csv = await exportService.exportLetterboxdCsv(request.user.userId);
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', 'attachment; filename="letterboxd-export.csv"')
    .send(csv);
});
```

### New test file: `packages/backend/src/movies/export-service.spec.ts`

Mirror `import-service.spec.ts` conventions: `vi.mock()` for `./movie-service.js` and
`../lib/prisma.js`, `beforeEach` with `vi.resetModules()` + dynamic re-import.

Scenarios to cover:
1. Rewatch flagging across a 3-viewing `WatchHistory` (first `false`, rest `true`);
   `Rating10` empty on all diary rows.
2. Watched-and-rated movie produces its diary row(s) **plus** a separate standalone
   rating row (not merged into any diary row).
3. Rating row for a rated-but-never-watched movie (`WatchedDate`/`Rewatch` empty).
4. Watched-but-never-rated movie → no rating row emitted for it, only diary rows.
5. Multiple distinct movies don't cross-contaminate rows.
6. Empty watch history + no ratings → header-only CSV.
7. CSV escaping for titles containing commas and double quotes.
8. TMDB lookup failure for one movie → that movie's rows (diary and/or rating) are
   skipped, others unaffected.
9. Exact header row string.

## Frontend

### Modify: `packages/frontend/src/services/api-client.ts`

Export the currently-private `BASE_URL` const so it can be reused for direct navigation
(`export const BASE_URL = ...`).

### Modify: `packages/frontend/src/services/user-data-api.ts`

Add a URL builder (no fetch/blob handling needed):

```ts
export function getLetterboxdExportUrl(): string {
  return `${BASE_URL}/api/movies/export/letterboxd`;
}
```

### Modify: `packages/frontend/src/pages/profile/ProfilePage.tsx`

Add a new `Card` (matching the existing Flexget/Trakt integration card structure, same
`Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`Button` imports already
used in this file) with an "Export to Letterboxd" button that triggers
`window.location.href = getLetterboxdExportUrl()`.

**Download approach: direct navigation, not blob-fetch.** Auth is cookie-based
(`credentials: 'include'`), so a plain navigation to the same API host carries the session
cookie automatically. No existing blob/`createObjectURL`/`download=` pattern exists
anywhere in the frontend today, and `apiRequest()` can't be reused as-is since it
unconditionally calls `.json()`. Direct navigation needs zero new DOM-handling code.
Tradeoff: a failed request (expired session, 500) can't be intercepted to show a toast,
since plain navigation isn't a promise-based fetch — the browser will just show the raw
error response. Acceptable for v1 since this button only appears on an already-authenticated
page; a contained follow-up could migrate to blob-fetch later if this becomes a real
pain point.

## Edge cases handled

| Case | Handling |
|---|---|
| Comma/quote/newline in title | Quoted + backslash-escaped per Letterboxd's convention |
| No watch history, no ratings | Header-only CSV, no error |
| TV-only user data | Excluded by construction (movie tables only) |
| Movie is both watched and rated | Diary row(s) and rating row both emitted independently |
| TMDB lookup fails for a tmdbId | Skip that movie's rows, log a warning, don't fail the export |
| Missing/null `releaseDate` | `Year` emitted as `''` |
| Large watch history → many parallel TMDB calls | Accepted v1 tradeoff, consistent with existing no-batching precedent in `movie-routes.ts` |

## Verification

1. `npm --workspace packages/backend run test` — new `export-service.spec.ts` suite passes.
2. `npm run lint`, `npm run build` from root.
3. Manual end-to-end: start backend + frontend dev servers, log in as a user with some
   watch history (including a rewatch), a movie that's both watched and rated, and a
   rated-but-unwatched movie. Go to Profile page, click "Export to Letterboxd", confirm
   `letterboxd-export.csv` downloads, and open it to verify: header row present, rewatch
   rows flagged correctly, watched-and-rated movies appear as both diary row(s) and a
   separate rating row, and rating rows always have empty `WatchedDate`/`Rewatch`.
4. Optionally spot-check the file against Letterboxd's own import page (letterboxd.com/import)
   to confirm it's accepted without column errors.

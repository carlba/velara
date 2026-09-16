# Plan: Import official Trakt data dump (GHI #37)

## Context

Trakt has restricted API access for exports, so users can no longer rely on the existing
`/api/movies/import` and `/api/tv/import` flows, which expect a single combined Trakt JSON export
(matching the `TraktExport` shape in [trakt.types.ts](packages/backend/src/trakt/trakt.types.ts))
pasted or loaded as plain text. Trakt still lets users download an official "data dump" — a zip file
containing dozens of per-category JSON files (`ratings-movies-1.json`, `ratings-episodes-1.json`,
`watched-history-1.json`, etc., per the issue's file listing). We need to support importing that zip
directly, reusing as much of the existing import pipeline as possible so ratings and watch history
still land in the same `Rating`/`TvRating`/`Watch` tables via the same dedupe/resolve-tmdb-id logic
already proven out for the single-blob JSON import.

Per direction from the user: the zip will be sent as a **base64-encoded string** inside the existing
JSON request body shape (`{ content, provider, type }`), not as a `multipart/form-data` file upload.
This avoids introducing `@fastify/multipart` and keeps the frontend's existing `fetch`/`apiRequest`
JSON-body pattern in [api-client.ts](packages/frontend/src/services/api-client.ts) unchanged — only
the _content_ of `content` changes (base64 zip bytes instead of raw JSON/CSV text).

Also per direction from the user: the zip dump **replaces** the old single-blob "paste Trakt JSON
export" flow entirely for the Trakt provider — it is not an additional option alongside it. The
Filmtipset CSV import path is untouched. Concretely: `provider: 'trakt'` on `/api/movies/import` and
the entire body of `/api/tv/import` will always mean "this is a base64-encoded data-dump zip"; the
old plain-JSON-text Trakt branches (`importFromTrakt`/`importTvFromTrakt` and their JSON-string
handling) are deleted, not kept behind a flag.

## Approach

### 1. Add a zip-reading dependency

Add [`fflate`](https://github.com/101arrowz/fflate) to `packages/backend/package.json`. It's
zero-dependency, works synchronously and purely in-memory on `Uint8Array` (`unzipSync`), which fits
the base64-decode-in-memory flow — no filesystem or streaming needed, unlike `yauzl`, and lighter
than `adm-zip`.

### 2. New module: `packages/backend/src/trakt/trakt-dump-service.ts`

Responsible for turning a decoded zip buffer into the same shape `importFromTraktExport` /
`importTvFromTraktExport` already consume in
[import-service.ts](packages/backend/src/movies/import-service.ts).

- `parseTraktDump(zipBuffer: Buffer): Pick<TraktExport, 'ratings' | 'history'>`:
  - `unzipSync` the buffer.
  - Glob-match entries by filename prefix: `ratings-movies-`, `ratings-shows` (note: this one is not
    numbered — just `ratings-shows.json`), `ratings-episodes-`, `watched-history-`. Sort matched
    filenames the way `resolveInputFiles` in the issue's reference implementation does (lexical sort
    of `-1`, `-2`, ... matches numeric order for the expected range, no numeric-suffix-aware sort
    needed).
  - `JSON.parse` each matched file's contents, validate with zod schemas colocated in this file
    (`traktDumpRatingMovieSchema`, `traktDumpRatingEpisodeSchema`, `traktDumpRatingShowSchema`,
    `traktDumpHistorySchema`), modeled directly on the existing `TraktRatedMovie` /
    `TraktRatedEpisode` / `TraktRatedShow` / `TraktHistoryMovie` / `TraktHistoryEpisode` interfaces
    in [trakt.types.ts](packages/backend/src/trakt/trakt.types.ts) — the dump's per-file entries
    match those shapes directly (confirmed against the issue's sample JSON). Show ratings
    (`ratings-shows.json`) are included, matching what the existing single-blob import already does
    for `TraktRatedShow` entries.
  - Concatenate all matched-file entries into `ratings: TraktRatingEntry[]` (movies + shows +
    episodes) and `history: TraktHistoryEntry[]`.
  - Missing files are not an error (a user may only have movie ratings, no TV) — just treat as empty
    arrays; throw only if _no_ recognized files are found at all (mirrors the "no files matched"
    guard in the issue's reference `resolveInputFiles`).
  - Update `importFromTraktExport` / `importTvFromTraktExport` signatures in `import-service.ts` to
    accept `Pick<TraktExport, 'ratings' | 'history'>` instead of the full `TraktExport` (they
    already only read `.ratings` and `.history`), so no fake full `TraktExport` needs to be
    constructed.

### 3. Wire into `import-service.ts`

- Replace `importFromTrakt` / `importTvFromTrakt` with
  `importFromTraktDump(userId, zipBase64: string, options?): Promise<ImportSummary>` and
  `importTvFromTraktDump(userId, zipBase64: string, options?): Promise<ImportSummary>`:
  1. `Buffer.from(zipBase64, 'base64')`
  2. `parseTraktDump(buffer)` (catch and wrap errors the same way the existing functions catch
     `JSON.parse` failures — return `{ importedCount: 0, skippedCount: 0, errors: [...] }` rather
     than throwing, matching current error-handling style)
  3. delegate to the existing `importFromTraktExport` / `importTvFromTraktExport`.
- Delete the old JSON-string parsing bodies of `importFromTrakt` / `importTvFromTrakt` (the
  `JSON.parse(content)` + shape-check logic) — they're fully superseded, not kept as a fallback.

### 4. Route changes

- [movie-routes.ts](packages/backend/src/movies/movie-routes.ts): `importBodySchema`'s `content`
  field, when `provider === 'trakt'`, now always means "base64-encoded data-dump zip" — call
  `importFromTraktDump` instead of `importFromTrakt`. No new schema field needed since there's no
  dual-format branching; `type` stays irrelevant for the trakt provider as it already is today.
- [tv-show-routes.ts](packages/backend/src/tv-shows/tv-show-routes.ts): the `/api/tv/import` route's
  `content` is always base64 zip now — branch to `importTvFromTraktDump`.

### 5. Frontend changes

- [user-data-api.ts](packages/frontend/src/services/user-data-api.ts) /
  [user-tv-data-api.ts](packages/frontend/src/services/user-tv-data-api.ts): change
  `importTrakt(content)` / `importTvShows(content)` to take the base64 zip string — same function
  signatures and POST shape (`{ content, provider: 'trakt', type: 'ratings' }` / `{ content }`),
  just document that `content` is now base64 zip bytes, not raw JSON text.
- [ProfilePage.tsx](packages/frontend/src/pages/profile/ProfilePage.tsx): for the Trakt provider,
  replace the paste-JSON `Textarea` + plain file input with a single `.zip`/`application/zip` file
  input (no format choice, no textarea — zip is the only supported input now). On file selection,
  read as `ArrayBuffer` and base64-encode it (chunked `btoa(String.fromCharCode(...))` to avoid
  call-stack limits on large files) instead of `file.text()`. Keep the Filmtipset CSV
  textarea/file-input path exactly as-is. Reuse the existing summary-display UI
  (`summary`/`tvSummary` state, same result cards) for both the movie-data card and the TV-data
  card.

### 6. Tests

- `packages/backend/src/trakt/trakt-dump-service.spec.ts`: build a small in-memory zip fixture
  (using `fflate.zipSync`) with a couple of `ratings-movies-1.json` / `ratings-episodes-1.json`
  entries matching the issue's sample JSON, assert `parseTraktDump` returns the expected
  `ratings`/`history` arrays; cover missing-files and malformed-JSON error paths.
- Extend `packages/backend/src/movies/import-service.spec.ts` with cases for
  `importFromTraktDump`/`importTvFromTraktDump` (valid zip, corrupt base64, empty zip).

## Verification

1. `pnpm --filter @carlba/backend run lint && pnpm --filter @carlba/backend run test`
2. `pnpm --filter @carlba/frontend run lint && pnpm --filter @carlba/frontend run test`
3. `pnpm run build` from root.
4. Manual: start the app (`/run` or existing dev script), go to Profile page, select a real or
   hand-built Trakt data-dump zip for the Trakt provider, confirm the import summary shows imported
   ratings/history counts and the movie/TV pages reflect the new ratings.

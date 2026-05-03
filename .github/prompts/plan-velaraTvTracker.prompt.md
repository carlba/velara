# Plan: Introduce TV Shows

## TL;DR

Add full TV show support as a parallel domain alongside movies. New dedicated DB tables (no
collision with movie tables), TMDB+OMDB data, episode-level watch tracking, season+show-level
ratings, reviews and comments at show level. Separate /tv frontend routes. Extend Trakt import for
TV.

---

## Decisions

- **Tracking granularity**: Episode-level watch tracking; season + show-level ratings; reviews +
  comments at show level
- **External data**: TMDB (primary) + OMDB (external ratings enrichment) — same pattern as movies
- **UI**: Separate `/tv` and `/tv/:seriesId` routes, separate pages/components
- **DB strategy**: New dedicated TV tables (no modifying existing movie tables) to avoid tmdbId
  namespace collision
- **Trakt import**: Extended to import TV show ratings and episode watch history
- **TvRating**: Use `seasonNumber = 0` as convention for show-level rating; non-nullable with unique
  `[seriesTmdbId, seasonNumber, userId]`

---

## Phase 1: Database Schema

Add 4 new Prisma models in `packages/backend/prisma/schema.prisma`:

1. **TvWatchEntry** — tracks individual episodes watched
   - `id`, `seriesTmdbId: String`, `seasonNumber: Int`, `episodeNumber: Int`, `userId`, `watchedAt`,
     `source`, `createdAt`
   - Unique: `[seriesTmdbId, seasonNumber, episodeNumber, userId]`
   - Cascade delete on User

2. **TvRating** — show-level (seasonNumber=0) or season-level rating
   - `id`, `seriesTmdbId: String`, `seasonNumber: Int (default 0)`, `userId`, `score: Int`,
     `source`, `ratedAt`, `createdAt`, `updatedAt`, `importedAt?`
   - Unique: `[seriesTmdbId, seasonNumber, userId]`
   - Cascade delete on User

3. **TvReview** — show-level review
   - `id`, `seriesTmdbId: String`, `userId`, `content: String`, `createdAt`, `updatedAt`
   - Unique: `[seriesTmdbId, userId]`
   - Cascade delete on User

4. **TvComment** — show-level comments
   - `id`, `seriesTmdbId: String`, `userId`, `content: String`, `createdAt`, `updatedAt`,
     `importedAt?`
   - Index on `seriesTmdbId`
   - Cascade delete on User

After schema changes: `cd packages/backend && npm run db:generate` +
`npx prisma migrate dev --name add_tv_shows`

---

## Phase 2: Backend — TV Show Service Layer

New folder: `packages/backend/src/tv-shows/`

### tv-show-types.ts

- `TvShowListItem` — seriesTmdbId, name, posterPath, backdropPath, voteAverage, voteCount,
  firstAirDate, overview
- `TvShowDetail` — extends TvShowListItem + genres, number_of_seasons, number_of_episodes,
  externalRatings, status, networks, imdbId, urls
- `TvSeason` — seasonNumber, name, episodeCount, airDate, posterPath, episodes[]
- `TvEpisode` — episodeNumber, name, overview, airDate, runtime, stillPath
- `UserTvData` — watchEntries: TvWatchEntry[], showRating?, seasonRatings: Record<number, TvRating>,
  review?

### tv-show-service.ts

Analogous to `movie-service.ts`:

- `searchTvShows(query, page)` — TMDB `/search/tv`
- `discoverTvShows(sortBy, page)` — TMDB `/discover/tv`
- `getTvShowById(seriesTmdbId)` — TMDB `/tv/{id}` with external_ids appended
- `getTvShowDetails(seriesTmdbId)` — Full details + OMDB enrichment via IMDb ID (same pattern as
  `getMovieDetails`)
- `getTvSeason(seriesTmdbId, seasonNumber)` — TMDB `/tv/{id}/season/{n}` with episode list
- `mapTvListItem()` — transform TMDB result to TvShowListItem

### tv-watch-service.ts

- `markEpisodeWatched(seriesTmdbId, seasonNumber, episodeNumber, userId, watchedAt, source)` —
  upsert
- `unmarkEpisodeWatched(seriesTmdbId, seasonNumber, episodeNumber, userId)` — delete
- `getWatchEntriesForSeries(seriesTmdbId, userId)` — all episodes watched for a series
- `createWatchEntryIfMissing(...)` — for import deduplication

### tv-rating-service.ts

- `upsertTvRating(seriesTmdbId, seasonNumber=0, userId, score, ratedAt?, importedAt?, source)` —
  upsert
- `deleteTvRating(seriesTmdbId, seasonNumber, userId)` — delete
- `getTvRatingsForSeries(seriesTmdbId, userId)` — all ratings for a series (show + seasons)

### tv-review-service.ts

- `upsertTvReview(seriesTmdbId, userId, content)` — upsert
- `deleteTvReview(seriesTmdbId, userId)` — delete

### tv-comment-service.ts

- `getCommentsForSeries(seriesTmdbId)` — ordered by newest first, include user metadata
- `createComment(seriesTmdbId, userId, content, createdAt?, importedAt?)` — create
- `deleteComment(seriesTmdbId, commentId, userId)` — delete (validates ownership)

### tv-user-data-service.ts

- `getFilteredSeriesTmdbIds(userId, filters, sortBy?)` — same pattern as `getFilteredTmdbIds` in
  movie domain; queries TvRating, TvWatchEntry, TvReview, TvComment
- `getUserTvData(seriesTmdbId, userId)` — aggregated user data for a series

### tv-show-routes.ts

Routes under `/api/tv`:

| Method | Endpoint                                 | Auth     | Purpose                                                                 |
| ------ | ---------------------------------------- | -------- | ----------------------------------------------------------------------- |
| GET    | `/`                                      | —        | List/search TV shows (search, page, sort_by, user_filter)               |
| GET    | `/:seriesId`                             | —        | TV show details                                                         |
| GET    | `/:seriesId/season/:seasonNumber`        | optional | Season details + episode list                                           |
| GET    | `/:seriesId/user-data`                   | ✓        | User's ratings, review, watch entries                                   |
| GET    | `/:seriesId/comments`                    | —        | All show comments                                                       |
| POST   | `/:seriesId/comments`                    | ✓        | Create comment                                                          |
| DELETE | `/:seriesId/comments/:commentId`         | ✓        | Delete comment                                                          |
| PUT    | `/:seriesId/rating`                      | ✓        | Set show-level rating (seasonNumber=0)                                  |
| DELETE | `/:seriesId/rating`                      | ✓        | Remove show-level rating                                                |
| PUT    | `/:seriesId/season/:seasonNumber/rating` | ✓        | Set season rating                                                       |
| DELETE | `/:seriesId/season/:seasonNumber/rating` | ✓        | Remove season rating                                                    |
| PUT    | `/:seriesId/review`                      | ✓        | Create/update review                                                    |
| DELETE | `/:seriesId/review`                      | ✓        | Delete review                                                           |
| PUT    | `/:seriesId/watch`                       | ✓        | Mark episode watched: body `{ seasonNumber, episodeNumber, watchedAt }` |
| DELETE | `/:seriesId/watch`                       | ✓        | Unmark episode: body `{ seasonNumber, episodeNumber }`                  |

---

## Phase 3: Extend Trakt Import

Update `packages/backend/src/movies/import-service.ts`:

- In `importFromTrakt()`, add processing for:
  - `traktExport.ratings` entries where `type === 'show'` → upsert TvRating (seasonNumber=0) using
    `show.ids.tmdb`
  - `traktExport.history` entries where `type === 'episode'` → create TvWatchEntry using
    `show.ids.tmdb` + `episode.season` + `episode.number`
- Add `resolveTraktTvSeriesTmdbId(show)` helper — uses `show.ids.tmdb` directly (no IMDb lookup
  needed since Trakt provides TMDB IDs for TV)
- Update `TraktExport` type in `trakt.types.ts` to include TV-specific fields if not already present

---

## Phase 4: Register TV Routes

Update `packages/backend/src/index.ts`:

- Import `tvRoutes` from `tv-shows/tv-show-routes.ts`
- Register: `app.register(tvRoutes, { prefix: '/api/tv' })`

---

## Phase 5: Frontend — Types & Services

### types/tv-show.ts (new)

- `TvShowListItem`, `TvShowDetail`, `TvSeason`, `TvEpisode`
- `UserTvData` — showRating?, seasonRatings, watchedEpisodes: Set of "s{n}e{n}" keys, review?
- `TvSortBy` — 'popularity' | 'rating' | 'watched_date' | 'my_rating'
- `TvUserFilter` — 'rated' | 'watched' | 'reviewed' | 'commented'

### services/tv-shows-api.ts (new)

- `fetchTvShows(params)` — search, page, sort, filter
- `fetchTvShowDetail(seriesId)` — full show details
- `fetchTvSeason(seriesId, seasonNumber)` — season + episodes

### services/user-tv-data-api.ts (new)

- `fetchUserTvData(seriesId)` — get user data for show
- `updateTvRating(seriesId, score)` / `removeTvRating(seriesId)` — show-level
- `updateTvSeasonRating(seriesId, seasonNumber, score)` /
  `removeTvSeasonRating(seriesId, seasonNumber)` — season-level
- `updateTvReview(seriesId, content)` / `removeTvReview(seriesId)`
- `markEpisodeWatched(seriesId, seasonNumber, episodeNumber, watchedAt)` /
  `unmarkEpisodeWatched(...)`

### services/tv-comments-api.ts (new)

- `fetchTvComments(seriesId)` / `createTvComment(seriesId, content)` /
  `deleteTvComment(seriesId, commentId)`

---

## Phase 6: Frontend Hooks

- `hooks/useTvShows.ts` — React Query wrapper for `fetchTvShows`, cache key `['tv-shows', params]`,
  5-min stale
- `hooks/useTvShowDetails.ts` — dual queries: show details (10-min cache) + user data (0 stale,
  auth-gated)
- `hooks/useTvSeason.ts` — season details query, cache key `['tv-season', seriesId, seasonNumber]`
- `hooks/useUserTvData.ts` — mutations for all ratings/review/watch actions with toast feedback +
  cache invalidation
- `hooks/useTvComments.ts` — comments query + add/remove mutations

---

## Phase 7: Frontend Components

New folder: `packages/frontend/src/components/tv-shows/`

- `TvShowCard.tsx` — mirrors MovieCard; shows poster, name, year, TMDB rating; links to
  `/tv/:seriesId`
- `TvShowGrid.tsx` — mirrors MovieGrid; responsive grid, skeleton loading
- `EpisodeRow.tsx` — episode number, name, air date, runtime, watch toggle button; shows "watched"
  state
- `SeasonSection.tsx` — collapsible season header (poster, name, episode count, season rating
  stars), renders EpisodeRow list

---

## Phase 8: Frontend Pages

### pages/tv-shows/TvShowsPage.tsx (new)

- Mirrors MoviesPage: search, sort, filter, pagination
- Uses TvShowGrid + TvShowCard
- Separate sort options: popularity, rating (no watched_date/my_rating unless filter active)

### pages/tv-show-details/TvShowDetailsPage.tsx (new)

- Hero section: backdrop, poster, title, status, genres, first air date, network
- External ratings badges (TMDB, IMDB, RT) — same pattern as MovieDetailsPage
- Show-level: watch (overall progress info), rating (StarRating), review textarea
- Comments section — same as movie details
- Seasons list: SeasonSection components with EpisodeRow children
  - Season-level star rating
  - Episode-level watch toggles

---

## Phase 9: Routing & Navigation

- Update `packages/frontend/src/App.tsx`: add routes `/tv` → TvShowsPage and `/tv/:seriesId` →
  TvShowDetailsPage
- Update `packages/frontend/src/components/layout/Header.tsx`: add "TV Shows" nav link alongside
  "Movies"

---

## Relevant Files (to create or modify)

**Create (Backend):**

- `packages/backend/src/tv-shows/tv-show-types.ts`
- `packages/backend/src/tv-shows/tv-show-service.ts`
- `packages/backend/src/tv-shows/tv-watch-service.ts`
- `packages/backend/src/tv-shows/tv-rating-service.ts`
- `packages/backend/src/tv-shows/tv-review-service.ts`
- `packages/backend/src/tv-shows/tv-comment-service.ts`
- `packages/backend/src/tv-shows/tv-user-data-service.ts`
- `packages/backend/src/tv-shows/tv-show-routes.ts`

**Modify (Backend):**

- `packages/backend/prisma/schema.prisma` — add 4 new models
- `packages/backend/src/movies/import-service.ts` — extend Trakt importer for TV
- `packages/backend/src/trakt.types.ts` — add TV-specific Trakt export types if missing
- `packages/backend/src/index.ts` — register TV routes

**Create (Frontend):**

- `packages/frontend/src/types/tv-show.ts`
- `packages/frontend/src/services/tv-shows-api.ts`
- `packages/frontend/src/services/user-tv-data-api.ts`
- `packages/frontend/src/services/tv-comments-api.ts`
- `packages/frontend/src/hooks/useTvShows.ts`
- `packages/frontend/src/hooks/useTvShowDetails.ts`
- `packages/frontend/src/hooks/useTvSeason.ts`
- `packages/frontend/src/hooks/useUserTvData.ts`
- `packages/frontend/src/hooks/useTvComments.ts`
- `packages/frontend/src/components/tv-shows/TvShowCard.tsx`
- `packages/frontend/src/components/tv-shows/TvShowGrid.tsx`
- `packages/frontend/src/components/tv-shows/EpisodeRow.tsx`
- `packages/frontend/src/components/tv-shows/SeasonSection.tsx`
- `packages/frontend/src/pages/tv-shows/TvShowsPage.tsx`
- `packages/frontend/src/pages/tv-show-details/TvShowDetailsPage.tsx`

**Modify (Frontend):**

- `packages/frontend/src/App.tsx` — add `/tv` and `/tv/:seriesId` routes
- `packages/frontend/src/components/layout/Header.tsx` — add TV Shows nav link

---

## Verification

1. `cd packages/backend && npx prisma migrate dev --name add_tv_shows` — apply new schema
2. `cd packages/backend && npm run db:generate` — regenerate Prisma client
3. `npm run build` from workspace root — verify TypeScript compilation across both packages
4. `npm run lint` — verify no lint errors
5. `npm test` — ensure existing movie tests still pass
6. Manual: search for a TV show (e.g., "Breaking Bad"), view detail page, mark episodes as watched,
   set a season rating, leave a comment
7. Manual: import a Trakt export that includes TV show ratings and episode history, verify data
   appears correctly

---

## Explicitly Out of Scope

- Per-episode ratings (only show + season level)
- Reviews/comments at season or episode level (show level only)
- Filmtipset import for TV (Filmtipset is a movie-only site)
- Push notifications for new episodes
- "Continue watching" / progress tracking UI

# History View (GitHub Issue #41)

## Context

Velara currently lets users track movies and TV episodes as watched, but there's no unified place
to browse *when* things were watched. Watch history data already exists and is populated from
multiple sources (manual marking, Trakt import, Plex webhooks, Filmtipset import) via the
`WatchHistory` / `TvWatchHistory` tables — but it's only ever queried scoped to a single movie or
series (`getUserMovieData`). Issue #41 asks for a dedicated "History" section in the main nav that
shows a chronological, poster-based view of everything a user has watched, grouped by day, with
the ability to filter by movies/shows and delete individual records.

**Clarified scope (confirmed with user):**

- Show the last 30 days by default; support paging further back into older history (not a hard
  cutoff).

- "Delete a history record" means a hard delete of that single watch event, not the whole
  watched-status for that title.

- No per-source badges (Trakt/Plex/manual) — uniform display.

- Movies and episodes watched on the same day are mixed into one chronological list per day (not
  split into sub-sections).

- One card per episode — no collapsing multiple same-day episodes of a show into one entry.

- The History nav link is always visible (matches how "Lists" behaves today); logged-out users see
  a sign-in prompt on the page itself, reusing `ListsPage.tsx`'s existing pattern.

- Deleting a record requires a confirm step via a new shadcn `AlertDialog` component (not yet
  installed in this repo).

## Backend design

### New domain: `packages/backend/src/history/`

- `history-types.ts` — zod schemas + response types for the list and delete endpoints.

- `history-service.ts` — `createHistoryService()`: `getHistoryPage`, `deleteMovieHistoryRecord`,
  `deleteEpisodeHistoryRecord`.

- `history-routes.ts` — `historyRoutes` (`FastifyPluginCallbackZod`), registered at `/api/history`
  in `packages/backend/src/index.ts` alongside the existing route registrations.

### `GET /api/history` — cursor-paginated, flat, sorted list

Query params: `type: 'movies' | 'shows' | 'both'` (default `both`), `before?: string` (ISO
datetime, exclusive upper bound), `limit` (default 30, max 100). `preHandler: authenticate`.

**Pagination — cursor-based on `watchedAt`, not offset.** The result set merges two independent
tables (`WatchHistory`, `TvWatchHistory`) sorted by `watchedAt desc`; there's no single query that
offset-paginates across both without raw SQL `UNION ALL`, which would break from this codebase's
zod-at-the-boundary/Prisma-only conventions. A `before` cursor is also stable under concurrent
inserts (a new Trakt/Plex sync landing mid-scroll won't skip or duplicate rows), which offset
pagination isn't.

Per page: fetch `limit` rows from **each** table independently (`watchedAt < before`, ordered
`watchedAt desc, id desc`), merge the up-to-`2*limit` candidates in memory, sort, slice to `limit`.
`nextCursor` = `watchedAt` of the last item in the slice; `hasMore = movieRows.length === limit ||
tvRows.length === limit`. This slightly over-fetches (up to 2x) but stays correct and simple; given
this is a personal-tracker's per-user data volume, that's an acceptable tradeoff over adding a
denormalized history table.

There's no explicit "30 day" filter in the backend at all — the first call (no `before`) just
returns the most recent `limit` items, which in practice covers roughly the last month for an
active user. "Load more" is simply calling the same endpoint again with `before: nextCursor`. This
keeps the 30-day acceptance criterion and the "page further back" requirement served by one simple
mechanism instead of two.

**Metadata batching (avoid N+1 against TMDB):**

1. Collect distinct `tmdbId`s (movies) and distinct `seriesTmdbId`s (shows) from the page's rows.

2. Batch-fetch via `movieService.getMovieById` / `tvShowService.getTvShowById`, once per distinct
   id, in parallel (`Promise.all`) — reuse these existing functions, don't reimplement TMDB
   fetching.

3. For episode stills/names, TMDB only exposes these via a season-level fetch. Collect distinct
   `(seriesTmdbId, seasonNumber)` pairs and batch-fetch seasons (existing `tv-show-service.ts`
   season fetch), then look up each episode by number from the returned `episodes[]`.

4. Build `Map`-based lookups and assemble each row's display fields from them.

5. If a TMDB fetch for a given id fails (404/removed title), catch per-id, log via
   `request.log.warn`, and fall back to `posterPath: null` / a placeholder title for just that
   row — don't fail the whole page.

**Response shape — flat list, not pre-grouped by day.** Day-boundary grouping is a timezone-display
concern (a row stored in UTC needs to bucket by the *viewer's local* day), which belongs on the
frontend where `Date` is timezone-aware. Grouping server-side would also force awkward split-day
pages at the `limit` boundary.

```ts
const historyItemSchema = z.object({
  historyId: z.number(),
  mediaType: z.enum(['movie', 'episode']),
  watchedAt: z.string().datetime(),
  tmdbId: z.number().optional(),
  title: z.string(),
  posterPath: z.string().nullable(),
  releaseYear: z.number().nullable().optional(),
  seriesTmdbId: z.string().optional(),
  seriesName: z.string().optional(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
  episodeName: z.string().optional(),
  stillPath: z.string().nullable().optional(),
});

const historyResponseSchema = z.object({
  items: z.array(historyItemSchema),
  nextCursor: z.string().datetime().nullable(),
  hasMore: z.boolean(),
});
```

`historyId` collides across the two source tables (a `WatchHistory.id` and `TvWatchHistory.id` can
both be `5`), so treat `(mediaType, historyId)` as the composite key everywhere — React list keys,
the delete endpoint, cache invalidation.

### `DELETE /api/history/:type/:id` — single-record hard delete + recompute

`type: 'movie' | 'episode'`, `id` = the `WatchHistory.id` or `TvWatchHistory.id`. `preHandler:
authenticate`. 204 on success, 404 if the row doesn't exist or doesn't belong to the caller.

Neither `watch-service.ts` nor `tv-watch-service.ts` currently supports deleting a single history
row — both only expose whole-entry deletion (`deleteWatchEntry`/`unmarkEpisodeWatched`, which wipe
*all* history for that title). New methods on `history-service.ts` (colocated with the new
"read side" logic rather than bolted onto the existing add-watch-focused services):

```ts
async function deleteMovieHistoryRecord(historyId: number, userId: number): Promise<void> {
  await prisma.$transaction(async tx => {
    const record = await tx.watchHistory.findUnique({ where: { id: historyId } });
    if (!record || record.userId !== userId) {
      throw new HttpError('History record not found', { statusCode: 404 });
    }

    await tx.watchHistory.delete({ where: { id: historyId } });

    const remaining = await tx.watchHistory.findMany({
      where: { watchEntryId: record.watchEntryId },
      orderBy: { watchedAt: 'desc' },
      take: 1,
    });

    if (remaining.length === 0) {
      await tx.watchEntry.delete({ where: { id: record.watchEntryId } });
    } else {
      await tx.watchEntry.update({
        where: { id: record.watchEntryId },
        data: { latestWatchedAt: remaining[0].watchedAt, source: remaining[0].source },
      });
    }
  });
}
```

Mirror `deleteEpisodeHistoryRecord` against `tvWatchHistory`/`tvWatchEntry`. The transaction matters
because read-check → delete → recompute-or-cascade-delete must be atomic (a double-click or a
concurrent new watch landing mid-sequence could otherwise leave `latestWatchedAt` stale or crash a
second delete attempt). This is the first use of `prisma.$transaction` in the codebase — standard
Prisma practice, introduced here because the existing single-statement service methods never needed
it before.

## Frontend design

### New/changed files

- `packages/frontend/src/types/history.ts` — `HistoryItem`, `HistoryResponse`, `HistoryTypeFilter`.

- `packages/frontend/src/services/history-api.ts` — `fetchHistory(params)`,
  `deleteHistoryRecord(type, id)`, built on the existing `apiRequest<T>()` wrapper
  (`services/api-client.ts`).

- `packages/frontend/src/hooks/useHistory.ts` — `useInfiniteQuery` wrapper + a delete mutation hook.

- `packages/frontend/src/pages/history/HistoryPage.tsx` — page shell: toggle, day-grouped list,
  load-more, sign-in prompt when logged out (mirror `ListsPage.tsx`'s existing pattern for this).

- `packages/frontend/src/components/history/HistoryTypeToggle.tsx` — Movies/Shows toggle buttons.

- `packages/frontend/src/components/history/HistoryDayGroup.tsx` — one date heading + its grid.

- `packages/frontend/src/components/history/HistoryCard.tsx` — one poster card (movie or episode)
  with a delete button that opens the confirm dialog.

- `packages/frontend/src/components/ui/alert-dialog.tsx` — new shadcn primitive, added via
  `npx shadcn@latest add alert-dialog`.

- `packages/frontend/src/components/layout/Header.tsx` — add a History nav link (History icon from
  `lucide-react`) between Lists and ThemeToggle, always visible, following the exact existing
  `Button variant="ghost" size="sm" asChild` + `Link` + `hidden sm:inline` pattern.

- `packages/frontend/src/App.tsx` — add `<Route path="history" element={<HistoryPage />} />`.

### Data fetching & grouping

```ts
export function useHistory(type: HistoryTypeFilter) {
  return useInfiniteQuery({
    queryKey: ['history', type],
    queryFn: ({ pageParam }) => fetchHistory({ type, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => (lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined),
  });
}
```

Flatten `data.pages.flatMap(p => p.items)`, then group by **local** calendar day in a `useMemo`
(derive the key from `getFullYear/getMonth/getDate`, not the raw UTC ISO string, so a late-night
watch buckets under the viewer's actual day). Preserve encounter order since the source list is
already sorted descending. Heading labels: "Today", "Yesterday", else e.g. "Wednesday, September 10".

The Movies/Shows toggle is a single `?type=movies|shows|both` URL param (closer to
`parseUrlSortParam`'s single-value pattern than the comma-joined multi-value
`buildUrlSearchParams`/`parseUrlFilterParam` helpers, which don't fit a 3-state single field
cleanly). Disallow deselecting both — clicking the second active toggle off is a no-op, since an
empty history view isn't useful. Changing `type` naturally resets the infinite query because it's
part of `queryKey`.

### Cards

- **Movie card**: reuses `MovieCard.tsx`'s visual treatment (`aspect-[2/3]`, gradient overlay,
  title/year), links to `/movies/${item.tmdbId}`.

- **Episode card**: poster prefers the episode still (`stillPath`, `w300`, cropped via
  `object-cover` into the same `aspect-[2/3]` slot as movies for grid uniformity), falling back to
  the series poster when no still exists. Shows series name + `S{season}E{episode}` (style matches
  `TvShowDetailsPage.tsx`'s existing history rows). Links to `/tv/${item.seriesTmdbId}` (confirmed
  route: `tv/:seriesId` in `App.tsx` — there's no per-episode detail page, so the series page is
  the correct target).

- **Delete button**: small `Button variant="destructive" size="icon"` with a `Trash2` icon,
  absolutely positioned on the card. Visible on hover on desktop; kept at reduced opacity (not
  fully hidden) by default so touch users without hover can still find it. Clicking opens the new
  `AlertDialog` to confirm before calling the delete mutation — irreversible hard delete warrants
  the explicit confirm.

### Delete mutation

Matches the existing `useUserMovieData.ts` mutation pattern (`useMutation` + sonner `toast` +
`queryClient.invalidateQueries`):

```ts
const deleteRecord = useMutation({
  mutationFn: (item: HistoryItem) =>
    deleteHistoryRecord(item.mediaType === 'movie' ? 'movie' : 'episode', item.historyId),
  onSuccess: () => {
    toast.success('Removed from history');
    void queryClient.invalidateQueries({ queryKey: ['history'] });
  },
  onError: () => toast.error('Failed to remove history record'),
});
```

Invalidate the `['history']` prefix (not the specific `type`) so switching the toggle afterward
doesn't surface stale cached data.

### Load more

A centered "Load older history" `Button` (`disabled={!hasNextPage || isFetchingNextPage}`,
`onClick={() => fetchNextPage()}`) rather than scroll-triggered infinite loading — this matches
`MoviesPage.tsx`'s existing explicit pagination convention (no `IntersectionObserver`-based
infinite scroll exists anywhere in this codebase yet) and gives users clear control over an action
that also triggers several batched TMDB fetches. The cursor-based API supports switching to true
infinite scroll later without any backend changes, if wanted.

## Verification

1. `npm run lint`, `npm run test`, `npm run build` from root.

2. `npm run db:migrate` if the schema needs any changes (none anticipated — no new tables/columns,
   only new queries against existing `WatchHistory`/`TvWatchHistory`).

3. Manual walkthrough via `npm run start:dev`:
   - Log in, visit `/history` — see the "History" nav link, confirm day-grouped posters render for
     recent movie/episode watches.
   - Toggle Movies-only / Shows-only / both, confirm the list and URL param update correctly.
   - Click "Load older history" and confirm it fetches further back without duplicating or
     skipping entries (check against known watch dates).
   - Delete a record, confirm the `AlertDialog` appears, confirm it disappears from the list on
     confirm, and that the underlying movie/show's "watched" status is unaffected unless that was
     the only watch event (in which case confirm the watched status clears).
   - Visit `/history` while logged out, confirm the sign-in prompt matches `ListsPage`'s pattern.

4. Update `README.md` if the documented feature list should mention History.

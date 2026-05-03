import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MovieSearch from '@/components/movies/MovieSearch';
import MovieGrid from '@/components/movies/MovieGrid';
import { useMovies } from '@/hooks/useMovies';
import { useAuth } from '@/hooks/useAuth';
import { buildUrlSearchParams, parseUrlFilterParam, parseUrlSortParam } from '@/lib/query-params';
import type { SortBy, UserFilter } from '@/types/movie';

const DEBOUNCE_MS = 400;
const DEFAULT_MOVIE_SORT: SortBy = 'popularity';
const ALLOWED_MOVIE_FILTERS = ['rated', 'watched', 'reviewed', 'commented'] as const;
const ALLOWED_MOVIE_SORTS = ['popularity', 'rating', 'watched_date', 'my_rating'] as const;

export default function MoviesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>(() =>
    parseUrlSortParam(searchParams, 'sort', ALLOWED_MOVIE_SORTS, DEFAULT_MOVIE_SORT)
  );
  const [userFilters, setUserFilters] = useState<UserFilter[]>(() =>
    parseUrlFilterParam(searchParams, 'filter', ALLOWED_MOVIE_FILTERS)
  );
  const [page, setPage] = useState(1);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const tmdbIdMatch = /^\d+$/.test(debouncedSearch.trim())
    ? Number(debouncedSearch.trim())
    : undefined;
  const textSearch = tmdbIdMatch === undefined ? debouncedSearch.trim() : undefined;

  const { data, isLoading, isFetching } = useMovies({
    search: textSearch,
    tmdbId: tmdbIdMatch,
    page,
    sortBy,
    userFilters,
  });

  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        setDebouncedSearch(value);
        setPage(1);
      }, DEBOUNCE_MS);
      setDebounceTimer(timer);
    },
    [debounceTimer]
  );

  useEffect(() => {
    const nextSortBy = parseUrlSortParam(
      searchParams,
      'sort',
      ALLOWED_MOVIE_SORTS,
      DEFAULT_MOVIE_SORT
    );
    const nextUserFilters = parseUrlFilterParam(searchParams, 'filter', ALLOWED_MOVIE_FILTERS);

    if (nextSortBy !== sortBy) {
      setSortBy(nextSortBy);
    }

    if (
      nextUserFilters.length !== userFilters.length ||
      nextUserFilters.some((value, index) => userFilters[index] !== value)
    ) {
      setUserFilters(nextUserFilters);
    }
  }, [searchParams, sortBy, userFilters]);

  const handleSortChange = (sort: SortBy) => {
    setSortBy(sort);
    setPage(1);
    setSearchParams(
      buildUrlSearchParams(searchParams, 'filter', 'sort', userFilters, sort, DEFAULT_MOVIE_SORT),
      { replace: true }
    );
  };

  const handleFilterChange = (filter: UserFilter) => {
    const isRemoving = userFilters.includes(filter);
    const nextFilters = isRemoving
      ? userFilters.filter(f => f !== filter)
      : [...userFilters, filter];

    let nextSortBy = sortBy;
    if (isRemoving) {
      if (filter === 'watched' && sortBy === 'watched_date') {
        nextSortBy = DEFAULT_MOVIE_SORT;
      }
      if (filter === 'rated' && sortBy === 'my_rating') {
        nextSortBy = DEFAULT_MOVIE_SORT;
      }
    }

    setUserFilters(nextFilters);
    setSortBy(nextSortBy);
    setPage(1);
    setSearchParams(
      buildUrlSearchParams(
        searchParams,
        'filter',
        'sort',
        nextFilters,
        nextSortBy,
        DEFAULT_MOVIE_SORT
      ),
      { replace: true }
    );
  };

  const totalPages = data?.total_pages ?? 1;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Movies</h1>
        <p className="text-muted-foreground">Discover and track movies from TMDB</p>
      </div>

      <MovieSearch
        onSearch={handleSearch}
        onSortChange={handleSortChange}
        sortBy={sortBy}
        defaultValue={searchInput}
        userFilters={userFilters}
        onFilterChange={user ? handleFilterChange : undefined}
      />

      <MovieGrid movies={data?.results ?? []} isLoading={isLoading || isFetching} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isFetching}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

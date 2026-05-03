import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import TvShowGrid from '@/components/tv-shows/TvShowGrid';
import { useTvShows } from '@/hooks/useTvShows';
import { useAuth } from '@/hooks/useAuth';
import type { TvSortBy, TvUserFilter } from '@/types/tv-show';

const DEBOUNCE_MS = 400;

const USER_FILTER_LABELS: Record<TvUserFilter, string> = {
  rated: 'Rated by me',
  watched: 'Watched by me',
  reviewed: 'Reviewed by me',
  commented: 'Commented by me',
};

export default function TvShowsPage() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<TvSortBy>('popularity');
  const [userFilters, setUserFilters] = useState<TvUserFilter[]>([]);
  const [page, setPage] = useState(1);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const textSearch = debouncedSearch.trim() || undefined;

  const { data, isLoading, isFetching } = useTvShows({
    search: textSearch,
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

  const handleSortChange = (sort: TvSortBy) => {
    setSortBy(sort);
    setPage(1);
  };

  const handleFilterChange = (filter: TvUserFilter) => {
    const isRemoving = userFilters.includes(filter);
    setUserFilters(current =>
      isRemoving ? current.filter(f => f !== filter) : [...current, filter]
    );
    if (isRemoving) {
      if (filter === 'watched' && sortBy === 'watched_date') setSortBy('popularity');
      if (filter === 'rated' && sortBy === 'my_rating') setSortBy('popularity');
    }
    setPage(1);
  };

  const totalPages = data?.total_pages ?? 1;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">TV Shows</h1>
        <p className="text-muted-foreground">Discover and track TV shows from TMDB</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search TV shows by title…"
              className="pl-9"
              value={searchInput}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          <Select value={sortBy} onValueChange={v => handleSortChange(v as TvSortBy)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popularity">Most Popular</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="watched_date" disabled={!userFilters.includes('watched')}>
                My Watched Date
              </SelectItem>
              <SelectItem value="my_rating" disabled={!userFilters.includes('rated')}>
                My Highest Rated
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {user && (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(USER_FILTER_LABELS) as TvUserFilter[]).map(filter => (
              <Button
                key={filter}
                variant={userFilters.includes(filter) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange(filter)}>
                {USER_FILTER_LABELS[filter]}
              </Button>
            ))}
          </div>
        )}
      </div>

      <TvShowGrid shows={data?.results ?? []} isLoading={isLoading || isFetching} />

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

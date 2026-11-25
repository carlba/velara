import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from './useDebouncedValue';
import { toMovieResults, toSeriesResults } from '@/lib/list-items';
import { fetchMovies } from '@/services/movies-api';
import { fetchTvShows } from '@/services/tv-shows-api';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_STALE_TIME_MS = 5 * 60 * 1000;

export function useTitleSearch(input: string) {
  const term = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS);
  // Checking the raw input too hides old results as soon as the field is cleared.
  const hasTerm = input.trim() !== '' && term !== '';

  const movieQuery = useQuery({
    queryKey: ['title-search', 'movie', term],
    queryFn: () => fetchMovies({ search: term, page: 1 }),
    enabled: hasTerm,
    placeholderData: keepPreviousData,
    staleTime: SEARCH_STALE_TIME_MS,
  });

  const seriesQuery = useQuery({
    queryKey: ['title-search', 'series', term],
    queryFn: () => fetchTvShows({ search: term, page: 1 }),
    enabled: hasTerm,
    placeholderData: keepPreviousData,
    staleTime: SEARCH_STALE_TIME_MS,
  });

  return {
    movies: hasTerm ? toMovieResults(movieQuery.data?.results ?? []) : [],
    series: hasTerm ? toSeriesResults(seriesQuery.data?.results ?? []) : [],
    isSearching: input.trim() !== term || movieQuery.isFetching || seriesQuery.isFetching,
    hasError: hasTerm && (movieQuery.isError || seriesQuery.isError),
  };
}

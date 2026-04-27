import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchMovies } from '@/services/movies-api';
import type { SortBy, UserFilter } from '@/types/movie';

interface UseMoviesParams {
  search?: string;
  tmdbId?: number;
  page: number;
  sortBy: SortBy;
  userFilters?: UserFilter[];
}

export function useMovies(params: UseMoviesParams) {
  return useQuery({
    queryKey: ['movies', params],
    queryFn: () => fetchMovies(params),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

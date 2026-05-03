import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchTvShows } from '@/services/tv-shows-api';
import type { TvSortBy, TvUserFilter } from '@/types/tv-show';

interface UseTvShowsParams {
  search?: string;
  seriesId?: string;
  page: number;
  sortBy: TvSortBy;
  userFilters?: TvUserFilter[];
}

export function useTvShows(params: UseTvShowsParams) {
  return useQuery({
    queryKey: ['tv-shows', params],
    queryFn: () => fetchTvShows(params),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

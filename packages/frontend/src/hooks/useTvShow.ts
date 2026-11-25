import { useQuery } from '@tanstack/react-query';
import { fetchTvShowDetail } from '@/services/tv-shows-api';

export function useTvShow(seriesId: string) {
  return useQuery({
    queryKey: ['tv-show', seriesId],
    queryFn: () => fetchTvShowDetail(seriesId),
    staleTime: 10 * 60 * 1000,
  });
}

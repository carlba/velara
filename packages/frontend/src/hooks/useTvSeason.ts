import { useQuery } from '@tanstack/react-query';
import { fetchTvSeason } from '@/services/tv-shows-api';

export function useTvSeason(seriesId: string, seasonNumber: number) {
  return useQuery({
    queryKey: ['tv-season', seriesId, seasonNumber],
    queryFn: () => fetchTvSeason(seriesId, seasonNumber),
    staleTime: 10 * 60 * 1000,
  });
}

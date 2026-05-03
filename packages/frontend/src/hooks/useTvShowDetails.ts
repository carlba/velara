import { useQuery } from '@tanstack/react-query';
import { fetchTvShowDetail } from '@/services/tv-shows-api';
import { fetchUserTvData } from '@/services/user-tv-data-api';
import { useAuth } from './useAuth';

export function useTvShowDetails(seriesId: string) {
  const { user } = useAuth();

  const showQuery = useQuery({
    queryKey: ['tv-show', seriesId],
    queryFn: () => fetchTvShowDetail(seriesId),
    staleTime: 10 * 60 * 1000,
  });

  const userDataQuery = useQuery({
    queryKey: ['user-tv-data', seriesId],
    queryFn: () => fetchUserTvData(seriesId),
    enabled: !!user,
    staleTime: 0,
  });

  return { showQuery, userDataQuery };
}

import { useQuery } from '@tanstack/react-query';
import { fetchUserTvData } from '@/services/user-tv-data-api';
import { useAuth } from './useAuth';
import { useTvShow } from './useTvShow';

export function useTvShowDetails(seriesId: string) {
  const { user } = useAuth();

  const showQuery = useTvShow(seriesId);

  const userDataQuery = useQuery({
    queryKey: ['user-tv-data', seriesId],
    queryFn: () => fetchUserTvData(seriesId),
    enabled: !!user,
    staleTime: 0,
  });

  return { showQuery, userDataQuery };
}

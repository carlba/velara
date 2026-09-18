import { useQuery } from '@tanstack/react-query';
import { fetchNowPlaying } from '@/services/plex-api';
import { useAuth } from '@/hooks/useAuth';

const POLL_INTERVAL_MS = 7000;

export function useNowPlaying() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['plex', 'now-playing'],
    queryFn: fetchNowPlaying,
    enabled: !!user,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

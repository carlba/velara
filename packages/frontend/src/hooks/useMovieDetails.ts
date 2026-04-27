import { useQuery } from '@tanstack/react-query';
import { fetchMovieDetail } from '@/services/movies-api';
import { fetchUserMovieData } from '@/services/user-data-api';
import { useAuth } from './useAuth';

export function useMovieDetails(tmdbId: number) {
  const { user } = useAuth();

  const movieQuery = useQuery({
    queryKey: ['movie', tmdbId],
    queryFn: () => fetchMovieDetail(tmdbId),
    staleTime: 10 * 60 * 1000,
  });

  const userDataQuery = useQuery({
    queryKey: ['user-movie-data', tmdbId],
    queryFn: () => fetchUserMovieData(tmdbId),
    enabled: !!user,
    staleTime: 0,
  });

  return { movieQuery, userDataQuery };
}

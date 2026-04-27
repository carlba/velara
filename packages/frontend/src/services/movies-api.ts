import { apiRequest } from './api-client';
import type { MovieListResponse, MovieDetail, SortBy, UserFilter } from '@/types/movie';

export async function fetchMovies(params: {
  search?: string;
  tmdbId?: number;
  page?: number;
  sortBy?: SortBy;
  userFilters?: UserFilter[];
}): Promise<MovieListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.tmdbId !== undefined) query.set('tmdb_id', String(params.tmdbId));
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.sortBy) query.set('sort_by', params.sortBy);
  if (params.userFilters && params.userFilters.length > 0) {
    query.set('user_filter', params.userFilters.join(','));
  }

  return apiRequest<MovieListResponse>(`/api/movies?${query.toString()}`);
}

export async function fetchMovieDetail(tmdbId: number): Promise<MovieDetail> {
  return apiRequest<MovieDetail>(`/api/movies/${tmdbId}`);
}

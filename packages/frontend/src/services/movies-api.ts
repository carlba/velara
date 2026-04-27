import { apiRequest } from './api-client';
import type { MovieListResponse, MovieDetail, SortBy } from '@/types/movie';

export async function fetchMovies(params: {
  search?: string;
  tmdbId?: number;
  page?: number;
  sortBy?: SortBy;
}): Promise<MovieListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.tmdbId !== undefined) query.set('tmdb_id', String(params.tmdbId));
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.sortBy) query.set('sort_by', params.sortBy);

  return apiRequest<MovieListResponse>(`/api/movies?${query.toString()}`);
}

export async function fetchMovieDetail(tmdbId: number): Promise<MovieDetail> {
  return apiRequest<MovieDetail>(`/api/movies/${tmdbId}`);
}

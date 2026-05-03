import { apiRequest } from './api-client';
import type { UserMovieData } from '@/types/movie';

export type ImportProvider = 'filmtipset' | 'trakt';

export async function fetchUserMovieData(tmdbId: number): Promise<UserMovieData> {
  return apiRequest<UserMovieData>(`/api/movies/${tmdbId}/user-data`);
}

export async function updateWatch(tmdbId: number, watchedAt: string): Promise<void> {
  await apiRequest(`/api/movies/${tmdbId}/watch`, {
    method: 'PUT',
    body: JSON.stringify({ watchedAt }),
  });
}

export async function removeWatch(tmdbId: number): Promise<void> {
  await apiRequest(`/api/movies/${tmdbId}/watch`, { method: 'DELETE' });
}

export async function updateRating(tmdbId: number, score: number): Promise<void> {
  await apiRequest(`/api/movies/${tmdbId}/rating`, {
    method: 'PUT',
    body: JSON.stringify({ score }),
  });
}

export async function removeRating(tmdbId: number): Promise<void> {
  await apiRequest(`/api/movies/${tmdbId}/rating`, { method: 'DELETE' });
}

export async function updateReview(tmdbId: number, content: string): Promise<void> {
  await apiRequest(`/api/movies/${tmdbId}/review`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function removeReview(tmdbId: number): Promise<void> {
  await apiRequest(`/api/movies/${tmdbId}/review`, { method: 'DELETE' });
}

export interface ImportSummary {
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

export async function importMovies(
  content: string,
  provider: ImportProvider,
  type: 'ratings' | 'comments' = 'ratings'
): Promise<ImportSummary> {
  return apiRequest<ImportSummary>('/api/movies/import', {
    method: 'POST',
    body: JSON.stringify({ content, provider, type }),
  });
}

export async function importFilmtipset(
  content: string,
  type: 'ratings' | 'comments'
): Promise<ImportSummary> {
  return importMovies(content, 'filmtipset', type);
}

export async function importTrakt(content: string): Promise<ImportSummary> {
  return importMovies(content, 'trakt', 'ratings');
}

export async function importRatings(content: string): Promise<ImportSummary> {
  return importFilmtipset(content, 'ratings');
}

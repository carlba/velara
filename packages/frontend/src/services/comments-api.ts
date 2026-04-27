import { apiRequest } from './api-client';
import type { MovieComment } from '@/types/movie';

export async function fetchMovieComments(tmdbId: number): Promise<MovieComment[]> {
  return apiRequest<MovieComment[]>(`/api/movies/${tmdbId}/comments`);
}

export async function createMovieComment(tmdbId: number, content: string): Promise<MovieComment> {
  return apiRequest<MovieComment>(`/api/movies/${tmdbId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function deleteMovieComment(tmdbId: number, commentId: number): Promise<void> {
  return apiRequest<void>(`/api/movies/${tmdbId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}

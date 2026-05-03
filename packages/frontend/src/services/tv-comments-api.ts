import { apiRequest } from './api-client';
import type { TvComment } from '@/types/tv-show';

export async function fetchTvComments(seriesId: string): Promise<TvComment[]> {
  return apiRequest<TvComment[]>(`/api/tv/${seriesId}/comments`);
}

export async function createTvComment(seriesId: string, content: string): Promise<TvComment> {
  return apiRequest<TvComment>(`/api/tv/${seriesId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function deleteTvComment(seriesId: string, commentId: number): Promise<void> {
  return apiRequest<void>(`/api/tv/${seriesId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}

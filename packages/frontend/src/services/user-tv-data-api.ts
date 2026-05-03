import { apiRequest } from './api-client';
import type { UserTvData } from '@/types/tv-show';

export async function fetchUserTvData(seriesId: string): Promise<UserTvData> {
  return apiRequest<UserTvData>(`/api/tv/${seriesId}/user-data`);
}

export async function updateTvRating(seriesId: string, score: number): Promise<void> {
  await apiRequest(`/api/tv/${seriesId}/rating`, {
    method: 'PUT',
    body: JSON.stringify({ score }),
  });
}

export async function removeTvRating(seriesId: string): Promise<void> {
  await apiRequest(`/api/tv/${seriesId}/rating`, { method: 'DELETE' });
}

export async function updateTvSeasonRating(
  seriesId: string,
  seasonNumber: number,
  score: number
): Promise<void> {
  await apiRequest(`/api/tv/${seriesId}/season/${seasonNumber}/rating`, {
    method: 'PUT',
    body: JSON.stringify({ score }),
  });
}

export async function removeTvSeasonRating(seriesId: string, seasonNumber: number): Promise<void> {
  await apiRequest(`/api/tv/${seriesId}/season/${seasonNumber}/rating`, { method: 'DELETE' });
}

export async function updateTvReview(seriesId: string, content: string): Promise<void> {
  await apiRequest(`/api/tv/${seriesId}/review`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function removeTvReview(seriesId: string): Promise<void> {
  await apiRequest(`/api/tv/${seriesId}/review`, { method: 'DELETE' });
}

export async function markEpisodeWatched(
  seriesId: string,
  seasonNumber: number,
  episodeNumber: number,
  watchedAt: string
): Promise<void> {
  await apiRequest(`/api/tv/${seriesId}/watch`, {
    method: 'PUT',
    body: JSON.stringify({ seasonNumber, episodeNumber, watchedAt }),
  });
}

export async function unmarkEpisodeWatched(
  seriesId: string,
  seasonNumber: number,
  episodeNumber: number
): Promise<void> {
  await apiRequest(`/api/tv/${seriesId}/watch`, {
    method: 'DELETE',
    body: JSON.stringify({ seasonNumber, episodeNumber }),
  });
}

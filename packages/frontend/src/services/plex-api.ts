import { apiRequest } from './api-client';
import type { NowPlayingResponse } from '@/types/now-playing';

export async function fetchNowPlaying(): Promise<NowPlayingResponse> {
  return apiRequest<NowPlayingResponse>('/api/plex/now-playing');
}

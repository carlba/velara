import { apiRequest } from './api-client';
import type {
  TvShowListResponse,
  TvShowDetail,
  TvSeason,
  TvSortBy,
  TvUserFilter,
} from '@/types/tv-show';

export async function fetchTvShows(params: {
  search?: string;
  seriesId?: string;
  page?: number;
  sortBy?: TvSortBy;
  userFilters?: TvUserFilter[];
}): Promise<TvShowListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.seriesId !== undefined) query.set('series_id', params.seriesId);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.sortBy) query.set('sort_by', params.sortBy);
  if (params.userFilters && params.userFilters.length > 0) {
    query.set('user_filter', params.userFilters.join(','));
  }

  return apiRequest<TvShowListResponse>(`/api/tv?${query.toString()}`);
}

export async function fetchTvShowDetail(seriesId: string): Promise<TvShowDetail> {
  return apiRequest<TvShowDetail>(`/api/tv/${seriesId}`);
}

export async function fetchTvSeason(seriesId: string, seasonNumber: number): Promise<TvSeason> {
  return apiRequest<TvSeason>(`/api/tv/${seriesId}/season/${seasonNumber}`);
}

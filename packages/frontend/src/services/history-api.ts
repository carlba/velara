import { apiRequest } from './api-client';
import type { HistoryMediaType, HistoryResponse, HistoryTypeFilter } from '@/types/history';

interface FetchHistoryParams {
  type: HistoryTypeFilter;
  before?: string;
  limit?: number;
}

export async function fetchHistory({
  type,
  before,
  limit,
}: FetchHistoryParams): Promise<HistoryResponse> {
  const searchParams = new URLSearchParams({ type });
  if (before) searchParams.set('before', before);
  if (limit) searchParams.set('limit', String(limit));

  return apiRequest<HistoryResponse>(`/api/history?${searchParams.toString()}`);
}

export async function deleteHistoryRecord(
  type: HistoryMediaType,
  historyId: number
): Promise<void> {
  await apiRequest(`/api/history/${type}/${historyId}`, { method: 'DELETE' });
}

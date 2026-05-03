import { apiRequest } from './api-client';
import type {
  AddListItemPayload,
  CreateListPayload,
  ListDetails,
  ListSummary,
  UpdateListPayload,
} from '@/types/list';

export async function fetchLists(mine?: boolean): Promise<ListSummary[]> {
  const searchParams = new URLSearchParams();
  if (mine) {
    searchParams.set('mine', 'true');
  }

  return apiRequest<ListSummary[]>(
    `/api/lists${searchParams.toString() ? `?${searchParams}` : ''}`
  );
}

export async function fetchListDetails(listId: number): Promise<ListDetails> {
  return apiRequest<ListDetails>(`/api/lists/${listId}`);
}

export async function createList(payload: CreateListPayload): Promise<ListSummary> {
  return apiRequest<ListSummary>('/api/lists', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateList(listId: number, payload: UpdateListPayload): Promise<ListSummary> {
  return apiRequest<ListSummary>(`/api/lists/${listId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteList(listId: number): Promise<void> {
  return apiRequest<void>(`/api/lists/${listId}`, { method: 'DELETE' });
}

export async function addListItem(listId: number, payload: AddListItemPayload) {
  return apiRequest('/api/lists/' + listId + '/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteListItem(listId: number, itemId: number): Promise<void> {
  return apiRequest<void>(`/api/lists/${listId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

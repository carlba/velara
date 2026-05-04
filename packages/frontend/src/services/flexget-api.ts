import { apiRequest } from './api-client';

export interface FlexgetIntegration {
  baseUrl: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlexgetIntegrationInput {
  baseUrl: string;
  username: string;
  password: string;
}

export interface FlexgetConnection {
  entryListName: string;
  remoteListId: number;
}

export async function fetchFlexgetIntegration(): Promise<FlexgetIntegration> {
  return apiRequest<FlexgetIntegration>('/api/flexget/integration');
}

export async function saveFlexgetIntegration(
  payload: FlexgetIntegrationInput
): Promise<FlexgetIntegration> {
  return apiRequest<FlexgetIntegration>('/api/flexget/integration', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteFlexgetIntegration(): Promise<void> {
  return apiRequest<void>('/api/flexget/integration', {
    method: 'DELETE',
  });
}

export async function fetchFlexgetRemoteLists(): Promise<FlexgetConnection[]> {
  return apiRequest<FlexgetConnection[]>('/api/flexget/remote-lists');
}

export async function connectListToFlexget(
  listId: number,
  entryListName: string
): Promise<FlexgetConnection> {
  return apiRequest<FlexgetConnection>(`/api/lists/${listId}/flexget`, {
    method: 'PUT',
    body: JSON.stringify({ entryListName }),
  });
}

export async function disconnectListFromFlexget(listId: number): Promise<void> {
  return apiRequest<void>(`/api/lists/${listId}/flexget`, {
    method: 'DELETE',
  });
}

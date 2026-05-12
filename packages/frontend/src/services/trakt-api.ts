import { apiRequest } from './api-client';

export interface TraktIntegration {
  active: boolean;
  traktUsername?: string | null;
  traktSlug?: string | null;
  lastSyncedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TraktAuthUrlResponse {
  url: string;
}

export interface TraktConnectPayload {
  authorizationCode: string;
  redirectUri: string;
}

export async function fetchTraktAuthUrl(redirectUri: string): Promise<TraktAuthUrlResponse> {
  return apiRequest<TraktAuthUrlResponse>(
    `/api/trakt/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`
  );
}

export async function fetchTraktIntegration(): Promise<TraktIntegration> {
  return apiRequest<TraktIntegration>('/api/trakt/integration');
}

export async function connectTraktIntegration(
  payload: TraktConnectPayload
): Promise<TraktIntegration> {
  return apiRequest<TraktIntegration>('/api/trakt/integration', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteTraktIntegration(): Promise<void> {
  return apiRequest<void>('/api/trakt/integration', {
    method: 'DELETE',
  });
}

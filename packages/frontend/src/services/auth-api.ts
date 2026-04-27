import { apiRequest } from './api-client';
import type { AuthUser } from '@/types/user';

interface AuthResponse {
  user: AuthUser;
}

export async function registerApi(
  email: string,
  username: string,
  password: string
): Promise<AuthUser> {
  const response = await apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  });
  return response.user;
}

export async function loginApi(email: string, password: string): Promise<AuthUser> {
  const response = await apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.user;
}

export async function logoutApi(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function getMeApi(): Promise<AuthUser | null> {
  try {
    const response = await apiRequest<AuthResponse>('/api/auth/me');
    return response.user;
  } catch {
    return null;
  }
}

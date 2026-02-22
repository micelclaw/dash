import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:7200';
const API_PREFIX = '/api/v1';

interface ApiResponse<T> {
  data: T;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const tokens = useAuthStore.getState().tokens;
    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }
    return headers;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      const { getMockResponse } = await import('./mock');
      return getMockResponse(method, path) as T;
    }

    const url = `${this.baseUrl}${API_PREFIX}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      try {
        await useAuthStore.getState().refresh();
        const retryRes = await fetch(url, {
          method,
          headers: this.getHeaders(),
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retryRes.ok) throw new Error(`HTTP ${retryRes.status}`);
        return retryRes.json() as Promise<T>;
      } catch {
        useAuthStore.getState().logout();
        throw new Error('Session expired');
      }
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export const api = new ApiClient(BASE_URL);
export type { ApiResponse };

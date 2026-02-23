import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:7200';
const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public status?: number,
  ) {
    super(message);
  }
}

class ApiClient {
  private getToken(): string | null {
    return useAuthStore.getState().tokens?.accessToken ?? null;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: { body?: unknown; params?: Record<string, string | number | boolean | undefined> },
  ): Promise<T> {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      const { getMockResponse } = await import('./mock');
      // Build full path with query string for mock router
      let mockPath = path;
      if (options?.params) {
        const qs = new URLSearchParams();
        for (const [key, val] of Object.entries(options.params)) {
          if (val !== undefined) qs.set(key, String(val));
        }
        const str = qs.toString();
        if (str) mockPath += `?${str}`;
      }
      return getMockResponse(method, mockPath, options?.body) as T;
    }

    const url = new URL(`${BASE_URL}${API_PREFIX}${path}`);
    if (options?.params) {
      for (const [key, val] of Object.entries(options.params)) {
        if (val !== undefined) url.searchParams.set(key, String(val));
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401) {
      try {
        await useAuthStore.getState().refresh();
        return this.request(method, path, options);
      } catch {
        useAuthStore.getState().logout();
        throw new ApiError('UNAUTHORIZED', 'Session expired', undefined, 401);
      }
    }

    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(
        json.error?.code || 'UNKNOWN',
        json.error?.message || 'Request failed',
        json.error?.details,
        res.status,
      );
    }

    return json;
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      const { getMockResponse } = await import('./mock');
      return getMockResponse('POST', path, Object.fromEntries(formData.entries())) as T;
    }
    const url = `${BASE_URL}${API_PREFIX}${path}`;
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // No Content-Type — browser sets multipart boundary
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError('UPLOAD_FAILED', text, undefined, res.status);
    }
    return res.json();
  }
}

export const api = new ApiClient();

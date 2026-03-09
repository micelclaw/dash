import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:7200';
const API_PREFIX = '/api/v1';

/**
 * Convert camelCase keys to snake_case recursively.
 * The real API (Drizzle ORM) returns camelCase but all frontend
 * types and mock data use snake_case.
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function transformKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[camelToSnake(key)] = transformKeys(value);
    }
    return result;
  }
  return obj;
}

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
    options?: { body?: unknown; params?: Record<string, string | number | boolean | undefined>; _isRetry?: boolean },
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

    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options?.body) headers['Content-Type'] = 'application/json';

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401 && !options?._isRetry && !path.startsWith('/auth/')) {
      try {
        await useAuthStore.getState().refresh();
        return this.request(method, path, { ...options, _isRetry: true });
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

    // Transform camelCase keys from API to snake_case for frontend
    const useMockMode = import.meta.env.VITE_MOCK_API === 'true';
    return (useMockMode ? json : transformKeys(json)) as T;
  }

  /**
   * Raw POST that skips camelCase→snake_case key transformation.
   * Needed for ONLYOFFICE config which requires exact camelCase keys.
   */
  async rawPost<T>(path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${API_PREFIX}${path}`;
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const fetchOpts: RequestInit = { method: 'POST', headers };
    if (body !== undefined) fetchOpts.body = JSON.stringify(body);

    const res = await fetch(url, fetchOpts);

    if (res.status === 401) {
      try {
        await useAuthStore.getState().refresh();
        const retryToken = this.getToken();
        if (retryToken) headers['Authorization'] = `Bearer ${retryToken}`;
        const retry = await fetch(url, { ...fetchOpts, headers });
        if (!retry.ok) {
          const errJson = await retry.json().catch(() => ({}));
          throw new ApiError(errJson.error?.code || 'UNKNOWN', errJson.error?.message || `Request failed: ${retry.status}`, undefined, retry.status);
        }
        return (await retry.json()) as T;
      } catch (e) {
        if (e instanceof ApiError) throw e;
        useAuthStore.getState().logout();
        throw new ApiError('UNAUTHORIZED', 'Session expired', undefined, 401);
      }
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(json.error?.code || 'UNKNOWN', json.error?.message || `Request failed: ${res.status}`, undefined, res.status);
    }
    return json as T;
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

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }

  delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('DELETE', path, body !== undefined ? { body } : undefined);
  }

  async upload<T>(path: string, formData: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      const { getMockResponse } = await import('./mock');
      return getMockResponse(method, path, Object.fromEntries(formData.entries())) as T;
    }
    const url = `${BASE_URL}${API_PREFIX}${path}`;
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // No Content-Type — browser sets multipart boundary
    const res = await fetch(url, { method, headers, body: formData });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError('UPLOAD_FAILED', text, undefined, res.status);
    }
    const json = await res.json();
    return transformKeys(json) as T;
  }
}

export const api = new ApiClient();

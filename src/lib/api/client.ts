'use client';

// ---------------------------------------------------------------------------
// Shared API Client — all hooks call server routes through this module
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(error: { code?: string; message?: string; details?: unknown }, status: number) {
    super(error.message ?? 'An unexpected error occurred');
    this.name = 'ApiError';
    this.code = error.code ?? 'UNKNOWN_ERROR';
    this.status = status;
    this.details = error.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

// ---- Response shapes (mirror server helpers) --------------------------------

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

// ---- Core request helper ----------------------------------------------------

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  // Handle non-JSON error responses (e.g., 502, 504 from proxy)
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new ApiError(
        { code: 'NETWORK_ERROR', message: `Server returned ${res.status}` },
        res.status,
      );
    }
    return undefined as T;
  }

  const json = await res.json();

  if (!json.success) {
    throw new ApiError(
      json.error ?? { code: 'UNKNOWN_ERROR', message: 'Request failed' },
      res.status,
    );
  }

  return json.data as T;
}

async function requestPaginated<T>(
  path: string,
  options?: RequestInit,
): Promise<PaginatedResult<T>> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  const json = await res.json();

  if (!json.success) {
    throw new ApiError(
      json.error ?? { code: 'UNKNOWN_ERROR', message: 'Request failed' },
      res.status,
    );
  }

  return {
    items: json.data as T[],
    meta: json.meta as PaginationMeta,
  };
}

// ---- Query-string builder ---------------------------------------------------

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '' && v !== false) sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

// ---- Public API object ------------------------------------------------------

export const api = {
  /** GET request returning deserialized `data` field */
  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    return request<T>(`${path}${buildQuery(params)}`);
  },

  /** GET request returning `{ items, meta }` for paginated endpoints */
  getPaginated<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<PaginatedResult<T>> {
    return requestPaginated<T>(`${path}${buildQuery(params)}`);
  },

  /** POST request with JSON body */
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body !== null && body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  /** PATCH request with JSON body */
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body !== null && body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  /** PUT request with JSON body */
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body !== null && body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  /** DELETE request */
  delete<T = void>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
};

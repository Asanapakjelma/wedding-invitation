type ApiResult<T> = { data: T | null; error: Error | null };

type QueryOperation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
const requestTimeoutMs = 45000;

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const token = localStorage.getItem('wedding-admin-token');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Permintaan terlalu lama. Periksa koneksi server lalu coba lagi.', { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request gagal (${response.status}).`);
  return body as T;
};

class QueryBuilder<T = unknown> implements PromiseLike<ApiResult<T>> {
  private operation: QueryOperation = 'select';
  private payload: unknown;
  private filters: Record<string, string | number> = {};
  private selected = '*';
  private sort?: { column: string; ascending: boolean };

  private readonly table: string;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*') {
    this.operation = 'select';
    this.selected = columns;
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload: unknown, _options?: unknown) {
    void _options;
    this.operation = 'upsert';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: string | number) {
    this.filters[column] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sort = { column, ascending: options?.ascending !== false };
    return this;
  }

  maybeSingle() {
    return this;
  }

  then<TResult1 = ApiResult<T>, TResult2 = never>(
    onfulfilled?: ((value: ApiResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<ApiResult<T>> {
    try {
      const query = new URLSearchParams({ table: this.table, select: this.selected, ...this.filters });
      if (this.sort) {
        query.set('order', this.sort.column);
        query.set('ascending', String(this.sort.ascending));
      }

      let data: unknown;
      if (this.operation === 'select') {
        const owner = new URLSearchParams(window.location.search).get('owner');
        if (owner) query.set('owner', owner);
        data = await requestJson<unknown[]>(`/api/data?${query}`);
      } else {
        const owner = new URLSearchParams(window.location.search).get('owner');
        const endpoint = owner ? `/api/data/${this.table}?owner=${encodeURIComponent(owner)}` : `/api/data/${this.table}`;
        data = await requestJson<unknown>(endpoint, {
          method: 'POST',
          body: JSON.stringify({ operation: this.operation, filters: this.filters, payload: this.payload }),
        });
      }
      return { data: data as T, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Request gagal.') };
    }
  }
}

const storage = {
  from: (bucket: string) => ({
    list: async (folder: string, options?: unknown) => {
      void options;
      try {
        const data = await requestJson<{ name: string }[]>(`/api/storage?bucket=${encodeURIComponent(bucket)}&folder=${encodeURIComponent(folder)}`);
        return { data, error: null };
      } catch (error) {
        return { data: null, error: error instanceof Error ? error : new Error('Gagal memuat file.') };
      }
    },
    upload: async (path: string, file: File, options?: unknown) => {
      void options;
      try {
        const token = localStorage.getItem('wedding-admin-token');
        const response = await fetch(`/api/storage/${encodeURIComponent(bucket)}?path=${encodeURIComponent(path)}`, {
          method: 'POST',
          headers: {
            'Content-Type': file.type,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: file,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Upload gagal (${response.status}).`);
        return { data: { path }, error: null };
      } catch (error) {
        return { data: null, error: error instanceof Error ? error : new Error('Gagal mengunggah file.') };
      }
    },
    getPublicUrl: (path: string) => ({
      data: { publicUrl: `/uploads/${path.split('/').map(encodeURIComponent).join('/')}` },
    }),
  }),
};

const auth = {
  getSession: async () => {
    const token = localStorage.getItem('wedding-admin-token');
    if (!token) return { data: { session: null as { user: { id: string } } | null }, error: null };
    try {
      const result = await requestJson<{ user: { id: string; email: string } }>('/api/auth/session');
      return { data: { session: { user: { id: result.user.id } } }, error: null };
    } catch {
      localStorage.removeItem('wedding-admin-token');
      return { data: { session: null as { user: { id: string } } | null }, error: null };
    }
  },
  onAuthStateChange: (callback: (event: string, session: { user: { id: string } } | null) => void) => {
    void callback;
    return { data: { subscription: { unsubscribe: () => undefined } } };
  },
  signOut: async () => { localStorage.removeItem('wedding-admin-token'); return { error: null }; },
  signInWithPassword: async (credentials: unknown) => {
    try {
      const result = await requestJson<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
      localStorage.setItem('wedding-admin-token', result.token);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Login gagal.') };
    }
  },
  signUp: async (credentials: unknown) => {
    try { const data = await requestJson<{ developmentOtp?: string }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(credentials) }); return { data, error: null }; }
    catch (error) { return { error: error instanceof Error ? error : new Error('Pendaftaran gagal.') }; }
  },
  verifyOtp: async (credentials: unknown) => {
    try { const result = await requestJson<{ token: string }>('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify(credentials) }); localStorage.setItem('wedding-admin-token', result.token); return { error: null }; }
    catch (error) { return { error: error instanceof Error ? error : new Error('Verifikasi gagal.') }; }
  },
  resend: async (credentials: unknown) => {
    try { const data = await requestJson<{ developmentOtp?: string }>('/api/auth/resend', { method: 'POST', body: JSON.stringify(credentials) }); return { data, error: null }; }
    catch (error) { return { error: error instanceof Error ? error : new Error('Pengiriman OTP gagal.') }; }
  },
};

export const localApi = {
  from: <T = unknown>(table: string) => new QueryBuilder<T>(table),
  storage,
  auth,
};

export const resetRsvps = async (owner: string) => {
  return requestJson<{ deleted: number }>(`/api/rsvp/reset?owner=${encodeURIComponent(owner)}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
};

export const mapsResolverUrl = import.meta.env.VITE_MAPS_RESOLVER_URL || '/api/resolve-maps';
export const RSVP_RESET_AT = new Date('2026-08-27T02:39:00.000Z');
export const isTestGuest = (guestName: string) => guestName.trim().toLowerCase() === 'tamu uji coba';

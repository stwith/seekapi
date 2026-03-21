/**
 * API client for the SeekAPI operator console.
 *
 * Uses the Vite dev proxy (or same-origin in production) so the
 * base URL defaults to "" (relative). The admin API key is passed
 * via Bearer token on every admin request.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface ApiError {
  error: string;
  message: string;
}

async function request<T>(
  path: string,
  opts: RequestInit & { adminKey?: string } = {},
): Promise<T> {
  const { adminKey, ...init } = opts;
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (adminKey) {
    headers["Authorization"] = `Bearer ${adminKey}`;
  }
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "UNKNOWN", message: res.statusText }));
    const err = new Error(body.message ?? res.statusText);
    (err as ApiClientError).status = res.status;
    (err as ApiClientError).apiError = body as ApiError;
    throw err;
  }

  return res.json() as Promise<T>;
}

export interface ApiClientError extends Error {
  status: number;
  apiError: ApiError;
}

// --- Admin endpoints ---

export interface Project {
  id: string;
  name: string;
  status: string;
}

export interface ProjectDetail {
  project: Project;
  bindings: ProviderBinding[];
  keys: ApiKeyInfo[];
  credential: CredentialMeta | null;
}

export interface ProviderBinding {
  provider: string;
  capability: string;
  enabled: boolean;
  priority: number;
}

export interface ApiKeyInfo {
  id: string;
  projectId: string;
  status: string;
}

export interface CredentialMeta {
  id: string;
  projectId: string;
  provider: string;
  status: string;
  createdAt?: string;
}

export interface CreateKeyResult {
  id: string;
  projectId: string;
  rawKey: string;
}

export const api = {
  // Read endpoints (Task 27)
  listProjects(adminKey: string) {
    return request<Project[]>("/v1/admin/projects", { adminKey });
  },

  getProjectDetail(adminKey: string, projectId: string) {
    return request<ProjectDetail>(`/v1/admin/projects/${projectId}`, { adminKey });
  },

  listProjectKeys(adminKey: string, projectId: string) {
    return request<ApiKeyInfo[]>(`/v1/admin/projects/${projectId}/keys`, { adminKey });
  },

  listProjectBindings(adminKey: string, projectId: string) {
    return request<ProviderBinding[]>(`/v1/admin/projects/${projectId}/bindings`, { adminKey });
  },

  getCredentialMeta(adminKey: string, projectId: string) {
    return request<CredentialMeta | null>(`/v1/admin/projects/${projectId}/credentials`, { adminKey });
  },

  // Mutation endpoints (existing)
  createProject(adminKey: string, name: string) {
    return request<Project>("/v1/admin/projects", {
      method: "POST",
      adminKey,
      body: JSON.stringify({ name }),
    });
  },

  createApiKey(adminKey: string, projectId: string) {
    return request<CreateKeyResult>(`/v1/admin/projects/${projectId}/keys`, {
      method: "POST",
      adminKey,
    });
  },

  disableApiKey(adminKey: string, keyId: string) {
    return request<{ status: string }>(`/v1/admin/keys/${keyId}/disable`, {
      method: "POST",
      adminKey,
    });
  },

  upsertCredential(adminKey: string, projectId: string, provider: string, secret: string) {
    return request<{ id: string }>(`/v1/admin/projects/${projectId}/credentials`, {
      method: "POST",
      adminKey,
      body: JSON.stringify({ provider, secret }),
    });
  },

  configureBinding(
    adminKey: string,
    projectId: string,
    binding: { provider: string; capability: string; enabled: boolean; priority: number },
  ) {
    return request<{ status: string }>(`/v1/admin/projects/${projectId}/bindings`, {
      method: "POST",
      adminKey,
      body: JSON.stringify(binding),
    });
  },

  // Canonical search (for flow runner)
  async search(apiKey: string, query: string): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`${API_BASE}/v1/search/web`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query }),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  },
};

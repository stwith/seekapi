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

// --- Stats & query types [Task 34/38] ---

export interface DashboardStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
}

export interface TimeSeriesPoint {
  bucket: string;
  count: number;
  successCount: number;
  failureCount: number;
}

export interface CapabilityBreakdown {
  capability: string;
  count: number;
}

export interface UsageEvent {
  requestId: string;
  projectId: string;
  apiKeyId: string;
  provider: string;
  capability: string;
  statusCode: number;
  success: boolean;
  latencyMs: number;
  resultCount: number;
  fallbackCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KeyUsageStats {
  apiKeyId: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
}

export interface AuditEntry {
  projectId: string;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
}

export interface ProjectQuota {
  id: string;
  projectId: string;
  dailyRequestLimit: number | null;
  monthlyRequestLimit: number | null;
  maxKeys: number;
  rateLimitRpm: number;
  status: string;
  currentDailyUsage: number;
  currentMonthlyUsage: number;
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

  // Stats endpoints [Task 34]
  getDashboardStats(adminKey: string, params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<DashboardStats>(`/v1/admin/stats/dashboard${qs}`, { adminKey });
  },

  getTimeSeries(adminKey: string, params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ series: TimeSeriesPoint[] }>(`/v1/admin/stats/timeseries${qs}`, { adminKey });
  },

  getCapabilityBreakdown(adminKey: string, params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ capabilities: CapabilityBreakdown[] }>(`/v1/admin/stats/capabilities${qs}`, { adminKey });
  },

  queryUsageEvents(adminKey: string, params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<PaginatedResult<UsageEvent>>(`/v1/admin/usage${qs}`, { adminKey });
  },

  getPerKeyStats(adminKey: string, projectId: string) {
    return request<{ keys: KeyUsageStats[] }>(`/v1/admin/projects/${projectId}/keys/stats`, { adminKey });
  },

  queryAuditLogs(adminKey: string, params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<PaginatedResult<AuditEntry>>(`/v1/admin/audit${qs}`, { adminKey });
  },

  // Quota endpoints [Task 38]
  getProjectQuota(adminKey: string, projectId: string) {
    return request<ProjectQuota>(`/v1/admin/projects/${projectId}/quota`, { adminKey });
  },

  updateProjectQuota(adminKey: string, projectId: string, updates: Record<string, unknown>) {
    return request<ProjectQuota>(`/v1/admin/projects/${projectId}/quota`, {
      method: "PUT",
      adminKey,
      body: JSON.stringify(updates),
    });
  },

  listQuotas(adminKey: string) {
    return request<{ quotas: ProjectQuota[] }>("/v1/admin/quotas", { adminKey });
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

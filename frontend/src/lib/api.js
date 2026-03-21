/**
 * API client for the SeekAPI operator console.
 *
 * Uses the Vite dev proxy (or same-origin in production) so the
 * base URL defaults to "" (relative). The admin API key is passed
 * via Bearer token on every admin request.
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "";
async function request(path, opts = {}) {
    const { adminKey, ...init } = opts;
    const headers = {
        ...init.headers,
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
        err.status = res.status;
        err.apiError = body;
        throw err;
    }
    return res.json();
}
export const api = {
    // Read endpoints (Task 27)
    listProjects(adminKey) {
        return request("/v1/admin/projects", { adminKey });
    },
    getProjectDetail(adminKey, projectId) {
        return request(`/v1/admin/projects/${projectId}`, { adminKey });
    },
    listProjectKeys(adminKey, projectId) {
        return request(`/v1/admin/projects/${projectId}/keys`, { adminKey });
    },
    listProjectBindings(adminKey, projectId) {
        return request(`/v1/admin/projects/${projectId}/bindings`, { adminKey });
    },
    getCredentialMeta(adminKey, projectId) {
        return request(`/v1/admin/projects/${projectId}/credentials`, { adminKey });
    },
    // Mutation endpoints (existing)
    createProject(adminKey, name) {
        return request("/v1/admin/projects", {
            method: "POST",
            adminKey,
            body: JSON.stringify({ name }),
        });
    },
    createApiKey(adminKey, projectId) {
        return request(`/v1/admin/projects/${projectId}/keys`, {
            method: "POST",
            adminKey,
        });
    },
    disableApiKey(adminKey, keyId) {
        return request(`/v1/admin/keys/${keyId}/disable`, {
            method: "POST",
            adminKey,
        });
    },
    upsertCredential(adminKey, projectId, provider, secret) {
        return request(`/v1/admin/projects/${projectId}/credentials`, {
            method: "POST",
            adminKey,
            body: JSON.stringify({ provider, secret }),
        });
    },
    configureBinding(adminKey, projectId, binding) {
        return request(`/v1/admin/projects/${projectId}/bindings`, {
            method: "POST",
            adminKey,
            body: JSON.stringify(binding),
        });
    },
    // Canonical search (for flow runner)
    async search(apiKey, query) {
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

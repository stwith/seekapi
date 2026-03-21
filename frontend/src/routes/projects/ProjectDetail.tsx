import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import type { ProjectDetail, CreateKeyResult } from "../../lib/types.js";

interface ProjectDetailPageProps {
  adminKey: string;
}

export function ProjectDetailPage({ adminKey }: ProjectDetailPageProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Credential form
  const [secret, setSecret] = useState("");
  const [credSubmitting, setCredSubmitting] = useState(false);

  // Binding form
  const [bindCap, setBindCap] = useState("search.web");
  const [bindEnabled, setBindEnabled] = useState(true);

  // Key management
  const [revealedKey, setRevealedKey] = useState<CreateKeyResult | null>(null);
  const [mintingKey, setMintingKey] = useState(false);

  async function loadDetail() {
    if (!projectId) return;
    try {
      const d = await api.getProjectDetail(adminKey, projectId);
      setDetail(d);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [adminKey, projectId]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!detail) return <p>Project not found.</p>;

  const { project, bindings, keys, credential } = detail;

  async function handleAttachCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !secret.trim()) return;
    setCredSubmitting(true);
    try {
      await api.upsertCredential(adminKey, projectId, "brave", secret.trim());
      setSecret("");
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setCredSubmitting(false);
    }
  }

  async function handleConfigureBinding(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    try {
      await api.configureBinding(adminKey, projectId, {
        provider: "brave",
        capability: bindCap,
        enabled: bindEnabled,
        priority: 0,
      });
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  async function handleMintKey() {
    if (!projectId) return;
    setMintingKey(true);
    try {
      const result = await api.createApiKey(adminKey, projectId);
      setRevealedKey(result);
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setMintingKey(false);
    }
  }

  async function handleDisableKey(keyId: string) {
    try {
      await api.disableApiKey(adminKey, keyId);
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <Link to="/projects">&larr; Projects</Link>
      <h1>{project.name}</h1>
      <p>
        Status: <strong>{project.status}</strong> &middot; ID:{" "}
        <code>{project.id}</code>
      </p>

      {/* Credential */}
      <section style={{ marginTop: 24 }}>
        <h2>Brave Credential</h2>
        {credential ? (
          <p>
            Provider: <strong>{credential.provider}</strong> &middot; Status:{" "}
            <strong>{credential.status}</strong> &middot; ID: <code>{credential.id}</code>
          </p>
        ) : (
          <p>No credential attached.</p>
        )}
        <form onSubmit={handleAttachCredential}>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Brave API secret"
            style={{ padding: 6, marginRight: 8, width: 300 }}
          />
          <button type="submit" disabled={credSubmitting}>
            {credential ? "Rotate" : "Attach"}
          </button>
        </form>
      </section>

      {/* Bindings */}
      <section style={{ marginTop: 24 }}>
        <h2>Capability Bindings</h2>
        {bindings.length === 0 && <p>No bindings configured.</p>}
        <table data-testid="bindings-table" style={{ borderCollapse: "collapse", marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 6 }}>Capability</th>
              <th style={{ textAlign: "left", padding: 6 }}>Provider</th>
              <th style={{ textAlign: "left", padding: 6 }}>Enabled</th>
              <th style={{ textAlign: "left", padding: 6 }}>Priority</th>
            </tr>
          </thead>
          <tbody>
            {bindings.map((b) => (
              <tr key={`${b.provider}-${b.capability}`}>
                <td style={{ padding: 6 }}>{b.capability}</td>
                <td style={{ padding: 6 }}>{b.provider}</td>
                <td style={{ padding: 6 }}>{b.enabled ? "Yes" : "No"}</td>
                <td style={{ padding: 6 }}>{b.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={handleConfigureBinding} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={bindCap} onChange={(e) => setBindCap(e.target.value)}>
            <option value="search.web">search.web</option>
            <option value="search.news">search.news</option>
            <option value="search.images">search.images</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={bindEnabled}
              onChange={(e) => setBindEnabled(e.target.checked)}
            />{" "}
            Enabled
          </label>
          <button type="submit">Configure</button>
        </form>
      </section>

      {/* API Keys */}
      <section style={{ marginTop: 24 }}>
        <h2>API Keys</h2>
        <button onClick={handleMintKey} disabled={mintingKey} style={{ marginBottom: 12 }}>
          {mintingKey ? "Minting..." : "Mint New Key"}
        </button>
        {revealedKey && (
          <div
            data-testid="revealed-key"
            style={{
              background: "#fff3cd",
              border: "1px solid #ffc107",
              padding: 12,
              marginBottom: 12,
            }}
          >
            <strong>New API Key (shown once only):</strong>
            <pre style={{ margin: "8px 0", userSelect: "all" }}>{revealedKey.rawKey}</pre>
            <p style={{ margin: 0, fontSize: 12, color: "#856404" }}>
              Copy this key now. It cannot be retrieved later.
            </p>
            <button onClick={() => setRevealedKey(null)} style={{ marginTop: 8 }}>
              Dismiss
            </button>
          </div>
        )}
        {keys.length === 0 && <p>No keys issued.</p>}
        <table data-testid="keys-table" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 6 }}>Key ID</th>
              <th style={{ textAlign: "left", padding: 6 }}>Status</th>
              <th style={{ textAlign: "left", padding: 6 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td style={{ padding: 6, fontFamily: "monospace", fontSize: 12 }}>{k.id}</td>
                <td style={{ padding: 6 }}>
                  <span style={{ color: k.status === "active" ? "green" : "red" }}>{k.status}</span>
                </td>
                <td style={{ padding: 6 }}>
                  {k.status === "active" && (
                    <button onClick={() => handleDisableKey(k.id)}>Disable</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

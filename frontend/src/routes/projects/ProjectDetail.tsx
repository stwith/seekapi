import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import type { ProjectDetail, CreateKeyResult, ProviderInfo, CredentialMeta } from "../../lib/types.js";
import { StatusBadge, LoadingSpinner } from "../../components/ui/index.js";

interface ProjectDetailPageProps {
  adminKey: string;
}

export function ProjectDetailPage({ adminKey }: ProjectDetailPageProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [credentials, setCredentials] = useState<CredentialMeta[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedProvider, setSelectedProvider] = useState("");
  const [secret, setSecret] = useState("");
  const [credSubmitting, setCredSubmitting] = useState(false);

  const [bindProvider, setBindProvider] = useState("");
  const [bindCap, setBindCap] = useState("search.web");
  const [bindEnabled, setBindEnabled] = useState(true);
  const [bindPriority, setBindPriority] = useState(0);

  const [revealedKey, setRevealedKey] = useState<CreateKeyResult | null>(null);
  const [mintingKey, setMintingKey] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!projectId) return;
    try {
      const [d, provResult] = await Promise.all([
        api.getProjectDetail(adminKey, projectId),
        api.listProviders(adminKey).catch(() => ({ providers: [] })),
      ]);
      setDetail(d);
      setProviders(provResult.providers);
      // credential may be a single item or null; load full list
      const creds: CredentialMeta[] = [];
      if (d.credential) creds.push(d.credential);
      setCredentials(creds);
      if (provResult.providers.length > 0) {
        setSelectedProvider((prev) => prev || provResult.providers[0]!.id);
        setBindProvider((prev) => prev || provResult.providers[0]!.id);
      }
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminKey, projectId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!detail) return <p className="text-gray-500">Project not found.</p>;

  const { project, bindings, keys } = detail;

  async function handleAttachCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !secret.trim() || !selectedProvider) return;
    setCredSubmitting(true);
    try {
      await api.upsertCredential(adminKey, projectId, selectedProvider, secret.trim());
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
    if (!projectId || !bindProvider) return;
    try {
      await api.configureBinding(adminKey, projectId, {
        provider: bindProvider,
        capability: bindCap,
        enabled: bindEnabled,
        priority: bindPriority,
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
      <Link to="/projects" className="text-primary-400 hover:underline text-sm">&larr; Projects</Link>
      <h1 className="text-xl font-bold text-white mt-2">{project.name}</h1>
      <p className="text-gray-400 text-sm mt-1">
        Status: <StatusBadge variant={project.status === "active" ? "active" : "disabled"} /> &middot; ID:{" "}
        <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">{project.id}</code>
      </p>

      {/* Credentials — multi-provider */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Provider Credentials</h2>
        {credentials.length > 0 ? (
          <div className="space-y-1 mb-3">
            {credentials.map((c) => (
              <p key={c.id} className="text-gray-300 text-sm">
                <strong>{c.provider}</strong> &middot; Status: {c.status} &middot; ID: <code className="text-xs">{c.id}</code>
              </p>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm mb-3">No credentials attached.</p>
        )}
        <form onSubmit={handleAttachCredential} className="flex gap-2 items-center">
          <select
            data-testid="credential-provider-select"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </select>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="API secret"
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 w-72"
          />
          <button
            type="submit"
            disabled={credSubmitting}
            className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded disabled:opacity-50"
          >
            Attach
          </button>
        </form>
      </section>

      {/* Bindings — multi-provider */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Capability Bindings</h2>
        {bindings.length === 0 && <p className="text-gray-500 text-sm">No bindings configured.</p>}
        <table data-testid="bindings-table" className="text-sm text-left mb-3">
          <thead>
            <tr className="text-gray-400 uppercase text-xs">
              <th className="pr-6 py-1.5 font-medium">Provider</th>
              <th className="pr-6 py-1.5 font-medium">Capability</th>
              <th className="pr-6 py-1.5 font-medium">Enabled</th>
              <th className="pr-6 py-1.5 font-medium">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {bindings.map((b) => (
              <tr key={`${b.provider}-${b.capability}`}>
                <td className="pr-6 py-1.5 text-gray-300">{b.provider}</td>
                <td className="pr-6 py-1.5 text-gray-300">{b.capability}</td>
                <td className="pr-6 py-1.5">{b.enabled ? "Yes" : "No"}</td>
                <td className="pr-6 py-1.5">{b.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={handleConfigureBinding} className="flex gap-2 items-center flex-wrap">
          <select
            data-testid="binding-provider-select"
            value={bindProvider}
            onChange={(e) => setBindProvider(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </select>
          <select
            value={bindCap}
            onChange={(e) => setBindCap(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
          >
            <option value="search.web">search.web</option>
            <option value="search.news">search.news</option>
            <option value="search.images">search.images</option>
          </select>
          <input
            type="number"
            value={bindPriority}
            onChange={(e) => setBindPriority(parseInt(e.target.value, 10) || 0)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 w-16"
            title="Priority"
          />
          <label className="flex items-center gap-1 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={bindEnabled}
              onChange={(e) => setBindEnabled(e.target.checked)}
            />{" "}
            Enabled
          </label>
          <button
            type="submit"
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm rounded text-gray-200"
          >
            Configure
          </button>
        </form>
      </section>

      {/* API Keys */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">API Keys</h2>
        <button
          onClick={handleMintKey}
          disabled={mintingKey}
          className="mb-3 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded disabled:opacity-50"
        >
          {mintingKey ? "Minting..." : "Mint New Key"}
        </button>
        {revealedKey && (
          <div
            data-testid="revealed-key"
            className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-3"
          >
            <strong className="text-yellow-300">New API Key (shown once only):</strong>
            <pre className="my-2 text-yellow-200 select-all text-sm">{revealedKey.rawKey}</pre>
            <p className="text-xs text-yellow-500 m-0">
              Copy this key now. It cannot be retrieved later.
            </p>
            <button
              onClick={() => setRevealedKey(null)}
              className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-sm rounded text-gray-200"
            >
              Dismiss
            </button>
          </div>
        )}
        {keys.length === 0 && <p className="text-gray-500 text-sm">No keys issued.</p>}
        <table data-testid="keys-table" className="text-sm text-left">
          <thead>
            <tr className="text-gray-400 uppercase text-xs">
              <th className="pr-6 py-1.5 font-medium">Key ID</th>
              <th className="pr-6 py-1.5 font-medium">Status</th>
              <th className="pr-6 py-1.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="pr-6 py-1.5 font-mono text-xs text-gray-400">{k.id}</td>
                <td className="pr-6 py-1.5">
                  <StatusBadge variant={k.status === "active" ? "active" : "disabled"} />
                </td>
                <td className="pr-6 py-1.5">
                  {k.status === "active" && (
                    <button
                      onClick={() => handleDisableKey(k.id)}
                      className="px-2 py-0.5 bg-red-900/50 hover:bg-red-800 text-red-300 text-xs rounded"
                    >
                      Disable
                    </button>
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

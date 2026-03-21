import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import type { Project, ApiKeyInfo } from "../../lib/api.js";
import { DataTable, LoadingSpinner, EmptyState, StatusBadge, ConfirmDialog } from "../../components/ui/index.js";
import type { Column } from "../../components/ui/index.js";

interface KeysPageProps {
  adminKey: string;
}

interface KeyRow extends ApiKeyInfo {
  projectName: string;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function KeysPage({ adminKey }: KeysPageProps) {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [minting, setMinting] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const projs = await api.listProjects(adminKey);
      setProjects(projs);

      const allRows: KeyRow[] = [];
      await Promise.all(
        projs.map(async (p: Project) => {
          try {
            const keys = await api.listProjectKeys(adminKey, p.id);
            for (const k of keys) {
              allRows.push({ ...k, projectName: p.name });
            }
          } catch {
            // skip projects with no keys
          }
        }),
      );

      setRows(allRows);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMint() {
    if (!selectedProject) return;
    setMinting(true);
    try {
      const result = await api.createApiKey(adminKey, selectedProject);
      setRevealedKey(result.rawKey);
      setCopied(false);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setMinting(false);
    }
  }

  async function handleDisable() {
    if (!disablingId) return;
    try {
      await api.disableApiKey(adminKey, disablingId);
      setDisablingId(null);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const columns: Column<KeyRow>[] = [
    { key: "id", header: "Key ID", render: (r) => <code className="text-xs">{r.id}</code> },
    { key: "project", header: "Project", render: (r) => <span className="text-gray-300">{r.projectName}</span> },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge variant={r.status === "active" ? "active" : "error"} label={r.status} />,
    },
    { key: "createdAt", header: "Created", render: (r) => <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span> },
    { key: "lastUsedAt", header: "Last Used", render: (r) => <span className="text-xs text-gray-400">{formatDate(r.lastUsedAt)}</span> },
    {
      key: "actions",
      header: "Actions",
      render: (r) =>
        r.status === "active" ? (
          <button
            onClick={() => setDisablingId(r.id)}
            className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-300 rounded"
          >
            Disable
          </button>
        ) : (
          <span className="text-xs text-gray-600">Disabled</span>
        ),
    },
  ];

  if (loading) return <LoadingSpinner label="Loading keys..." />;
  if (error && rows.length === 0) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-4">API Keys</h1>

      {/* Mint new key */}
      <div data-testid="mint-section" className="flex gap-3 items-center mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
        >
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          onClick={handleMint}
          disabled={!selectedProject || minting}
          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded disabled:opacity-50"
        >
          {minting ? "Creating..." : "Mint New Key"}
        </button>
      </div>

      {/* Reveal-once display */}
      {revealedKey && (
        <div data-testid="revealed-key" className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg">
          <p className="text-sm text-green-300 mb-2">New API key created. Copy it now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-gray-900 px-3 py-1.5 rounded text-green-200 flex-1 overflow-x-auto">{revealedKey}</code>
            <button
              onClick={() => copyToClipboard(revealedKey)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm rounded text-gray-200 shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-xs text-gray-400 hover:text-gray-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {rows.length === 0 ? (
        <EmptyState message="No API keys yet. Select a project and mint a new key." />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.projectId}-${r.id}`} />
      )}

      {/* Disable confirmation */}
      <ConfirmDialog
        open={disablingId !== null}
        title="Disable API Key"
        message={`Are you sure you want to disable key ${disablingId?.slice(0, 12)}...? This action cannot be undone.`}
        confirmLabel="Disable"
        onConfirm={handleDisable}
        onCancel={() => setDisablingId(null)}
      />
    </div>
  );
}

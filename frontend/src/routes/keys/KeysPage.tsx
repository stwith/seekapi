import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import type { Project } from "../../lib/api.js";
import { DataTable, LoadingSpinner, EmptyState, StatusBadge } from "../../components/ui/index.js";
import type { Column } from "../../components/ui/index.js";

interface KeysPageProps {
  adminKey: string;
}

interface KeyRow {
  apiKeyId: string;
  projectId: string;
  projectName: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
}

const columns: Column<KeyRow>[] = [
  { key: "apiKeyId", header: "Key ID", render: (r) => <code className="text-xs">{r.apiKeyId}</code> },
  { key: "project", header: "Project", render: (r) => <span className="text-gray-300">{r.projectName}</span> },
  { key: "requests", header: "Requests", render: (r) => r.requestCount },
  {
    key: "successRate",
    header: "Success Rate",
    render: (r) => {
      const rate = r.requestCount > 0 ? ((r.successCount / r.requestCount) * 100).toFixed(0) : "0";
      return (
        <StatusBadge
          variant={Number(rate) >= 95 ? "active" : Number(rate) >= 70 ? "degraded" : "error"}
          label={`${rate}%`}
        />
      );
    },
  },
  { key: "avgLatency", header: "Avg Latency", render: (r) => `${Math.round(r.avgLatencyMs)}ms` },
];

export function KeysPage({ adminKey }: KeysPageProps) {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const projects = await api.listProjects(adminKey);
      const allRows: KeyRow[] = [];

      await Promise.all(
        projects.map(async (p: Project) => {
          try {
            const { keys } = await api.getPerKeyStats(adminKey, p.id);
            for (const k of keys) {
              allRows.push({ ...k, projectId: p.id, projectName: p.name });
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

  if (loading) return <LoadingSpinner label="Loading key stats..." />;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6">API Keys</h1>
      {rows.length === 0 ? (
        <EmptyState message="No API key usage data available." />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.projectId}-${r.apiKeyId}`} />
      )}
    </div>
  );
}

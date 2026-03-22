import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import type { UsageEvent, PaginatedResult, Project, ProviderInfo } from "../../lib/api.js";
import { DataTable, Pagination, LoadingSpinner, StatusBadge, EmptyState, DateRangePicker } from "../../components/ui/index.js";
import type { Column } from "../../components/ui/index.js";

interface UsagePageProps {
  adminKey: string;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

const columns: Column<UsageEvent>[] = [
  { key: "createdAt", header: "Timestamp", render: (r) => <span className="text-xs text-gray-400">{formatTimestamp(r.createdAt)}</span> },
  { key: "requestId", header: "Request ID", render: (r) => <code className="text-xs">{r.requestId.slice(0, 12)}</code> },
  { key: "capability", header: "Capability", render: (r) => r.capability },
  { key: "provider", header: "Provider", render: (r) => r.provider },
  {
    key: "success",
    header: "Status",
    render: (r) => <StatusBadge variant={r.success ? "active" : "error"} label={r.success ? "OK" : `${r.statusCode}`} />,
  },
  { key: "latencyMs", header: "Latency", render: (r) => `${r.latencyMs}ms` },
  { key: "resultCount", header: "Results", render: (r) => r.resultCount },
  { key: "fallbackCount", header: "Fallbacks", render: (r) => <span className={r.fallbackCount > 0 ? "text-orange-400" : "text-gray-500"}>{r.fallbackCount}</span> },
];

function buildCsv(items: UsageEvent[]): string {
  const header = "Timestamp,Request ID,Project ID,API Key ID,Capability,Provider,Status,Status Code,Latency (ms),Results,Fallbacks";
  const rows = items.map((r) =>
    [
      r.createdAt ?? "",
      r.requestId,
      r.projectId,
      r.apiKeyId,
      r.capability,
      r.provider,
      r.success ? "OK" : "Failed",
      r.statusCode,
      r.latencyMs,
      r.resultCount,
      r.fallbackCount,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

function downloadCsv(items: UsageEvent[]) {
  const csv = buildCsv(items);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `usage-records-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function UsagePage({ adminKey }: UsagePageProps) {
  const [result, setResult] = useState<PaginatedResult<UsageEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [capability, setCapability] = useState("");
  const [success, setSuccess] = useState("");
  const [projectId, setProjectId] = useState("");
  const [apiKeyId, setApiKeyId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [provider, setProvider] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    api.listProjects(adminKey).then(setProjects).catch(() => {});
    api.listProviders(adminKey).then((r) => setProviders(r.providers)).catch(() => {});
  }, [adminKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (capability) params.capability = capability;
      if (success) params.success = success;
      if (projectId) params.projectId = projectId;
      if (provider) params.provider = provider;
      if (apiKeyId) params.apiKeyId = apiKeyId;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;

      const data = await api.queryUsageEvents(adminKey, params);
      setResult(data);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminKey, page, pageSize, capability, success, projectId, apiKeyId, provider, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Usage Records</h1>
        {result && result.items.length > 0 && (
          <button
            data-testid="csv-export"
            onClick={() => downloadCsv(result.items)}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm rounded text-gray-200"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          value={projectId}
          onChange={(e) => { setProjectId(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="API Key ID"
          value={apiKeyId}
          onChange={(e) => { setApiKeyId(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 w-36"
        />
        <select
          value={capability}
          onChange={(e) => { setCapability(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
        >
          <option value="">All capabilities</option>
          <option value="search.web">search.web</option>
          <option value="search.news">search.news</option>
          <option value="search.images">search.images</option>
        </select>
        <select
          data-testid="provider-filter"
          value={provider}
          onChange={(e) => { setProvider(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.id}</option>
          ))}
        </select>
        <select
          value={success}
          onChange={(e) => { setSuccess(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
        >
          <option value="">All statuses</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>
      </div>

      {/* Date range */}
      <div className="mb-4">
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); setPage(1); }}
        />
      </div>

      {loading && <LoadingSpinner label="Loading usage records..." />}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && result && (
        <>
          {result.items.length === 0 ? (
            <EmptyState message="No usage records match your filters." />
          ) : (
            <DataTable columns={columns} rows={result.items} rowKey={(r) => r.requestId} />
          )}
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </>
      )}
    </div>
  );
}

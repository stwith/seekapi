import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import type { UsageEvent, PaginatedResult } from "../../lib/api.js";
import { DataTable, Pagination, LoadingSpinner, StatusBadge, EmptyState } from "../../components/ui/index.js";
import type { Column } from "../../components/ui/index.js";

interface UsagePageProps {
  adminKey: string;
}

const columns: Column<UsageEvent>[] = [
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
];

export function UsagePage({ adminKey }: UsagePageProps) {
  const [result, setResult] = useState<PaginatedResult<UsageEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [capability, setCapability] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (capability) params.capability = capability;
      if (success) params.success = success;

      const data = await api.queryUsageEvents(adminKey, params);
      setResult(data);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminKey, page, pageSize, capability, success]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-4">Usage Records</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4 items-center">
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
          value={success}
          onChange={(e) => { setSuccess(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
        >
          <option value="">All statuses</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>
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

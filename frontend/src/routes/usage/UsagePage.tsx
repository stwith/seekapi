import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { UsageEvent, PaginatedResult, Project, ProviderInfo, ApiKeyInfo } from "@/lib/api.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { EmptyState } from "@/components/ui/empty-state.js";
import { LoadingSpinner } from "@/components/ui/loading-skeleton.js";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { FormField } from "@/components/ui/form-field.js";
import { Alert, AlertDescription } from "@/components/ui/shadcn/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { AlertCircle, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header.js";
import { formatDate } from "@/lib/format.js";

interface UsagePageProps {
  adminKey: string;
}


function buildCsv(items: UsageEvent[]): string {
  const header = "Timestamp,Request ID,Project ID,API Key ID,Capability,Provider,Status,Status Code,Latency (ms),Results,Fallbacks";
  const rows = items.map((r) =>
    [r.createdAt ?? "", r.requestId, r.projectId, r.apiKeyId, r.capability, r.provider, r.success ? "OK" : "Failed", r.statusCode, r.latencyMs, r.resultCount, r.fallbackCount].join(","),
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
  const { t } = useTranslation();
  const [result, setResult] = useState<PaginatedResult<UsageEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [capability, setCapability] = useState("");
  const [success, setSuccess] = useState("");
  const [projectId, setProjectId] = useState("");
  const [apiKeyId, setApiKeyId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [provider, setProvider] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);

  useEffect(() => {
    api.listProjects(adminKey).then(setProjects).catch(() => {});
    api.listProviders(adminKey).then((r) => setProviders(r.providers)).catch(() => {});
  }, [adminKey]);

  // Load keys for selected project
  useEffect(() => {
    if (!projectId) {
      setApiKeys([]);
      return;
    }
    api.listProjectKeys(adminKey, projectId).then(setApiKeys).catch(() => setApiKeys([]));
  }, [adminKey, projectId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
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

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <PageHeader
        title={t("usage.title")}
        actions={
          result && result.items.length > 0 ? (
            <Button data-testid="csv-export" variant="outline" size="sm" onClick={() => downloadCsv(result.items)}>
              <Download className="size-3.5 mr-1.5" />
              {t("usage.exportCsv")}
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <FormField label={t("common.project")}>
          <Select value={projectId || "__all__"} onValueChange={(v) => { setProjectId(v === "__all__" ? "" : v); setApiKeyId(""); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("common.allProjects")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.allProjects")}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {/* API Key - loaded per project */}

        <FormField label={t("usage.apiKeyId")}>
          <Select
            value={apiKeyId || "__all__"}
            onValueChange={(v) => { setApiKeyId(v === "__all__" ? "" : v); setPage(1); }}
            disabled={!projectId}
          >
            <SelectTrigger className="w-44" aria-label={t("usage.apiKeyId")}>
              <SelectValue placeholder={projectId ? t("usage.allKeys") : t("usage.selectProjectFirst")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("usage.allKeys")}</SelectItem>
              {apiKeys.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.id.slice(0, 16)}…
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label={t("common.capability")}>
          <Select value={capability || "__all__"} onValueChange={(v) => { setCapability(v === "__all__" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("common.allCapabilities")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.allCapabilities")}</SelectItem>
              <SelectItem value="search.web">search.web</SelectItem>
              <SelectItem value="search.news">search.news</SelectItem>
              <SelectItem value="search.images">search.images</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label={t("common.provider")}>
          <Select value={provider || "__all__"} onValueChange={(v) => { setProvider(v === "__all__" ? "" : v); setPage(1); }}>
            <SelectTrigger data-testid="provider-filter" className="w-36">
              <SelectValue placeholder={t("common.allProviders")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.allProviders")}</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label={t("common.status")}>
          <Select value={success || "__all__"} onValueChange={(v) => { setSuccess(v === "__all__" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder={t("common.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.allStatuses")}</SelectItem>
              <SelectItem value="true">{t("common.success")}</SelectItem>
              <SelectItem value="false">{t("common.failed")}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {/* Date range */}
      <div className="flex gap-4 mb-6 items-end">
        <FormField label={t("usage.from")} htmlFor="date-from">
          <Input id="date-from" type="datetime-local" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-48" />
        </FormField>
        <FormField label={t("usage.to")} htmlFor="date-to">
          <Input id="date-to" type="datetime-local" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-48" />
        </FormField>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}>
            {t("usage.clearDates")}
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <LoadingSpinner label={t("usage.loadingUsage")} />
      ) : result && result.items.length === 0 ? (
        <EmptyState message={t("usage.noRecords")} />
      ) : result ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("usage.timestamp")}</TableHead>
                <TableHead>{t("usage.requestId")}</TableHead>
                <TableHead>{t("common.capability")}</TableHead>
                <TableHead>{t("common.provider")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("usage.latency")}</TableHead>
                <TableHead>{t("usage.results")}</TableHead>
                <TableHead>{t("usage.fallbacks")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((r) => (
                <TableRow key={r.requestId} className="transition-colors hover:bg-muted/50">
                  <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.requestId.slice(0, 12)}</TableCell>
                  <TableCell className="text-sm">{r.capability}</TableCell>
                  <TableCell className="text-sm">{r.provider}</TableCell>
                  <TableCell>
                    <StatusBadge variant={r.success ? "active" : "error"} label={r.success ? "OK" : `${r.statusCode}`} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.latencyMs}ms</TableCell>
                  <TableCell className="font-mono text-xs">{r.resultCount}</TableCell>
                  <TableCell className={`font-mono text-xs ${r.fallbackCount > 0 ? "text-orange-400" : "text-muted-foreground"}`}>
                    {r.fallbackCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Simple pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              {t("usage.pageInfo", { page: result.page, total: Math.ceil(result.total / result.pageSize) || 1, count: result.total })}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}>
                {t("common.previous")}
              </Button>
              <Button variant="outline" size="sm" disabled={result.page * result.pageSize >= result.total} onClick={() => setPage(result.page + 1)}>
                {t("common.next")}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

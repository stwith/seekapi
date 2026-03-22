import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { DashboardStats, TimeSeriesPoint, CapabilityBreakdown, ProviderBreakdown, Project } from "@/lib/api.js";
import { StatDisplay } from "@/components/ui/stat-display.js";
import { LoadingSpinner } from "@/components/ui/loading-skeleton.js";
import { Alert, AlertDescription } from "@/components/ui/shadcn/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import { AlertCircle, ServerCrash } from "lucide-react";
import { Badge } from "@/components/ui/shadcn/badge";
import { PageHeader } from "@/components/ui/page-header.js";

interface DashboardProps {
  adminKey: string;
}

export function Dashboard({ adminKey }: DashboardProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityBreakdown[]>([]);
  const [providerBreakdown, setProviderBreakdown] = useState<ProviderBreakdown[]>([]);
  const [activeKeyCount, setActiveKeyCount] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    api.listProjects(adminKey).then(setProjects).catch(() => {});
    fetch("/v1/health").then((r) => setHealthy(r.ok)).catch(() => setHealthy(false));
  }, [adminKey]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedProject) params.projectId = selectedProject;

      const [s, ts, cb, pb] = await Promise.all([
        api.getDashboardStats(adminKey, Object.keys(params).length > 0 ? params : undefined),
        api.getTimeSeries(adminKey, { granularity: "hour", ...params }),
        api.getCapabilityBreakdown(adminKey, Object.keys(params).length > 0 ? params : undefined),
        api.getProviderBreakdown(adminKey, Object.keys(params).length > 0 ? params : undefined),
      ]);
      setStats(s);
      setSeries(ts.series);
      setCapabilities(cb.capabilities);
      setProviderBreakdown(pb.providers);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminKey, selectedProject]);

  useEffect(() => {
    (async () => {
      try {
        const projs = await api.listProjects(adminKey);
        const targetProjs = selectedProject
          ? projs.filter((p) => p.id === selectedProject)
          : projs;
        let count = 0;
        await Promise.all(
          targetProjs.map(async (p) => {
            try {
              const keys = await api.listProjectKeys(adminKey, p.id);
              count += keys.filter((k) => k.status === "active").length;
            } catch { /* skip */ }
          }),
        );
        setActiveKeyCount(count);
      } catch { /* non-critical */ }
    })();
  }, [adminKey, selectedProject]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  if (loading) return <LoadingSpinner label={t("dashboard.loadingDashboard")} />;

  if (error) {
    return (
      <div>
        <PageHeader title={t("dashboard.title")} />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!stats) return null;

  const successRate = stats.totalRequests > 0
    ? ((stats.successCount / stats.totalRequests) * 100).toFixed(1)
    : "0";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
        {healthy !== null && (
          healthy ? (
            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600" data-testid="health-status">{t("overview.connected")}</Badge>
          ) : (
            <Badge variant="destructive" data-testid="health-status">
              <ServerCrash className="mr-1 size-3" />
              {t("overview.unreachable")}
            </Badge>
          )
        )}
        <div className="ml-auto">
          <Select
            value={selectedProject || "__all__"}
            onValueChange={(v) => setSelectedProject(v === "__all__" ? "" : v)}
          >
            <SelectTrigger data-testid="project-filter" className="w-48" aria-label={t("common.allProjects")}>
              <SelectValue placeholder={t("common.allProjects")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.allProjects")}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div data-testid="stats-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatDisplay label={t("dashboard.totalRequests")} value={stats.totalRequests} />
        <StatDisplay label={t("dashboard.successRate")} value={`${successRate}%`} />
        <StatDisplay label={t("dashboard.failures")} value={stats.failureCount} accent={stats.failureCount > 0 ? "destructive" : "muted"} />
        <StatDisplay label={t("dashboard.avgLatency")} value={`${Math.round(stats.avgLatencyMs)}ms`} accent="warning" />
        <StatDisplay label={t("dashboard.activeKeys")} value={activeKeyCount} />
      </div>

      {/* Time series */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("dashboard.requestVolume")}</h2>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <div data-testid="time-series" className="divide-y divide-border">
            {series.map((point) => {
              const maxCount = Math.max(...series.map((p) => p.count), 1);
              const pct = (point.count / maxCount) * 100;
              return (
                <div key={point.bucket} className="flex items-center gap-3 py-1.5 text-xs">
                  <span className="w-40 font-mono text-muted-foreground shrink-0">
                    {new Date(point.bucket).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex-1 bg-muted rounded-sm h-3 overflow-hidden">
                    <div className="bg-primary h-full rounded-sm transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right font-mono text-muted-foreground">{point.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Provider breakdown */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("dashboard.providerBreakdown")}</h2>
        {providerBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <div data-testid="provider-breakdown" className="divide-y divide-border">
            {providerBreakdown.map((pb) => (
              <div key={pb.provider} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium">{pb.provider}</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {pb.requestCount} req · {pb.successCount} ok · {Math.round(pb.avgLatencyMs)}ms avg
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Capability breakdown */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("dashboard.capabilityBreakdown")}</h2>
        {capabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <div data-testid="capability-breakdown" className="divide-y divide-border">
            {capabilities.map((cap) => (
              <div key={cap.capability} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{cap.capability}</span>
                <span className="text-sm font-mono font-medium">{cap.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

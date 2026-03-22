import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { ProviderInfo, ProviderBreakdown } from "@/lib/api.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { Alert, AlertDescription } from "@/components/ui/shadcn/alert";
import { EmptyState } from "@/components/ui/empty-state.js";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header.js";
import { formatDate } from "@/lib/format.js";

interface ProvidersPageProps {
  adminKey: string;
}

interface ProviderHealth {
  provider: string;
  status: string;
  latency_ms?: number;
  checked_at?: string;
}

export function ProvidersPage({ adminKey }: ProvidersPageProps) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, ProviderHealth>>({});
  const [stats, setStats] = useState<Record<string, ProviderBreakdown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [provResult, breakdownResult] = await Promise.all([
          api.listProviders(adminKey),
          api.getProviderBreakdown(adminKey),
        ]);
        setProviders(provResult.providers);

        const statsMap: Record<string, ProviderBreakdown> = {};
        for (const pb of breakdownResult.providers) {
          statsMap[pb.provider] = pb;
        }
        setStats(statsMap);

        try {
          const healthRes = await fetch("/v1/health/providers", {
            headers: { Authorization: `Bearer ${adminKey}` },
          });
          if (healthRes.ok) {
            const data = await healthRes.json();
            const hMap: Record<string, ProviderHealth> = {};
            for (const h of (data.providers ?? []) as ProviderHealth[]) {
              hMap[h.provider] = h;
            }
            setHealthMap(hMap);
          }
        } catch {
          // Health endpoint may not be accessible with admin key
        }

        setError(null);
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [adminKey]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t("providers.title")} />
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title={t("providers.title")} />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("providers.title")} />

      {providers.length === 0 ? (
        <EmptyState message={t("providers.noProviders")} />
      ) : (
        <div data-testid="providers-list" className="divide-y divide-border">
          {providers.map((p) => {
            const health = healthMap[p.id];
            const stat = stats[p.id];
            return (
              <div key={p.id} className="py-4 first:pt-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <h2 className="font-medium">{p.id}</h2>
                    {health && (
                      <StatusBadge
                        variant={health.status === "healthy" ? "healthy" : health.status === "degraded" ? "degraded" : "unavailable"}
                        label={health.status}
                      />
                    )}
                  </div>
                  {stat && (
                    <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                      <span>{stat.requestCount} req</span>
                      <span className="text-emerald-500">{stat.successCount} ok</span>
                      {stat.failureCount > 0 && (
                        <span className="text-red-500">{stat.failureCount} fail</span>
                      )}
                      <span>{Math.round(stat.avgLatencyMs)}ms avg</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {p.capabilities.join(", ")}
                </p>
                {health?.latency_ms !== undefined && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Health latency: {health.latency_ms}ms · Checked: {formatDate(health.checked_at)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

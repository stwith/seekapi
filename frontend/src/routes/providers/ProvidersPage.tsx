import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import type { ProviderInfo, ProviderBreakdown } from "../../lib/api.js";
import { LoadingSpinner, StatusBadge } from "../../components/ui/index.js";

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

        // Try to fetch health (requires downstream API key, may fail)
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

  if (loading) return <LoadingSpinner label="Loading providers..." />;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6">Providers</h1>

      {providers.length === 0 ? (
        <p className="text-gray-500 text-sm">No providers registered.</p>
      ) : (
        <div data-testid="providers-list" className="space-y-4">
          {providers.map((p) => {
            const health = healthMap[p.id];
            const stat = stats[p.id];
            return (
              <div key={p.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-white">{p.id}</h2>
                  {health && (
                    <StatusBadge
                      variant={health.status === "healthy" ? "healthy" : health.status === "degraded" ? "degraded" : "unavailable"}
                      label={health.status}
                    />
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-2">
                  Capabilities: {p.capabilities.join(", ")}
                </p>
                {health?.latency_ms !== undefined && (
                  <p className="text-xs text-gray-500">
                    Health latency: {health.latency_ms}ms &middot; Checked: {health.checked_at ? new Date(health.checked_at).toLocaleString() : "—"}
                  </p>
                )}
                {stat && (
                  <p className="text-xs text-gray-500 mt-1">
                    Requests: {stat.requestCount} &middot; Success: {stat.successCount} &middot; Failures: {stat.failureCount} &middot; Avg latency: {Math.round(stat.avgLatencyMs)}ms
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

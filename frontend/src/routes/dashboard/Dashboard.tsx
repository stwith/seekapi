import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import type { DashboardStats, TimeSeriesPoint, CapabilityBreakdown, ProviderBreakdown, Project } from "../../lib/api.js";
import { StatCard, LoadingSpinner } from "../../components/ui/index.js";

interface DashboardProps {
  adminKey: string;
}

export function Dashboard({ adminKey }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityBreakdown[]>([]);
  const [providerBreakdown, setProviderBreakdown] = useState<ProviderBreakdown[]>([]);
  const [activeKeyCount, setActiveKeyCount] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load projects once
  useEffect(() => {
    api.listProjects(adminKey).then(setProjects).catch(() => {});
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

  // Load active key count
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
            } catch {
              // skip
            }
          }),
        );
        setActiveKeyCount(count);
      } catch {
        // non-critical
      }
    })();
  }, [adminKey, selectedProject]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!stats) return null;

  const successRate = stats.totalRequests > 0
    ? ((stats.successCount / stats.totalRequests) * 100).toFixed(1)
    : "0";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <select
          data-testid="project-filter"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Stats cards */}
      <div data-testid="stats-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Requests" value={stats.totalRequests} accent="teal" />
        <StatCard label="Success Rate" value={`${successRate}%`} accent="teal" />
        <StatCard label="Failures" value={stats.failureCount} accent={stats.failureCount > 0 ? "red" : "gray"} />
        <StatCard label="Avg Latency" value={`${Math.round(stats.avgLatencyMs)}ms`} accent="orange" />
        <StatCard label="Active Keys" value={activeKeyCount} accent="teal" />
      </div>

      {/* Time series (text-based chart) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Request Volume (Hourly)</h2>
        {series.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet.</p>
        ) : (
          <div data-testid="time-series" className="space-y-1">
            {series.map((point) => {
              const maxCount = Math.max(...series.map((p) => p.count), 1);
              const pct = (point.count / maxCount) * 100;
              return (
                <div key={point.bucket} className="flex items-center gap-3 text-xs">
                  <span className="w-40 text-gray-500 shrink-0">
                    {new Date(point.bucket).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex-1 bg-gray-800 rounded h-4 overflow-hidden">
                    <div
                      className="bg-primary-600 h-full rounded transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-gray-400">{point.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Provider breakdown */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Provider Breakdown</h2>
        {providerBreakdown.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet.</p>
        ) : (
          <div data-testid="provider-breakdown" className="space-y-2">
            {providerBreakdown.map((pb) => (
              <div key={pb.provider} className="flex items-center justify-between bg-gray-800 rounded px-4 py-2">
                <span className="text-sm text-gray-300">{pb.provider}</span>
                <span className="text-sm text-gray-400">
                  {pb.requestCount} reqs &middot; {pb.successCount} ok &middot; {Math.round(pb.avgLatencyMs)}ms avg
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Capability breakdown */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Capability Breakdown</h2>
        {capabilities.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet.</p>
        ) : (
          <div data-testid="capability-breakdown" className="space-y-2">
            {capabilities.map((cap) => (
              <div key={cap.capability} className="flex items-center justify-between bg-gray-800 rounded px-4 py-2">
                <span className="text-sm text-gray-300">{cap.capability}</span>
                <span className="text-sm font-medium text-white">{cap.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

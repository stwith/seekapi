import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import type { ProjectQuota, Project } from "../../lib/api.js";
import { LoadingSpinner, EmptyState, StatusBadge, Modal, ConfirmDialog } from "../../components/ui/index.js";

interface SubscriptionsPageProps {
  adminKey: string;
}

interface EnrichedQuota extends ProjectQuota {
  projectName: string;
  currentKeyCount: number;
}

function usagePercent(current: number, limit: number | null): number | null {
  if (limit === null || limit === 0) return null;
  return Math.min(100, (current / limit) * 100);
}

function barColor(pct: number | null): string {
  if (pct === null) return "bg-gray-600";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-orange-500";
  return "bg-primary-500";
}

function QuotaCard({
  quota,
  onEdit,
  onToggleStatus,
}: {
  quota: EnrichedQuota;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const dailyPct = usagePercent(quota.currentDailyUsage, quota.dailyRequestLimit);
  const monthlyPct = usagePercent(quota.currentMonthlyUsage, quota.monthlyRequestLimit);

  return (
    <div data-testid="quota-card" className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white truncate">{quota.projectName}</h3>
        <StatusBadge variant={quota.status === "active" ? "active" : "suspended"} />
      </div>

      {/* Daily usage */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Daily</span>
          <span>
            {quota.currentDailyUsage} / {quota.dailyRequestLimit ?? "\u221e"}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded overflow-hidden">
          <div
            className={`h-full rounded transition-all ${barColor(dailyPct)}`}
            style={{ width: `${dailyPct ?? 0}%` }}
          />
        </div>
      </div>

      {/* Monthly usage */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Monthly</span>
          <span>
            {quota.currentMonthlyUsage} / {quota.monthlyRequestLimit ?? "\u221e"}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded overflow-hidden">
          <div
            className={`h-full rounded transition-all ${barColor(monthlyPct)}`}
            style={{ width: `${monthlyPct ?? 0}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-gray-500 mb-3">
        Keys: {quota.currentKeyCount} / {quota.maxKeys} &middot; RPM: {quota.rateLimitRpm}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm rounded text-gray-200"
        >
          Edit Quota
        </button>
        <button
          data-testid="toggle-status"
          onClick={onToggleStatus}
          className={`flex-1 px-3 py-1.5 text-sm rounded ${
            quota.status === "active"
              ? "bg-red-900/50 hover:bg-red-800 text-red-300"
              : "bg-green-900/50 hover:bg-green-800 text-green-300"
          }`}
        >
          {quota.status === "active" ? "Suspend" : "Activate"}
        </button>
      </div>
    </div>
  );
}

export function SubscriptionsPage({ adminKey }: SubscriptionsPageProps) {
  const [quotas, setQuotas] = useState<EnrichedQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EnrichedQuota | null>(null);
  const [form, setForm] = useState({ daily: "", monthly: "", maxKeys: "", rpm: "" });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<EnrichedQuota | null>(null);

  const load = useCallback(async () => {
    try {
      const [quotaData, projects] = await Promise.all([
        api.listQuotas(adminKey),
        api.listProjects(adminKey),
      ]);

      const projectMap = new Map<string, Project>();
      for (const p of projects) projectMap.set(p.id, p);

      // Fetch key counts per project
      const keyCounts = new Map<string, number>();
      await Promise.all(
        quotaData.quotas.map(async (q) => {
          try {
            const keys = await api.listProjectKeys(adminKey, q.projectId);
            keyCounts.set(q.projectId, keys.length);
          } catch {
            keyCounts.set(q.projectId, 0);
          }
        }),
      );

      const enriched: EnrichedQuota[] = quotaData.quotas.map((q) => ({
        ...q,
        projectName: projectMap.get(q.projectId)?.name ?? q.projectId.slice(0, 12),
        currentKeyCount: keyCounts.get(q.projectId) ?? 0,
      }));

      setQuotas(enriched);
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

  function openEdit(quota: EnrichedQuota) {
    setEditing(quota);
    setForm({
      daily: quota.dailyRequestLimit?.toString() ?? "",
      monthly: quota.monthlyRequestLimit?.toString() ?? "",
      maxKeys: quota.maxKeys.toString(),
      rpm: quota.rateLimitRpm.toString(),
    });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.updateProjectQuota(adminKey, editing.projectId, {
        dailyRequestLimit: form.daily ? Number(form.daily) : null,
        monthlyRequestLimit: form.monthly ? Number(form.monthly) : null,
        maxKeys: Number(form.maxKeys) || 10,
        rateLimitRpm: Number(form.rpm) || 60,
      });
      setEditing(null);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!toggling) return;
    try {
      const newStatus = toggling.status === "active" ? "suspended" : "active";
      await api.updateProjectQuota(adminKey, toggling.projectId, { status: newStatus });
      setToggling(null);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  if (loading) return <LoadingSpinner label="Loading quotas..." />;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6">Subscriptions & Quotas</h1>

      {quotas.length === 0 ? (
        <EmptyState message="No quota configurations yet. Create a project and set its quota." />
      ) : (
        <div data-testid="quota-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quotas.map((q) => (
            <QuotaCard
              key={q.projectId}
              quota={q}
              onEdit={() => openEdit(q)}
              onToggleStatus={() => setToggling(q)}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit Quota"
      >
        <div className="space-y-3">
          <label className="block text-sm text-gray-300">
            Daily Request Limit (empty = unlimited)
            <input
              type="number"
              value={form.daily}
              onChange={(e) => setForm({ ...form, daily: e.target.value })}
              className="mt-1 w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200"
              placeholder="unlimited"
            />
          </label>
          <label className="block text-sm text-gray-300">
            Monthly Request Limit (empty = unlimited)
            <input
              type="number"
              value={form.monthly}
              onChange={(e) => setForm({ ...form, monthly: e.target.value })}
              className="mt-1 w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200"
              placeholder="unlimited"
            />
          </label>
          <label className="block text-sm text-gray-300">
            Max Keys
            <input
              type="number"
              value={form.maxKeys}
              onChange={(e) => setForm({ ...form, maxKeys: e.target.value })}
              className="mt-1 w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200"
            />
          </label>
          <label className="block text-sm text-gray-300">
            Rate Limit (RPM)
            <input
              type="number"
              value={form.rpm}
              onChange={(e) => setForm({ ...form, rpm: e.target.value })}
              className="mt-1 w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200"
            />
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded disabled:opacity-50 mt-2"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Modal>

      {/* Suspend/Activate confirmation */}
      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.status === "active" ? "Suspend Project" : "Activate Project"}
        message={`Are you sure you want to ${toggling?.status === "active" ? "suspend" : "activate"} ${toggling?.projectName ?? "this project"}?`}
        confirmLabel={toggling?.status === "active" ? "Suspend" : "Activate"}
        onConfirm={handleToggleStatus}
        onCancel={() => setToggling(null)}
      />
    </div>
  );
}

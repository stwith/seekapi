import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { ProjectQuota, Project } from "@/lib/api.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { EmptyState } from "@/components/ui/empty-state.js";
import { ConfirmDialog } from "@/components/ui/confirm-dialog.js";
import { LoadingSpinner } from "@/components/ui/loading-skeleton.js";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { FormField } from "@/components/ui/form-field.js";
import { Alert, AlertDescription } from "@/components/ui/shadcn/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/shadcn/dialog";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header.js";

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

function barColorClass(pct: number | null): string {
  if (pct === null) return "bg-muted-foreground/30";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-orange-500";
  return "bg-primary";
}

function QuotaItem({
  quota,
  onEdit,
  onToggleStatus,
}: {
  quota: EnrichedQuota;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const { t } = useTranslation();
  const dailyPct = usagePercent(quota.currentDailyUsage, quota.dailyRequestLimit);
  const monthlyPct = usagePercent(quota.currentMonthlyUsage, quota.monthlyRequestLimit);

  return (
    <div data-testid="quota-card" className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold truncate">{quota.projectName}</h3>
        <StatusBadge variant={quota.status === "active" ? "active" : "suspended"} />
      </div>

      {/* Daily */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{t("subscriptions.daily")}</span>
          <span className="font-mono">{quota.currentDailyUsage} / {quota.dailyRequestLimit ?? "\u221e"}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", barColorClass(dailyPct))} style={{ width: `${dailyPct ?? 0}%` }} />
        </div>
      </div>

      {/* Monthly */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{t("subscriptions.monthly")}</span>
          <span className="font-mono">{quota.currentMonthlyUsage} / {quota.monthlyRequestLimit ?? "\u221e"}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", barColorClass(monthlyPct))} style={{ width: `${monthlyPct ?? 0}%` }} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-3 font-mono">
        Keys: {quota.currentKeyCount}/{quota.maxKeys} · RPM: {quota.rateLimitRpm}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
          {t("subscriptions.editQuota")}
        </Button>
        <Button
          data-testid="toggle-status"
          variant={quota.status === "active" ? "destructive" : "default"}
          size="sm"
          className="flex-1"
          onClick={onToggleStatus}
        >
          {quota.status === "active" ? t("subscriptions.suspend") : t("subscriptions.activate")}
        </Button>
      </div>
    </div>
  );
}

export function SubscriptionsPage({ adminKey }: SubscriptionsPageProps) {
  const { t } = useTranslation();
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

  useEffect(() => { void load(); }, [load]);

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

  if (loading) return <LoadingSpinner label={t("subscriptions.loadingQuotas")} />;

  if (error && quotas.length === 0) {
    return (
      <div>
        <PageHeader title={t("subscriptions.title")} />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">{t("subscriptions.title")}</h1>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {quotas.length === 0 ? (
        <EmptyState message={t("subscriptions.noQuotas")} />
      ) : (
        <div data-testid="quota-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {quotas.map((q) => (
            <QuotaItem
              key={q.projectId}
              quota={q}
              onEdit={() => openEdit(q)}
              onToggleStatus={() => setToggling(q)}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("subscriptions.editQuota")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label={t("subscriptions.dailyLimit")} htmlFor="quota-daily">
              <Input id="quota-daily" type="number" value={form.daily} onChange={(e) => setForm({ ...form, daily: e.target.value })} placeholder={t("subscriptions.unlimited")} />
            </FormField>
            <FormField label={t("subscriptions.monthlyLimit")} htmlFor="quota-monthly">
              <Input id="quota-monthly" type="number" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} placeholder={t("subscriptions.unlimited")} />
            </FormField>
            <FormField label={t("subscriptions.maxKeys")} htmlFor="quota-keys">
              <Input id="quota-keys" type="number" value={form.maxKeys} onChange={(e) => setForm({ ...form, maxKeys: e.target.value })} />
            </FormField>
            <FormField label={t("subscriptions.rateLimitRpm")} htmlFor="quota-rpm">
              <Input id="quota-rpm" type="number" value={form.rpm} onChange={(e) => setForm({ ...form, rpm: e.target.value })} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.status === "active" ? t("subscriptions.suspendProject") : t("subscriptions.activateProject")}
        message={toggling?.status === "active" ? t("subscriptions.suspendConfirm", { name: toggling?.projectName ?? "" }) : t("subscriptions.activateConfirm", { name: toggling?.projectName ?? "" })}
        confirmLabel={toggling?.status === "active" ? t("subscriptions.suspend") : t("subscriptions.activate")}
        variant={toggling?.status === "active" ? "destructive" : "default"}
        onConfirm={handleToggleStatus}
        onCancel={() => setToggling(null)}
      />
    </div>
  );
}

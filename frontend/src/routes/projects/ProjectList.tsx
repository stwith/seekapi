import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { Project, ProjectQuota } from "@/lib/api.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { Input } from "@/components/ui/shadcn/input";
import { Button } from "@/components/ui/shadcn/button";
import { FormField } from "@/components/ui/form-field.js";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { Alert, AlertDescription } from "@/components/ui/shadcn/alert";
import { EmptyState } from "@/components/ui/empty-state.js";
import { ConfirmDialog } from "@/components/ui/confirm-dialog.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/shadcn/dialog";
import { AlertCircle, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header.js";
import { cn } from "@/lib/utils";

interface ProjectListProps {
  adminKey: string;
}

interface EnrichedProject extends Project {
  quota?: ProjectQuota;
  keyCount: number;
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

export function ProjectList({ adminKey }: ProjectListProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<EnrichedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit quota state
  const [editing, setEditing] = useState<EnrichedProject | null>(null);
  const [form, setForm] = useState({ daily: "", monthly: "", maxKeys: "", rpm: "" });
  const [saving, setSaving] = useState(false);

  // Suspend/activate state
  const [toggling, setToggling] = useState<EnrichedProject | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const [list, quotaData] = await Promise.all([
        api.listProjects(adminKey),
        api.listQuotas(adminKey).catch(() => ({ quotas: [] })),
      ]);

      const quotaMap = new Map<string, ProjectQuota>();
      for (const q of quotaData.quotas) quotaMap.set(q.projectId, q);

      const enriched: EnrichedProject[] = await Promise.all(
        list.map(async (p) => {
          let keyCount = 0;
          try {
            const keys = await api.listProjectKeys(adminKey, p.id);
            keyCount = keys.length;
          } catch { /* ignore */ }
          return { ...p, quota: quotaMap.get(p.id), keyCount };
        }),
      );

      setProjects(enriched);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createProject(adminKey, newName.trim());
      setNewName("");
      await loadProjects();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function openEdit(proj: EnrichedProject) {
    setEditing(proj);
    const q = proj.quota;
    setForm({
      daily: q?.dailyRequestLimit?.toString() ?? "",
      monthly: q?.monthlyRequestLimit?.toString() ?? "",
      maxKeys: (q?.maxKeys ?? 10).toString(),
      rpm: (q?.rateLimitRpm ?? 60).toString(),
    });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.updateProjectQuota(adminKey, editing.id, {
        dailyRequestLimit: form.daily ? Number(form.daily) : null,
        monthlyRequestLimit: form.monthly ? Number(form.monthly) : null,
        maxKeys: Number(form.maxKeys) || 10,
        rateLimitRpm: Number(form.rpm) || 60,
      });
      setEditing(null);
      await loadProjects();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!toggling) return;
    try {
      const newStatus = toggling.quota?.status === "active" ? "suspended" : "active";
      await api.updateProjectQuota(adminKey, toggling.id, { status: newStatus });
      setToggling(null);
      await loadProjects();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader title={t("projects.title")} />

      <form onSubmit={handleCreate} className="mb-6 flex items-end gap-4">
        <FormField label={t("projects.projectName")} htmlFor="new-project">
          <Input
            id="new-project"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("projects.newProjectPlaceholder")}
            className="w-64"
          />
        </FormField>
        <Button type="submit" disabled={creating}>
          {creating ? t("projects.creating") : t("projects.createProject")}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState message={t("projects.noProjects")} />
      ) : (
        <div data-testid="projects-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((p) => {
            const q = p.quota;
            const dailyPct = q ? usagePercent(q.currentDailyUsage, q.dailyRequestLimit) : null;
            const monthlyPct = q ? usagePercent(q.currentMonthlyUsage, q.monthlyRequestLimit) : null;

            return (
              <div key={p.id} className="border border-border rounded-lg p-4 transition-colors hover:bg-muted/30">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{p.name}</h3>
                    <StatusBadge variant={p.status === "active" ? "active" : "disabled"} />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{p.id}</span>
                </div>

                {/* Quota bars */}
                {q ? (
                  <>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{t("subscriptions.daily")}</span>
                        <span className="font-mono">{q.currentDailyUsage} / {q.dailyRequestLimit ?? "\u221e"}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", barColorClass(dailyPct))} style={{ width: `${dailyPct ?? 0}%` }} />
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{t("subscriptions.monthly")}</span>
                        <span className="font-mono">{q.currentMonthlyUsage} / {q.monthlyRequestLimit ?? "\u221e"}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", barColorClass(monthlyPct))} style={{ width: `${monthlyPct ?? 0}%` }} />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3 font-mono">
                      Keys: {p.keyCount}/{q.maxKeys} · RPM: {q.rateLimitRpm}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground mb-3 font-mono">
                    Keys: {p.keyCount}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {q && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                        {t("subscriptions.editQuota")}
                      </Button>
                      <Button
                        data-testid="toggle-status"
                        variant={q.status === "active" ? "destructive" : "default"}
                        size="sm"
                        onClick={() => setToggling(p)}
                      >
                        {q.status === "active" ? t("subscriptions.suspend") : t("subscriptions.activate")}
                      </Button>
                    </>
                  )}
                  <Link to={`/projects/${p.id}`} className="ml-auto">
                    <Button variant="ghost" size="sm">
                      {t("projects.viewDetail")}
                      <ArrowRight className="size-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Quota Dialog */}
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

      {/* Suspend/Activate Confirm */}
      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.quota?.status === "active" ? t("subscriptions.suspendProject") : t("subscriptions.activateProject")}
        message={toggling?.quota?.status === "active"
          ? t("subscriptions.suspendConfirm", { name: toggling?.name ?? "" })
          : t("subscriptions.activateConfirm", { name: toggling?.name ?? "" })}
        confirmLabel={toggling?.quota?.status === "active" ? t("subscriptions.suspend") : t("subscriptions.activate")}
        variant={toggling?.quota?.status === "active" ? "destructive" : "default"}
        onConfirm={handleToggleStatus}
        onCancel={() => setToggling(null)}
      />
    </div>
  );
}

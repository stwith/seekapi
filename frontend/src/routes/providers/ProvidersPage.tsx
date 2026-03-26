import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { ProviderInfo, GlobalCredentialMeta, CredentialUsage, CredentialCapacity } from "@/lib/api.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { Alert, AlertDescription } from "@/components/ui/shadcn/alert";
import { EmptyState } from "@/components/ui/empty-state.js";
import { FormField } from "@/components/ui/form-field.js";
import { ConfirmDialog } from "@/components/ui/confirm-dialog.js";
import { Input } from "@/components/ui/shadcn/input";
import { Button } from "@/components/ui/shadcn/button";
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
import { AlertCircle, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header.js";

interface ProvidersPageProps {
  adminKey: string;
}

export function ProvidersPage({ adminKey }: ProvidersPageProps) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global credential pool state
  const [globalCreds, setGlobalCreds] = useState<GlobalCredentialMeta[]>([]);
  const [newCredProvider, setNewCredProvider] = useState("");
  const [newCredName, setNewCredName] = useState("");
  const [newCredSecret, setNewCredSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<GlobalCredentialMeta | null>(null);

  // Edit state
  const [editTarget, setEditTarget] = useState<GlobalCredentialMeta | null>(null);
  const [editName, setEditName] = useState("");

  // Usage/capacity state [AC8]
  const [credUsage, setCredUsage] = useState<Record<string, CredentialUsage>>({});
  const [credCapacity, setCredCapacity] = useState<Record<string, CredentialCapacity>>({});

  useEffect(() => {
    (async () => {
      try {
        const [provResult, credsResult] = await Promise.all([
          api.listProviders(adminKey),
          api.listGlobalCredentials(adminKey).catch(() => ({ credentials: [] })),
        ]);
        setProviders(provResult.providers);
        setGlobalCreds(credsResult.credentials);

        // Fetch usage and capacity for each credential [AC8]
        const creds = credsResult.credentials ?? [];
        const usageMap: Record<string, CredentialUsage> = {};
        const capMap: Record<string, CredentialCapacity> = {};
        await Promise.all(
          creds.map(async (cred: GlobalCredentialMeta) => {
            try {
              usageMap[cred.id] = await api.getCredentialUsage(adminKey, cred.id);
            } catch { /* no usage data */ }
            try {
              capMap[cred.id] = await api.getCredentialCapacity(adminKey, cred.id);
            } catch { /* no capacity set */ }
          }),
        );
        setCredUsage(usageMap);
        setCredCapacity(capMap);

        if (provResult.providers.length > 0) {
          const defaultProv = provResult.providers[0]!.id;
          setNewCredProvider((prev) => prev || defaultProv);
          const count = (credsResult.credentials ?? []).filter((c: GlobalCredentialMeta) => c.provider === defaultProv).length;
          setNewCredName((prev) => prev || `${defaultProv}-${count + 1}`);
        }

        setError(null);
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [adminKey]);

  function generateDefaultName(provider: string): string {
    const existing = globalCreds.filter((c) => c.provider === provider);
    return `${provider}-${existing.length + 1}`;
  }

  async function handleAddCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!newCredProvider || !newCredSecret.trim()) return;
    // Auto-fill name if empty
    if (!newCredName.trim()) {
      setNewCredName(generateDefaultName(newCredProvider));
    }
    const name = newCredName.trim() || generateDefaultName(newCredProvider);
    setSubmitting(true);
    try {
      await api.createGlobalCredential(adminKey, newCredProvider, name, newCredSecret.trim());
      const result = await api.listGlobalCredentials(adminKey);
      setGlobalCreds(result.credentials);
      setNewCredName("");
      setNewCredSecret("");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCredential() {
    if (!deleteTarget) return;
    try {
      await api.deleteGlobalCredential(adminKey, deleteTarget.id);
      const result = await api.listGlobalCredentials(adminKey);
      setGlobalCreds(result.credentials);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleEditSave() {
    if (!editTarget || !editName.trim()) return;
    try {
      await api.updateGlobalCredential(adminKey, editTarget.id, { name: editName.trim() });
      const result = await api.listGlobalCredentials(adminKey);
      setGlobalCreds(result.credentials);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setEditTarget(null);
      setEditName("");
    }
  }

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

  if (error && providers.length === 0) {
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

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Global Credential Pool */}
      <section>

        {globalCreds.length === 0 ? (
          <EmptyState message={t("providers.noCredentials")} />
        ) : (
          <Table data-testid="credential-pool-table" className="mb-4">
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.provider")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("providers.usage")}</TableHead>
                <TableHead>{t("providers.capacity")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {globalCreds.map((cred) => (
                <TableRow key={cred.id} className="transition-colors hover:bg-muted/50">
                  <TableCell>
                    {editTarget?.id === cred.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 w-48"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleEditSave();
                            if (e.key === "Escape") { setEditTarget(null); setEditName(""); }
                          }}
                        />
                        <Button size="sm" onClick={() => void handleEditSave()}>
                          {t("common.confirm")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditTarget(null); setEditName(""); }}>
                          {t("common.cancel")}
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium">{cred.name}</span>
                    )}
                  </TableCell>
                  <TableCell>{cred.provider}</TableCell>
                  <TableCell>
                    <StatusBadge variant={cred.status === "active" ? "active" : "disabled"} label={cred.status} />
                  </TableCell>
                  <TableCell>
                    {credUsage[cred.id] ? (
                      <div className="text-xs space-y-0.5">
                        <div>{t("providers.dailyUsage")}: {credUsage[cred.id]!.dailyRequests}</div>
                        <div>{t("providers.monthlyUsage")}: {credUsage[cred.id]!.monthlyRequests}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {credCapacity[cred.id] ? (
                      <div className="text-xs space-y-0.5">
                        <div>
                          {t("providers.dailyUsage")}:{" "}
                          {credCapacity[cred.id]!.dailyLimit != null
                            ? `${credCapacity[cred.id]!.currentDailyUsage ?? 0} / ${credCapacity[cred.id]!.dailyLimit}`
                            : t("providers.noLimit")}
                        </div>
                        <div>
                          {t("providers.monthlyUsage")}:{" "}
                          {credCapacity[cred.id]!.monthlyLimit != null
                            ? `${credCapacity[cred.id]!.currentMonthlyUsage ?? 0} / ${credCapacity[cred.id]!.monthlyLimit}`
                            : t("providers.noLimit")}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">{t("providers.noLimit")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditTarget(cred); setEditName(cred.name); }}
                      >
                        <Pencil className="size-3.5 mr-1" />
                        {t("providers.editName")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteTarget(cred)}
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        {t("common.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <form onSubmit={handleAddCredential} className="flex gap-4 items-end flex-wrap">
          <FormField label={t("common.provider")}>
            <Select value={newCredProvider} onValueChange={(v) => { setNewCredProvider(v); setNewCredName(generateDefaultName(v)); }}>
              <SelectTrigger data-testid="cred-pool-provider-select" className="w-36" aria-label={t("common.provider")}>
                <SelectValue placeholder={t("common.provider")} />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("providers.credentialName")} htmlFor="cred-pool-name">
            <Input
              id="cred-pool-name"
              value={newCredName}
              onChange={(e) => setNewCredName(e.target.value)}
              placeholder={newCredProvider ? generateDefaultName(newCredProvider) : "brave-1"}
              className="w-48"
            />
          </FormField>
          <FormField label={t("providers.apiSecret")} htmlFor="cred-pool-secret">
            <Input
              id="cred-pool-secret"
              type="password"
              value={newCredSecret}
              onChange={(e) => setNewCredSecret(e.target.value)}
              placeholder={t("providers.apiSecret")}
              className="w-72"
            />
          </FormField>
          <Button type="submit" disabled={submitting}>
            {t("providers.addCredential")}
          </Button>
        </form>
      </section>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t("providers.deleteCredential")}
        message={t("providers.deleteConfirm", { name: deleteTarget?.name ?? "" })}
        variant="destructive"
        onConfirm={() => void handleDeleteCredential()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

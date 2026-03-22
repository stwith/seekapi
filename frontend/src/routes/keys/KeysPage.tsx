import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { Project, ApiKeyInfo } from "@/lib/api.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { EmptyState } from "@/components/ui/empty-state.js";
import { ConfirmDialog } from "@/components/ui/confirm-dialog.js";
import { LoadingSpinner } from "@/components/ui/loading-skeleton.js";
import { Button } from "@/components/ui/shadcn/button";
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
import { AlertCircle, Copy, KeyRound } from "lucide-react";
import { FormField } from "@/components/ui/form-field.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { formatDate } from "@/lib/format.js";

interface KeysPageProps {
  adminKey: string;
}

interface KeyRow extends ApiKeyInfo {
  projectName: string;
}

export function KeysPage({ adminKey }: KeysPageProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [minting, setMinting] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const projs = await api.listProjects(adminKey);
      setProjects(projs);
      const allRows: KeyRow[] = [];
      await Promise.all(
        projs.map(async (p: Project) => {
          try {
            const keys = await api.listProjectKeys(adminKey, p.id);
            for (const k of keys) {
              allRows.push({ ...k, projectName: p.name });
            }
          } catch { /* skip */ }
        }),
      );
      setRows(allRows);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { void load(); }, [load]);

  async function handleMint() {
    if (!selectedProject) return;
    setMinting(true);
    try {
      const result = await api.createApiKey(adminKey, selectedProject);
      setRevealedKey(result.rawKey);
      setCopied(false);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setMinting(false);
    }
  }

  async function handleDisable() {
    if (!disablingId) return;
    try {
      await api.disableApiKey(adminKey, disablingId);
      setDisablingId(null);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  if (loading) return <LoadingSpinner label={t("keys.loadingKeys")} />;

  return (
    <div>
      <PageHeader title={t("keys.title")} />

      {/* Mint section */}
      <div data-testid="mint-section" className="flex gap-4 items-end mb-6 border border-border rounded-lg p-4">
        <FormField label={t("keys.project")}>
          <Select value={selectedProject || "__none__"} onValueChange={(v) => setSelectedProject(v === "__none__" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("common.selectProject")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" disabled>{t("common.selectProject")}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="space-y-1.5">
          <span className="h-4 block" />
          <Button onClick={handleMint} disabled={!selectedProject || minting} className="h-9">
            <KeyRound className="size-3.5 mr-1.5" />
            {minting ? t("keys.creating") : t("keys.mintNewKey")}
          </Button>
        </div>
      </div>

      {/* Revealed key */}
      {revealedKey && (
        <Alert data-testid="revealed-key" className="mb-6 border-emerald-600/50">
          <KeyRound className="size-4 text-emerald-500" />
          <AlertDescription>
            <p className="text-sm text-emerald-400 mb-2">{t("keys.newKeyCreated")}</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded flex-1 overflow-x-auto">{revealedKey}</code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(revealedKey)}>
                <Copy className="size-3 mr-1" />
                {copied ? t("common.copied") : t("common.copy")}
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRevealedKey(null)}>
              {t("common.dismiss")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <EmptyState message={t("keys.noKeys")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("keys.keyId")}</TableHead>
              <TableHead>{t("keys.project")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("keys.created")}</TableHead>
              <TableHead>{t("keys.lastUsed")}</TableHead>
              <TableHead className="w-24">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.projectId}-${r.id}`} className="transition-colors hover:bg-muted/50">
                <TableCell className="font-mono text-xs">{r.id}</TableCell>
                <TableCell>{r.projectName}</TableCell>
                <TableCell>
                  <StatusBadge variant={r.status === "active" ? "active" : "error"} label={r.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(r.lastUsedAt)}</TableCell>
                <TableCell>
                  {r.status === "active" ? (
                    <Button size="sm" variant="destructive" onClick={() => setDisablingId(r.id)}>
                      {t("common.disable")}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("common.disabled")}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={disablingId !== null}
        title={t("keys.disableTitle")}
        message={t("keys.disableMessage", { keyId: disablingId?.slice(0, 12) + "..." })}
        confirmLabel={t("common.disable")}
        variant="destructive"
        onConfirm={handleDisable}
        onCancel={() => setDisablingId(null)}
      />
    </div>
  );
}

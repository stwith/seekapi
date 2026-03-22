import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { ProjectDetail, CreateKeyResult, ProviderInfo, GlobalCredentialMeta } from "@/lib/types.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { LoadingSpinner } from "@/components/ui/loading-skeleton.js";
import { Input } from "@/components/ui/shadcn/input";
import { Button } from "@/components/ui/shadcn/button";
import { Alert, AlertDescription } from "@/components/ui/shadcn/alert";
import { Separator } from "@/components/ui/shadcn/separator";
import { Switch } from "@/components/ui/shadcn/switch";
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
import { AlertCircle, ChevronLeft, Copy, KeyRound } from "lucide-react";
import { FormField } from "@/components/ui/form-field.js";

interface ProjectDetailPageProps {
  adminKey: string;
}

export function ProjectDetailPage({ adminKey }: ProjectDetailPageProps) {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Linked credentials state (global credential refs)
  const [globalCreds, setGlobalCreds] = useState<GlobalCredentialMeta[]>([]);
  const [linkedCreds, setLinkedCreds] = useState<GlobalCredentialMeta[]>([]);
  const [selectedCredId, setSelectedCredId] = useState("");

  const [bindProvider, setBindProvider] = useState("");
  const [bindCap, setBindCap] = useState("search.web");
  const [bindEnabled, setBindEnabled] = useState(true);
  const [bindPriority, setBindPriority] = useState(0);

  const [revealedKey, setRevealedKey] = useState<CreateKeyResult | null>(null);
  const [mintingKey, setMintingKey] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!projectId) return;
    try {
      const [d, provResult, globalCredsResult, linkedCredsResult] = await Promise.all([
        api.getProjectDetail(adminKey, projectId),
        api.listProviders(adminKey).catch(() => ({ providers: [] })),
        api.listGlobalCredentials(adminKey).catch(() => ({ credentials: [] })),
        api.listProjectCredentialRefs(adminKey, projectId).catch(() => ({ credentials: [] })),
      ]);
      setDetail(d);
      setProviders(provResult.providers);
      setGlobalCreds(globalCredsResult.credentials);
      setLinkedCreds(linkedCredsResult.credentials);
      if (provResult.providers.length > 0) {
        setBindProvider((prev) => prev || provResult.providers[0]!.id);
      }
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminKey, projectId]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  if (loading) return <LoadingSpinner />;
  if (error && !detail) {
    return (
      <div>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!detail) return <p className="text-muted-foreground">{t("projects.notFound")}</p>;

  const { project, bindings, keys } = detail;

  // Compute available (not yet linked) credentials
  const linkedIds = new Set(linkedCreds.map((c) => c.id));
  const availableCreds = globalCreds.filter((c) => !linkedIds.has(c.id));

  async function handleLinkCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !selectedCredId) return;
    try {
      await api.addProjectCredentialRef(adminKey, projectId, selectedCredId);
      setSelectedCredId("");
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  async function handleUnlinkCredential(credentialId: string) {
    if (!projectId) return;
    try {
      await api.removeProjectCredentialRef(adminKey, projectId, credentialId);
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  async function handleConfigureBinding(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !bindProvider) return;
    try {
      await api.configureBinding(adminKey, projectId, {
        provider: bindProvider,
        capability: bindCap,
        enabled: bindEnabled,
        priority: bindPriority,
      });
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  async function handleMintKey() {
    if (!projectId) return;
    setMintingKey(true);
    try {
      const result = await api.createApiKey(adminKey, projectId);
      setRevealedKey(result);
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setMintingKey(false);
    }
  }

  async function handleDisableKey(keyId: string) {
    try {
      await api.disableApiKey(adminKey, keyId);
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <Link to="/projects">
        <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
          <ChevronLeft className="size-4 mr-1" />
          {t("projects.title")}
        </Button>
      </Link>

      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <StatusBadge variant={project.status === "active" ? "active" : "disabled"} />
      </div>
      <p className="text-xs font-mono text-muted-foreground mb-6">{project.id}</p>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Linked Credentials (from global pool) */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("projects.linkedCredentials")}</h2>
        {linkedCreds.length > 0 ? (
          <Table data-testid="linked-credentials-table" className="mb-4">
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.provider")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkedCreds.map((c) => (
                <TableRow key={c.id} className="transition-colors hover:bg-muted/50">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.provider}</TableCell>
                  <TableCell>
                    <StatusBadge variant={c.status === "active" ? "active" : "disabled"} label={c.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleUnlinkCredential(c.id)}
                    >
                      {t("projects.unlinkCredential")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">{t("projects.noLinkedCredentials")}</p>
        )}
        <form onSubmit={handleLinkCredential} className="flex gap-4 items-end flex-wrap">
          <FormField label={t("projects.linkCredential")}>
            <Select value={selectedCredId} onValueChange={setSelectedCredId}>
              <SelectTrigger data-testid="link-credential-select" className="w-64" aria-label={t("projects.selectCredential")}>
                <SelectValue placeholder={t("projects.selectCredential")} />
              </SelectTrigger>
              <SelectContent>
                {availableCreds.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <Button type="submit" disabled={!selectedCredId}>
            {t("projects.linkCredential")}
          </Button>
        </form>
      </section>

      <Separator className="my-6" />

      {/* Capability Bindings */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("projects.capabilityBindings")}</h2>
        {bindings.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">{t("projects.noBindings")}</p>
        ) : (
          <Table data-testid="bindings-table" className="mb-4">
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.provider")}</TableHead>
                <TableHead>{t("common.capability")}</TableHead>
                <TableHead>{t("common.enabled")}</TableHead>
                <TableHead>{t("common.priority")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bindings.map((b) => (
                <TableRow key={`${b.provider}-${b.capability}`} className="transition-colors hover:bg-muted/50">
                  <TableCell>{b.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{b.capability}</TableCell>
                  <TableCell>{b.enabled ? t("common.yes") : t("common.no")}</TableCell>
                  <TableCell className="font-mono">{b.priority}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <form onSubmit={handleConfigureBinding} className="flex gap-4 items-end flex-wrap">
          <FormField label={t("common.provider")}>
            <Select value={bindProvider} onValueChange={setBindProvider}>
              <SelectTrigger data-testid="binding-provider-select" className="w-36" aria-label={t("common.provider")}>
                <SelectValue placeholder={t("common.provider")} />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("common.capability")}>
            <Select value={bindCap} onValueChange={setBindCap}>
              <SelectTrigger className="w-40" aria-label={t("common.capability")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="search.web">search.web</SelectItem>
                <SelectItem value="search.news">search.news</SelectItem>
                <SelectItem value="search.images">search.images</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("common.priority")} htmlFor="bind-priority">
            <Input
              id="bind-priority"
              type="number"
              value={bindPriority}
              onChange={(e) => setBindPriority(parseInt(e.target.value, 10) || 0)}
              className="w-20"
            />
          </FormField>
          <div className="flex items-center gap-2 pb-0.5">
            <Switch checked={bindEnabled} onCheckedChange={setBindEnabled} aria-label={t("common.enabled")} />
            <span className="text-sm text-muted-foreground">{t("common.enabled")}</span>
          </div>
          <Button type="submit" variant="secondary">
            {t("common.configure")}
          </Button>
        </form>
      </section>

      <Separator className="my-6" />

      {/* API Keys */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("projects.apiKeys")}</h2>
          <Button onClick={handleMintKey} disabled={mintingKey} size="sm">
            <KeyRound className="size-3.5 mr-1.5" />
            {mintingKey ? t("projects.minting") : t("projects.mintNewKey")}
          </Button>
        </div>

        {revealedKey && (
          <Alert data-testid="revealed-key" className="mb-4 border-emerald-600/50">
            <KeyRound className="size-4 text-emerald-500" />
            <AlertDescription>
              <p className="font-medium text-emerald-400 mb-1">{t("projects.newKeyTitle")}</p>
              <pre className="font-mono text-sm select-all bg-muted rounded px-2 py-1 my-1">{revealedKey.rawKey}</pre>
              <p className="text-xs text-muted-foreground">{t("projects.newKeyMessage")}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(revealedKey.rawKey)}>
                  <Copy className="size-3 mr-1" />{t("common.copy")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRevealedKey(null)}>
                  {t("common.dismiss")}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("projects.noKeys")}</p>
        ) : (
          <Table data-testid="keys-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("projects.keyId")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="w-24">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id} className="transition-colors hover:bg-muted/50">
                  <TableCell className="font-mono text-xs text-muted-foreground">{k.id}</TableCell>
                  <TableCell>
                    <StatusBadge variant={k.status === "active" ? "active" : "disabled"} />
                  </TableCell>
                  <TableCell>
                    {k.status === "active" && (
                      <Button size="sm" variant="destructive" onClick={() => handleDisableKey(k.id)}>
                        {t("common.disable")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { ProjectDetail, GlobalCredentialMeta, ProviderBinding } from "@/lib/types.js";
import type { ProviderInfo } from "@/lib/api.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { LoadingSpinner } from "@/components/ui/loading-skeleton.js";
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
import { AlertCircle, ChevronLeft, GripVertical } from "lucide-react";
import { FormField } from "@/components/ui/form-field.js";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Sortable table row for drag-and-drop binding priority */
function SortableBindingRow({
  binding,
  onToggle,
}: {
  binding: ProviderBinding;
  onToggle: (enabled: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: binding.provider,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className="transition-colors hover:bg-muted/50">
      <TableCell className="w-8">
        <button type="button" className="cursor-grab text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{binding.provider}</TableCell>
      <TableCell className="w-16 text-center font-mono text-xs text-muted-foreground">{binding.priority}</TableCell>
      <TableCell className="w-20">
        <Switch
          checked={binding.enabled}
          onCheckedChange={onToggle}
          aria-label={`${binding.provider} enabled`}
        />
      </TableCell>
    </TableRow>
  );
}

interface ProjectDetailPageProps {
  adminKey: string;
}

export function ProjectDetailPage({ adminKey }: ProjectDetailPageProps) {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Linked credentials state (global credential refs)
  const [globalCreds, setGlobalCreds] = useState<GlobalCredentialMeta[]>([]);
  const [linkedCreds, setLinkedCreds] = useState<GlobalCredentialMeta[]>([]);
  const [selectedCredId, setSelectedCredId] = useState("");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  const loadDetail = useCallback(async () => {
    if (!projectId) return;
    try {
      const [d, globalCredsResult, linkedCredsResult, provResult] = await Promise.all([
        api.getProjectDetail(adminKey, projectId),
        api.listGlobalCredentials(adminKey).catch(() => ({ credentials: [] })),
        api.listProjectCredentialRefs(adminKey, projectId).catch(() => ({ credentials: [] })),
        api.listProviders(adminKey).catch(() => ({ providers: [] })),
      ]);
      setDetail(d);
      setGlobalCreds(globalCredsResult.credentials);
      setLinkedCreds(linkedCredsResult.credentials);
      setProviders(provResult.providers);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminKey, projectId]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  // DnD sensors — must be before any early return (Rules of Hooks)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const { project, bindings } = detail;

  /** After drag ends, re-assign priorities for the affected capability group */
  async function handleDragEnd(capability: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !projectId) return;

    const capBindings = bindings
      .filter((b) => b.capability === capability)
      .sort((a, b) => a.priority - b.priority);

    const oldIndex = capBindings.findIndex((b) => b.provider === active.id);
    const newIndex = capBindings.findIndex((b) => b.provider === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder in place
    const reordered = [...capBindings];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);

    // Persist new priorities (index = priority)
    try {
      await Promise.all(
        reordered.map((b, i) =>
          api.configureBinding(adminKey, projectId!, {
            provider: b.provider,
            capability: b.capability,
            enabled: b.enabled,
            priority: i,
          }),
        ),
      );
      await loadDetail();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  // Compute available (not yet linked) credentials
  const linkedIds = new Set(linkedCreds.map((c) => c.id));
  const availableCreds = globalCreds.filter((c) => !linkedIds.has(c.id));

  async function handleLinkCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !selectedCredId) return;
    try {
      await api.addProjectCredentialRef(adminKey, projectId, selectedCredId);

      // Auto-create bindings for the linked credential's provider capabilities
      const cred = globalCreds.find((c) => c.id === selectedCredId);
      if (cred) {
        const provInfo = providers.find((p) => p.id === cred.provider);
        if (provInfo) {
          const existingCaps = new Set(
            (detail?.bindings ?? [])
              .filter((b) => b.provider === cred.provider)
              .map((b) => b.capability),
          );
          await Promise.all(
            provInfo.capabilities
              .filter((cap) => !existingCaps.has(cap))
              .map((cap, i) =>
                api.configureBinding(adminKey, projectId!, {
                  provider: cred.provider,
                  capability: cap,
                  enabled: true,
                  priority: (detail?.bindings ?? []).filter((b) => b.capability === cap).length + i,
                }),
              ),
          );
        }
      }

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

  async function handleBindingToggle(provider: string, capability: string, enabled: boolean, priority: number) {
    if (!projectId) return;
    try {
      await api.configureBinding(adminKey, projectId, { provider, capability, enabled, priority });
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

      {/* Capability Bindings — grouped by capability, drag to reorder */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("projects.capabilityBindings")}</h2>

        {(() => {
          const caps = ["search.web", "search.news", "search.images"] as const;
          const grouped = new Map<string, ProviderBinding[]>();
          for (const b of bindings) {
            const list = grouped.get(b.capability) ?? [];
            list.push(b);
            grouped.set(b.capability, list);
          }

          return (
            <div data-testid="bindings-table" className="space-y-4">
              {caps.map((cap) => {
                const capBindings = (grouped.get(cap) ?? []).sort((a, b) => a.priority - b.priority);
                const providerIds = capBindings.map((b) => b.provider);

                return (
                  <div key={cap} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2 text-sm font-mono font-medium">{cap}</div>
                    {capBindings.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground">{t("projects.noBindings")}</div>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(cap, e)}>
                        <SortableContext items={providerIds} strategy={verticalListSortingStrategy}>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8" />
                                <TableHead>{t("common.provider")}</TableHead>
                                <TableHead className="w-16 text-center">#</TableHead>
                                <TableHead className="w-20">{t("common.enabled")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {capBindings.map((b) => (
                                <SortableBindingRow
                                  key={b.provider}
                                  binding={b}
                                  onToggle={(enabled) => void handleBindingToggle(b.provider, b.capability, enabled, b.priority)}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>

    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { Project } from "@/lib/types.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
import { Input } from "@/components/ui/shadcn/input";
import { Button } from "@/components/ui/shadcn/button";
import { FormField } from "@/components/ui/form-field.js";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { Alert, AlertDescription } from "@/components/ui/shadcn/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { EmptyState } from "@/components/ui/empty-state.js";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header.js";

interface ProjectListProps {
  adminKey: string;
}

export function ProjectList({ adminKey }: ProjectListProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const list = await api.listProjects(adminKey);
      setProjects(list);
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
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState message={t("projects.noProjects")} />
      ) : (
        <Table data-testid="projects-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead className="w-28">{t("common.status")}</TableHead>
              <TableHead>{t("common.id")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id} className="transition-colors hover:bg-muted/50">
                <TableCell>
                  <Link to={`/projects/${p.id}`} className="text-primary hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge variant={p.status === "active" ? "active" : "disabled"} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.id}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

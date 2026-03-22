import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api.js";
import type { Project } from "@/lib/types.js";
import { StatusBadge } from "@/components/ui/status-badge.js";
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
import { Badge } from "@/components/ui/shadcn/badge";
import { AlertCircle, ServerCrash } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header.js";

interface OverviewProps {
  adminKey: string;
}

export function Overview({ adminKey }: OverviewProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/v1/health")
      .then((r) => setHealthy(r.ok))
      .catch(() => setHealthy(false));

    api
      .listProjects(adminKey)
      .then(setProjects)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminKey]);

  return (
    <div>
      <PageHeader title={t("overview.title")} />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Server health */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("overview.serverStatus")}</h2>
          <div className="flex items-center gap-3" data-testid="health-status">
            {healthy === null ? (
              <Skeleton className="h-6 w-24" />
            ) : healthy ? (
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">{t("overview.connected")}</Badge>
            ) : (
              <Badge variant="destructive">
                <ServerCrash className="mr-1 size-3" />
                {t("overview.unreachable")}
              </Badge>
            )}
          </div>
        </section>

        {/* Projects quick list */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            {loading ? t("overview.projectsCount", { count: 0 }).replace("0", "...") : t("overview.projectsCount", { count: projects.length })}
          </h2>

          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : projects.length === 0 && !error ? (
            <p className="text-sm text-muted-foreground">{t("overview.noProjects")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead className="w-24">{t("common.status")}</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}

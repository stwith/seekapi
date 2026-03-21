import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import type { Project } from "../../lib/types.js";
import { StatusBadge } from "../../components/ui/index.js";

interface OverviewProps {
  adminKey: string;
}

export function Overview({ adminKey }: OverviewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/v1/health")
      .then((r) => setHealthy(r.ok))
      .catch(() => setHealthy(false));

    api
      .listProjects(adminKey)
      .then(setProjects)
      .catch((e: Error) => setError(e.message));
  }, [adminKey]);

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6">Overview</h1>
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Server Status</h2>
        <p data-testid="health-status" className="text-gray-300">
          {healthy === null ? "Checking..." : healthy ? "Connected" : "Unreachable"}
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Projects ({projects.length})</h2>
        {error && <p className="text-red-400">{error}</p>}
        {projects.length === 0 && !error && <p className="text-gray-500">No projects yet.</p>}
        <ul className="space-y-1">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-gray-300">
              {p.name} <StatusBadge variant={p.status === "active" ? "active" : "disabled"} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

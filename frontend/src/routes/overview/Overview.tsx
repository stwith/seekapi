import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import type { Project } from "../../lib/types.js";

interface OverviewProps {
  adminKey: string;
}

export function Overview({ adminKey }: OverviewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check health
    fetch("/v1/health")
      .then((r) => setHealthy(r.ok))
      .catch(() => setHealthy(false));

    // Load projects
    api
      .listProjects(adminKey)
      .then(setProjects)
      .catch((e: Error) => setError(e.message));
  }, [adminKey]);

  return (
    <div>
      <h1>Overview</h1>
      <section style={{ marginBottom: 24 }}>
        <h2>Server Status</h2>
        <p data-testid="health-status">
          {healthy === null ? "Checking..." : healthy ? "Connected" : "Unreachable"}
        </p>
      </section>
      <section>
        <h2>Projects ({projects.length})</h2>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {projects.length === 0 && !error && <p>No projects yet.</p>}
        <ul>
          {projects.map((p) => (
            <li key={p.id}>
              {p.name} ({p.status})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

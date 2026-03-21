import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import type { Project } from "../../lib/types.js";

interface ProjectListProps {
  adminKey: string;
}

export function ProjectList({ adminKey }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadProjects() {
    try {
      const list = await api.listProjects(adminKey);
      setProjects(list);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, [adminKey]);

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
      <h1>Projects</h1>
      <form onSubmit={handleCreate} style={{ marginBottom: 16 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          style={{ padding: 6, marginRight: 8 }}
        />
        <button type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create Project"}
        </button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && projects.length === 0 && <p>No projects yet.</p>}
      <table data-testid="projects-table" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Name</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Status</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>ID</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                <Link to={`/projects/${p.id}`}>{p.name}</Link>
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.status}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #eee", fontFamily: "monospace", fontSize: 12 }}>
                {p.id}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

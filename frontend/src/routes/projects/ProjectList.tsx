import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import type { Project } from "../../lib/types.js";
import { StatusBadge, LoadingSpinner } from "../../components/ui/index.js";

interface ProjectListProps {
  adminKey: string;
}

export function ProjectList({ adminKey }: ProjectListProps) {
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

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

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
      <h1 className="text-xl font-bold text-white mb-4">Projects</h1>
      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Project"}
        </button>
      </form>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {loading && <LoadingSpinner />}
      {!loading && projects.length === 0 && <p className="text-gray-500">No projects yet.</p>}
      <table data-testid="projects-table" className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 uppercase text-xs">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">ID</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {projects.map((p) => (
            <tr key={p.id} className="hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3">
                <Link to={`/projects/${p.id}`} className="text-primary-400 hover:underline">
                  {p.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusBadge variant={p.status === "active" ? "active" : "disabled"} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

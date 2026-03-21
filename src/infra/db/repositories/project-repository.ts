/**
 * Repository interface for project lookups. [AC1][AC2]
 *
 * Resolves project configuration by id, including the default
 * provider and allowed provider list derived from provider bindings.
 */

export interface ProjectRow {
  id: string;
  name: string;
  status: string;
}

export interface ProviderBindingRow {
  provider: string;
  capability: string;
  enabled: boolean;
  priority: number;
}

export interface ProjectWithBindings {
  project: ProjectRow;
  bindings: ProviderBindingRow[];
  defaultProvider: string;
}

export interface ProjectRepository {
  /** Find an active project by id, including provider bindings. */
  findById(projectId: string): Promise<ProjectWithBindings | undefined>;
}

/**
 * In-memory implementation for tests and local development.
 */
export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, ProjectWithBindings>();

  seed(data: ProjectWithBindings): void {
    this.projects.set(data.project.id, data);
  }

  async findById(projectId: string): Promise<ProjectWithBindings | undefined> {
    const result = this.projects.get(projectId);
    if (!result || result.project.status !== "active") return undefined;
    return result;
  }
}

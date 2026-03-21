import type { ProjectRepository } from "../../../infra/db/repositories/project-repository.js";

/**
 * Project context resolved from a valid API key. [AC1][AC2]
 */
export interface ProjectContext {
  projectId: string;
  projectName: string;
  defaultProvider: string;
  allowedProviders: string[];
  /** Providers ordered by binding priority (ascending), excluding the default. */
  fallbackProviders: string[];
  apiKeyId: string;
}

export interface ProjectServiceDeps {
  projectRepository: ProjectRepository;
}

export class ProjectService {
  private readonly deps: ProjectServiceDeps;

  constructor(deps: ProjectServiceDeps) {
    this.deps = deps;
  }

  /**
   * Resolve project context by id. [AC2]
   * Fetches the project and its provider bindings from the repository,
   * derives allowed providers and default provider from persisted state.
   */
  async resolve(
    projectId: string,
    apiKeyId?: string,
  ): Promise<ProjectContext | undefined> {
    const result = await this.deps.projectRepository.findById(projectId);
    if (!result) return undefined;

    const allowedProviders = result.bindings
      .filter((b) => b.enabled)
      .map((b) => b.provider)
      .filter((v, i, a) => a.indexOf(v) === i);

    // Derive fallback order: enabled bindings sorted by priority (ascending),
    // deduplicated, with the default provider excluded.
    const fallbackProviders = result.bindings
      .filter((b) => b.enabled && b.provider !== result.defaultProvider)
      .sort((a, b) => a.priority - b.priority)
      .map((b) => b.provider)
      .filter((v, i, a) => a.indexOf(v) === i);

    return {
      projectId: result.project.id,
      projectName: result.project.name,
      defaultProvider: result.defaultProvider,
      allowedProviders,
      fallbackProviders,
      apiKeyId: apiKeyId ?? "unknown",
    };
  }
}

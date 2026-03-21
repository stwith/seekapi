import type {
  ProjectRepository,
  ProviderBindingRow,
} from "../../../infra/db/repositories/project-repository.js";

/**
 * Project context resolved from a valid API key. [AC1][AC2]
 */
export interface ProjectContext {
  projectId: string;
  projectName: string;
  defaultProvider: string;
  /** Raw provider bindings — routing uses these to derive per-capability policy. */
  bindings: ProviderBindingRow[];
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
   * Fetches the project and its provider bindings from the repository.
   * Raw bindings are preserved so downstream routing can filter by capability.
   */
  async resolve(
    projectId: string,
    apiKeyId?: string,
  ): Promise<ProjectContext | undefined> {
    const result = await this.deps.projectRepository.findById(projectId);
    if (!result) return undefined;

    return {
      projectId: result.project.id,
      projectName: result.project.name,
      defaultProvider: result.defaultProvider,
      bindings: result.bindings,
      apiKeyId: apiKeyId ?? "unknown",
    };
  }
}

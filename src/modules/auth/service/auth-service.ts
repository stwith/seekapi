import { createHash } from "node:crypto";
import type { ProjectContext } from "../../projects/service/project-service.js";
import type { ProjectService } from "../../projects/service/project-service.js";
import type { ApiKeyRepository } from "../../../infra/db/repositories/api-key-repository.js";

/** SHA-256 hash a raw API key for comparison. */
export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface AuthServiceDeps {
  apiKeyRepository: ApiKeyRepository;
  projectService: ProjectService;
}

export class AuthService {
  private readonly deps: AuthServiceDeps;

  constructor(deps: AuthServiceDeps) {
    this.deps = deps;
  }

  /**
   * Authenticate a raw API key. [AC1][AC2]
   * Resolves the key hash through the repository, then delegates
   * to ProjectService for project context resolution.
   * Returns the resolved project context or undefined if invalid.
   */
  async authenticate(rawKey: string): Promise<ProjectContext | undefined> {
    const hash = hashKey(rawKey);
    const record = await this.deps.apiKeyRepository.findByHash(hash);
    if (!record) return undefined;
    return this.deps.projectService.resolve(record.projectId, record.id);
  }
}

/**
 * AdminService — orchestrates project, API key, credential, and
 * binding management for operators. [AC3]
 *
 * All mutations go through this service; it never exposes raw
 * encrypted secrets in responses.
 */

import { randomUUID } from "node:crypto";
import { hashKey } from "../../auth/service/auth-service.js";
import { encryptSecret } from "../../credentials/service/credential-service.js";
import type { ApiKeyRepository } from "../../../infra/db/repositories/api-key-repository.js";
import type { ProjectRepository, ProviderBindingRow } from "../../../infra/db/repositories/project-repository.js";
import type { CredentialRepository } from "../../../infra/db/repositories/credential-repository.js";

export interface AdminServiceDeps {
  apiKeyRepository: ApiKeyRepository;
  projectRepository: ProjectRepository;
  credentialRepository: CredentialRepository;
  encryptionKey: string;
}

export interface CreateProjectResult {
  id: string;
  name: string;
  status: string;
}

export interface CreateApiKeyResult {
  id: string;
  projectId: string;
  /** The raw API key — only returned once at creation time. */
  rawKey: string;
}

export class AdminService {
  private readonly deps: AdminServiceDeps;

  constructor(deps: AdminServiceDeps) {
    this.deps = deps;
  }

  /** Create a new project. [AC3] */
  async createProject(name: string): Promise<CreateProjectResult> {
    const id = randomUUID();
    const project = { id, name, status: "active" };
    if (!this.deps.projectRepository.create) {
      throw new Error("Project creation not supported by this repository");
    }
    await this.deps.projectRepository.create(project);
    return project;
  }

  /** Create a downstream API key for a project. [AC3] */
  async createApiKey(projectId: string): Promise<CreateApiKeyResult> {
    // Verify project exists
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }

    const id = randomUUID();
    const rawKey = `sk_${randomUUID().replace(/-/g, "")}`;
    const hashedKey = hashKey(rawKey);

    if (!this.deps.apiKeyRepository.create) {
      throw new Error("API key creation not supported by this repository");
    }
    await this.deps.apiKeyRepository.create({
      id,
      projectId,
      hashedKey,
      status: "active",
    });

    return { id, projectId, rawKey };
  }

  /** Disable an API key. [AC3] */
  async disableApiKey(keyId: string): Promise<void> {
    if (!this.deps.apiKeyRepository.updateStatus) {
      throw new Error("API key status update not supported by this repository");
    }
    await this.deps.apiKeyRepository.updateStatus(keyId, "disabled");
  }

  /** Attach or rotate a Brave credential for a project. [AC3] */
  async upsertCredential(
    projectId: string,
    provider: string,
    secret: string,
  ): Promise<{ id: string }> {
    // Verify project exists
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }

    const id = randomUUID();
    const encryptedSecret = encryptSecret(secret, this.deps.encryptionKey);

    if (!this.deps.credentialRepository.upsert) {
      throw new Error("Credential upsert not supported by this repository");
    }
    await this.deps.credentialRepository.upsert({
      id,
      projectId,
      provider,
      encryptedSecret,
      status: "active",
    });

    return { id };
  }

  /** Configure a Brave capability binding for a project. [AC3] */
  async configureBinding(
    projectId: string,
    binding: ProviderBindingRow,
  ): Promise<void> {
    // Verify project exists
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }

    if (!this.deps.projectRepository.upsertBinding) {
      throw new Error("Binding configuration not supported by this repository");
    }
    await this.deps.projectRepository.upsertBinding(projectId, binding);
  }
}

export class AdminError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AdminError";
  }
}

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
import { MVP_CAPABILITIES } from "../../../providers/core/types.js";
import type { ApiKeyRepository } from "../../../infra/db/repositories/api-key-repository.js";
import type { ProjectRepository, ProjectRow, ProviderBindingRow } from "../../../infra/db/repositories/project-repository.js";
import type { CredentialRepository, CredentialMeta } from "../../../infra/db/repositories/credential-repository.js";

/** Providers allowed in the current phase (Brave-only). */
const ALLOWED_PROVIDERS = new Set(["brave"]);

/** Capabilities allowed in the current phase. */
const ALLOWED_CAPABILITIES = new Set<string>(MVP_CAPABILITIES);

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
    if (!ALLOWED_PROVIDERS.has(provider)) {
      throw new AdminError(
        `Provider "${provider}" is not supported in the current phase. Allowed: ${[...ALLOWED_PROVIDERS].join(", ")}`,
        "INVALID_PROVIDER",
      );
    }

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

  /** List all projects. [Phase 3 AC4] */
  async listProjects(): Promise<ProjectRow[]> {
    if (!this.deps.projectRepository.listAll) {
      throw new Error("Project listing not supported by this repository");
    }
    return this.deps.projectRepository.listAll();
  }

  /** Get project detail with bindings, keys, and credential metadata. [Phase 3 AC4] */
  async getProjectDetail(projectId: string): Promise<{
    project: ProjectRow;
    bindings: ProviderBindingRow[];
    keys: { id: string; projectId: string; status: string }[];
    credential: CredentialMeta | null;
  }> {
    const found = await this.deps.projectRepository.findById(projectId);
    if (!found) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }

    const bindings = this.deps.projectRepository.listBindings
      ? await this.deps.projectRepository.listBindings(projectId)
      : found.bindings;

    const keys = this.deps.apiKeyRepository.listByProject
      ? (await this.deps.apiKeyRepository.listByProject(projectId)).map((k) => ({
          id: k.id,
          projectId: k.projectId,
          status: k.status,
        }))
      : [];

    const credential = this.deps.credentialRepository.findMetaByProject
      ? (await this.deps.credentialRepository.findMetaByProject(projectId)) ?? null
      : null;

    return { project: found.project, bindings, keys, credential };
  }

  /** List keys for a project. [Phase 3 AC4] */
  async listProjectKeys(projectId: string): Promise<{ id: string; projectId: string; status: string }[]> {
    const found = await this.deps.projectRepository.findById(projectId);
    if (!found) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }
    if (!this.deps.apiKeyRepository.listByProject) {
      throw new Error("Key listing not supported by this repository");
    }
    return (await this.deps.apiKeyRepository.listByProject(projectId)).map((k) => ({
      id: k.id,
      projectId: k.projectId,
      status: k.status,
    }));
  }

  /** List bindings for a project. [Phase 3 AC4] */
  async listProjectBindings(projectId: string): Promise<ProviderBindingRow[]> {
    const found = await this.deps.projectRepository.findById(projectId);
    if (!found) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }
    if (this.deps.projectRepository.listBindings) {
      return this.deps.projectRepository.listBindings(projectId);
    }
    return found.bindings;
  }

  /** Get credential metadata for a project (no raw secret). [Phase 3 AC4] */
  async getCredentialMeta(projectId: string): Promise<CredentialMeta | null> {
    const found = await this.deps.projectRepository.findById(projectId);
    if (!found) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }
    if (!this.deps.credentialRepository.findMetaByProject) {
      return null;
    }
    return (await this.deps.credentialRepository.findMetaByProject(projectId)) ?? null;
  }

  /** Configure a Brave capability binding for a project. [AC3] */
  async configureBinding(
    projectId: string,
    binding: ProviderBindingRow,
  ): Promise<void> {
    if (!ALLOWED_PROVIDERS.has(binding.provider)) {
      throw new AdminError(
        `Provider "${binding.provider}" is not supported in the current phase. Allowed: ${[...ALLOWED_PROVIDERS].join(", ")}`,
        "INVALID_PROVIDER",
      );
    }
    if (!ALLOWED_CAPABILITIES.has(binding.capability)) {
      throw new AdminError(
        `Capability "${binding.capability}" is not supported in the current phase. Allowed: ${[...ALLOWED_CAPABILITIES].join(", ")}`,
        "INVALID_CAPABILITY",
      );
    }

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

/**
 * Repository interface for project lookups. [AC1][AC2]
 *
 * Resolves project configuration by id, including the default
 * provider and allowed provider list derived from provider bindings.
 */

import { eq, and } from "drizzle-orm";
import type { DbClient } from "../client.js";
import { projects } from "../schema/projects.js";
import { providerBindings } from "../schema/provider-bindings.js";
import { routingPolicies } from "../schema/routing-policies.js";

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
  /** List all projects. [Phase 3 AC4] */
  listAll?(): Promise<ProjectRow[]>;
  /** List bindings for a project. [Phase 3 AC4] */
  listBindings?(projectId: string): Promise<ProviderBindingRow[]>;
  /** Create a new project. [AC3] */
  create?(project: ProjectRow): Promise<void>;
  /** Upsert a provider binding for a project. [AC3] */
  upsertBinding?(projectId: string, binding: ProviderBindingRow): Promise<void>;
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

  async listAll(): Promise<ProjectRow[]> {
    return [...this.projects.values()].map((p) => p.project);
  }

  async listBindings(projectId: string): Promise<ProviderBindingRow[]> {
    return this.projects.get(projectId)?.bindings ?? [];
  }

  async create(project: ProjectRow): Promise<void> {
    this.projects.set(project.id, {
      project,
      bindings: [],
      defaultProvider: "",
    });
  }

  async upsertBinding(projectId: string, binding: ProviderBindingRow): Promise<void> {
    const entry = this.projects.get(projectId);
    if (!entry) return;
    const idx = entry.bindings.findIndex(
      (b) => b.provider === binding.provider && b.capability === binding.capability,
    );
    if (idx >= 0) {
      entry.bindings[idx] = binding;
    } else {
      entry.bindings.push(binding);
    }
    // Derive defaultProvider from bindings
    const enabled = entry.bindings.filter((b) => b.enabled);
    if (enabled.length > 0) {
      enabled.sort((a, b) => a.priority - b.priority);
      entry.defaultProvider = enabled[0]!.provider;
    }
  }
}

/**
 * Drizzle-backed implementation for production persistence. [AC1][AC2]
 *
 * Joins projects, provider_bindings, and routing_policies to build
 * the full ProjectWithBindings result. The defaultProvider is read
 * from the first routing_policies row for the project, or derived
 * from the highest-priority enabled binding.
 */
export class DrizzleProjectRepository implements ProjectRepository {
  constructor(private readonly db: DbClient) {}

  async findById(projectId: string): Promise<ProjectWithBindings | undefined> {
    // Load project row
    const projectRows = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.status, "active")))
      .limit(1);

    const project = projectRows[0];
    if (!project) return undefined;

    // Load provider bindings
    const bindingRows = await this.db
      .select({
        provider: providerBindings.provider,
        capability: providerBindings.capability,
        enabled: providerBindings.enabled,
        priority: providerBindings.priority,
      })
      .from(providerBindings)
      .where(eq(providerBindings.projectId, projectId));

    // Load routing policy for default provider
    const policyRows = await this.db
      .select({
        defaultProvider: routingPolicies.defaultProvider,
      })
      .from(routingPolicies)
      .where(eq(routingPolicies.projectId, projectId))
      .limit(1);

    // Derive defaultProvider: routing_policies row first, then
    // highest-priority enabled binding, then empty string
    let defaultProvider = policyRows[0]?.defaultProvider ?? "";
    if (!defaultProvider && bindingRows.length > 0) {
      const enabled = bindingRows.filter((b) => b.enabled);
      if (enabled.length > 0) {
        enabled.sort((a, b) => a.priority - b.priority);
        defaultProvider = enabled[0]!.provider;
      }
    }

    return {
      project,
      bindings: bindingRows,
      defaultProvider,
    };
  }

  async listAll(): Promise<ProjectRow[]> {
    return this.db
      .select({ id: projects.id, name: projects.name, status: projects.status })
      .from(projects);
  }

  async listBindings(projectId: string): Promise<ProviderBindingRow[]> {
    return this.db
      .select({
        provider: providerBindings.provider,
        capability: providerBindings.capability,
        enabled: providerBindings.enabled,
        priority: providerBindings.priority,
      })
      .from(providerBindings)
      .where(eq(providerBindings.projectId, projectId));
  }

  async create(projectRow: ProjectRow): Promise<void> {
    await this.db.insert(projects).values({
      id: projectRow.id,
      name: projectRow.name,
      status: projectRow.status,
    });
  }

  async upsertBinding(projectId: string, binding: ProviderBindingRow): Promise<void> {
    // Delete existing binding for same project+provider+capability, then insert
    const existing = await this.db
      .select({ id: providerBindings.id })
      .from(providerBindings)
      .where(
        and(
          eq(providerBindings.projectId, projectId),
          eq(providerBindings.provider, binding.provider),
          eq(providerBindings.capability, binding.capability),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await this.db
        .update(providerBindings)
        .set({ enabled: binding.enabled, priority: binding.priority })
        .where(eq(providerBindings.id, existing[0].id));
    } else {
      await this.db.insert(providerBindings).values({
        projectId,
        provider: binding.provider,
        capability: binding.capability,
        enabled: binding.enabled,
        priority: binding.priority,
      });
    }
  }
}

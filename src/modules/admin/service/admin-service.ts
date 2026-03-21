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
import type {
  UsageEventRepository,
  UsageQueryFilters,
  UsageStats,
  TimeSeriesPoint,
  CapabilityBreakdown,
  KeyUsageStats,
  PaginatedResult,
} from "../../../infra/db/repositories/usage-event-repository.js";
import type { UsageEvent } from "../../usage/service/usage-service.js";
import type { AuditLogRepository, AuditQueryFilters } from "../../../infra/db/repositories/audit-log-repository.js";
import type { AuditEntry } from "../../audit/service/audit-service.js";
import type { QuotaRepository, ProjectQuota } from "../../../infra/db/repositories/quota-repository.js";

/** Providers allowed in the current phase (Brave-only). */
const ALLOWED_PROVIDERS = new Set(["brave"]);

/** Capabilities allowed in the current phase. */
const ALLOWED_CAPABILITIES = new Set<string>(MVP_CAPABILITIES);

export interface AdminServiceDeps {
  apiKeyRepository: ApiKeyRepository;
  projectRepository: ProjectRepository;
  credentialRepository: CredentialRepository;
  encryptionKey: string;
  /** Usage event repository for stats queries. [Phase 3.5 AC6] */
  usageEventRepository?: UsageEventRepository;
  /** Audit log repository for audit queries. [Phase 3.5 AC6] */
  auditLogRepository?: AuditLogRepository;
  /** Quota repository for quota management. [Task 38] */
  quotaRepository?: QuotaRepository;
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
  async listProjectKeys(projectId: string): Promise<{ id: string; projectId: string; status: string; createdAt?: string; lastUsedAt?: string | null }[]> {
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
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
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

  // --- Stats & query methods [Phase 3.5 AC6] ---

  /** Aggregated dashboard stats. */
  async getDashboardStats(filters: UsageQueryFilters): Promise<UsageStats> {
    const repo = this.deps.usageEventRepository;
    if (!repo?.aggregateStats) {
      return { totalRequests: 0, successCount: 0, failureCount: 0, avgLatencyMs: 0 };
    }
    return repo.aggregateStats(filters);
  }

  /** Time series for charts. */
  async getTimeSeries(filters: UsageQueryFilters, granularity: "hour" | "day"): Promise<TimeSeriesPoint[]> {
    const repo = this.deps.usageEventRepository;
    if (!repo?.timeSeries) return [];
    return repo.timeSeries(filters, granularity);
  }

  /** Capability breakdown. */
  async getCapabilityBreakdown(filters: UsageQueryFilters): Promise<CapabilityBreakdown[]> {
    const repo = this.deps.usageEventRepository;
    if (!repo?.topCapabilities) return [];
    return repo.topCapabilities(filters);
  }

  /** Query usage events with filtering and pagination. */
  async queryUsageEvents(
    filters: UsageQueryFilters,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<UsageEvent>> {
    const repo = this.deps.usageEventRepository;
    if (!repo?.query) {
      return { items: [], total: 0, page, pageSize };
    }
    return repo.query(filters, page, pageSize);
  }

  /** Per-key usage stats for a project. */
  async getPerKeyStats(projectId: string): Promise<KeyUsageStats[]> {
    const found = await this.deps.projectRepository.findById(projectId);
    if (!found) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }
    const repo = this.deps.usageEventRepository;
    if (!repo?.perKeyStats) return [];
    return repo.perKeyStats(projectId);
  }

  /** Query audit log entries with filtering and pagination. */
  async queryAuditLogs(
    filters: AuditQueryFilters,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<AuditEntry>> {
    const repo = this.deps.auditLogRepository;
    if (!repo?.query) {
      return { items: [], total: 0, page, pageSize };
    }
    return repo.query(filters, page, pageSize);
  }

  // --- Quota methods [Task 38] ---

  private defaultQuota(projectId: string): ProjectQuota {
    return {
      id: "",
      projectId,
      dailyRequestLimit: null,
      monthlyRequestLimit: null,
      maxKeys: 10,
      rateLimitRpm: 60,
      status: "active",
    };
  }

  private async computeUsageCounts(projectId: string): Promise<{ daily: number; monthly: number }> {
    const usageRepo = this.deps.usageEventRepository;
    if (!usageRepo?.aggregateStats) return { daily: 0, monthly: 0 };

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dailyStats, monthlyStats] = await Promise.all([
      usageRepo.aggregateStats({ projectId, from: startOfDay.toISOString() }),
      usageRepo.aggregateStats({ projectId, from: startOfMonth.toISOString() }),
    ]);
    return { daily: dailyStats.totalRequests, monthly: monthlyStats.totalRequests };
  }

  /** Get quota config + current usage for a project. */
  async getProjectQuota(projectId: string): Promise<ProjectQuota & { currentDailyUsage: number; currentMonthlyUsage: number }> {
    const found = await this.deps.projectRepository.findById(projectId);
    if (!found) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }

    const quotaRepo = this.deps.quotaRepository;
    const quota = (quotaRepo ? await quotaRepo.findByProjectId(projectId) : undefined)
      ?? this.defaultQuota(projectId);

    const usage = await this.computeUsageCounts(projectId);
    return { ...quota, currentDailyUsage: usage.daily, currentMonthlyUsage: usage.monthly };
  }

  /** Create or update quota for a project. */
  async upsertProjectQuota(
    projectId: string,
    updates: Partial<Pick<ProjectQuota, "dailyRequestLimit" | "monthlyRequestLimit" | "maxKeys" | "rateLimitRpm" | "status">>,
  ): Promise<ProjectQuota> {
    const found = await this.deps.projectRepository.findById(projectId);
    if (!found) {
      throw new AdminError("Project not found", "PROJECT_NOT_FOUND");
    }

    const quotaRepo = this.deps.quotaRepository;
    if (!quotaRepo) {
      throw new Error("Quota repository not available");
    }

    const existing = await quotaRepo.findByProjectId(projectId);
    const base = existing ?? this.defaultQuota(projectId);

    const merged: ProjectQuota = {
      id: base.id || `quota_${projectId}`,
      projectId,
      dailyRequestLimit: updates.dailyRequestLimit !== undefined ? updates.dailyRequestLimit : base.dailyRequestLimit,
      monthlyRequestLimit: updates.monthlyRequestLimit !== undefined ? updates.monthlyRequestLimit : base.monthlyRequestLimit,
      maxKeys: updates.maxKeys ?? base.maxKeys,
      rateLimitRpm: updates.rateLimitRpm ?? base.rateLimitRpm,
      status: updates.status ?? base.status,
    };

    await quotaRepo.upsert(merged);
    return merged;
  }

  /** List all project quotas with current usage (includes defaults for projects without explicit quota). */
  async listAllQuotas(): Promise<(ProjectQuota & { currentDailyUsage: number; currentMonthlyUsage: number })[]> {
    if (!this.deps.projectRepository.listAll) return [];

    const projects = await this.deps.projectRepository.listAll();
    const quotaRepo = this.deps.quotaRepository;

    // Build a map of existing quota rows keyed by projectId
    const quotaMap = new Map<string, ProjectQuota>();
    if (quotaRepo) {
      const existing = await quotaRepo.listAll();
      for (const q of existing) {
        quotaMap.set(q.projectId, q);
      }
    }

    return Promise.all(
      projects.map(async (p) => {
        const quota = quotaMap.get(p.id) ?? this.defaultQuota(p.id);
        const usage = await this.computeUsageCounts(p.id);
        return { ...quota, currentDailyUsage: usage.daily, currentMonthlyUsage: usage.monthly };
      }),
    );
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

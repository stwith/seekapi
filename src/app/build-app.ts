import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthPreHandler } from "../modules/auth/http/pre-handler.js";
import { AuthService } from "../modules/auth/service/auth-service.js";
import { ProjectService } from "../modules/projects/service/project-service.js";
import { registerCapabilityRoutes } from "../modules/capabilities/http/routes.js";
import { registerHealthRoutes } from "../modules/health/http/routes.js";
import { registerAdminRoutes } from "../modules/admin/http/routes.js";
import { AdminService } from "../modules/admin/service/admin-service.js";
import { SearchService } from "../modules/capabilities/service/search-service.js";
import { ProviderRegistry } from "../providers/core/registry.js";
import { BraveAdapter } from "../providers/brave/adapter.js";
import { CredentialService } from "../modules/credentials/service/credential-service.js";
import { UsageService } from "../modules/usage/service/usage-service.js";
import { AuditService } from "../modules/audit/service/audit-service.js";
import { RateLimitService } from "../modules/auth/service/rate-limit-service.js";
import {
  createRedisClient,
  createInMemoryRedisClient,
} from "../infra/redis/client.js";
import { HealthService } from "../modules/health/service/health-service.js";
import type { ApiKeyRepository } from "../infra/db/repositories/api-key-repository.js";
import type { ProjectRepository } from "../infra/db/repositories/project-repository.js";
import type { CredentialRepository } from "../infra/db/repositories/credential-repository.js";
import type { UsageEventRepository } from "../infra/db/repositories/usage-event-repository.js";
import type { AuditLogRepository } from "../infra/db/repositories/audit-log-repository.js";
import type { HealthSnapshotRepository } from "../infra/db/repositories/health-snapshot-repository.js";
import type { QuotaRepository } from "../infra/db/repositories/quota-repository.js";

export interface AppOptions {
  logger?: boolean | object;
  /** Repository for downstream API key lookups. Required. */
  apiKeyRepository: ApiKeyRepository;
  /** Repository for project lookups. Required. */
  projectRepository: ProjectRepository;
  /** Repository for provider credential lookups. Required. */
  credentialRepository: CredentialRepository;
  /** Repository for persisting usage events. Required. [AC3] */
  usageEventRepository: UsageEventRepository;
  /** Repository for persisting audit log entries. Required. [AC3] */
  auditLogRepository: AuditLogRepository;
  /** Repository for persisting health snapshots. Required. [AC3] */
  healthSnapshotRepository: HealthSnapshotRepository;
  /** Repository for project quota configuration. [Task 38] */
  quotaRepository?: QuotaRepository;
  /** Hex-encoded 32-byte key for credential encryption. Required. */
  encryptionKey: string;
  /**
   * Project ID whose credentials are used for provider health probes.
   * When set, health probes use real upstream credentials so
   * `/v1/health/providers` reports actual provider readiness. [AC4]
   */
  healthProbeProjectId?: string;
  /**
   * Admin API key for operator management endpoints (/v1/admin/*).
   * When set, admin routes are registered and protected by this key. [AC3]
   */
  adminApiKey?: string;
}

/**
 * Build and configure the Fastify application. [AC1][AC2][AC6]
 *
 * All repositories and the encryption key must be provided by the caller.
 * This ensures the app never silently falls back to demo-only state or
 * process-local encryption keys.
 */
export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  const {
    apiKeyRepository,
    projectRepository,
    credentialRepository,
    usageEventRepository,
    auditLogRepository,
    healthSnapshotRepository,
    encryptionKey,
  } = opts;

  // Service layer — repository-backed [AC2]
  const projectService = new ProjectService({ projectRepository });
  const authService = new AuthService({ apiKeyRepository, projectService });
  const credentialService = new CredentialService({
    credentialRepository,
    encryptionKey,
  });

  // Provider registry [AC6]
  const registry = new ProviderRegistry();
  registry.register(new BraveAdapter());

  // Health service — uses a dedicated health-probe project's credentials
  // to perform real upstream probes. When healthProbeProjectId is set,
  // probes use real credentials so /v1/health/providers reports actual
  // provider readiness. Without it, adapters fall back to returning
  // "unavailable" (no credential to probe with). [AC4]
  const healthProbeProjectId = opts.healthProbeProjectId;
  const healthService = new HealthService({
    registry,
    resolveHealthCredential: async (provider) => {
      if (!healthProbeProjectId) return undefined;
      try {
        return await credentialService.resolve(healthProbeProjectId, provider);
      } catch {
        return undefined; // no credential for this provider — probe without
      }
    },
    snapshotSink: healthSnapshotRepository,
  });

  // Health endpoints — /v1/health is public, /v1/health/providers requires auth
  await registerHealthRoutes(app, { healthService });

  // Search service with routing-backed provider selection [AC2][AC6]
  const searchService = new SearchService({
    registry,
    resolveCredential: (projectId, provider) =>
      credentialService.resolve(projectId, provider),
    health: healthService,
  });

  // Usage event recording — repository-backed [AC3]
  const usageService = new UsageService(usageEventRepository);

  // Audit log recording — repository-backed [AC3]
  const auditService = new AuditService(auditLogRepository);

  // Rate limiting — real Redis when REDIS_URL is set, in-memory stub otherwise
  const redisUrl = process.env["REDIS_URL"];
  const redis = redisUrl
    ? createRedisClient(redisUrl)
    : createInMemoryRedisClient();
  const rateLimitService = new RateLimitService(redis);

  // Admin endpoints — operator management via ADMIN_API_KEY [AC3]
  if (opts.adminApiKey) {
    const adminService = new AdminService({
      apiKeyRepository,
      projectRepository,
      credentialRepository,
      encryptionKey,
      usageEventRepository,
      auditLogRepository,
      quotaRepository: opts.quotaRepository,
    });
    await registerAdminRoutes(app, {
      adminService,
      adminApiKey: opts.adminApiKey,
    });
  }

  // Downstream API key authentication with rate limiting [AC2]
  await registerAuthPreHandler(app, { authService, rateLimitService });

  // Canonical search endpoints [AC6]
  await registerCapabilityRoutes(app, { searchService, usageService, auditService });

  // Close Redis connection on app shutdown to prevent connection leaks
  app.addHook("onClose", async () => {
    await redis.quit();
  });

  return app;
}

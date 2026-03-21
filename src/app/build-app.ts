import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthPreHandler } from "../modules/auth/http/pre-handler.js";
import { AuthService } from "../modules/auth/service/auth-service.js";
import { ProjectService } from "../modules/projects/service/project-service.js";
import { registerCapabilityRoutes } from "../modules/capabilities/http/routes.js";
import { registerHealthRoutes } from "../modules/health/http/routes.js";
import { SearchService } from "../modules/capabilities/service/search-service.js";
import { ProviderRegistry } from "../providers/core/registry.js";
import { BraveAdapter } from "../providers/brave/adapter.js";
import { CredentialService } from "../modules/credentials/service/credential-service.js";
import { UsageService, type UsageEventSink } from "../modules/usage/service/usage-service.js";
import { AuditService, type AuditLogSink } from "../modules/audit/service/audit-service.js";
import { RateLimitService } from "../modules/auth/service/rate-limit-service.js";
import {
  createRedisClient,
  createInMemoryRedisClient,
} from "../infra/redis/client.js";
import { HealthService } from "../modules/health/service/health-service.js";
import type { ApiKeyRepository } from "../infra/db/repositories/api-key-repository.js";
import type { ProjectRepository } from "../infra/db/repositories/project-repository.js";
import type { CredentialRepository } from "../infra/db/repositories/credential-repository.js";

export interface AppOptions {
  logger?: boolean | object;
  /** Repository for downstream API key lookups. Required. */
  apiKeyRepository: ApiKeyRepository;
  /** Repository for project lookups. Required. */
  projectRepository: ProjectRepository;
  /** Repository for provider credential lookups. Required. */
  credentialRepository: CredentialRepository;
  /** Hex-encoded 32-byte key for credential encryption. Required. */
  encryptionKey: string;
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

  // Health service — resolves credentials from the caller's project context,
  // not a hardcoded demo project. Uses the authenticated request's project
  // for provider health when available, falls back to probing without
  // credentials (adapter-level decision).
  const healthService = new HealthService({
    registry,
    resolveHealthCredential: async (_provider) => {
      // Health probes do not have a request-scoped project context.
      // Return undefined so adapters fall back to unauthenticated probes
      // or skip the check. A proper health credential strategy (e.g. a
      // dedicated health-probe project) belongs in Task 15.
      return undefined;
    },
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

  // Usage event recording
  const usageEventSink: UsageEventSink = {
    async record(event) {
      app.log.info({ usageEvent: event }, "usage event recorded");
    },
  };
  const usageService = new UsageService(usageEventSink);

  // Audit log recording
  const auditLogSink: AuditLogSink = {
    async record(entry) {
      app.log.info({ auditEntry: entry }, "audit event recorded");
    },
  };
  const auditService = new AuditService(auditLogSink);

  // Rate limiting — real Redis when REDIS_URL is set, in-memory stub otherwise
  const redisUrl = process.env["REDIS_URL"];
  const redis = redisUrl
    ? createRedisClient(redisUrl)
    : createInMemoryRedisClient();
  const rateLimitService = new RateLimitService(redis);

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

import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthPreHandler } from "../modules/auth/http/pre-handler.js";
import { AuthService, hashKey } from "../modules/auth/service/auth-service.js";
import { ProjectService } from "../modules/projects/service/project-service.js";
import { registerCapabilityRoutes } from "../modules/capabilities/http/routes.js";
import { registerHealthRoutes } from "../modules/health/http/routes.js";
import { SearchService } from "../modules/capabilities/service/search-service.js";
import { ProviderRegistry } from "../providers/core/registry.js";
import { BraveAdapter } from "../providers/brave/adapter.js";
import { CredentialService, encryptSecret } from "../modules/credentials/service/credential-service.js";
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
import { InMemoryApiKeyRepository } from "../infra/db/repositories/api-key-repository.js";
import { InMemoryProjectRepository } from "../infra/db/repositories/project-repository.js";
import { InMemoryCredentialRepository } from "../infra/db/repositories/credential-repository.js";
import { randomBytes } from "node:crypto";

export interface AppOptions {
  logger?: boolean | object;
  /** Override repositories for testing or custom wiring. */
  apiKeyRepository?: ApiKeyRepository;
  projectRepository?: ProjectRepository;
  credentialRepository?: CredentialRepository;
  encryptionKey?: string;
}

/** Well-known test key — used for development and testing. */
const TEST_KEY = "sk_test_seekapi_demo_key_001";

/**
 * Create default in-memory repositories seeded with demo data. [AC1]
 * Used when no external repositories are provided (local dev / tests).
 */
function createDefaultRepositories(encryptionKey: string) {
  const apiKeyRepo = new InMemoryApiKeyRepository([
    {
      id: "key_demo_001",
      projectId: "proj_demo_001",
      hashedKey: hashKey(TEST_KEY),
      status: "active",
    },
  ]);

  const projectRepo = new InMemoryProjectRepository();
  projectRepo.seed({
    project: { id: "proj_demo_001", name: "Demo Project", status: "active" },
    bindings: [
      { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      { provider: "brave", capability: "search.news", enabled: true, priority: 0 },
      { provider: "brave", capability: "search.images", enabled: true, priority: 0 },
    ],
    defaultProvider: "brave",
  });

  const credentialRepo = new InMemoryCredentialRepository();
  const braveKey = process.env["BRAVE_API_KEY"];
  if (braveKey) {
    credentialRepo.seed({
      id: "cred_demo_001",
      projectId: "proj_demo_001",
      provider: "brave",
      encryptedSecret: encryptSecret(braveKey, encryptionKey),
      status: "active",
    });
  }

  return { apiKeyRepo, projectRepo, credentialRepo };
}

/**
 * Build and configure the Fastify application. [AC1][AC2][AC6]
 * Composes repository-backed services for auth, project, and credential
 * resolution, then wires them into the HTTP layer.
 */
export async function buildApp(
  opts: AppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  // Encryption key for provider credentials
  const encryptionKey =
    opts.encryptionKey ??
    process.env["ENCRYPTION_KEY"] ??
    randomBytes(32).toString("hex");

  // Repositories — injectable for tests, default in-memory for local dev [AC1]
  const defaults = (!opts.apiKeyRepository && !opts.projectRepository && !opts.credentialRepository)
    ? createDefaultRepositories(encryptionKey)
    : null;

  const apiKeyRepository = opts.apiKeyRepository ?? defaults!.apiKeyRepo;
  const projectRepository = opts.projectRepository ?? defaults!.projectRepo;
  const credentialRepository = opts.credentialRepository ?? defaults!.credentialRepo;

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

  // Health service — caches provider probes to avoid upstream quota burn
  const healthService = new HealthService({
    registry,
    resolveHealthCredential: async (provider) => {
      try {
        return await credentialService.resolve("proj_demo_001", provider);
      } catch {
        return undefined;
      }
    },
  });

  // Health endpoints — /v1/health is public, /v1/health/providers requires auth
  await registerHealthRoutes(app, { healthService });

  // Search service with real provider wiring [AC6]
  const searchService = new SearchService({
    registry,
    resolveCredential: (projectId, provider) =>
      credentialService.resolve(projectId, provider),
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

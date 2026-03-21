import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthPreHandler } from "../modules/auth/http/pre-handler.js";
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

export interface AppOptions {
  logger?: boolean | object;
}

/**
 * Build and configure the Fastify application. [AC1][AC4]
 * Composes the provider registry, credential resolution, and search service,
 * then wires them into the HTTP layer.
 */
export async function buildApp(
  opts: AppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  // Provider registry [AC4]
  const registry = new ProviderRegistry();
  registry.register(new BraveAdapter());

  // Health endpoints — available before auth
  await registerHealthRoutes(app, { registry });

  // Credential resolution [AC4]
  const credentialService = new CredentialService();

  // Search service with real provider wiring [AC4]
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
  await registerAuthPreHandler(app, { rateLimitService });

  // Canonical search endpoints [AC3]
  await registerCapabilityRoutes(app, { searchService, usageService, auditService });

  return app;
}

import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthPreHandler } from "../modules/auth/http/pre-handler.js";
import { registerCapabilityRoutes } from "../modules/capabilities/http/routes.js";
import { SearchService } from "../modules/capabilities/service/search-service.js";
import { ProviderRegistry } from "../providers/core/registry.js";
import { BraveAdapter } from "../providers/brave/adapter.js";
import { CredentialService } from "../modules/credentials/service/credential-service.js";

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

  // Health probe — available before any module wiring
  app.get("/v1/health", async (_req, reply) => {
    return reply.send({ status: "ok" });
  });

  // Provider registry [AC4]
  const registry = new ProviderRegistry();
  registry.register(new BraveAdapter());

  // Credential resolution [AC4]
  const credentialService = new CredentialService();

  // Search service with real provider wiring [AC4]
  const searchService = new SearchService({
    registry,
    resolveCredential: (projectId, provider) =>
      credentialService.resolve(projectId, provider),
  });

  // Downstream API key authentication [AC2]
  await registerAuthPreHandler(app);

  // Canonical search endpoints [AC3]
  await registerCapabilityRoutes(app, searchService);

  return app;
}

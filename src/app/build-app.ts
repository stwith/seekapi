import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthPreHandler } from "../modules/auth/http/pre-handler.js";
import { registerCapabilityRoutes } from "../modules/capabilities/http/routes.js";

export interface AppOptions {
  logger?: boolean | object;
}

/**
 * Build and configure the Fastify application.
 * Modules and plugins are registered here during composition (Task 10).
 * For now this returns a minimal runnable app. [AC1]
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

  // Downstream API key authentication [AC2]
  await registerAuthPreHandler(app);

  // Canonical search endpoints [AC3]
  await registerCapabilityRoutes(app);

  return app;
}

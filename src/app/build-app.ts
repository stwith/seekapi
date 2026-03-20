import Fastify, { type FastifyInstance } from "fastify";

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

  return app;
}

/**
 * Health HTTP routes — gateway and provider health reporting.
 */

import type { FastifyInstance } from "fastify";
import type { HealthService } from "../service/health-service.js";

export interface HealthRouteDeps {
  healthService?: HealthService;
}

/**
 * Register health endpoints.
 *
 * - GET /v1/health — gateway readiness (always available, public)
 * - GET /v1/health/providers — per-provider health status (requires auth)
 */
export async function registerHealthRoutes(
  app: FastifyInstance,
  deps?: HealthRouteDeps,
): Promise<void> {
  // Gateway readiness — reports basic uptime and timestamp
  app.get("/v1/health", async (_req, reply) => {
    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  // Provider health — delegates to HealthService (cached, avoids repeated upstream probes)
  app.get("/v1/health/providers", async (_req, reply) => {
    if (!deps?.healthService) {
      return reply.send({ providers: [] });
    }

    const results = await deps.healthService.getProviderHealth();
    const providers = results.map((r) => ({
      provider: r.provider,
      status: r.status,
      latency_ms: r.latencyMs,
      checked_at: r.checkedAt,
    }));
    return reply.send({ providers });
  });
}

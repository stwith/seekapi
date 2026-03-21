/**
 * Health HTTP routes — gateway and provider health reporting.
 */

import type { FastifyInstance } from "fastify";
import type { ProviderRegistry } from "../../../providers/core/registry.js";

export interface HealthRouteDeps {
  registry?: ProviderRegistry;
}

/**
 * Register health endpoints.
 *
 * - GET /v1/health — gateway readiness (always available)
 * - GET /v1/health/providers — per-provider health status
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

  // Provider health — reports each registered provider's health status
  app.get("/v1/health/providers", async (_req, reply) => {
    if (!deps?.registry) {
      return reply.send({ providers: [] });
    }

    const adapters = deps.registry.list();
    const results = await Promise.all(
      adapters.map(async (adapter) => {
        try {
          const health = await adapter.healthCheck({});
          return {
            provider: adapter.id,
            status: health.status,
            latency_ms: health.latencyMs ?? null,
            checked_at: health.checkedAt.toISOString(),
          };
        } catch {
          return {
            provider: adapter.id,
            status: "unavailable" as const,
            latency_ms: null,
            checked_at: new Date().toISOString(),
          };
        }
      }),
    );

    return reply.send({ providers: results });
  });
}

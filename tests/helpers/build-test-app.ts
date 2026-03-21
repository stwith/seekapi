/**
 * Shared helper to build a fully-wired test app with seeded repositories.
 * Every test that needs a running Fastify instance should use this instead
 * of calling buildApp() directly, ensuring no demo-only assumptions leak.
 */

import { buildApp } from "../../src/app/build-app.js";
import { seedTestRepositories } from "./seed-test-repos.js";
import type { FastifyInstance } from "fastify";

export async function buildTestApp(opts?: {
  braveApiKey?: string;
}): Promise<FastifyInstance> {
  const repos = seedTestRepositories(opts);
  return buildApp({
    logger: false,
    ...repos,
  });
}

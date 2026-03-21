import { buildApp } from "./build-app.js";
import { bootstrapFromEnv } from "./bootstrap.js";

async function main(): Promise<void> {
  const port = Number(process.env["PORT"] ?? 3000);
  const host = process.env["HOST"] ?? "0.0.0.0";

  const repos = bootstrapFromEnv();
  const app = await buildApp({
    ...repos,
    // Use the seed project's credentials for health probes when BRAVE_API_KEY
    // is set and running in in-memory mode. In DB-backed mode, health probes
    // use HEALTH_PROBE_PROJECT_ID if configured. [AC4]
    healthProbeProjectId: process.env["HEALTH_PROBE_PROJECT_ID"]
      ?? (process.env["BRAVE_API_KEY"] && !process.env["DATABASE_URL"]
        ? (process.env["SEED_PROJECT_ID"] ?? "proj_demo_001")
        : undefined),
  });

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

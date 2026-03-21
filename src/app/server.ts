import { buildApp } from "./build-app.js";
import { hashKey } from "../modules/auth/service/auth-service.js";
import { encryptSecret } from "../modules/credentials/service/credential-service.js";
import { createDbClient } from "../infra/db/client.js";
import { InMemoryApiKeyRepository, DrizzleApiKeyRepository } from "../infra/db/repositories/api-key-repository.js";
import { InMemoryProjectRepository, DrizzleProjectRepository } from "../infra/db/repositories/project-repository.js";
import { InMemoryCredentialRepository, DrizzleCredentialRepository } from "../infra/db/repositories/credential-repository.js";
import { InMemoryUsageEventRepository, DrizzleUsageEventRepository } from "../infra/db/repositories/usage-event-repository.js";
import { InMemoryAuditLogRepository, DrizzleAuditLogRepository } from "../infra/db/repositories/audit-log-repository.js";
import { InMemoryHealthSnapshotRepository, DrizzleHealthSnapshotRepository } from "../infra/db/repositories/health-snapshot-repository.js";

/**
 * Bootstrap repositories from environment variables.
 *
 * When DATABASE_URL is set, all repositories — including control-plane
 * entities (API keys, projects, credentials, bindings) and observability
 * stores (usage, audit, health) — use Drizzle-backed PostgreSQL. [AC1][AC2]
 *
 * When DATABASE_URL is not set, falls back to seed-based in-memory
 * repositories for local dev, tests, and smoke runs.
 */
function bootstrapFromEnv() {
  const encryptionKey = process.env["ENCRYPTION_KEY"];
  if (!encryptionKey) {
    throw new Error(
      "ENCRYPTION_KEY is required. Set a 64-character hex string (32 bytes).",
    );
  }

  const databaseUrl = process.env["DATABASE_URL"];

  if (databaseUrl) {
    // DB-backed path — all entities loaded from PostgreSQL [AC1][AC2]
    const { db } = createDbClient(databaseUrl);
    return {
      apiKeyRepository: new DrizzleApiKeyRepository(db) as InstanceType<typeof DrizzleApiKeyRepository>,
      projectRepository: new DrizzleProjectRepository(db) as InstanceType<typeof DrizzleProjectRepository>,
      credentialRepository: new DrizzleCredentialRepository(db) as InstanceType<typeof DrizzleCredentialRepository>,
      usageEventRepository: new DrizzleUsageEventRepository(db),
      auditLogRepository: new DrizzleAuditLogRepository(db),
      healthSnapshotRepository: new DrizzleHealthSnapshotRepository(db),
      encryptionKey,
    };
  }

  // In-memory path — seed-based bootstrap for local dev / smoke / tests
  const seedApiKey = process.env["SEED_API_KEY"] ?? "sk_test_seekapi_demo_key_001";
  const seedProjectId = process.env["SEED_PROJECT_ID"] ?? "proj_demo_001";
  const seedProjectName = process.env["SEED_PROJECT_NAME"] ?? "Demo Project";

  const apiKeyRepository = new InMemoryApiKeyRepository([
    {
      id: "key_seed_001",
      projectId: seedProjectId,
      hashedKey: hashKey(seedApiKey),
      status: "active",
    },
  ]);

  const projectRepository = new InMemoryProjectRepository();
  projectRepository.seed({
    project: { id: seedProjectId, name: seedProjectName, status: "active" },
    bindings: [
      { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      { provider: "brave", capability: "search.news", enabled: true, priority: 0 },
      { provider: "brave", capability: "search.images", enabled: true, priority: 0 },
    ],
    defaultProvider: "brave",
  });

  const credentialRepository = new InMemoryCredentialRepository();
  const braveKey = process.env["BRAVE_API_KEY"];
  if (braveKey) {
    credentialRepository.seed({
      id: "cred_seed_001",
      projectId: seedProjectId,
      provider: "brave",
      encryptedSecret: encryptSecret(braveKey, encryptionKey),
      status: "active",
    });
  }

  const usageEventRepository = new InMemoryUsageEventRepository();
  const auditLogRepository = new InMemoryAuditLogRepository();
  const healthSnapshotRepository = new InMemoryHealthSnapshotRepository();

  return {
    apiKeyRepository,
    projectRepository,
    credentialRepository,
    usageEventRepository,
    auditLogRepository,
    healthSnapshotRepository,
    encryptionKey,
  };
}

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

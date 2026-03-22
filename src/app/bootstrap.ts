/**
 * Bootstrap repository selection from environment variables. [AC1][AC2]
 *
 * When DATABASE_URL is set, all repositories — including control-plane
 * entities (API keys, projects, credentials, bindings) and observability
 * stores (usage, audit, health) — use Drizzle-backed PostgreSQL.
 *
 * When DATABASE_URL is not set, falls back to seed-based in-memory
 * repositories for local dev, tests, and smoke runs.
 */

import { hashKey } from "../modules/auth/service/auth-service.js";
import { encryptSecret } from "../modules/credentials/service/credential-service.js";
import { createDbClient } from "../infra/db/client.js";
import { InMemoryApiKeyRepository, DrizzleApiKeyRepository } from "../infra/db/repositories/api-key-repository.js";
import { InMemoryProjectRepository, DrizzleProjectRepository } from "../infra/db/repositories/project-repository.js";
import { InMemoryCredentialRepository, DrizzleCredentialRepository } from "../infra/db/repositories/credential-repository.js";
import { InMemoryUsageEventRepository, DrizzleUsageEventRepository } from "../infra/db/repositories/usage-event-repository.js";
import { InMemoryAuditLogRepository, DrizzleAuditLogRepository } from "../infra/db/repositories/audit-log-repository.js";
import { InMemoryHealthSnapshotRepository, DrizzleHealthSnapshotRepository } from "../infra/db/repositories/health-snapshot-repository.js";
import type { ApiKeyRepository } from "../infra/db/repositories/api-key-repository.js";
import type { ProjectRepository } from "../infra/db/repositories/project-repository.js";
import type { CredentialRepository } from "../infra/db/repositories/credential-repository.js";
import type { UsageEventRepository } from "../infra/db/repositories/usage-event-repository.js";
import type { AuditLogRepository } from "../infra/db/repositories/audit-log-repository.js";
import type { HealthSnapshotRepository } from "../infra/db/repositories/health-snapshot-repository.js";

export interface BootstrapResult {
  apiKeyRepository: ApiKeyRepository;
  projectRepository: ProjectRepository;
  credentialRepository: CredentialRepository;
  usageEventRepository: UsageEventRepository;
  auditLogRepository: AuditLogRepository;
  healthSnapshotRepository: HealthSnapshotRepository;
  encryptionKey: string;
}

export function bootstrapFromEnv(): BootstrapResult {
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
      apiKeyRepository: new DrizzleApiKeyRepository(db),
      projectRepository: new DrizzleProjectRepository(db),
      credentialRepository: new DrizzleCredentialRepository(db),
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
      { provider: "tavily", capability: "search.web", enabled: true, priority: 1 },
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

  const tavilyKey = process.env["TAVILY_API_KEY"];
  if (tavilyKey) {
    credentialRepository.seed({
      id: "cred_seed_002",
      projectId: seedProjectId,
      provider: "tavily",
      encryptedSecret: encryptSecret(tavilyKey, encryptionKey),
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

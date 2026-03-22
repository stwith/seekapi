/**
 * Shared test helper: create in-memory repositories seeded with
 * well-known test data for integration / smoke / e2e tests.
 *
 * This replaces the old demo-only data that was hardcoded inside
 * buildApp(). Tests must now explicitly supply repositories.
 */

import { randomBytes } from "node:crypto";
import { hashKey } from "../../src/modules/auth/service/auth-service.js";
import { encryptSecret } from "../../src/modules/credentials/service/credential-service.js";
import { InMemoryApiKeyRepository } from "../../src/infra/db/repositories/api-key-repository.js";
import { InMemoryProjectRepository } from "../../src/infra/db/repositories/project-repository.js";
import { InMemoryCredentialRepository } from "../../src/infra/db/repositories/credential-repository.js";
import { InMemoryUsageEventRepository } from "../../src/infra/db/repositories/usage-event-repository.js";
import { InMemoryAuditLogRepository } from "../../src/infra/db/repositories/audit-log-repository.js";
import { InMemoryHealthSnapshotRepository } from "../../src/infra/db/repositories/health-snapshot-repository.js";
import { InMemoryQuotaRepository } from "../../src/infra/db/repositories/quota-repository.js";

/** Well-known test API key used across test suites. */
export const TEST_API_KEY = "sk_test_seekapi_demo_key_001";
export const TEST_PROJECT_ID = "proj_demo_001";
export const TEST_API_KEY_ID = "key_demo_001";
export const TEST_BRAVE_CREDENTIAL = "test_brave_api_key_for_e2e";
export const TEST_GLOBAL_CREDENTIAL_ID = "cred_global_001";

/**
 * Create a fresh set of in-memory repositories seeded with test data.
 * Returns the repos and the encryption key needed by buildApp().
 */
export function seedTestRepositories(opts?: {
  braveApiKey?: string;
}) {
  const encryptionKey = randomBytes(32).toString("hex");
  const braveKey = opts?.braveApiKey ?? process.env["BRAVE_API_KEY"] ?? TEST_BRAVE_CREDENTIAL;

  const apiKeyRepository = new InMemoryApiKeyRepository([
    {
      id: TEST_API_KEY_ID,
      projectId: TEST_PROJECT_ID,
      hashedKey: hashKey(TEST_API_KEY),
      status: "active",
    },
  ]);

  const projectRepository = new InMemoryProjectRepository();
  projectRepository.seed({
    project: { id: TEST_PROJECT_ID, name: "Demo Project", status: "active" },
    bindings: [
      { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      { provider: "brave", capability: "search.news", enabled: true, priority: 0 },
      { provider: "brave", capability: "search.images", enabled: true, priority: 0 },
    ],
    defaultProvider: "brave",
  });

  const credentialRepository = new InMemoryCredentialRepository();
  credentialRepository.seed({
    id: "cred_demo_001",
    projectId: TEST_PROJECT_ID,
    name: "Demo Brave Key",
    provider: "brave",
    encryptedSecret: encryptSecret(braveKey, encryptionKey),
    status: "active",
  });

  // Seed a global credential (projectId=null) for credential pool testing
  credentialRepository.seed({
    id: TEST_GLOBAL_CREDENTIAL_ID,
    projectId: null,
    name: "Global Brave Key",
    provider: "brave",
    encryptedSecret: encryptSecret("global_brave_api_key_for_test", encryptionKey),
    status: "active",
  });

  const usageEventRepository = new InMemoryUsageEventRepository();
  const auditLogRepository = new InMemoryAuditLogRepository();
  const healthSnapshotRepository = new InMemoryHealthSnapshotRepository();
  const quotaRepository = new InMemoryQuotaRepository();

  return {
    apiKeyRepository,
    projectRepository,
    credentialRepository,
    usageEventRepository,
    auditLogRepository,
    healthSnapshotRepository,
    quotaRepository,
    encryptionKey,
  };
}

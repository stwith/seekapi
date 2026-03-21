import { buildApp } from "./build-app.js";
import { hashKey } from "../modules/auth/service/auth-service.js";
import { encryptSecret } from "../modules/credentials/service/credential-service.js";
import { InMemoryApiKeyRepository } from "../infra/db/repositories/api-key-repository.js";
import { InMemoryProjectRepository } from "../infra/db/repositories/project-repository.js";
import { InMemoryCredentialRepository } from "../infra/db/repositories/credential-repository.js";

/**
 * Bootstrap in-memory repositories from environment variables.
 * This is the local dev / smoke entrypoint.
 * Production deployments should wire Drizzle-backed repositories.
 */
function bootstrapFromEnv() {
  const encryptionKey = process.env["ENCRYPTION_KEY"];
  if (!encryptionKey) {
    throw new Error(
      "ENCRYPTION_KEY is required. Set a 64-character hex string (32 bytes).",
    );
  }

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

  return { apiKeyRepository, projectRepository, credentialRepository, encryptionKey };
}

async function main(): Promise<void> {
  const port = Number(process.env["PORT"] ?? 3000);
  const host = process.env["HOST"] ?? "0.0.0.0";

  const repos = bootstrapFromEnv();
  const app = await buildApp(repos);

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

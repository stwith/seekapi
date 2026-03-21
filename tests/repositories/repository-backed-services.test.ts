import { describe, test, expect, beforeEach } from "vitest";
import { AuthService, hashKey } from "../../src/modules/auth/service/auth-service.js";
import { ProjectService } from "../../src/modules/projects/service/project-service.js";
import {
  CredentialService,
  encryptSecret,
  decryptSecret,
} from "../../src/modules/credentials/service/credential-service.js";
import { InMemoryApiKeyRepository } from "../../src/infra/db/repositories/api-key-repository.js";
import { InMemoryProjectRepository } from "../../src/infra/db/repositories/project-repository.js";
import { InMemoryCredentialRepository } from "../../src/infra/db/repositories/credential-repository.js";
import { randomBytes } from "node:crypto";

const TEST_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const TEST_RAW_KEY = "sk_test_repo_key_001";
const TEST_PROJECT_ID = "proj_repo_001";
const TEST_API_KEY_ID = "key_repo_001";

describe("Repository-backed AuthService", () => {
  let authService: AuthService;
  let apiKeyRepo: InMemoryApiKeyRepository;
  let projectRepo: InMemoryProjectRepository;

  beforeEach(() => {
    apiKeyRepo = new InMemoryApiKeyRepository([
      {
        id: TEST_API_KEY_ID,
        projectId: TEST_PROJECT_ID,
        hashedKey: hashKey(TEST_RAW_KEY),
        status: "active",
      },
    ]);

    projectRepo = new InMemoryProjectRepository();
    projectRepo.seed({
      project: { id: TEST_PROJECT_ID, name: "Test Project", status: "active" },
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      ],
      defaultProvider: "brave",
    });

    const projectService = new ProjectService({ projectRepository: projectRepo });
    authService = new AuthService({ apiKeyRepository: apiKeyRepo, projectService });
  });

  test("valid key resolves to project context", async () => {
    const ctx = await authService.authenticate(TEST_RAW_KEY);
    expect(ctx).toBeDefined();
    expect(ctx!.projectId).toBe(TEST_PROJECT_ID);
    expect(ctx!.apiKeyId).toBe(TEST_API_KEY_ID);
    expect(ctx!.defaultProvider).toBe("brave");
    expect(ctx!.bindings.some((b) => b.provider === "brave" && b.enabled)).toBe(true);
  });

  test("invalid key returns undefined", async () => {
    const ctx = await authService.authenticate("sk_invalid_key_000");
    expect(ctx).toBeUndefined();
  });

  test("inactive key returns undefined", async () => {
    apiKeyRepo.seed({
      id: "key_inactive",
      projectId: TEST_PROJECT_ID,
      hashedKey: hashKey("sk_inactive_key"),
      status: "revoked",
    });
    const ctx = await authService.authenticate("sk_inactive_key");
    expect(ctx).toBeUndefined();
  });

  test("key for inactive project returns undefined", async () => {
    const inactiveProjectId = "proj_inactive_001";
    apiKeyRepo.seed({
      id: "key_inactive_proj",
      projectId: inactiveProjectId,
      hashedKey: hashKey("sk_inactive_proj_key"),
      status: "active",
    });
    projectRepo.seed({
      project: { id: inactiveProjectId, name: "Inactive", status: "suspended" },
      bindings: [],
      defaultProvider: "brave",
    });
    const ctx = await authService.authenticate("sk_inactive_proj_key");
    expect(ctx).toBeUndefined();
  });
});

describe("Repository-backed ProjectService", () => {
  let projectService: ProjectService;
  let projectRepo: InMemoryProjectRepository;

  beforeEach(() => {
    projectRepo = new InMemoryProjectRepository();
    projectRepo.seed({
      project: { id: TEST_PROJECT_ID, name: "Test Project", status: "active" },
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "brave", capability: "search.news", enabled: true, priority: 0 },
        { provider: "tavily", capability: "search.web", enabled: false, priority: 1 },
      ],
      defaultProvider: "brave",
    });
    projectService = new ProjectService({ projectRepository: projectRepo });
  });

  test("resolves active project with bindings", async () => {
    const ctx = await projectService.resolve(TEST_PROJECT_ID, "key_001");
    expect(ctx).toBeDefined();
    expect(ctx!.projectId).toBe(TEST_PROJECT_ID);
    expect(ctx!.projectName).toBe("Test Project");
    expect(ctx!.defaultProvider).toBe("brave");
    expect(ctx!.bindings).toHaveLength(3);
    expect(ctx!.apiKeyId).toBe("key_001");
  });

  test("bindings include both enabled and disabled entries for downstream filtering", async () => {
    const ctx = await projectService.resolve(TEST_PROJECT_ID);
    const enabled = ctx!.bindings.filter((b) => b.enabled);
    expect(enabled.every((b) => b.provider === "brave")).toBe(true);
    expect(ctx!.bindings.some((b) => b.provider === "tavily" && !b.enabled)).toBe(true);
  });

  test("unknown project returns undefined", async () => {
    const ctx = await projectService.resolve("proj_nonexistent");
    expect(ctx).toBeUndefined();
  });
});

describe("Repository-backed CredentialService", () => {
  let credentialService: CredentialService;
  let credentialRepo: InMemoryCredentialRepository;

  beforeEach(() => {
    credentialRepo = new InMemoryCredentialRepository();
    credentialRepo.seed({
      id: "cred_001",
      projectId: TEST_PROJECT_ID,
      provider: "brave",
      encryptedSecret: encryptSecret("brave_api_key_value", TEST_ENCRYPTION_KEY),
      status: "active",
    });
    credentialService = new CredentialService({
      credentialRepository: credentialRepo,
      encryptionKey: TEST_ENCRYPTION_KEY,
    });
  });

  test("resolves and decrypts credential", async () => {
    const secret = await credentialService.resolve(TEST_PROJECT_ID, "brave");
    expect(secret).toBe("brave_api_key_value");
  });

  test("throws for missing credential", async () => {
    await expect(
      credentialService.resolve(TEST_PROJECT_ID, "tavily"),
    ).rejects.toThrow(/No credential found/);
  });

  test("throws for unknown project", async () => {
    await expect(
      credentialService.resolve("proj_nonexistent", "brave"),
    ).rejects.toThrow(/No credential found/);
  });

  test("inactive credential is not returned", async () => {
    credentialRepo.seed({
      id: "cred_revoked",
      projectId: TEST_PROJECT_ID,
      provider: "tavily",
      encryptedSecret: encryptSecret("tavily_key", TEST_ENCRYPTION_KEY),
      status: "revoked",
    });
    await expect(
      credentialService.resolve(TEST_PROJECT_ID, "tavily"),
    ).rejects.toThrow(/No credential found/);
  });
});

describe("Encryption utilities", () => {
  test("encrypt and decrypt roundtrip", () => {
    const key = randomBytes(32).toString("hex");
    const plaintext = "my_secret_api_key_12345";
    const encrypted = encryptSecret(plaintext, key);
    const decrypted = decryptSecret(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  test("encrypted value has three colon-separated parts", () => {
    const key = randomBytes(32).toString("hex");
    const encrypted = encryptSecret("test", key);
    const parts = encrypted.split(":");
    expect(parts.length).toBe(3);
  });

  test("different encryptions produce different ciphertexts", () => {
    const key = randomBytes(32).toString("hex");
    const a = encryptSecret("same_value", key);
    const b = encryptSecret("same_value", key);
    expect(a).not.toBe(b); // random IV
  });

  test("decryption with wrong key fails", () => {
    const key1 = randomBytes(32).toString("hex");
    const key2 = randomBytes(32).toString("hex");
    const encrypted = encryptSecret("secret", key1);
    expect(() => decryptSecret(encrypted, key2)).toThrow();
  });
});

import { describe, it, expect } from "vitest";
import {
  CredentialService,
  encryptSecret,
} from "../../src/modules/credentials/service/credential-service.js";
import { InMemoryCredentialRepository } from "../../src/infra/db/repositories/credential-repository.js";
import { InMemoryCredentialCapacityRepository } from "../../src/infra/db/repositories/credential-capacity-repository.js";
import { InMemoryUsageEventRepository } from "../../src/infra/db/repositories/usage-event-repository.js";

const KEY_HEX = "a".repeat(64);

function seedCred(
  repo: InMemoryCredentialRepository,
  id: string,
  provider: string,
  secret: string,
) {
  repo.seed({
    id,
    projectId: null,
    name: `${provider}-${id}`,
    provider,
    encryptedSecret: encryptSecret(secret, KEY_HEX),
    status: "active",
  });
}

describe("AC5 — Multi-credential candidate selection", () => {
  it("resolveWithCapacity picks the first credential with remaining capacity", async () => {
    const credRepo = new InMemoryCredentialRepository();
    const capRepo = new InMemoryCredentialCapacityRepository();
    const usageRepo = new InMemoryUsageEventRepository();

    // Two global credentials for brave
    seedCred(credRepo, "cred_a", "brave", "key-a");
    seedCred(credRepo, "cred_b", "brave", "key-b");

    // Link both to project
    await credRepo.addProjectRef!({ id: "ref_1", projectId: "proj_001", credentialId: "cred_a" });
    await credRepo.addProjectRef!({ id: "ref_2", projectId: "proj_001", credentialId: "cred_b" });

    // cred_a has a daily limit of 2, and has been used 2 times (exhausted)
    await capRepo.upsert({ credentialId: "cred_a", dailyLimit: 2 });
    for (let i = 0; i < 2; i++) {
      await usageRepo.record({
        requestId: `req_${i}`,
        projectId: "proj_001",
        apiKeyId: "key_001",
        provider: "brave",
        capability: "search.web",
        statusCode: 200,
        success: true,
        latencyMs: 100,
        resultCount: 5,
        fallbackCount: 0,
        credentialId: "cred_a",
      });
    }

    // cred_b has a daily limit of 100 and 0 usage
    await capRepo.upsert({ credentialId: "cred_b", dailyLimit: 100 });

    const svc = new CredentialService({
      credentialRepository: credRepo,
      encryptionKey: KEY_HEX,
      capacityRepository: capRepo,
      usageEventRepository: usageRepo,
    });

    const result = await svc.resolveWithCapacity("proj_001", "brave");
    expect(result.credentialId).toBe("cred_b");
    expect(result.secret).toBe("key-b");
  });

  it("resolveWithCapacity returns first credential when no capacity limits set", async () => {
    const credRepo = new InMemoryCredentialRepository();
    const capRepo = new InMemoryCredentialCapacityRepository();
    const usageRepo = new InMemoryUsageEventRepository();

    seedCred(credRepo, "cred_a", "brave", "key-a");
    await credRepo.addProjectRef!({ id: "ref_1", projectId: "proj_001", credentialId: "cred_a" });

    const svc = new CredentialService({
      credentialRepository: credRepo,
      encryptionKey: KEY_HEX,
      capacityRepository: capRepo,
      usageEventRepository: usageRepo,
    });

    const result = await svc.resolveWithCapacity("proj_001", "brave");
    expect(result.credentialId).toBe("cred_a");
    expect(result.secret).toBe("key-a");
  });

  it("resolveWithCapacity throws when all credentials exhausted", async () => {
    const credRepo = new InMemoryCredentialRepository();
    const capRepo = new InMemoryCredentialCapacityRepository();
    const usageRepo = new InMemoryUsageEventRepository();

    seedCred(credRepo, "cred_a", "brave", "key-a");
    await credRepo.addProjectRef!({ id: "ref_1", projectId: "proj_001", credentialId: "cred_a" });

    await capRepo.upsert({ credentialId: "cred_a", dailyLimit: 1 });
    await usageRepo.record({
      requestId: "req_1",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      statusCode: 200,
      success: true,
      latencyMs: 100,
      resultCount: 5,
      fallbackCount: 0,
      credentialId: "cred_a",
    });

    const svc = new CredentialService({
      credentialRepository: credRepo,
      encryptionKey: KEY_HEX,
      capacityRepository: capRepo,
      usageEventRepository: usageRepo,
    });

    await expect(
      svc.resolveWithCapacity("proj_001", "brave"),
    ).rejects.toThrow(/exhausted/);
  });

  it("resolve still works without capacity deps (backward compat)", async () => {
    const credRepo = new InMemoryCredentialRepository();
    credRepo.seed({
      id: "cred_direct",
      projectId: "proj_001",
      name: "brave-key",
      provider: "brave",
      encryptedSecret: encryptSecret("my-key", KEY_HEX),
      status: "active",
    });

    const svc = new CredentialService({
      credentialRepository: credRepo,
      encryptionKey: KEY_HEX,
    });

    const result = await svc.resolve("proj_001", "brave");
    expect(result.credentialId).toBe("cred_direct");
    expect(result.secret).toBe("my-key");
  });
});

import { describe, it, expect } from "vitest";
import {
  CredentialService,
  encryptSecret,
} from "../../src/modules/credentials/service/credential-service.js";
import { InMemoryCredentialRepository } from "../../src/infra/db/repositories/credential-repository.js";

const KEY_HEX = "a".repeat(64);

describe("AC3 — CredentialService.resolve returns credentialId", () => {
  it("resolve returns object with credentialId and secret", async () => {
    const repo = new InMemoryCredentialRepository();
    const encrypted = encryptSecret("my-api-key", KEY_HEX);
    repo.seed({
      id: "cred-001",
      projectId: "proj-001",
      name: "brave-key",
      provider: "brave",
      encryptedSecret: encrypted,
      status: "active",
    });

    const svc = new CredentialService({
      credentialRepository: repo,
      encryptionKey: KEY_HEX,
    });

    const result = await svc.resolve("proj-001", "brave");
    expect(result).toEqual({
      credentialId: "cred-001",
      secret: "my-api-key",
    });
  });

  it("resolve throws when no credential found", async () => {
    const repo = new InMemoryCredentialRepository();
    const svc = new CredentialService({
      credentialRepository: repo,
      encryptionKey: KEY_HEX,
    });

    await expect(svc.resolve("proj-999", "brave")).rejects.toThrow(
      /No credential found/,
    );
  });
});

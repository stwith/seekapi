import { describe, it, expect } from "vitest";
import {
  InMemoryCredentialCapacityRepository,
  type CredentialCapacity,
} from "../../src/infra/db/repositories/credential-capacity-repository.js";
import { InMemoryUsageEventRepository } from "../../src/infra/db/repositories/usage-event-repository.js";
import type { UsageEvent } from "../../src/modules/usage/service/usage-service.js";

function makeUsageEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    requestId: `req_${Math.random().toString(36).slice(2)}`,
    projectId: "proj_001",
    apiKeyId: "key_001",
    provider: "brave",
    capability: "search.web",
    statusCode: 200,
    success: true,
    latencyMs: 100,
    resultCount: 5,
    fallbackCount: 0,
    ...overrides,
  };
}

describe("AC2 — Credential capacity policy", () => {
  describe("CredentialCapacityRepository", () => {
    it("stores and retrieves capacity config", async () => {
      const repo = new InMemoryCredentialCapacityRepository();
      await repo.upsert({
        credentialId: "cred_001",
        dailyLimit: 1000,
        monthlyLimit: 25000,
      });

      const result = await repo.findByCredentialId("cred_001");
      expect(result).toBeDefined();
      expect(result!.dailyLimit).toBe(1000);
      expect(result!.monthlyLimit).toBe(25000);
    });

    it("returns undefined for unknown credential", async () => {
      const repo = new InMemoryCredentialCapacityRepository();
      const result = await repo.findByCredentialId("cred_unknown");
      expect(result).toBeUndefined();
    });

    it("upsert updates existing capacity", async () => {
      const repo = new InMemoryCredentialCapacityRepository();
      await repo.upsert({
        credentialId: "cred_001",
        dailyLimit: 1000,
        monthlyLimit: 25000,
      });
      await repo.upsert({
        credentialId: "cred_001",
        dailyLimit: 2000,
        monthlyLimit: 50000,
      });

      const result = await repo.findByCredentialId("cred_001");
      expect(result!.dailyLimit).toBe(2000);
      expect(result!.monthlyLimit).toBe(50000);
    });

    it("deletes capacity config", async () => {
      const repo = new InMemoryCredentialCapacityRepository();
      await repo.upsert({
        credentialId: "cred_001",
        dailyLimit: 1000,
        monthlyLimit: 25000,
      });
      await repo.delete("cred_001");

      const result = await repo.findByCredentialId("cred_001");
      expect(result).toBeUndefined();
    });
  });

  describe("Credential usage counting", () => {
    it("counts daily usage for a credential from usage events", async () => {
      const usageRepo = new InMemoryUsageEventRepository();

      // Record 3 events for cred_001
      for (let i = 0; i < 3; i++) {
        await usageRepo.record(
          makeUsageEvent({ credentialId: "cred_001" }),
        );
      }
      // Record 2 events for cred_002
      for (let i = 0; i < 2; i++) {
        await usageRepo.record(
          makeUsageEvent({ credentialId: "cred_002" }),
        );
      }

      const count = await usageRepo.countByCredential!("cred_001", "day");
      expect(count).toBe(3);
    });

    it("counts monthly usage for a credential", async () => {
      const usageRepo = new InMemoryUsageEventRepository();

      for (let i = 0; i < 5; i++) {
        await usageRepo.record(
          makeUsageEvent({ credentialId: "cred_001" }),
        );
      }

      const count = await usageRepo.countByCredential!("cred_001", "month");
      expect(count).toBe(5);
    });

    it("returns 0 for credential with no usage", async () => {
      const usageRepo = new InMemoryUsageEventRepository();
      const count = await usageRepo.countByCredential!("cred_none", "day");
      expect(count).toBe(0);
    });
  });
});

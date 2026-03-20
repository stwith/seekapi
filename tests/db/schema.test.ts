import { describe, test, expect } from "vitest";
import * as schema from "../../src/infra/db/schema/index.js";

/**
 * Verify the Drizzle schema exports the expected tables and columns. [AC2]
 */
describe("database schema", () => {
  test("exports projects table with required columns", () => {
    const t = schema.projects;
    expect(t).toBeDefined();
    expect(t.id).toBeDefined();
    expect(t.name).toBeDefined();
    expect(t.status).toBeDefined();
    expect(t.createdAt).toBeDefined();
    expect(t.updatedAt).toBeDefined();
  });

  test("exports apiKeys table with required columns", () => {
    const t = schema.apiKeys;
    expect(t).toBeDefined();
    expect(t.id).toBeDefined();
    expect(t.projectId).toBeDefined();
    expect(t.name).toBeDefined();
    expect(t.hashedKey).toBeDefined();
    expect(t.status).toBeDefined();
    expect(t.lastUsedAt).toBeDefined();
    expect(t.createdAt).toBeDefined();
  });

  test("exports providerCredentials table with required columns", () => {
    const t = schema.providerCredentials;
    expect(t).toBeDefined();
    expect(t.id).toBeDefined();
    expect(t.projectId).toBeDefined();
    expect(t.provider).toBeDefined();
    expect(t.encryptedSecret).toBeDefined();
    expect(t.metadataJson).toBeDefined();
    expect(t.status).toBeDefined();
    expect(t.validatedAt).toBeDefined();
    expect(t.createdAt).toBeDefined();
    expect(t.updatedAt).toBeDefined();
  });

  test("exports providerBindings table with required columns", () => {
    const t = schema.providerBindings;
    expect(t).toBeDefined();
    expect(t.id).toBeDefined();
    expect(t.projectId).toBeDefined();
    expect(t.provider).toBeDefined();
    expect(t.capability).toBeDefined();
    expect(t.enabled).toBeDefined();
    expect(t.priority).toBeDefined();
  });

  test("exports routingPolicies table with required columns", () => {
    const t = schema.routingPolicies;
    expect(t).toBeDefined();
    expect(t.id).toBeDefined();
    expect(t.projectId).toBeDefined();
    expect(t.capability).toBeDefined();
    expect(t.defaultProvider).toBeDefined();
    expect(t.fallbackOrderJson).toBeDefined();
    expect(t.allowExplicitOverride).toBeDefined();
  });

  test("exports usageEvents table with required columns", () => {
    const t = schema.usageEvents;
    expect(t).toBeDefined();
    expect(t.id).toBeDefined();
    expect(t.requestId).toBeDefined();
    expect(t.projectId).toBeDefined();
    expect(t.apiKeyId).toBeDefined();
    expect(t.provider).toBeDefined();
    expect(t.capability).toBeDefined();
    expect(t.statusCode).toBeDefined();
    expect(t.success).toBeDefined();
    expect(t.latencyMs).toBeDefined();
    expect(t.resultCount).toBeDefined();
    expect(t.fallbackCount).toBeDefined();
    expect(t.estimatedCost).toBeDefined();
    expect(t.createdAt).toBeDefined();
  });

  test("exports auditLogs table with required columns", () => {
    const t = schema.auditLogs;
    expect(t).toBeDefined();
    expect(t.id).toBeDefined();
    expect(t.projectId).toBeDefined();
    expect(t.actorType).toBeDefined();
    expect(t.actorId).toBeDefined();
    expect(t.action).toBeDefined();
    expect(t.resourceType).toBeDefined();
    expect(t.resourceId).toBeDefined();
    expect(t.detailsJson).toBeDefined();
    expect(t.createdAt).toBeDefined();
  });

  test("exports providerHealthSnapshots table with required columns", () => {
    const t = schema.providerHealthSnapshots;
    expect(t).toBeDefined();
    expect(t.id).toBeDefined();
    expect(t.provider).toBeDefined();
    expect(t.capability).toBeDefined();
    expect(t.status).toBeDefined();
    expect(t.latencyMs).toBeDefined();
    expect(t.checkedAt).toBeDefined();
  });

  test("schema exports exactly 8 tables", () => {
    const tableNames = [
      "projects",
      "apiKeys",
      "providerCredentials",
      "providerBindings",
      "routingPolicies",
      "usageEvents",
      "auditLogs",
      "providerHealthSnapshots",
    ] as const;

    for (const name of tableNames) {
      expect(schema[name], `missing table: ${name}`).toBeDefined();
    }
  });
});

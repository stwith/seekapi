/**
 * Repository interface for downstream API key lookups. [AC1][AC2]
 *
 * The hot path resolves an API key hash to the owning project.
 * Implementations may be backed by PostgreSQL (production) or
 * an in-memory store (tests).
 */

import { eq, and } from "drizzle-orm";
import type { DbClient } from "../client.js";
import { apiKeys } from "../schema/api-keys.js";

export interface ApiKeyRow {
  id: string;
  projectId: string;
  hashedKey: string;
  status: string;
}

export interface ApiKeyRepository {
  /** Find an active API key record by its SHA-256 hash. */
  findByHash(hash: string): Promise<ApiKeyRow | undefined>;
  /** Create a new API key record. [AC3] */
  create?(row: ApiKeyRow): Promise<void>;
  /** Update the status of an API key. [AC3] */
  updateStatus?(id: string, status: string): Promise<void>;
}

/**
 * In-memory implementation for tests and local development.
 * Seed data via the constructor or `seed()`.
 */
export class InMemoryApiKeyRepository implements ApiKeyRepository {
  private readonly keys: ApiKeyRow[] = [];

  constructor(initial?: ApiKeyRow[]) {
    if (initial) this.keys.push(...initial);
  }

  seed(row: ApiKeyRow): void {
    this.keys.push(row);
  }

  async findByHash(hash: string): Promise<ApiKeyRow | undefined> {
    return this.keys.find((k) => k.hashedKey === hash && k.status === "active");
  }

  async create(row: ApiKeyRow): Promise<void> {
    this.keys.push(row);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const key = this.keys.find((k) => k.id === id);
    if (key) key.status = status;
  }
}

/**
 * Drizzle-backed implementation for production persistence. [AC1][AC2]
 */
export class DrizzleApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: DbClient) {}

  async findByHash(hash: string): Promise<ApiKeyRow | undefined> {
    const rows = await this.db
      .select({
        id: apiKeys.id,
        projectId: apiKeys.projectId,
        hashedKey: apiKeys.hashedKey,
        status: apiKeys.status,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.hashedKey, hash), eq(apiKeys.status, "active")))
      .limit(1);
    return rows[0];
  }

  async create(row: ApiKeyRow): Promise<void> {
    await this.db.insert(apiKeys).values({
      id: row.id,
      projectId: row.projectId,
      name: `key-${row.id.slice(0, 8)}`,
      hashedKey: row.hashedKey,
      status: row.status,
    });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.update(apiKeys).set({ status }).where(eq(apiKeys.id, id));
  }
}

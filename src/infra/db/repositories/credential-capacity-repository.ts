/**
 * Repository for credential capacity policies. [AC2]
 *
 * Stores per-credential daily and monthly request limits.
 */

import { eq } from "drizzle-orm";
import type { DbClient } from "../client.js";
import { credentialCapacities } from "../schema/credential-capacities.js";

export interface CredentialCapacity {
  credentialId: string;
  dailyLimit: number | null;
  monthlyLimit: number | null;
}

export interface CredentialCapacityInput {
  credentialId: string;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
}

export interface CredentialCapacityRepository {
  findByCredentialId(credentialId: string): Promise<CredentialCapacity | undefined>;
  upsert(input: CredentialCapacityInput): Promise<void>;
  delete(credentialId: string): Promise<void>;
}

/**
 * In-memory implementation for tests.
 */
export class InMemoryCredentialCapacityRepository implements CredentialCapacityRepository {
  private readonly capacities = new Map<string, CredentialCapacity>();

  async findByCredentialId(credentialId: string): Promise<CredentialCapacity | undefined> {
    return this.capacities.get(credentialId);
  }

  async upsert(input: CredentialCapacityInput): Promise<void> {
    this.capacities.set(input.credentialId, {
      credentialId: input.credentialId,
      dailyLimit: input.dailyLimit ?? null,
      monthlyLimit: input.monthlyLimit ?? null,
    });
  }

  async delete(credentialId: string): Promise<void> {
    this.capacities.delete(credentialId);
  }
}

/**
 * Drizzle-backed implementation for production persistence. [AC2]
 */
export class DrizzleCredentialCapacityRepository implements CredentialCapacityRepository {
  constructor(private readonly db: DbClient) {}

  async findByCredentialId(credentialId: string): Promise<CredentialCapacity | undefined> {
    const rows = await this.db
      .select({
        credentialId: credentialCapacities.credentialId,
        dailyLimit: credentialCapacities.dailyLimit,
        monthlyLimit: credentialCapacities.monthlyLimit,
      })
      .from(credentialCapacities)
      .where(eq(credentialCapacities.credentialId, credentialId))
      .limit(1);
    return rows[0] ?? undefined;
  }

  async upsert(input: CredentialCapacityInput): Promise<void> {
    const existing = await this.findByCredentialId(input.credentialId);
    if (existing) {
      await this.db
        .update(credentialCapacities)
        .set({
          dailyLimit: input.dailyLimit ?? null,
          monthlyLimit: input.monthlyLimit ?? null,
        })
        .where(eq(credentialCapacities.credentialId, input.credentialId));
    } else {
      await this.db.insert(credentialCapacities).values({
        credentialId: input.credentialId,
        dailyLimit: input.dailyLimit ?? null,
        monthlyLimit: input.monthlyLimit ?? null,
      });
    }
  }

  async delete(credentialId: string): Promise<void> {
    await this.db
      .delete(credentialCapacities)
      .where(eq(credentialCapacities.credentialId, credentialId));
  }
}

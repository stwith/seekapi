/**
 * Repository for credential capacity policies. [AC2]
 *
 * Stores per-credential daily and monthly request limits.
 */

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

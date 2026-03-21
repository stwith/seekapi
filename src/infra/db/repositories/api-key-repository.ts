/**
 * Repository interface for downstream API key lookups. [AC1][AC2]
 *
 * The hot path resolves an API key hash to the owning project.
 * Implementations may be backed by PostgreSQL (production) or
 * an in-memory store (tests).
 */

export interface ApiKeyRow {
  id: string;
  projectId: string;
  hashedKey: string;
  status: string;
}

export interface ApiKeyRepository {
  /** Find an active API key record by its SHA-256 hash. */
  findByHash(hash: string): Promise<ApiKeyRow | undefined>;
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
}

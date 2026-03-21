/**
 * Repository interface for upstream provider credential lookups. [AC1][AC2]
 *
 * Returns the encrypted secret for a project + provider pair.
 * Decryption is the caller's responsibility — the repository
 * never handles plaintext secrets.
 */

import { eq, and } from "drizzle-orm";
import type { DbClient } from "../client.js";
import { providerCredentials } from "../schema/provider-credentials.js";

export interface CredentialRow {
  id: string;
  projectId: string;
  provider: string;
  encryptedSecret: string;
  status: string;
}

export interface CredentialRepository {
  /** Find the active credential for a project + provider pair. */
  findByProjectAndProvider(
    projectId: string,
    provider: string,
  ): Promise<CredentialRow | undefined>;
}

/**
 * In-memory implementation for tests and local development.
 */
export class InMemoryCredentialRepository implements CredentialRepository {
  private readonly credentials: CredentialRow[] = [];

  seed(row: CredentialRow): void {
    this.credentials.push(row);
  }

  async findByProjectAndProvider(
    projectId: string,
    provider: string,
  ): Promise<CredentialRow | undefined> {
    return this.credentials.find(
      (c) =>
        c.projectId === projectId &&
        c.provider === provider &&
        c.status === "active",
    );
  }
}

/**
 * Drizzle-backed implementation for production persistence. [AC1][AC2]
 */
export class DrizzleCredentialRepository implements CredentialRepository {
  constructor(private readonly db: DbClient) {}

  async findByProjectAndProvider(
    projectId: string,
    provider: string,
  ): Promise<CredentialRow | undefined> {
    const rows = await this.db
      .select({
        id: providerCredentials.id,
        projectId: providerCredentials.projectId,
        provider: providerCredentials.provider,
        encryptedSecret: providerCredentials.encryptedSecret,
        status: providerCredentials.status,
      })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.projectId, projectId),
          eq(providerCredentials.provider, provider),
          eq(providerCredentials.status, "active"),
        ),
      )
      .limit(1);
    return rows[0];
  }
}

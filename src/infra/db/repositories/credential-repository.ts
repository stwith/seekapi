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

export interface CredentialMeta {
  id: string;
  projectId: string;
  provider: string;
  status: string;
}

export interface CredentialRepository {
  /** Find the active credential for a project + provider pair. */
  findByProjectAndProvider(
    projectId: string,
    provider: string,
  ): Promise<CredentialRow | undefined>;
  /** Find credential metadata for a project (no raw secret). [Phase 3 AC4] */
  findMetaByProject?(projectId: string): Promise<CredentialMeta | undefined>;
  /** Upsert (attach or rotate) a credential for a project + provider. [AC3] */
  upsert?(row: CredentialRow): Promise<void>;
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

  async findMetaByProject(projectId: string): Promise<CredentialMeta | undefined> {
    const cred = this.credentials.find(
      (c) => c.projectId === projectId && c.status === "active",
    );
    if (!cred) return undefined;
    return { id: cred.id, projectId: cred.projectId, provider: cred.provider, status: cred.status };
  }

  async upsert(row: CredentialRow): Promise<void> {
    // Revoke existing active credential for same project+provider
    const idx = this.credentials.findIndex(
      (c) =>
        c.projectId === row.projectId &&
        c.provider === row.provider &&
        c.status === "active",
    );
    if (idx >= 0) {
      this.credentials[idx]!.status = "rotated";
    }
    this.credentials.push(row);
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

  async findMetaByProject(projectId: string): Promise<CredentialMeta | undefined> {
    const rows = await this.db
      .select({
        id: providerCredentials.id,
        projectId: providerCredentials.projectId,
        provider: providerCredentials.provider,
        status: providerCredentials.status,
      })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.projectId, projectId),
          eq(providerCredentials.status, "active"),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async upsert(row: CredentialRow): Promise<void> {
    // Revoke existing active credential for same project+provider
    await this.db
      .update(providerCredentials)
      .set({ status: "rotated" })
      .where(
        and(
          eq(providerCredentials.projectId, row.projectId),
          eq(providerCredentials.provider, row.provider),
          eq(providerCredentials.status, "active"),
        ),
      );
    // Insert new credential
    await this.db.insert(providerCredentials).values({
      id: row.id,
      projectId: row.projectId,
      provider: row.provider,
      encryptedSecret: row.encryptedSecret,
      status: row.status,
    });
  }
}

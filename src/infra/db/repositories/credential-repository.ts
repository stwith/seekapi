/**
 * Repository interface for upstream provider credential lookups. [AC1][AC2]
 *
 * Returns the encrypted secret for a project + provider pair.
 * Decryption is the caller's responsibility — the repository
 * never handles plaintext secrets.
 */

import { eq, and, isNull } from "drizzle-orm";
import type { DbClient } from "../client.js";
import { providerCredentials } from "../schema/provider-credentials.js";
import { projectCredentialRefs } from "../schema/project-credential-refs.js";

export interface CredentialRow {
  id: string;
  projectId: string | null;
  name: string;
  provider: string;
  encryptedSecret: string;
  status: string;
}

export interface CredentialMeta {
  id: string;
  projectId: string | null;
  name: string;
  provider: string;
  status: string;
}

export interface ProjectCredentialRef {
  id: string;
  projectId: string;
  credentialId: string;
}

export interface CredentialRepository {
  /** Find the active credential for a project + provider pair. */
  findByProjectAndProvider(
    projectId: string,
    provider: string,
  ): Promise<CredentialRow | undefined>;
  /** Find all active credential metadata for a project (no raw secret). [Phase 3 AC4][Phase 4D AC6] */
  findMetaByProject?(projectId: string): Promise<CredentialMeta[]>;
  /** Upsert (attach or rotate) a credential for a project + provider. [AC3] */
  upsert?(row: CredentialRow): Promise<void>;

  /** Create a global (projectId=null) credential. */
  createGlobal?(row: CredentialRow): Promise<void>;
  /** Find all active global credentials. */
  findAllGlobal?(): Promise<CredentialMeta[]>;
  /** Find a credential by its ID. */
  findById?(id: string): Promise<CredentialRow | undefined>;
  /** Update a global credential. */
  updateGlobal?(id: string, updates: { name?: string; encryptedSecret?: string; status?: string }): Promise<void>;
  /** Soft-delete a global credential (set status='deleted'). */
  deleteGlobal?(id: string): Promise<void>;
  /** Add a project→credential reference. */
  addProjectRef?(ref: ProjectCredentialRef): Promise<void>;
  /** Remove a project→credential reference. */
  removeProjectRef?(projectId: string, credentialId: string): Promise<void>;
  /** Find all credentials referenced by a project. */
  findRefsByProject?(projectId: string): Promise<CredentialMeta[]>;
}

/**
 * In-memory implementation for tests and local development.
 */
export class InMemoryCredentialRepository implements CredentialRepository {
  private readonly credentials: CredentialRow[] = [];
  private readonly refs: ProjectCredentialRef[] = [];

  seed(row: CredentialRow): void {
    this.credentials.push(row);
  }

  async findByProjectAndProvider(
    projectId: string,
    provider: string,
  ): Promise<CredentialRow | undefined> {
    // 1. Direct match (legacy: projectId on the credential itself)
    const direct = this.credentials.find(
      (c) =>
        c.projectId === projectId &&
        c.provider === provider &&
        c.status === "active",
    );
    if (direct) return direct;

    // 2. Check refs: find credential IDs referenced by this project
    const refCredIds = this.refs
      .filter((r) => r.projectId === projectId)
      .map((r) => r.credentialId);
    return this.credentials.find(
      (c) =>
        refCredIds.includes(c.id) &&
        c.provider === provider &&
        c.status === "active",
    );
  }

  async findMetaByProject(projectId: string): Promise<CredentialMeta[]> {
    // Direct credentials
    const direct = this.credentials
      .filter((c) => c.projectId === projectId && c.status === "active")
      .map((c) => ({ id: c.id, projectId: c.projectId, name: c.name, provider: c.provider, status: c.status }));

    // Referenced credentials
    const refCredIds = this.refs
      .filter((r) => r.projectId === projectId)
      .map((r) => r.credentialId);
    const referenced = this.credentials
      .filter((c) => refCredIds.includes(c.id) && c.status === "active")
      .map((c) => ({ id: c.id, projectId: c.projectId, name: c.name, provider: c.provider, status: c.status }));

    // Merge, dedup by id
    const seen = new Set<string>();
    const result: CredentialMeta[] = [];
    for (const m of [...direct, ...referenced]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        result.push(m);
      }
    }
    return result;
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

  async createGlobal(row: CredentialRow): Promise<void> {
    this.credentials.push(row);
  }

  async findAllGlobal(): Promise<CredentialMeta[]> {
    return this.credentials
      .filter((c) => c.projectId === null && c.status === "active")
      .map((c) => ({ id: c.id, projectId: c.projectId, name: c.name, provider: c.provider, status: c.status }));
  }

  async findById(id: string): Promise<CredentialRow | undefined> {
    return this.credentials.find((c) => c.id === id);
  }

  async updateGlobal(id: string, updates: { name?: string; encryptedSecret?: string; status?: string }): Promise<void> {
    const cred = this.credentials.find((c) => c.id === id);
    if (cred) {
      if (updates.name !== undefined) cred.name = updates.name;
      if (updates.encryptedSecret !== undefined) cred.encryptedSecret = updates.encryptedSecret;
      if (updates.status !== undefined) cred.status = updates.status;
    }
  }

  async deleteGlobal(id: string): Promise<void> {
    const cred = this.credentials.find((c) => c.id === id);
    if (cred) {
      cred.status = "deleted";
    }
  }

  async addProjectRef(ref: ProjectCredentialRef): Promise<void> {
    this.refs.push(ref);
  }

  async removeProjectRef(projectId: string, credentialId: string): Promise<void> {
    const idx = this.refs.findIndex(
      (r) => r.projectId === projectId && r.credentialId === credentialId,
    );
    if (idx >= 0) {
      this.refs.splice(idx, 1);
    }
  }

  async findRefsByProject(projectId: string): Promise<CredentialMeta[]> {
    const refCredIds = this.refs
      .filter((r) => r.projectId === projectId)
      .map((r) => r.credentialId);
    return this.credentials
      .filter((c) => refCredIds.includes(c.id) && c.status === "active")
      .map((c) => ({ id: c.id, projectId: c.projectId, name: c.name, provider: c.provider, status: c.status }));
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
    // 1. Direct match (legacy)
    const directRows = await this.db
      .select({
        id: providerCredentials.id,
        projectId: providerCredentials.projectId,
        name: providerCredentials.name,
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
    if (directRows[0]) return directRows[0];

    // 2. Fallback: check project credential refs
    const refRows = await this.db
      .select({
        id: providerCredentials.id,
        projectId: providerCredentials.projectId,
        name: providerCredentials.name,
        provider: providerCredentials.provider,
        encryptedSecret: providerCredentials.encryptedSecret,
        status: providerCredentials.status,
      })
      .from(projectCredentialRefs)
      .innerJoin(providerCredentials, eq(projectCredentialRefs.credentialId, providerCredentials.id))
      .where(
        and(
          eq(projectCredentialRefs.projectId, projectId),
          eq(providerCredentials.provider, provider),
          eq(providerCredentials.status, "active"),
        ),
      )
      .limit(1);
    return refRows[0];
  }

  async findMetaByProject(projectId: string): Promise<CredentialMeta[]> {
    // Direct credentials
    const direct = await this.db
      .select({
        id: providerCredentials.id,
        projectId: providerCredentials.projectId,
        name: providerCredentials.name,
        provider: providerCredentials.provider,
        status: providerCredentials.status,
      })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.projectId, projectId),
          eq(providerCredentials.status, "active"),
        ),
      );

    // Referenced credentials
    const referenced = await this.db
      .select({
        id: providerCredentials.id,
        projectId: providerCredentials.projectId,
        name: providerCredentials.name,
        provider: providerCredentials.provider,
        status: providerCredentials.status,
      })
      .from(projectCredentialRefs)
      .innerJoin(providerCredentials, eq(projectCredentialRefs.credentialId, providerCredentials.id))
      .where(
        and(
          eq(projectCredentialRefs.projectId, projectId),
          eq(providerCredentials.status, "active"),
        ),
      );

    // Merge, dedup by id
    const seen = new Set<string>();
    const result: CredentialMeta[] = [];
    for (const m of [...direct, ...referenced]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        result.push(m);
      }
    }
    return result;
  }

  async upsert(row: CredentialRow): Promise<void> {
    // Revoke existing active credential for same project+provider
    if (row.projectId) {
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
    }
    // Insert new credential
    await this.db.insert(providerCredentials).values({
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      provider: row.provider,
      encryptedSecret: row.encryptedSecret,
      status: row.status,
    });
  }

  async createGlobal(row: CredentialRow): Promise<void> {
    await this.db.insert(providerCredentials).values({
      id: row.id,
      projectId: null,
      name: row.name,
      provider: row.provider,
      encryptedSecret: row.encryptedSecret,
      status: row.status,
    });
  }

  async findAllGlobal(): Promise<CredentialMeta[]> {
    return this.db
      .select({
        id: providerCredentials.id,
        projectId: providerCredentials.projectId,
        name: providerCredentials.name,
        provider: providerCredentials.provider,
        status: providerCredentials.status,
      })
      .from(providerCredentials)
      .where(
        and(
          isNull(providerCredentials.projectId),
          eq(providerCredentials.status, "active"),
        ),
      );
  }

  async findById(id: string): Promise<CredentialRow | undefined> {
    const rows = await this.db
      .select({
        id: providerCredentials.id,
        projectId: providerCredentials.projectId,
        name: providerCredentials.name,
        provider: providerCredentials.provider,
        encryptedSecret: providerCredentials.encryptedSecret,
        status: providerCredentials.status,
      })
      .from(providerCredentials)
      .where(eq(providerCredentials.id, id))
      .limit(1);
    return rows[0];
  }

  async updateGlobal(id: string, updates: { name?: string; encryptedSecret?: string; status?: string }): Promise<void> {
    const setObj: Record<string, string> = {};
    if (updates.name !== undefined) setObj.name = updates.name;
    if (updates.encryptedSecret !== undefined) setObj.encrypted_secret = updates.encryptedSecret;
    if (updates.status !== undefined) setObj.status = updates.status;

    if (Object.keys(setObj).length > 0) {
      await this.db
        .update(providerCredentials)
        .set(updates)
        .where(eq(providerCredentials.id, id));
    }
  }

  async deleteGlobal(id: string): Promise<void> {
    await this.db
      .update(providerCredentials)
      .set({ status: "deleted" })
      .where(eq(providerCredentials.id, id));
  }

  async addProjectRef(ref: ProjectCredentialRef): Promise<void> {
    await this.db.insert(projectCredentialRefs).values({
      id: ref.id,
      projectId: ref.projectId,
      credentialId: ref.credentialId,
    });
  }

  async removeProjectRef(projectId: string, credentialId: string): Promise<void> {
    await this.db
      .delete(projectCredentialRefs)
      .where(
        and(
          eq(projectCredentialRefs.projectId, projectId),
          eq(projectCredentialRefs.credentialId, credentialId),
        ),
      );
  }

  async findRefsByProject(projectId: string): Promise<CredentialMeta[]> {
    return this.db
      .select({
        id: providerCredentials.id,
        projectId: providerCredentials.projectId,
        name: providerCredentials.name,
        provider: providerCredentials.provider,
        status: providerCredentials.status,
      })
      .from(projectCredentialRefs)
      .innerJoin(providerCredentials, eq(projectCredentialRefs.credentialId, providerCredentials.id))
      .where(
        and(
          eq(projectCredentialRefs.projectId, projectId),
          eq(providerCredentials.status, "active"),
        ),
      );
  }
}

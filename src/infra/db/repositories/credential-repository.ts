/**
 * Repository interface for upstream provider credential lookups. [AC1][AC2]
 *
 * Returns the encrypted secret for a project + provider pair.
 * Decryption is the caller's responsibility — the repository
 * never handles plaintext secrets.
 */

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

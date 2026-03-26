import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";
import type { CredentialRepository } from "../../../infra/db/repositories/credential-repository.js";
import type { CredentialCapacityRepository } from "../../../infra/db/repositories/credential-capacity-repository.js";
import type { UsageEventRepository } from "../../../infra/db/repositories/usage-event-repository.js";

/**
 * Encrypt a plaintext secret for storage. [AC2]
 * Uses AES-256-GCM. The output format is: iv:authTag:ciphertext (hex-encoded).
 * The encryption key must be 32 bytes (64 hex chars).
 */
export function encryptSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a stored secret. [AC2]
 * Expects the format produced by encryptSecret(): iv:authTag:ciphertext.
 */
export function decryptSecret(stored: string, keyHex: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted secret format");
  }
  const key = Buffer.from(keyHex, "hex");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export interface CredentialServiceDeps {
  credentialRepository: CredentialRepository;
  encryptionKey: string;
  /** Optional: required for resolveWithCapacity. [AC5] */
  capacityRepository?: CredentialCapacityRepository;
  /** Optional: required for resolveWithCapacity. [AC5] */
  usageEventRepository?: UsageEventRepository;
}

export interface ResolvedCredential {
  credentialId: string;
  secret: string;
}

export class CredentialService {
  private readonly deps: CredentialServiceDeps;

  constructor(deps: CredentialServiceDeps) {
    this.deps = deps;
  }

  /**
   * Resolve the decrypted provider credential for a project. [AC1][AC2][AC3]
   * Fetches the encrypted secret from the repository, decrypts it
   * using the configured encryption key, and returns the credential ID
   * alongside the plaintext secret. Never logs the raw secret.
   */
  async resolve(projectId: string, provider: string): Promise<ResolvedCredential> {
    const row = await this.deps.credentialRepository.findByProjectAndProvider(
      projectId,
      provider,
    );
    if (!row) {
      throw new Error(
        `No credential found for project "${projectId}" / provider "${provider}"`,
      );
    }
    return {
      credentialId: row.id,
      secret: decryptSecret(row.encryptedSecret, this.deps.encryptionKey),
    };
  }

  /**
   * Resolve a credential with capacity awareness. [AC5]
   * Finds all credentials for a project+provider, checks each against
   * its capacity limits, and returns the first non-exhausted one.
   * Falls back to resolve() if capacity deps are not configured.
   */
  async resolveWithCapacity(
    projectId: string,
    provider: string,
  ): Promise<ResolvedCredential> {
    const { credentialRepository, capacityRepository, usageEventRepository } = this.deps;

    // Fall back to simple resolve if capacity deps not available
    if (!capacityRepository || !usageEventRepository || !credentialRepository.findAllByProjectAndProvider) {
      return this.resolve(projectId, provider);
    }

    const candidates = await credentialRepository.findAllByProjectAndProvider(projectId, provider);
    if (candidates.length === 0) {
      throw new Error(
        `No credential found for project "${projectId}" / provider "${provider}"`,
      );
    }

    for (const cred of candidates) {
      const capacity = await capacityRepository.findByCredentialId(cred.id);

      // No capacity limit set — credential is usable
      if (!capacity) {
        return {
          credentialId: cred.id,
          secret: decryptSecret(cred.encryptedSecret, this.deps.encryptionKey),
        };
      }

      // Check daily limit
      if (capacity.dailyLimit !== null && usageEventRepository.countByCredential) {
        const dailyUsage = await usageEventRepository.countByCredential(cred.id, "day");
        if (dailyUsage >= capacity.dailyLimit) continue;
      }

      // Check monthly limit
      if (capacity.monthlyLimit !== null && usageEventRepository.countByCredential) {
        const monthlyUsage = await usageEventRepository.countByCredential(cred.id, "month");
        if (monthlyUsage >= capacity.monthlyLimit) continue;
      }

      return {
        credentialId: cred.id,
        secret: decryptSecret(cred.encryptedSecret, this.deps.encryptionKey),
      };
    }

    throw new Error(
      `All credentials for project "${projectId}" / provider "${provider}" are exhausted`,
    );
  }
}

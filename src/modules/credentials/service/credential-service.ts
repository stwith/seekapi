import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";
import type { CredentialRepository } from "../../../infra/db/repositories/credential-repository.js";

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
}

export class CredentialService {
  private readonly deps: CredentialServiceDeps;

  constructor(deps: CredentialServiceDeps) {
    this.deps = deps;
  }

  /**
   * Resolve the decrypted provider credential for a project. [AC1][AC2]
   * Fetches the encrypted secret from the repository, decrypts it
   * using the configured encryption key, and returns the plaintext.
   * Never logs the raw secret.
   */
  async resolve(projectId: string, provider: string): Promise<string> {
    const row = await this.deps.credentialRepository.findByProjectAndProvider(
      projectId,
      provider,
    );
    if (!row) {
      throw new Error(
        `No credential found for project "${projectId}" / provider "${provider}"`,
      );
    }
    return decryptSecret(row.encryptedSecret, this.deps.encryptionKey);
  }
}

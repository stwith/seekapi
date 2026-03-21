/**
 * In-memory credential store for BYOK provider keys.
 * Credentials are loaded from environment variables — never hardcoded.
 * Replaced by DB-backed repository when persistence is wired. [AC4]
 */

interface StoredCredential {
  projectId: string;
  provider: string;
  envVar: string;
}

/**
 * Credential bindings map project+provider to an environment variable name.
 * The actual secret is read from the environment at resolve time.
 */
const CREDENTIAL_BINDINGS: StoredCredential[] = [
  {
    projectId: "proj_demo_001",
    provider: "brave",
    envVar: "BRAVE_API_KEY",
  },
];

export class CredentialService {
  async resolve(projectId: string, provider: string): Promise<string> {
    const binding = CREDENTIAL_BINDINGS.find(
      (c) => c.projectId === projectId && c.provider === provider,
    );
    if (!binding) {
      throw new Error(
        `No credential found for project "${projectId}" / provider "${provider}"`,
      );
    }
    const secret = process.env[binding.envVar];
    if (!secret) {
      throw new Error(
        `Environment variable "${binding.envVar}" is not set for project "${projectId}" / provider "${provider}"`,
      );
    }
    return secret;
  }
}

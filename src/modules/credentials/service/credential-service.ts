/**
 * In-memory credential store for BYOK provider keys.
 * Replaced by DB-backed repository when persistence is wired. [AC4]
 */

interface StoredCredential {
  projectId: string;
  provider: string;
  secret: string;
}

/** Well-known test credential — seeded for development and testing. */
const CREDENTIALS: StoredCredential[] = [
  {
    projectId: "proj_demo_001",
    provider: "brave",
    secret: "BSA_demo_brave_key_001",
  },
];

export class CredentialService {
  async resolve(projectId: string, provider: string): Promise<string> {
    const cred = CREDENTIALS.find(
      (c) => c.projectId === projectId && c.provider === provider,
    );
    if (!cred) {
      throw new Error(
        `No credential found for project "${projectId}" / provider "${provider}"`,
      );
    }
    return cred.secret;
  }
}

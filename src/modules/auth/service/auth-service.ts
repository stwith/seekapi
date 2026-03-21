import { createHash } from "node:crypto";
import type { ProjectContext } from "../../projects/service/project-service.js";
import { ProjectService } from "../../projects/service/project-service.js";

/**
 * API key record stored in the auth layer.
 * Full persistence comes in Task 5; this task uses an in-memory store.
 */
interface ApiKeyRecord {
  id: string;
  keyHash: string;
  projectId: string;
}

/** SHA-256 hash a raw API key for comparison. */
function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Well-known test key — seeded for development and testing. */
const TEST_KEY = "sk_test_seekapi_demo_key_001";

/** In-memory key store — replaced by DB repository in Task 5. */
const KEYS: ApiKeyRecord[] = [
  { id: "key_demo_001", keyHash: hashKey(TEST_KEY), projectId: "proj_demo_001" },
];

export class AuthService {
  private readonly projectService: ProjectService;

  constructor(projectService?: ProjectService) {
    this.projectService = projectService ?? new ProjectService();
  }

  /**
   * Authenticate a raw API key.
   * Returns the resolved project context or undefined if invalid.
   */
  authenticate(rawKey: string): ProjectContext | undefined {
    const hash = hashKey(rawKey);
    const record = KEYS.find((k) => k.keyHash === hash);
    if (!record) return undefined;
    return this.projectService.resolve(record.projectId, record.id);
  }
}

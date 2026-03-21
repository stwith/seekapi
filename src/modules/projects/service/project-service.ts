/**
 * Project context resolved from a valid API key.
 * Full persistence comes in Task 5; this task uses an in-memory store.
 */
export interface ProjectContext {
  projectId: string;
  projectName: string;
  defaultProvider: string;
  allowedProviders: string[];
  apiKeyId: string;
}

/** In-memory project store — replaced by DB repository in Task 5. */
const PROJECTS: Map<string, Omit<ProjectContext, "apiKeyId">> = new Map([
  [
    "proj_demo_001",
    {
      projectId: "proj_demo_001",
      projectName: "Demo Project",
      defaultProvider: "brave",
      allowedProviders: ["brave"],
    },
  ],
]);

export class ProjectService {
  resolve(projectId: string, apiKeyId?: string): ProjectContext | undefined {
    const project = PROJECTS.get(projectId);
    if (!project) return undefined;
    return { ...project, apiKeyId: apiKeyId ?? "unknown" };
  }
}

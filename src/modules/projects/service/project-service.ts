/**
 * Project context resolved from a valid API key.
 * Full persistence comes in Task 5; this task uses an in-memory store.
 */
export interface ProjectContext {
  projectId: string;
  projectName: string;
  defaultProvider: string;
  allowedProviders: string[];
}

/** In-memory project store — replaced by DB repository in Task 5. */
const PROJECTS: Map<string, ProjectContext> = new Map([
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
  resolve(projectId: string): ProjectContext | undefined {
    return PROJECTS.get(projectId);
  }
}

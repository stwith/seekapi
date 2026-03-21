/**
 * Factory: derive a RoutingConfig from persisted project context. [AC2]
 *
 * This bridges the gap between repository-backed project state and the
 * RoutingService's config interface, ensuring default provider, fallback
 * order, and allowed providers all come from persisted policy.
 */

import type { ProjectContext } from "../../projects/service/project-service.js";
import type { RoutingConfig } from "./routing-service.js";

/**
 * Build a RoutingConfig from a resolved ProjectContext.
 * The config is capability-agnostic — the same default / fallback / allowed
 * set applies to all capabilities within the project.
 */
export function createRoutingConfig(ctx: ProjectContext): RoutingConfig {
  return {
    defaultProvider: () => ctx.defaultProvider,
    fallbackOrder: () => ctx.fallbackProviders,
    allowedProviders: () => ctx.allowedProviders,
  };
}

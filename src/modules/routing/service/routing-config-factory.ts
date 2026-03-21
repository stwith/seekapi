/**
 * Factory: derive a RoutingConfig from persisted project context. [AC2]
 *
 * This bridges the gap between repository-backed project state and the
 * RoutingService's config interface, ensuring default provider, fallback
 * order, and allowed providers all come from persisted policy.
 *
 * All three config dimensions are capability-scoped: only bindings whose
 * `capability` field matches the requested capability are considered.
 */

import type { ProjectContext } from "../../projects/service/project-service.js";
import type { RoutingConfig } from "./routing-service.js";
import type { Capability } from "../../../providers/core/types.js";

/**
 * Build a RoutingConfig from a resolved ProjectContext.
 * Each method filters bindings by the requested capability so that
 * provider enablement, default provider, and fallback order are all
 * scoped to the capability being executed.
 */
export function createRoutingConfig(ctx: ProjectContext): RoutingConfig {
  return {
    defaultProvider: (capability: Capability) => {
      // The default provider is valid only if it has an enabled binding
      // for this specific capability.
      const hasBinding = ctx.bindings.some(
        (b) =>
          b.provider === ctx.defaultProvider &&
          b.capability === capability &&
          b.enabled,
      );
      return hasBinding ? ctx.defaultProvider : undefined;
    },

    fallbackOrder: (capability: Capability) => {
      return ctx.bindings
        .filter(
          (b) =>
            b.enabled &&
            b.capability === capability &&
            b.provider !== ctx.defaultProvider,
        )
        .sort((a, b) => a.priority - b.priority)
        .map((b) => b.provider)
        .filter((v, i, a) => a.indexOf(v) === i);
    },

    allowedProviders: () => {
      // All enabled providers across all capabilities (used by the
      // explicit-provider check which is not capability-scoped).
      return ctx.bindings
        .filter((b) => b.enabled)
        .map((b) => b.provider)
        .filter((v, i, a) => a.indexOf(v) === i);
    },
  };
}

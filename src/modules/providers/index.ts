/**
 * Providers module — adapter registry, credential loading, health checks.
 * Registry implementation is in src/providers/core/registry.ts.
 * Module wiring comes in Task 6+.
 */

export function createProvidersModule() {
  return {
    name: "providers" as const,
  };
}

import type { Capability, ProviderAdapter } from "./types.js";

/**
 * Provider registry — manages adapter registration and lookup.
 * The routing module uses this to resolve providers by id or capability.
 */
export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Provider "${adapter.id}" is already registered`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  getOrThrow(id: string): ProviderAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Provider "${id}" is not registered`);
    }
    return adapter;
  }

  list(): ProviderAdapter[] {
    return [...this.adapters.values()];
  }

  listIds(): string[] {
    return [...this.adapters.keys()];
  }

  /** Return all registered providers that support the given capability. */
  byCapability(capability: Capability): ProviderAdapter[] {
    return this.list().filter((a) =>
      a.supportedCapabilities().includes(capability),
    );
  }
}

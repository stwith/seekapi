import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../../src/providers/core/registry.js";
import { BraveAdapter } from "../../src/providers/brave/adapter.js";

// AC2: service and adapter boundaries
describe("ProviderRegistry", () => {
  it("registers and retrieves a provider", () => {
    const registry = new ProviderRegistry();
    const adapter = new BraveAdapter();
    registry.register(adapter);

    expect(registry.get("brave")).toBe(adapter);
    expect(registry.getOrThrow("brave")).toBe(adapter);
  });

  it("throws on duplicate registration", () => {
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());

    expect(() => registry.register(new BraveAdapter())).toThrow(
      'Provider "brave" is already registered',
    );
  });

  it("returns undefined for unknown provider", () => {
    const registry = new ProviderRegistry();
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("throws on getOrThrow for unknown provider", () => {
    const registry = new ProviderRegistry();
    expect(() => registry.getOrThrow("unknown")).toThrow(
      'Provider "unknown" is not registered',
    );
  });

  it("lists all registered providers", () => {
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());

    expect(registry.listIds()).toEqual(["brave"]);
    expect(registry.list()).toHaveLength(1);
  });

  it("queries providers by capability", () => {
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());

    expect(registry.byCapability("search.web")).toHaveLength(1);
    expect(registry.byCapability("search.news")).toHaveLength(1);
    expect(registry.byCapability("search.images")).toHaveLength(1);
    expect(registry.byCapability("search.answer")).toHaveLength(0);
  });
});

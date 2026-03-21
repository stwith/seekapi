/**
 * Routing service — deterministic provider selection with ordered fallback.
 *
 * Decision order:
 * 1. If the request explicitly sets `provider`, use it (if allowed and healthy).
 * 2. Else use the project default provider for that capability.
 * 3. Else use the first healthy provider from the project's fallback order.
 *
 * Fallback triggers only on retryable errors (5xx, timeouts, provider rate limits).
 * Auth errors and invalid requests do not trigger fallback.
 */

import type { Capability } from "../../../providers/core/types.js";
import { classifyError } from "./error-classifier.js";

export interface ProviderHealth {
  isHealthy(providerId: string): boolean;
}

export interface RoutingConfig {
  /** Default provider for each capability. */
  defaultProvider: (capability: Capability) => string | undefined;
  /** Ordered fallback list for a capability (excluding the default). */
  fallbackOrder: (capability: Capability) => string[];
  /** Set of providers allowed for the project. */
  allowedProviders: () => string[];
}

export interface RouteResult {
  providerId: string;
  /** Why this provider was selected. */
  reason: "explicit" | "default" | "fallback";
}

export interface RoutingServiceDeps {
  health: ProviderHealth;
  config: RoutingConfig;
}

export class RoutingService {
  private readonly health: ProviderHealth;
  private readonly config: RoutingConfig;

  constructor(deps: RoutingServiceDeps) {
    this.health = deps.health;
    this.config = deps.config;
  }

  /**
   * Select the provider to use for a request.
   * Throws if no healthy, allowed provider is available.
   */
  selectProvider(
    capability: Capability,
    explicitProvider?: string,
  ): RouteResult {
    const allowed = new Set(this.config.allowedProviders());

    // 1. Explicit provider
    if (explicitProvider) {
      if (!allowed.has(explicitProvider)) {
        throw new RoutingError(
          `Provider "${explicitProvider}" is not allowed for this project`,
          "PROVIDER_NOT_ALLOWED",
        );
      }
      if (!this.health.isHealthy(explicitProvider)) {
        throw new RoutingError(
          `Provider "${explicitProvider}" is not healthy`,
          "PROVIDER_UNHEALTHY",
        );
      }
      return { providerId: explicitProvider, reason: "explicit" };
    }

    // 2. Default provider
    const defaultId = this.config.defaultProvider(capability);
    if (defaultId && allowed.has(defaultId) && this.health.isHealthy(defaultId)) {
      return { providerId: defaultId, reason: "default" };
    }

    // 3. Fallback order
    const fallbacks = this.config.fallbackOrder(capability);
    for (const id of fallbacks) {
      if (allowed.has(id) && this.health.isHealthy(id)) {
        return { providerId: id, reason: "fallback" };
      }
    }

    throw new RoutingError(
      `No healthy provider available for capability "${capability}"`,
      "NO_HEALTHY_PROVIDER",
    );
  }

  /**
   * Execute a request with fallback on retryable errors.
   *
   * When an explicit provider is requested, it is used without fallback —
   * any error (retryable or not) is propagated immediately. Fallback only
   * applies to the default → fallback chain when no explicit provider is set.
   */
  async executeWithFallback<T>(
    capability: Capability,
    explicitProvider: string | undefined,
    executeFn: (providerId: string) => Promise<T>,
  ): Promise<T> {
    // Explicit provider: fail fast, no fallback
    if (explicitProvider) {
      const route = this.selectProvider(capability, explicitProvider);
      return executeFn(route.providerId);
    }

    // Default + fallback chain
    const allowed = new Set(this.config.allowedProviders());
    const tried = new Set<string>();
    const candidates = this.buildFallbackCandidates(capability, allowed);

    let lastError: unknown;

    for (const candidate of candidates) {
      if (tried.has(candidate.providerId)) continue;
      if (!this.health.isHealthy(candidate.providerId)) continue;
      tried.add(candidate.providerId);

      try {
        return await executeFn(candidate.providerId);
      } catch (err) {
        lastError = err;
        const classified = classifyError(err);

        if (!classified.retryable) {
          throw err; // non-retryable — propagate immediately
        }
        // retryable — try the next candidate
      }
    }

    throw lastError ?? new RoutingError(
      `No healthy provider available for capability "${capability}"`,
      "NO_HEALTHY_PROVIDER",
    );
  }

  /** Build default + fallback candidate list (no explicit provider). */
  private buildFallbackCandidates(
    capability: Capability,
    allowed: Set<string>,
  ): RouteResult[] {
    const candidates: RouteResult[] = [];

    const defaultId = this.config.defaultProvider(capability);
    if (defaultId && allowed.has(defaultId)) {
      candidates.push({ providerId: defaultId, reason: "default" });
    }

    for (const id of this.config.fallbackOrder(capability)) {
      if (allowed.has(id)) {
        candidates.push({ providerId: id, reason: "fallback" });
      }
    }

    return candidates;
  }
}

export class RoutingError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "RoutingError";
    this.code = code;
  }
}

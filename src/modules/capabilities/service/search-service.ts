import type {
  Capability,
  CanonicalSearchRequest,
  CanonicalSearchResponse,
} from "../../../providers/core/types.js";
import type { ProviderRegistry } from "../../../providers/core/registry.js";
import type { SearchRequestBody } from "../http/schemas.js";
import type { ProjectContext } from "../../projects/service/project-service.js";
import type { ProviderHealth } from "../../routing/service/routing-service.js";
import { RoutingService } from "../../routing/service/routing-service.js";
import { createRoutingConfig } from "../../routing/service/routing-config-factory.js";
import type { ResolvedCredential } from "../../credentials/service/credential-service.js";

/** Result of search execution, wrapping the canonical response with credential attribution. [AC4] */
export interface SearchResult {
  response: CanonicalSearchResponse;
  credentialId?: string;
}

export interface SearchServiceDeps {
  registry: ProviderRegistry;
  /** Resolve the decrypted credential for a given project + provider. [AC3] */
  resolveCredential: (projectId: string, provider: string) => Promise<ResolvedCredential>;
  /** Provider health state for routing decisions. */
  health: ProviderHealth;
}

/**
 * Search service — orchestrates search execution through the provider layer.
 * Uses RoutingService for repository-backed provider selection and fallback.
 *
 * When no deps are provided, falls back to a stub response for tests
 * that don't need full provider wiring. [AC4][AC6]
 */
export class SearchService {
  private readonly deps?: SearchServiceDeps;

  constructor(deps?: SearchServiceDeps) {
    this.deps = deps;
  }

  async execute(
    capability: Capability,
    body: SearchRequestBody,
    requestId: string,
    projectContext?: ProjectContext,
  ): Promise<SearchResult> {
    if (!this.deps) {
      return { response: this.stub(capability, requestId) };
    }

    if (!projectContext) {
      throw new Error(
        "projectContext is required when SearchService is wired with provider deps",
      );
    }

    const routingConfig = createRoutingConfig(projectContext);
    const routing = new RoutingService({
      health: this.deps.health,
      config: routingConfig,
    });

    const { registry, resolveCredential } = this.deps;
    let resolvedCredentialId: string | undefined;

    try {
      const response = await routing.executeWithFallback(
        capability,
        body.provider,
        async (providerId) => {
          const adapter = registry.getOrThrow(providerId);
          const resolved = await resolveCredential(
            projectContext.projectId,
            providerId,
          );
          resolvedCredentialId = resolved.credentialId;

          const req: CanonicalSearchRequest = {
            capability,
            query: body.query,
            maxResults: body.max_results,
            country: body.country,
            locale: body.locale,
            includeDomains: body.include_domains,
            excludeDomains: body.exclude_domains,
            timeRange: body.time_range,
            provider: body.provider,
            options: body.options,
          };

          return adapter.execute(req, { credential: resolved.secret, requestId });
        },
      );

      return { response, credentialId: resolvedCredentialId };
    } catch (err) {
      // Attach credentialId to the error so callers can attribute failures [AC4]
      if (resolvedCredentialId && err instanceof Error) {
        (err as Error & { credentialId?: string }).credentialId = resolvedCredentialId;
      }
      throw err;
    }
  }

  private stub(
    capability: Capability,
    requestId: string,
  ): CanonicalSearchResponse {
    return {
      requestId,
      provider: "stub",
      capability,
      latencyMs: 0,
      items: [],
      citations: [],
      extensions: {},
      raw: null,
    };
  }
}

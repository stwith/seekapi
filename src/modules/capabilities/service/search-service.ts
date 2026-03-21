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

export interface SearchServiceDeps {
  registry: ProviderRegistry;
  /** Resolve the decrypted credential for a given project + provider. */
  resolveCredential: (projectId: string, provider: string) => Promise<string>;
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
  ): Promise<CanonicalSearchResponse> {
    if (!this.deps) {
      return this.stub(capability, requestId);
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

    return routing.executeWithFallback(
      capability,
      body.provider,
      async (providerId) => {
        const adapter = registry.getOrThrow(providerId);
        const credential = await resolveCredential(
          projectContext.projectId,
          providerId,
        );

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

        return adapter.execute(req, { credential, requestId });
      },
    );
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

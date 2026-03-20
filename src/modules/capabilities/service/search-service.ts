import type {
  Capability,
  CanonicalSearchRequest,
  CanonicalSearchResponse,
} from "../../../providers/core/types.js";
import type { ProviderRegistry } from "../../../providers/core/registry.js";
import type { SearchRequestBody } from "../http/schemas.js";

export interface SearchServiceDeps {
  registry: ProviderRegistry;
  /** Resolve the decrypted credential for a given project + provider. */
  resolveCredential: (projectId: string, provider: string) => Promise<string>;
}

/**
 * Search service — orchestrates search execution through the provider layer.
 * When no registry is provided, falls back to a stub response for tests
 * that don't need full provider wiring. [AC4]
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
    projectId?: string,
  ): Promise<CanonicalSearchResponse> {
    if (!this.deps) {
      return this.stub(capability, requestId);
    }

    const providerId = body.provider ?? this.defaultProvider(capability);
    const adapter = this.deps.registry.getOrThrow(providerId);

    const credential = projectId
      ? await this.deps.resolveCredential(projectId, providerId)
      : "";

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
  }

  private defaultProvider(_capability: Capability): string {
    return "brave";
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

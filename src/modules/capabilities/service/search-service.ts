import type { Capability, CanonicalSearchResponse } from "../../../providers/core/types.js";
import type { SearchRequestBody } from "../http/schemas.js";

export interface SearchServiceDeps {
  // Provider registry and routing will be injected in later tasks.
}

/**
 * Search service — orchestrates search execution through the provider layer.
 * In Task 3 this returns a stub response. Full provider delegation comes in Task 6+.
 */
export class SearchService {
  execute(
    capability: Capability,
    body: SearchRequestBody,
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

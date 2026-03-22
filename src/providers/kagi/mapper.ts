import type { Capability, CanonicalSearchRequest, SearchItem } from "../core/types.js";
import type { KagiSearchParams, KagiSearchResponse } from "./schemas.js";

/**
 * Maps between canonical request/response and Kagi-specific shapes.
 * All provider-specific mapping is isolated here.
 */

export function toProviderParams(req: CanonicalSearchRequest): KagiSearchParams {
  const params: KagiSearchParams = {
    q: req.query,
  };

  if (req.maxResults !== undefined) {
    params.limit = Math.min(req.maxResults, 50);
  }

  return params;
}

/** Kagi result type filter: t=0 for web, t=1 for news. */
const CAPABILITY_TYPE_FILTER: Record<string, number> = {
  "search.web": 0,
  "search.news": 1,
};

const CAPABILITY_SOURCE_TYPE: Record<string, string> = {
  "search.web": "web",
  "search.news": "news",
};

export function toCanonicalItems(
  capability: Capability,
  response: KagiSearchResponse,
): SearchItem[] {
  const typeFilter = CAPABILITY_TYPE_FILTER[capability];
  const sourceType = CAPABILITY_SOURCE_TYPE[capability] ?? "web";

  return (response.data ?? [])
    .filter((r) => r.t === typeFilter)
    .map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet ?? "",
      publishedAt: r.published ?? null,
      sourceType,
      score: null,
    }));
}

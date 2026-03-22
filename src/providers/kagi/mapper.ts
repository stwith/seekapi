import type { CanonicalSearchRequest, SearchItem } from "../core/types.js";
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

export function toCanonicalItems(
  response: KagiSearchResponse,
): SearchItem[] {
  return (response.data ?? [])
    .filter((r) => r.t === 0)
    .map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet ?? "",
      publishedAt: r.published ?? null,
      sourceType: "web",
      score: null,
    }));
}

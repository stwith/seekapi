import type { CanonicalSearchRequest, SearchItem } from "../core/types.js";
import type { TavilySearchRequest, TavilySearchResponse } from "./schemas.js";

/**
 * Maps between canonical request/response and Tavily-specific shapes.
 * All provider-specific mapping is isolated here.
 */

export function toProviderParams(
  req: CanonicalSearchRequest,
): Omit<TavilySearchRequest, "api_key"> {
  const params: Omit<TavilySearchRequest, "api_key"> = {
    query: req.query,
    search_depth: "basic",
    include_answer: true,
  };

  if (req.maxResults !== undefined) {
    params.max_results = Math.min(req.maxResults, 20);
  }

  if (req.includeDomains && req.includeDomains.length > 0) {
    params.include_domains = req.includeDomains;
  }

  if (req.excludeDomains && req.excludeDomains.length > 0) {
    params.exclude_domains = req.excludeDomains;
  }

  return params;
}

export function toCanonicalItems(
  response: TavilySearchResponse,
): SearchItem[] {
  return (response.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    publishedAt: r.published_date ?? null,
    sourceType: "web",
    score: r.score ?? null,
  }));
}

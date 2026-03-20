import type { Capability, CanonicalSearchRequest, SearchItem } from "../core/types.js";
import type { BraveSearchResponse, BraveWebSearchParams } from "./schemas.js";

/**
 * Maps between canonical request/response and Brave-specific shapes.
 * All provider-specific mapping is isolated here.
 */

const TIME_RANGE_MAP: Record<string, string> = {
  day: "pd",
  week: "pw",
  month: "pm",
  year: "py",
};

export function toProviderParams(
  req: CanonicalSearchRequest,
): BraveWebSearchParams {
  const params: BraveWebSearchParams = {
    q: req.query,
    count: req.maxResults,
    country: req.country,
  };

  if (req.timeRange) {
    params.freshness = TIME_RANGE_MAP[req.timeRange] ?? undefined;
  }

  if (req.capability === "search.news") {
    params.result_filter = "news";
  } else if (req.capability === "search.images") {
    params.result_filter = "images";
  }

  return params;
}

export function toCanonicalItems(
  capability: Capability,
  response: BraveSearchResponse,
): SearchItem[] {
  switch (capability) {
    case "search.web":
      return (response.web?.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
        publishedAt: r.page_age ?? null,
        sourceType: "web",
        score: null,
      }));

    case "search.news":
      return (response.news?.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
        publishedAt: r.age ?? null,
        sourceType: "news",
        score: null,
      }));

    case "search.images":
      return (response.images?.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.source,
        publishedAt: null,
        sourceType: "image",
        score: null,
      }));

    default:
      return [];
  }
}

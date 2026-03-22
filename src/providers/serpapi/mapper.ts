import type { Capability, CanonicalSearchRequest, SearchItem } from "../core/types.js";
import type { SerpApiSearchParams, SerpApiSearchResponse } from "./schemas.js";

/**
 * Maps between canonical request/response and SerpAPI-specific shapes.
 * All provider-specific mapping is isolated here.
 */

/** SerpAPI tbm parameter per capability: undefined for web, "nws" for news, "isch" for images. */
const CAPABILITY_TBM: Record<string, string | undefined> = {
  "search.web": undefined,
  "search.news": "nws",
  "search.images": "isch",
};

export function toProviderParams(req: CanonicalSearchRequest): SerpApiSearchParams {
  const params: SerpApiSearchParams = {
    q: req.query,
    engine: "google",
  };

  if (req.maxResults !== undefined) {
    params.num = Math.min(req.maxResults, 100);
  }

  const tbm = CAPABILITY_TBM[req.capability];
  if (tbm !== undefined) {
    params.tbm = tbm;
  }

  return params;
}

const SOURCE_TYPE: Record<string, string> = {
  "search.web": "web",
  "search.news": "news",
  "search.images": "images",
};

export function toCanonicalItems(
  capability: Capability,
  response: SerpApiSearchResponse,
): SearchItem[] {
  const sourceType = SOURCE_TYPE[capability] ?? "web";

  if (capability === "search.images") {
    return (response.images_results ?? []).map((r) => ({
      title: r.title,
      url: r.original,
      snippet: r.source ?? "",
      publishedAt: null,
      sourceType,
      score: null,
    }));
  }

  if (capability === "search.news") {
    return (response.news_results ?? []).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet ?? "",
      publishedAt: r.date ?? null,
      sourceType,
      score: null,
    }));
  }

  // search.web — organic results
  return (response.organic_results ?? []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet ?? "",
    publishedAt: r.date ?? null,
    sourceType,
    score: null,
  }));
}

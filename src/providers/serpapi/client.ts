import type { SerpApiSearchParams, SerpApiSearchResponse } from "./schemas.js";
import { ProviderError } from "../core/errors.js";

const SERPAPI_BASE = "https://serpapi.com";

/**
 * SerpAPI HTTP client. [AC4]
 * Encapsulates upstream HTTP calls and translates HTTP-level failures to typed ProviderErrors.
 */
export class SerpApiClient {
  async search(
    params: SerpApiSearchParams,
    apiKey: string,
    signal?: AbortSignal,
  ): Promise<SerpApiSearchResponse> {
    const url = new URL(`${SERPAPI_BASE}/search.json`);
    url.searchParams.set("q", params.q);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("engine", params.engine ?? "google");

    if (params.num !== undefined) {
      url.searchParams.set("num", String(params.num));
    }
    if (params.tbm !== undefined) {
      url.searchParams.set("tbm", params.tbm);
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), { method: "GET", signal });
    } catch (err) {
      throw new ProviderError({
        message: `SerpAPI network failure: ${err instanceof Error ? err.message : String(err)}`,
        category: categorizeNetworkError(err),
        provider: "serpapi",
        cause: err,
      });
    }

    if (!res.ok) {
      throw new ProviderError({
        message: `SerpAPI returned ${res.status}`,
        category: categorizeStatus(res.status),
        provider: "serpapi",
        statusCode: res.status,
      });
    }

    const body = (await res.json()) as SerpApiSearchResponse;

    if (body.error) {
      throw new ProviderError({
        message: `SerpAPI error: ${body.error}`,
        category: categorizeErrorMessage(body.error),
        provider: "serpapi",
        statusCode: res.status,
      });
    }

    return body;
  }
}

function categorizeStatus(
  status: number,
): "bad_credential" | "rate_limited" | "upstream_5xx" | "unknown" {
  if (status === 401 || status === 403) return "bad_credential";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_5xx";
  return "unknown";
}

function categorizeErrorMessage(
  msg: string,
): "bad_credential" | "rate_limited" | "invalid_request" | "unknown" {
  const lower = msg.toLowerCase();
  if (lower.includes("invalid api key") || lower.includes("unauthorized")) {
    return "bad_credential";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "rate_limited";
  }
  if (lower.includes("invalid") || lower.includes("missing")) {
    return "invalid_request";
  }
  return "unknown";
}

function categorizeNetworkError(err: unknown): "timeout" | "unknown" {
  if (err instanceof DOMException && err.name === "AbortError") return "timeout";
  if (err instanceof TypeError) return "timeout";
  return "unknown";
}

import type { TavilySearchRequest, TavilySearchResponse } from "./schemas.js";
import { ProviderError } from "../core/errors.js";

const TAVILY_API_BASE = "https://api.tavily.com";

/**
 * Tavily Search HTTP client. [AC4]
 * Encapsulates upstream HTTP calls and translates HTTP-level failures to typed ProviderErrors.
 */
export class TavilyClient {
  async search(
    params: Omit<TavilySearchRequest, "api_key">,
    apiKey: string,
    signal?: AbortSignal,
  ): Promise<TavilySearchResponse> {
    const body: TavilySearchRequest = { ...params, api_key: apiKey };

    let res: Response;
    try {
      res = await fetch(`${TAVILY_API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw new ProviderError({
        message: `Tavily API network failure: ${err instanceof Error ? err.message : String(err)}`,
        category: categorizeNetworkError(err),
        provider: "tavily",
        cause: err,
      });
    }

    if (!res.ok) {
      throw new ProviderError({
        message: `Tavily API returned ${res.status}`,
        category: categorizeStatus(res.status),
        provider: "tavily",
        statusCode: res.status,
      });
    }

    return (await res.json()) as TavilySearchResponse;
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

function categorizeNetworkError(err: unknown): "timeout" | "unknown" {
  if (err instanceof DOMException && err.name === "AbortError") return "timeout";
  if (err instanceof TypeError) return "timeout";
  return "unknown";
}

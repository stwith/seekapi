import type { BraveSearchResponse, BraveWebSearchParams } from "./schemas.js";
import { ProviderError } from "../core/errors.js";

const BRAVE_API_BASE = "https://api.search.brave.com/res/v1";

/**
 * Brave Search HTTP client.
 * Encapsulates upstream HTTP calls and translates HTTP-level failures to typed ProviderErrors.
 * Full implementation comes in Task 6 — this is the structural skeleton.
 */
export class BraveClient {
  async search(
    endpoint: string,
    params: BraveWebSearchParams,
    apiKey: string,
    signal?: AbortSignal,
  ): Promise<BraveSearchResponse> {
    const url = new URL(`${BRAVE_API_BASE}/${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal,
    });

    if (!res.ok) {
      throw new ProviderError({
        message: `Brave API returned ${res.status}`,
        category: categorizeStatus(res.status),
        provider: "brave",
        statusCode: res.status,
      });
    }

    return (await res.json()) as BraveSearchResponse;
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

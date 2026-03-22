import type { KagiSearchParams, KagiSearchResponse } from "./schemas.js";
import { ProviderError } from "../core/errors.js";

const KAGI_API_BASE = "https://kagi.com/api/v0";

/**
 * Kagi Search HTTP client. [AC4]
 * Encapsulates upstream HTTP calls and translates HTTP-level failures to typed ProviderErrors.
 */
export class KagiClient {
  async search(
    params: KagiSearchParams,
    apiToken: string,
    signal?: AbortSignal,
  ): Promise<KagiSearchResponse> {
    const url = new URL(`${KAGI_API_BASE}/search`);
    url.searchParams.set("q", params.q);
    if (params.limit !== undefined) {
      url.searchParams.set("limit", String(params.limit));
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bot ${apiToken}` },
        signal,
      });
    } catch (err) {
      throw new ProviderError({
        message: `Kagi API network failure: ${err instanceof Error ? err.message : String(err)}`,
        category: categorizeNetworkError(err),
        provider: "kagi",
        cause: err,
      });
    }

    if (!res.ok) {
      throw new ProviderError({
        message: `Kagi API returned ${res.status}`,
        category: categorizeStatus(res.status),
        provider: "kagi",
        statusCode: res.status,
      });
    }

    return (await res.json()) as KagiSearchResponse;
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

import type {
  Capability,
  CanonicalSearchRequest,
  CanonicalSearchResponse,
  ProviderAdapter,
  ProviderExecutionContext,
  ProviderHealthContext,
  ProviderHealthStatus,
} from "../core/types.js";
import { SerpApiClient } from "./client.js";
import { toProviderParams, toCanonicalItems } from "./mapper.js";

const SERPAPI_CAPABILITIES: Capability[] = ["search.web", "search.news", "search.images"];

/**
 * SerpAPI provider adapter. [AC4]
 * Maps canonical requests through the SerpAPI HTTP client and normalizes responses.
 */
export class SerpApiAdapter implements ProviderAdapter {
  readonly id = "serpapi";
  private readonly client: SerpApiClient;

  constructor(client?: SerpApiClient) {
    this.client = client ?? new SerpApiClient();
  }

  supportedCapabilities(): Capability[] {
    return SERPAPI_CAPABILITIES;
  }

  async validateCredential(input: unknown): Promise<void> {
    if (typeof input !== "string" || input.length === 0) {
      throw new Error("SerpAPI credential must be a non-empty string");
    }
  }

  async execute(
    req: CanonicalSearchRequest,
    ctx: ProviderExecutionContext,
  ): Promise<CanonicalSearchResponse> {
    if (
      req.capability !== "search.web" &&
      req.capability !== "search.news" &&
      req.capability !== "search.images"
    ) {
      throw new Error(
        `SerpAPI adapter does not support capability: ${req.capability}`,
      );
    }

    const params = toProviderParams(req);
    const start = Date.now();
    const raw = await this.client.search(params, ctx.credential, ctx.signal);
    const latencyMs = Date.now() - start;

    return {
      requestId: ctx.requestId,
      provider: this.id,
      capability: req.capability,
      latencyMs,
      items: toCanonicalItems(req.capability, raw),
      extensions: {},
      raw,
    };
  }

  /** Health check — probes SerpAPI with a lightweight request. */
  async healthCheck(ctx: ProviderHealthContext): Promise<ProviderHealthStatus> {
    if (!ctx.credential) {
      return {
        provider: this.id,
        status: "unavailable",
        checkedAt: new Date(),
      };
    }

    const start = Date.now();
    try {
      const timeout = AbortSignal.timeout(5_000);
      await this.client.search({ q: "health", num: 1 }, ctx.credential, timeout);
      return {
        provider: this.id,
        status: "healthy",
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch {
      return {
        provider: this.id,
        status: "degraded",
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    }
  }
}

import type {
  Capability,
  CanonicalSearchRequest,
  CanonicalSearchResponse,
  ProviderAdapter,
  ProviderExecutionContext,
  ProviderHealthContext,
  ProviderHealthStatus,
} from "../core/types.js";
import { KagiClient } from "./client.js";
import { toProviderParams, toCanonicalItems } from "./mapper.js";

const KAGI_CAPABILITIES: Capability[] = ["search.web"];

/**
 * Kagi Search provider adapter. [AC4]
 * Maps canonical requests through the Kagi HTTP client and normalizes responses.
 */
export class KagiAdapter implements ProviderAdapter {
  readonly id = "kagi";
  private readonly client: KagiClient;

  constructor(client?: KagiClient) {
    this.client = client ?? new KagiClient();
  }

  supportedCapabilities(): Capability[] {
    return KAGI_CAPABILITIES;
  }

  async validateCredential(input: unknown): Promise<void> {
    if (typeof input !== "string" || input.length === 0) {
      throw new Error("Kagi credential must be a non-empty string");
    }
  }

  async execute(
    req: CanonicalSearchRequest,
    ctx: ProviderExecutionContext,
  ): Promise<CanonicalSearchResponse> {
    if (req.capability !== "search.web") {
      throw new Error(
        `Kagi adapter does not support capability: ${req.capability}`,
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
      items: toCanonicalItems(raw),
      extensions: {},
      raw,
    };
  }

  /** Health check — probes Kagi API with a lightweight request. */
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
      await this.client.search({ q: "health", limit: 1 }, ctx.credential, timeout);
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

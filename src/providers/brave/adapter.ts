import type {
  Capability,
  CanonicalSearchRequest,
  CanonicalSearchResponse,
  ProviderAdapter,
  ProviderExecutionContext,
  ProviderHealthContext,
  ProviderHealthStatus,
} from "../core/types.js";
import { BraveClient } from "./client.js";
import { toProviderParams, toCanonicalItems } from "./mapper.js";

const BRAVE_CAPABILITIES: Capability[] = [
  "search.web",
  "search.news",
  "search.images",
];

const CAPABILITY_ENDPOINT: Record<string, string> = {
  "search.web": "web/search",
  "search.news": "web/search",
  "search.images": "images/search",
};

/**
 * Brave Search provider adapter.
 * Structural skeleton — full HTTP integration comes in Task 6.
 */
export class BraveAdapter implements ProviderAdapter {
  readonly id = "brave";
  private readonly client: BraveClient;

  constructor(client?: BraveClient) {
    this.client = client ?? new BraveClient();
  }

  supportedCapabilities(): Capability[] {
    return BRAVE_CAPABILITIES;
  }

  async validateCredential(input: unknown): Promise<void> {
    if (typeof input !== "string" || input.length === 0) {
      throw new Error("Brave credential must be a non-empty string");
    }
  }

  async execute(
    req: CanonicalSearchRequest,
    ctx: ProviderExecutionContext,
  ): Promise<CanonicalSearchResponse> {
    const endpoint = CAPABILITY_ENDPOINT[req.capability];
    if (!endpoint) {
      throw new Error(
        `Brave adapter does not support capability: ${req.capability}`,
      );
    }

    const params = toProviderParams(req);
    const start = Date.now();
    const raw = await this.client.search(
      endpoint,
      params,
      ctx.credential,
      ctx.signal,
    );
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

  /**
   * Health check placeholder — returns healthy until Task 9 wires
   * real health probes. Does NOT call the upstream API to avoid
   * consuming provider quota during skeleton phase.
   */
  async healthCheck(_ctx: ProviderHealthContext): Promise<ProviderHealthStatus> {
    return {
      provider: this.id,
      status: "healthy",
      checkedAt: new Date(),
    };
  }
}

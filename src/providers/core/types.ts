/**
 * Canonical capability types and provider adapter interface.
 * These types define the contract between the gateway core and provider adapters. [AC2]
 */

export type Capability =
  | "search.web"
  | "search.news"
  | "search.images"
  | "search.answer"
  | "search.extract"
  | "search.serp";

/** MVP capabilities — only these are implemented in release 1. */
export const MVP_CAPABILITIES: readonly Capability[] = [
  "search.web",
  "search.news",
  "search.images",
] as const;

export interface SearchItem {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string | null;
  sourceType: string;
  score?: number | null;
}

export interface Citation {
  url: string;
  title?: string;
  snippet?: string;
}

export interface CanonicalSearchRequest {
  capability: Capability;
  query: string;
  maxResults?: number;
  country?: string;
  locale?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  timeRange?: "day" | "week" | "month" | "year";
  provider?: string;
  options?: Record<string, unknown>;
}

export interface CanonicalSearchResponse {
  requestId: string;
  provider: string;
  capability: Capability;
  latencyMs: number;
  items: SearchItem[];
  answer?: string;
  citations?: Citation[];
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface ProviderExecutionContext {
  /** Decrypted upstream credential for the provider. */
  credential: string;
  /** Unique request identifier for tracing. */
  requestId: string;
  /** Abort signal for timeout enforcement. */
  signal?: AbortSignal;
}

export interface ProviderHealthContext {
  credential?: string;
}

export type ProviderHealthStatus = {
  provider: string;
  status: "healthy" | "degraded" | "unavailable";
  latencyMs?: number;
  checkedAt: Date;
};

/**
 * Provider adapter interface — each upstream provider implements this.
 * Adapters own provider-specific HTTP clients and schema mapping.
 * Adapters must not contain project policy logic.
 */
export interface ProviderAdapter {
  readonly id: string;
  supportedCapabilities(): Capability[];
  validateCredential(input: unknown): Promise<void>;
  execute(
    req: CanonicalSearchRequest,
    ctx: ProviderExecutionContext,
  ): Promise<CanonicalSearchResponse>;
  healthCheck(ctx: ProviderHealthContext): Promise<ProviderHealthStatus>;
}

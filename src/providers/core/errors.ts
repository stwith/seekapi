/**
 * Typed provider errors for routing-layer classification.
 * The routing module uses error categories to decide whether fallback is appropriate.
 */

export type ProviderErrorCategory =
  | "bad_credential"
  | "rate_limited"
  | "upstream_5xx"
  | "timeout"
  | "invalid_request"
  | "unknown";

export class ProviderError extends Error {
  readonly category: ProviderErrorCategory;
  readonly provider: string;
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(opts: {
    message: string;
    category: ProviderErrorCategory;
    provider: string;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = "ProviderError";
    this.category = opts.category;
    this.provider = opts.provider;
    this.statusCode = opts.statusCode;
    this.retryable = isRetryable(opts.category);
  }
}

function isRetryable(category: ProviderErrorCategory): boolean {
  switch (category) {
    case "upstream_5xx":
    case "timeout":
    case "rate_limited":
      return true;
    case "bad_credential":
    case "invalid_request":
    case "unknown":
      return false;
  }
}

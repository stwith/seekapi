/**
 * Error classifier — determines whether a provider error is retryable.
 * Retryable errors trigger fallback to the next provider.
 * Non-retryable errors (auth, invalid request) do not.
 */

import { ProviderError } from "../../../providers/core/errors.js";

export type ErrorCategory =
  | "retryable"
  | "auth"
  | "invalid_request"
  | "forbidden"
  | "rate_limit_project"
  | "unknown";

export interface ClassifiedError {
  category: ErrorCategory;
  retryable: boolean;
  original: unknown;
}

/**
 * Classify an error thrown by a provider adapter.
 *
 * If the error is a typed ProviderError (from provider adapters), we honour
 * its `category` and `retryable` fields directly. Otherwise we fall back to
 * heuristic classification via `statusCode` / `code` properties.
 */
export function classifyError(err: unknown): ClassifiedError {
  // Fast path: typed ProviderError from adapter layer
  if (err instanceof ProviderError) {
    return {
      category: mapProviderCategory(err.category),
      retryable: err.retryable,
      original: err,
    };
  }

  // Heuristic path for non-ProviderError exceptions
  const statusCode = getStatusCode(err);
  const code = getErrorCode(err);

  // Auth / credential errors — never retry
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    code === "AUTH_FAILED" ||
    code === "INVALID_CREDENTIAL"
  ) {
    return { category: "auth", retryable: false, original: err };
  }

  // Invalid downstream request — never retry
  if (statusCode === 400 || code === "INVALID_REQUEST") {
    return { category: "invalid_request", retryable: false, original: err };
  }

  // Project-level rate limit — never retry on another provider
  if (code === "PROJECT_RATE_LIMITED") {
    return { category: "rate_limit_project", retryable: false, original: err };
  }

  // Provider rate limit — retryable on a different provider
  if (statusCode === 429 || code === "RATE_LIMITED") {
    return { category: "retryable", retryable: true, original: err };
  }

  // 5xx upstream failures — retryable
  if (statusCode !== undefined && statusCode >= 500) {
    return { category: "retryable", retryable: true, original: err };
  }

  // Timeout / network errors — retryable
  if (code === "TIMEOUT" || code === "ECONNREFUSED" || code === "ENOTFOUND") {
    return { category: "retryable", retryable: true, original: err };
  }

  // Unknown errors default to non-retryable
  return { category: "unknown", retryable: false, original: err };
}

/** Map ProviderError categories to our classifier categories. */
function mapProviderCategory(
  category: import("../../../providers/core/errors.js").ProviderErrorCategory,
): ErrorCategory {
  switch (category) {
    case "bad_credential":
      return "auth";
    case "invalid_request":
      return "invalid_request";
    case "upstream_5xx":
    case "timeout":
    case "rate_limited":
      return "retryable";
    case "unknown":
      return "unknown";
  }
}

function getStatusCode(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "statusCode" in err) {
    const val = (err as Record<string, unknown>).statusCode;
    return typeof val === "number" ? val : undefined;
  }
  return undefined;
}

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const val = (err as Record<string, unknown>).code;
    return typeof val === "string" ? val : undefined;
  }
  return undefined;
}

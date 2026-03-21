/**
 * Telemetry — lightweight metrics counters for request observability.
 *
 * Uses OpenTelemetry Metrics API so counters work with any configured
 * exporter (stdout, OTLP, Prometheus, etc.). When no SDK is configured
 * the API returns no-op instruments, so this is safe in tests.
 */

import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("seekapi");

export const requestCounter = meter.createCounter("seekapi.request.count", {
  description: "Total requests by capability, provider, and status",
});

export const requestLatency = meter.createHistogram(
  "seekapi.request.latency_ms",
  {
    description: "Request latency in milliseconds",
    unit: "ms",
  },
);

export const fallbackCounter = meter.createCounter(
  "seekapi.request.fallback_count",
  {
    description: "Number of requests that triggered provider fallback",
  },
);

export const errorCounter = meter.createCounter("seekapi.request.error_count", {
  description: "Request errors by capability, provider, and error code",
});

export const rateLimitCounter = meter.createCounter(
  "seekapi.ratelimit.rejection_count",
  {
    description: "Rate-limit rejections by project",
  },
);

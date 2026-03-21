/**
 * Usage service — records usage events for request accounting.
 *
 * Accepts a `UsageEventSink` for persistence so callers can inject
 * a real DB writer or an in-memory sink for tests.
 */

import type { Capability } from "../../../providers/core/types.js";
import {
  requestCounter,
  requestLatency,
  fallbackCounter,
  errorCounter,
} from "../../../infra/telemetry/index.js";

export interface UsageEvent {
  requestId: string;
  projectId: string;
  apiKeyId: string;
  provider: string;
  capability: Capability;
  statusCode: number;
  success: boolean;
  latencyMs: number;
  resultCount: number;
  fallbackCount: number;
  estimatedCost?: string;
}

/** Persistence sink — implemented by DB repository or in-memory store. */
export interface UsageEventSink {
  record(event: UsageEvent): Promise<void>;
}

export class UsageService {
  private readonly sink: UsageEventSink;

  constructor(sink: UsageEventSink) {
    this.sink = sink;
  }

  /** Record a successful search request. */
  async recordSuccess(params: {
    requestId: string;
    projectId: string;
    apiKeyId: string;
    provider: string;
    capability: Capability;
    latencyMs: number;
    resultCount: number;
    fallbackCount: number;
  }): Promise<void> {
    const event: UsageEvent = {
      ...params,
      statusCode: 200,
      success: true,
    };

    await this.sink.record(event);

    const attrs = {
      capability: params.capability,
      provider: params.provider,
      status: "success",
    };
    requestCounter.add(1, attrs);
    requestLatency.record(params.latencyMs, attrs);

    if (params.fallbackCount > 0) {
      fallbackCounter.add(1, {
        capability: params.capability,
        provider: params.provider,
      });
    }
  }

  /** Record a failed request. */
  async recordFailure(params: {
    requestId: string;
    projectId: string;
    apiKeyId: string;
    provider: string;
    capability: Capability;
    statusCode: number;
    latencyMs: number;
    errorCode?: string;
  }): Promise<void> {
    const event: UsageEvent = {
      ...params,
      success: false,
      resultCount: 0,
      fallbackCount: 0,
    };

    await this.sink.record(event);

    const attrs = {
      capability: params.capability,
      provider: params.provider,
      status: "error",
    };
    requestCounter.add(1, attrs);
    requestLatency.record(params.latencyMs, attrs);
    errorCounter.add(1, {
      ...attrs,
      error_code: params.errorCode ?? "unknown",
    });
  }
}

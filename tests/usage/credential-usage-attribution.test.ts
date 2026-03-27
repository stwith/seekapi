import { describe, it, expect, vi } from "vitest";
import {
  UsageService,
  type UsageEvent,
  type UsageEventSink,
} from "../../src/modules/usage/service/usage-service.js";

function makeUsageSink(): UsageEventSink & { events: UsageEvent[] } {
  const events: UsageEvent[] = [];
  return {
    events,
    record: vi.fn(async (e: UsageEvent) => {
      events.push(e);
    }),
  };
}

describe("AC1 — credentialId on usage events", () => {
  it("recordSuccess persists credentialId when provided", async () => {
    const sink = makeUsageSink();
    const svc = new UsageService(sink);

    await svc.recordSuccess({
      requestId: "req_cred_001",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      latencyMs: 100,
      resultCount: 5,
      fallbackCount: 0,
      credentialId: "cred_abc",
    });

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0].credentialId).toBe("cred_abc");
  });

  it("recordFailure persists credentialId when provided", async () => {
    const sink = makeUsageSink();
    const svc = new UsageService(sink);

    await svc.recordFailure({
      requestId: "req_cred_002",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      statusCode: 502,
      latencyMs: 50,
      credentialId: "cred_def",
    });

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0].credentialId).toBe("cred_def");
  });

  it("credentialId is optional and defaults to undefined", async () => {
    const sink = makeUsageSink();
    const svc = new UsageService(sink);

    await svc.recordSuccess({
      requestId: "req_cred_003",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      latencyMs: 100,
      resultCount: 5,
      fallbackCount: 0,
    });

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0].credentialId).toBeUndefined();
  });
});

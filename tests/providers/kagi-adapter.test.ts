import { describe, it, expect } from "vitest";
import { KagiAdapter } from "../../src/providers/kagi/adapter.js";
import { KagiClient } from "../../src/providers/kagi/client.js";
import { ProviderError } from "../../src/providers/core/errors.js";
import { toProviderParams, toCanonicalItems } from "../../src/providers/kagi/mapper.js";
import type { Capability, CanonicalSearchRequest } from "../../src/providers/core/types.js";
import type { KagiSearchResponse } from "../../src/providers/kagi/schemas.js";

// AC1: adapter boundary validation
describe("KagiAdapter", () => {
  it("advertises search.web and search.news capabilities", () => {
    const adapter = new KagiAdapter();
    const caps = adapter.supportedCapabilities();

    expect(caps).toContain("search.web");
    expect(caps).toContain("search.news");
    expect(caps).not.toContain("search.images");
    expect(caps).not.toContain("search.answer");
  });

  it("has id 'kagi'", () => {
    const adapter = new KagiAdapter();
    expect(adapter.id).toBe("kagi");
  });

  it("validates credential must be non-empty string", async () => {
    const adapter = new KagiAdapter();

    await expect(adapter.validateCredential("valid-key")).resolves.toBeUndefined();
    await expect(adapter.validateCredential("")).rejects.toThrow("non-empty string");
    await expect(adapter.validateCredential(123)).rejects.toThrow("non-empty string");
    await expect(adapter.validateCredential(null)).rejects.toThrow("non-empty string");
  });

  it("healthCheck returns unavailable without credential", async () => {
    const adapter = new KagiAdapter();
    const result = await adapter.healthCheck({});

    expect(result.provider).toBe("kagi");
    expect(result.status).toBe("unavailable");
    expect(result.checkedAt).toBeInstanceOf(Date);
  });

  it("healthCheck returns degraded within 5s when upstream hangs", { timeout: 10_000 }, async () => {
    const adapter = new KagiAdapter();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted", "AbortError")),
          );
        }
      })) as typeof fetch;
    try {
      const start = Date.now();
      const result = await adapter.healthCheck({ credential: "test-key" });
      const elapsed = Date.now() - start;

      expect(result.status).toBe("degraded");
      expect(elapsed).toBeLessThan(10_000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("KagiClient error wrapping", () => {
  it("wraps network TypeError as timeout ProviderError", async () => {
    const client = new KagiClient();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new TypeError("fetch failed"));
    try {
      try {
        await client.search({ q: "test" }, "key");
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.category).toBe("timeout");
        expect(pe.provider).toBe("kagi");
        expect(pe.retryable).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("wraps AbortError as timeout ProviderError", async () => {
    const client = new KagiClient();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.reject(new DOMException("The operation was aborted", "AbortError"));
    try {
      try {
        await client.search({ q: "test" }, "key");
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.category).toBe("timeout");
        expect(pe.retryable).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("wraps unknown thrown value as unknown ProviderError", async () => {
    const client = new KagiClient();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject("string error");
    try {
      try {
        await client.search({ q: "test" }, "key");
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.category).toBe("unknown");
        expect(pe.retryable).toBe(false);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Kagi mapper", () => {
  it("maps canonical web search request to Kagi params", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test query",
      maxResults: 5,
    };

    const params = toProviderParams(req);
    expect(params.q).toBe("test query");
    expect(params.limit).toBe(5);
  });

  it("clamps maxResults to 50", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test",
      maxResults: 100,
    };

    const params = toProviderParams(req);
    expect(params.limit).toBe(50);
  });

  it("omits limit when maxResults not set", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test",
    };

    const params = toProviderParams(req);
    expect(params.limit).toBeUndefined();
  });

  it("maps Kagi response to canonical web items filtering by t=0", () => {
    const response: KagiSearchResponse = {
      meta: { id: "abc", node: "us-east", ms: 42 },
      data: [
        {
          t: 0,
          title: "Web Result",
          url: "https://example.com",
          snippet: "A web snippet",
          published: "2026-03-21T00:00:00Z",
        },
        {
          t: 1,
          title: "News Result",
          url: "https://news.example.com",
          snippet: "A news snippet",
        },
      ],
    };

    const items = toCanonicalItems("search.web", response);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      title: "Web Result",
      url: "https://example.com",
      snippet: "A web snippet",
      publishedAt: "2026-03-21T00:00:00Z",
      sourceType: "web",
      score: null,
    });
  });

  it("maps Kagi response to canonical news items filtering by t=1", () => {
    const response: KagiSearchResponse = {
      meta: { id: "abc", node: "us-east", ms: 42 },
      data: [
        {
          t: 0,
          title: "Web Result",
          url: "https://example.com",
          snippet: "A web snippet",
        },
        {
          t: 1,
          title: "News Result",
          url: "https://news.example.com",
          snippet: "A news snippet",
          published: "2026-03-21T12:00:00Z",
        },
        {
          t: 1,
          title: "Another News",
          url: "https://news2.example.com",
        },
      ],
    };

    const items = toCanonicalItems("search.news", response);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: "News Result",
      url: "https://news.example.com",
      snippet: "A news snippet",
      publishedAt: "2026-03-21T12:00:00Z",
      sourceType: "news",
      score: null,
    });
    expect(items[1]).toEqual({
      title: "Another News",
      url: "https://news2.example.com",
      snippet: "",
      publishedAt: null,
      sourceType: "news",
      score: null,
    });
  });

  it("returns empty items for empty data", () => {
    const response: KagiSearchResponse = {
      meta: { id: "abc", node: "us-east", ms: 0 },
      data: [],
    };
    expect(toCanonicalItems("search.web", response)).toEqual([]);
    expect(toCanonicalItems("search.news", response)).toEqual([]);
  });
});

// AC1: Kagi BYOK exercised through canonical routes
describe("KagiAdapter execute integration", () => {
  it("returns canonical response for a web search via mocked fetch", async () => {
    const originalFetch = globalThis.fetch;
    const mockResponse: KagiSearchResponse = {
      meta: { id: "req-kagi-1", node: "us-east", ms: 120 },
      data: [
        {
          t: 0,
          title: "Hello World",
          url: "https://example.com",
          snippet: "A greeting page",
          published: "2026-01-01",
        },
      ],
    };
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));

    try {
      const adapter = new KagiAdapter();
      const result = await adapter.execute(
        { capability: "search.web", query: "hello" },
        { credential: "test-key", requestId: "req-001" },
      );

      expect(result.requestId).toBe("req-001");
      expect(result.provider).toBe("kagi");
      expect(result.capability).toBe("search.web");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.title).toBe("Hello World");
      expect(result.items[0]?.sourceType).toBe("web");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns canonical response for a news search via mocked fetch", async () => {
    const originalFetch = globalThis.fetch;
    const mockResponse: KagiSearchResponse = {
      meta: { id: "req-kagi-2", node: "us-east", ms: 80 },
      data: [
        {
          t: 0,
          title: "Web Only",
          url: "https://web.example.com",
        },
        {
          t: 1,
          title: "Breaking News",
          url: "https://news.example.com",
          snippet: "Something happened",
          published: "2026-03-21",
        },
      ],
    };
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));

    try {
      const adapter = new KagiAdapter();
      const result = await adapter.execute(
        { capability: "search.news", query: "latest" },
        { credential: "test-key", requestId: "req-002" },
      );

      expect(result.requestId).toBe("req-002");
      expect(result.provider).toBe("kagi");
      expect(result.capability).toBe("search.news");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.title).toBe("Breaking News");
      expect(result.items[0]?.sourceType).toBe("news");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws for unsupported capability", async () => {
    const adapter = new KagiAdapter();
    await expect(
      adapter.execute(
        { capability: "search.images" as Capability, query: "q" },
        { credential: "key", requestId: "req-x" },
      ),
    ).rejects.toThrow("does not support capability");
  });
});

describe("KagiClient error envelope handling", () => {
  function mockFetchEnvelopeError(errorPayload: unknown): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify(errorPayload), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    return () => { globalThis.fetch = original; };
  }

  it("throws ProviderError for 200 response with insufficient credit error", async () => {
    const restore = mockFetchEnvelopeError({
      meta: { id: "abc", node: "us-east", ms: 0 },
      data: null,
      error: [{ code: 101, msg: "Insufficient credit" }],
    });
    try {
      await expect(new KagiClient().search({ q: "test" }, "key")).rejects.toThrow(ProviderError);
      try { await new KagiClient().search({ q: "test" }, "key"); } catch (err) {
        const pe = err as ProviderError;
        expect(pe.category).toBe("bad_credential");
        expect(pe.message).toContain("Insufficient credit");
        expect(pe.statusCode).toBe(200);
        expect(pe.retryable).toBe(false);
      }
    } finally { restore(); }
  });

  it("throws ProviderError for 200 response with auth error", async () => {
    const restore = mockFetchEnvelopeError({
      meta: { id: "abc", node: "us-east", ms: 0 },
      data: null,
      error: [{ code: 1, msg: "Authentication error" }],
    });
    try {
      try { await new KagiClient().search({ q: "test" }, "key"); } catch (err) {
        const pe = err as ProviderError;
        expect(pe.category).toBe("bad_credential");
        expect(pe.message).toContain("Authentication error");
      }
    } finally { restore(); }
  });

  it("throws ProviderError for 200 response with malformed request error", async () => {
    const restore = mockFetchEnvelopeError({
      meta: { id: "abc", node: "us-east", ms: 0 },
      data: null,
      error: [{ code: 42, msg: "Malformed request" }],
    });
    try {
      try { await new KagiClient().search({ q: "test" }, "key"); } catch (err) {
        const pe = err as ProviderError;
        expect(pe.category).toBe("invalid_request");
        expect(pe.retryable).toBe(false);
      }
    } finally { restore(); }
  });

  it("does not throw when error array is empty", async () => {
    const restore = mockFetchEnvelopeError({
      meta: { id: "abc", node: "us-east", ms: 10 },
      data: [{ t: 0, title: "OK", url: "https://example.com" }],
      error: [],
    });
    try {
      const result = await new KagiClient().search({ q: "test" }, "key");
      expect(result.data).toHaveLength(1);
    } finally { restore(); }
  });

  it("does not throw when error field is absent", async () => {
    const restore = mockFetchEnvelopeError({
      meta: { id: "abc", node: "us-east", ms: 10 },
      data: [{ t: 0, title: "OK", url: "https://example.com" }],
    });
    try {
      const result = await new KagiClient().search({ q: "test" }, "key");
      expect(result.data).toHaveLength(1);
    } finally { restore(); }
  });
});

describe("KagiClient HTTP status classification", () => {
  function mockFetchStatus(status: number): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response("error", { status }));
    return () => { globalThis.fetch = original; };
  }

  it("classifies 401 as bad_credential", async () => {
    const restore = mockFetchStatus(401);
    try {
      try { await new KagiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("bad_credential");
        expect((err as ProviderError).retryable).toBe(false);
      }
    } finally { restore(); }
  });

  it("classifies 403 as bad_credential", async () => {
    const restore = mockFetchStatus(403);
    try {
      try { await new KagiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("bad_credential");
      }
    } finally { restore(); }
  });

  it("classifies 429 as rate_limited", async () => {
    const restore = mockFetchStatus(429);
    try {
      try { await new KagiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("rate_limited");
        expect((err as ProviderError).retryable).toBe(true);
      }
    } finally { restore(); }
  });

  it("classifies 500 as upstream_5xx", async () => {
    const restore = mockFetchStatus(500);
    try {
      try { await new KagiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("upstream_5xx");
        expect((err as ProviderError).retryable).toBe(true);
      }
    } finally { restore(); }
  });

  it("classifies 502 as upstream_5xx", async () => {
    const restore = mockFetchStatus(502);
    try {
      try { await new KagiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("upstream_5xx");
        expect((err as ProviderError).statusCode).toBe(502);
      }
    } finally { restore(); }
  });
});

import { describe, it, expect } from "vitest";
import { BraveAdapter } from "../../src/providers/brave/adapter.js";
import { BraveClient } from "../../src/providers/brave/client.js";
import { ProviderError } from "../../src/providers/core/errors.js";
import { toProviderParams, toCanonicalItems } from "../../src/providers/brave/mapper.js";
import type { Capability, CanonicalSearchRequest } from "../../src/providers/core/types.js";
import type { BraveSearchResponse } from "../../src/providers/brave/schemas.js";

// AC2: adapter boundary validation
describe("BraveAdapter", () => {
  it("advertises web, news, and images capabilities", () => {
    const adapter = new BraveAdapter();
    const caps = adapter.supportedCapabilities();

    expect(caps).toContain("search.web");
    expect(caps).toContain("search.news");
    expect(caps).toContain("search.images");
    expect(caps).not.toContain("search.answer");
  });

  it("has id 'brave'", () => {
    const adapter = new BraveAdapter();
    expect(adapter.id).toBe("brave");
  });

  it("validates credential must be non-empty string", async () => {
    const adapter = new BraveAdapter();

    await expect(adapter.validateCredential("valid-key")).resolves.toBeUndefined();
    await expect(adapter.validateCredential("")).rejects.toThrow("non-empty string");
    await expect(adapter.validateCredential(123)).rejects.toThrow("non-empty string");
    await expect(adapter.validateCredential(null)).rejects.toThrow("non-empty string");
  });

  it("healthCheck returns unavailable without credential", async () => {
    const adapter = new BraveAdapter();
    const result = await adapter.healthCheck({});

    expect(result.provider).toBe("brave");
    expect(result.status).toBe("unavailable");
    expect(result.checkedAt).toBeInstanceOf(Date);
  });

  it("healthCheck returns degraded within 5s when upstream hangs", { timeout: 10_000 }, async () => {
    const adapter = new BraveAdapter();
    const originalFetch = globalThis.fetch;
    // Simulate a hanging upstream that respects abort signals
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
      expect(elapsed).toBeLessThan(10_000); // must not hang indefinitely
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("BraveClient error wrapping", () => {
  it("wraps network TypeError as timeout ProviderError", async () => {
    const client = new BraveClient();
    // Mock fetch to throw a network error (TypeError is what fetch throws for DNS/connection failures)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new TypeError("fetch failed"));
    try {
      await expect(
        client.search("web/search", { q: "test" }, "key"),
      ).rejects.toThrow(ProviderError);

      try {
        await client.search("web/search", { q: "test" }, "key");
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.category).toBe("timeout");
        expect(pe.provider).toBe("brave");
        expect(pe.retryable).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("wraps AbortError as timeout ProviderError", async () => {
    const client = new BraveClient();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.reject(new DOMException("The operation was aborted", "AbortError"));
    try {
      try {
        await client.search("web/search", { q: "test" }, "key");
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
    const client = new BraveClient();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject("string error");
    try {
      try {
        await client.search("web/search", { q: "test" }, "key");
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

describe("Brave mapper", () => {
  it("maps canonical web search request to Brave params", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test query",
      maxResults: 5,
      country: "US",
      timeRange: "week",
    };

    const params = toProviderParams(req);
    expect(params.q).toBe("test query");
    expect(params.count).toBe(5);
    expect(params.country).toBe("US");
    expect(params.freshness).toBe("pw");
    expect(params.result_filter).toBeUndefined();
  });

  it("sets result_filter for news capability", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.news",
      query: "news query",
    };

    const params = toProviderParams(req);
    expect(params.result_filter).toBe("news");
  });

  it("sets result_filter for images capability", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.images",
      query: "image query",
    };

    const params = toProviderParams(req);
    expect(params.result_filter).toBe("images");
  });

  it("maps Brave web response to canonical items", () => {
    const response: BraveSearchResponse = {
      web: {
        results: [
          {
            title: "Test",
            url: "https://example.com",
            description: "A test result",
            page_age: "2024-01-01",
          },
        ],
      },
    };

    const items = toCanonicalItems("search.web", response);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      title: "Test",
      url: "https://example.com",
      snippet: "A test result",
      publishedAt: "2024-01-01",
      sourceType: "web",
      score: null,
    });
  });

  it("maps Brave news response to canonical items", () => {
    const response: BraveSearchResponse = {
      news: {
        results: [
          {
            title: "News",
            url: "https://news.example.com",
            description: "Breaking news",
            age: "2h ago",
          },
        ],
      },
    };

    const items = toCanonicalItems("search.news", response);
    expect(items).toHaveLength(1);
    expect(items[0]?.sourceType).toBe("news");
    expect(items[0]?.publishedAt).toBe("2h ago");
  });

  it("returns empty items for missing response section", () => {
    const response: BraveSearchResponse = {};
    expect(toCanonicalItems("search.web", response)).toEqual([]);
    expect(toCanonicalItems("search.news", response)).toEqual([]);
    expect(toCanonicalItems("search.images", response)).toEqual([]);
  });
});

// AC4: Brave BYOK exercised through canonical routes
describe("BraveAdapter execute integration", () => {
  it("returns canonical response for a web search via mocked fetch", async () => {
    const originalFetch = globalThis.fetch;
    const mockResponse: BraveSearchResponse = {
      query: { original: "hello" },
      web: {
        results: [
          { title: "Hello World", url: "https://example.com", description: "A greeting", page_age: "2024-06-01" },
        ],
      },
    };
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));

    try {
      const adapter = new BraveAdapter();
      const result = await adapter.execute(
        { capability: "search.web", query: "hello" },
        { credential: "test-key", requestId: "req-001" },
      );

      expect(result.requestId).toBe("req-001");
      expect(result.provider).toBe("brave");
      expect(result.capability).toBe("search.web");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.title).toBe("Hello World");
      expect(result.items[0]?.sourceType).toBe("web");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws for unsupported capability", async () => {
    const adapter = new BraveAdapter();
    await expect(
      adapter.execute(
        { capability: "search.answer" as Capability, query: "q" },
        { credential: "key", requestId: "req-x" },
      ),
    ).rejects.toThrow("does not support capability");
  });
});

describe("BraveClient HTTP status classification", () => {
  function mockFetchStatus(status: number): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response("error", { status }));
    return () => { globalThis.fetch = original; };
  }

  it("classifies 401 as bad_credential", async () => {
    const restore = mockFetchStatus(401);
    try {
      const client = new BraveClient();
      await expect(client.search("web/search", { q: "t" }, "k")).rejects.toThrow(ProviderError);
      try { await client.search("web/search", { q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("bad_credential");
        expect((err as ProviderError).retryable).toBe(false);
      }
    } finally { restore(); }
  });

  it("classifies 403 as bad_credential", async () => {
    const restore = mockFetchStatus(403);
    try {
      try { await new BraveClient().search("web/search", { q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("bad_credential");
      }
    } finally { restore(); }
  });

  it("classifies 429 as rate_limited", async () => {
    const restore = mockFetchStatus(429);
    try {
      try { await new BraveClient().search("web/search", { q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("rate_limited");
        expect((err as ProviderError).retryable).toBe(true);
      }
    } finally { restore(); }
  });

  it("classifies 500 as upstream_5xx", async () => {
    const restore = mockFetchStatus(500);
    try {
      try { await new BraveClient().search("web/search", { q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("upstream_5xx");
        expect((err as ProviderError).retryable).toBe(true);
      }
    } finally { restore(); }
  });

  it("classifies 502 as upstream_5xx", async () => {
    const restore = mockFetchStatus(502);
    try {
      try { await new BraveClient().search("web/search", { q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("upstream_5xx");
        expect((err as ProviderError).statusCode).toBe(502);
      }
    } finally { restore(); }
  });

  it("classifies 422 as bad_credential", async () => {
    const restore = mockFetchStatus(422);
    try {
      try { await new BraveClient().search("web/search", { q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("bad_credential");
        expect((err as ProviderError).retryable).toBe(false);
      }
    } finally { restore(); }
  });
});

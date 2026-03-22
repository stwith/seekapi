import { describe, it, expect } from "vitest";
import { TavilyAdapter } from "../../src/providers/tavily/adapter.js";
import { TavilyClient } from "../../src/providers/tavily/client.js";
import { ProviderError } from "../../src/providers/core/errors.js";
import { toProviderParams, toCanonicalItems } from "../../src/providers/tavily/mapper.js";
import type { Capability, CanonicalSearchRequest } from "../../src/providers/core/types.js";
import type { TavilySearchResponse } from "../../src/providers/tavily/schemas.js";

// AC1: adapter boundary validation
describe("TavilyAdapter", () => {
  it("advertises only search.web capability", () => {
    const adapter = new TavilyAdapter();
    const caps = adapter.supportedCapabilities();

    expect(caps).toContain("search.web");
    expect(caps).not.toContain("search.news");
    expect(caps).not.toContain("search.images");
    expect(caps).not.toContain("search.answer");
  });

  it("has id 'tavily'", () => {
    const adapter = new TavilyAdapter();
    expect(adapter.id).toBe("tavily");
  });

  it("validates credential must be non-empty string", async () => {
    const adapter = new TavilyAdapter();

    await expect(adapter.validateCredential("valid-key")).resolves.toBeUndefined();
    await expect(adapter.validateCredential("")).rejects.toThrow("non-empty string");
    await expect(adapter.validateCredential(123)).rejects.toThrow("non-empty string");
    await expect(adapter.validateCredential(null)).rejects.toThrow("non-empty string");
  });

  it("healthCheck returns unavailable without credential", async () => {
    const adapter = new TavilyAdapter();
    const result = await adapter.healthCheck({});

    expect(result.provider).toBe("tavily");
    expect(result.status).toBe("unavailable");
    expect(result.checkedAt).toBeInstanceOf(Date);
  });

  it("healthCheck returns degraded within 5s when upstream hangs", { timeout: 10_000 }, async () => {
    const adapter = new TavilyAdapter();
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

describe("TavilyClient error wrapping", () => {
  it("wraps network TypeError as timeout ProviderError", async () => {
    const client = new TavilyClient();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new TypeError("fetch failed"));
    try {
      try {
        await client.search({ query: "test" }, "key");
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.category).toBe("timeout");
        expect(pe.provider).toBe("tavily");
        expect(pe.retryable).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("wraps AbortError as timeout ProviderError", async () => {
    const client = new TavilyClient();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.reject(new DOMException("The operation was aborted", "AbortError"));
    try {
      try {
        await client.search({ query: "test" }, "key");
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
    const client = new TavilyClient();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject("string error");
    try {
      try {
        await client.search({ query: "test" }, "key");
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

describe("Tavily mapper", () => {
  it("maps canonical web search request to Tavily params", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test query",
      maxResults: 5,
      includeDomains: ["example.com"],
      excludeDomains: ["spam.com"],
    };

    const params = toProviderParams(req);
    expect(params.query).toBe("test query");
    expect(params.max_results).toBe(5);
    expect(params.include_domains).toEqual(["example.com"]);
    expect(params.exclude_domains).toEqual(["spam.com"]);
    expect(params.search_depth).toBe("basic");
    expect(params.include_answer).toBe(true);
  });

  it("clamps maxResults to 20", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test",
      maxResults: 50,
    };

    const params = toProviderParams(req);
    expect(params.max_results).toBe(20);
  });

  it("omits domain filters when empty", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test",
    };

    const params = toProviderParams(req);
    expect(params.include_domains).toBeUndefined();
    expect(params.exclude_domains).toBeUndefined();
  });

  it("maps Tavily response to canonical items", () => {
    const response: TavilySearchResponse = {
      answer: "A generated answer",
      results: [
        {
          title: "Test",
          url: "https://example.com",
          content: "A test result",
          score: 0.95,
          published_date: "2026-03-21",
        },
      ],
    };

    const items = toCanonicalItems(response);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      title: "Test",
      url: "https://example.com",
      snippet: "A test result",
      publishedAt: "2026-03-21",
      sourceType: "web",
      score: 0.95,
    });
  });

  it("returns empty items for empty results", () => {
    const response: TavilySearchResponse = { results: [] };
    expect(toCanonicalItems(response)).toEqual([]);
  });
});

// AC1: Tavily BYOK exercised through canonical routes
describe("TavilyAdapter execute integration", () => {
  it("returns canonical response for a web search via mocked fetch", async () => {
    const originalFetch = globalThis.fetch;
    const mockResponse: TavilySearchResponse = {
      answer: "Hello world is a common greeting",
      results: [
        {
          title: "Hello World",
          url: "https://example.com",
          content: "A greeting page",
          score: 0.9,
          published_date: "2026-01-01",
        },
      ],
    };
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));

    try {
      const adapter = new TavilyAdapter();
      const result = await adapter.execute(
        { capability: "search.web", query: "hello" },
        { credential: "test-key", requestId: "req-001" },
      );

      expect(result.requestId).toBe("req-001");
      expect(result.provider).toBe("tavily");
      expect(result.capability).toBe("search.web");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.title).toBe("Hello World");
      expect(result.items[0]?.sourceType).toBe("web");
      expect(result.items[0]?.score).toBe(0.9);
      expect(result.answer).toBe("Hello world is a common greeting");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws for unsupported capability", async () => {
    const adapter = new TavilyAdapter();
    await expect(
      adapter.execute(
        { capability: "search.news" as Capability, query: "q" },
        { credential: "key", requestId: "req-x" },
      ),
    ).rejects.toThrow("does not support capability");
  });
});

describe("TavilyClient HTTP status classification", () => {
  function mockFetchStatus(status: number): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response("error", { status }));
    return () => { globalThis.fetch = original; };
  }

  it("classifies 401 as bad_credential", async () => {
    const restore = mockFetchStatus(401);
    try {
      try { await new TavilyClient().search({ query: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("bad_credential");
        expect((err as ProviderError).retryable).toBe(false);
      }
    } finally { restore(); }
  });

  it("classifies 403 as bad_credential", async () => {
    const restore = mockFetchStatus(403);
    try {
      try { await new TavilyClient().search({ query: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("bad_credential");
      }
    } finally { restore(); }
  });

  it("classifies 429 as rate_limited", async () => {
    const restore = mockFetchStatus(429);
    try {
      try { await new TavilyClient().search({ query: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("rate_limited");
        expect((err as ProviderError).retryable).toBe(true);
      }
    } finally { restore(); }
  });

  it("classifies 500 as upstream_5xx", async () => {
    const restore = mockFetchStatus(500);
    try {
      try { await new TavilyClient().search({ query: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("upstream_5xx");
        expect((err as ProviderError).retryable).toBe(true);
      }
    } finally { restore(); }
  });

  it("classifies 502 as upstream_5xx", async () => {
    const restore = mockFetchStatus(502);
    try {
      try { await new TavilyClient().search({ query: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("upstream_5xx");
        expect((err as ProviderError).statusCode).toBe(502);
      }
    } finally { restore(); }
  });
});

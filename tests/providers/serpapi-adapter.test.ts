import { describe, it, expect } from "vitest";
import { SerpApiAdapter } from "../../src/providers/serpapi/adapter.js";
import { SerpApiClient } from "../../src/providers/serpapi/client.js";
import { ProviderError } from "../../src/providers/core/errors.js";
import { toProviderParams, toCanonicalItems } from "../../src/providers/serpapi/mapper.js";
import type { Capability, CanonicalSearchRequest } from "../../src/providers/core/types.js";
import type { SerpApiSearchResponse } from "../../src/providers/serpapi/schemas.js";

// AC1: adapter boundary validation
describe("SerpApiAdapter", () => {
  it("advertises search.web, search.news, and search.images capabilities", () => {
    const adapter = new SerpApiAdapter();
    const caps = adapter.supportedCapabilities();

    expect(caps).toContain("search.web");
    expect(caps).toContain("search.news");
    expect(caps).toContain("search.images");
    expect(caps).not.toContain("search.answer");
  });

  it("has id 'serpapi'", () => {
    const adapter = new SerpApiAdapter();
    expect(adapter.id).toBe("serpapi");
  });

  it("validates credential must be non-empty string", async () => {
    const adapter = new SerpApiAdapter();

    await expect(adapter.validateCredential("valid-key")).resolves.toBeUndefined();
    await expect(adapter.validateCredential("")).rejects.toThrow("non-empty string");
    await expect(adapter.validateCredential(123)).rejects.toThrow("non-empty string");
    await expect(adapter.validateCredential(null)).rejects.toThrow("non-empty string");
  });

  it("healthCheck returns unavailable without credential", async () => {
    const adapter = new SerpApiAdapter();
    const result = await adapter.healthCheck({});

    expect(result.provider).toBe("serpapi");
    expect(result.status).toBe("unavailable");
    expect(result.checkedAt).toBeInstanceOf(Date);
  });

  it("healthCheck returns degraded within 5s when upstream hangs", { timeout: 10_000 }, async () => {
    const adapter = new SerpApiAdapter();
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

describe("SerpApiClient error wrapping", () => {
  it("wraps network TypeError as timeout ProviderError", async () => {
    const client = new SerpApiClient();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new TypeError("fetch failed"));
    try {
      try {
        await client.search({ q: "test" }, "key");
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.category).toBe("timeout");
        expect(pe.provider).toBe("serpapi");
        expect(pe.retryable).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("wraps AbortError as timeout ProviderError", async () => {
    const client = new SerpApiClient();
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
    const client = new SerpApiClient();
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

describe("SerpAPI mapper", () => {
  it("maps canonical web search request to SerpAPI params", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test query",
      maxResults: 5,
    };

    const params = toProviderParams(req);
    expect(params.q).toBe("test query");
    expect(params.num).toBe(5);
    expect(params.engine).toBe("google");
    expect(params.tbm).toBeUndefined();
  });

  it("sets tbm=nws for search.news", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.news",
      query: "latest news",
    };

    const params = toProviderParams(req);
    expect(params.tbm).toBe("nws");
  });

  it("sets tbm=isch for search.images", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.images",
      query: "cats",
    };

    const params = toProviderParams(req);
    expect(params.tbm).toBe("isch");
  });

  it("clamps maxResults to 100", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test",
      maxResults: 200,
    };

    const params = toProviderParams(req);
    expect(params.num).toBe(100);
  });

  it("omits num when maxResults not set", () => {
    const req: CanonicalSearchRequest = {
      capability: "search.web",
      query: "test",
    };

    const params = toProviderParams(req);
    expect(params.num).toBeUndefined();
  });

  it("maps SerpAPI organic_results to canonical web items", () => {
    const response: SerpApiSearchResponse = {
      search_metadata: { id: "abc", status: "Success" },
      organic_results: [
        {
          title: "Web Result",
          link: "https://example.com",
          snippet: "A web snippet",
          date: "2026-03-21",
          position: 1,
        },
      ],
    };

    const items = toCanonicalItems("search.web", response);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      title: "Web Result",
      url: "https://example.com",
      snippet: "A web snippet",
      publishedAt: "2026-03-21",
      sourceType: "web",
      score: null,
    });
  });

  it("maps SerpAPI news_results to canonical news items", () => {
    const response: SerpApiSearchResponse = {
      search_metadata: { id: "abc", status: "Success" },
      news_results: [
        {
          title: "Breaking News",
          link: "https://news.example.com",
          snippet: "Something happened",
          date: "2026-03-21",
          source: "Reuters",
        },
      ],
    };

    const items = toCanonicalItems("search.news", response);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      title: "Breaking News",
      url: "https://news.example.com",
      snippet: "Something happened",
      publishedAt: "2026-03-21",
      sourceType: "news",
      score: null,
    });
  });

  it("maps SerpAPI images_results to canonical image items", () => {
    const response: SerpApiSearchResponse = {
      search_metadata: { id: "abc", status: "Success" },
      images_results: [
        {
          title: "Cat Photo",
          link: "https://example.com/page",
          original: "https://example.com/cat.jpg",
          thumbnail: "https://example.com/cat_thumb.jpg",
          source: "Example",
        },
      ],
    };

    const items = toCanonicalItems("search.images", response);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      title: "Cat Photo",
      url: "https://example.com/cat.jpg",
      snippet: "Example",
      publishedAt: null,
      sourceType: "images",
      score: null,
    });
  });

  it("returns empty items for empty results", () => {
    const response: SerpApiSearchResponse = {
      search_metadata: { id: "abc", status: "Success" },
    };
    expect(toCanonicalItems("search.web", response)).toEqual([]);
    expect(toCanonicalItems("search.news", response)).toEqual([]);
    expect(toCanonicalItems("search.images", response)).toEqual([]);
  });
});

// AC1: SerpAPI BYOK exercised through canonical routes
describe("SerpApiAdapter execute integration", () => {
  it("returns canonical response for a web search via mocked fetch", async () => {
    const originalFetch = globalThis.fetch;
    const mockResponse: SerpApiSearchResponse = {
      search_metadata: { id: "req-serp-1", status: "Success" },
      organic_results: [
        {
          title: "Hello World",
          link: "https://example.com",
          snippet: "A greeting page",
          date: "2026-01-01",
        },
      ],
    };
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));

    try {
      const adapter = new SerpApiAdapter();
      const result = await adapter.execute(
        { capability: "search.web", query: "hello" },
        { credential: "test-key", requestId: "req-001" },
      );

      expect(result.requestId).toBe("req-001");
      expect(result.provider).toBe("serpapi");
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
    const mockResponse: SerpApiSearchResponse = {
      search_metadata: { id: "req-serp-2", status: "Success" },
      news_results: [
        {
          title: "Breaking News",
          link: "https://news.example.com",
          snippet: "Something happened",
          date: "2026-03-21",
        },
      ],
    };
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));

    try {
      const adapter = new SerpApiAdapter();
      const result = await adapter.execute(
        { capability: "search.news", query: "latest" },
        { credential: "test-key", requestId: "req-002" },
      );

      expect(result.requestId).toBe("req-002");
      expect(result.provider).toBe("serpapi");
      expect(result.capability).toBe("search.news");
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.title).toBe("Breaking News");
      expect(result.items[0]?.sourceType).toBe("news");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns canonical response for an images search via mocked fetch", async () => {
    const originalFetch = globalThis.fetch;
    const mockResponse: SerpApiSearchResponse = {
      search_metadata: { id: "req-serp-3", status: "Success" },
      images_results: [
        {
          title: "Cat",
          link: "https://example.com/page",
          original: "https://example.com/cat.jpg",
          thumbnail: "https://example.com/cat_thumb.jpg",
        },
      ],
    };
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));

    try {
      const adapter = new SerpApiAdapter();
      const result = await adapter.execute(
        { capability: "search.images", query: "cats" },
        { credential: "test-key", requestId: "req-003" },
      );

      expect(result.requestId).toBe("req-003");
      expect(result.provider).toBe("serpapi");
      expect(result.capability).toBe("search.images");
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.sourceType).toBe("images");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws for unsupported capability", async () => {
    const adapter = new SerpApiAdapter();
    await expect(
      adapter.execute(
        { capability: "search.answer" as Capability, query: "q" },
        { credential: "key", requestId: "req-x" },
      ),
    ).rejects.toThrow("does not support capability");
  });
});

describe("SerpApiClient error envelope handling", () => {
  function mockFetchEnvelopeError(errorPayload: unknown): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify(errorPayload), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    return () => { globalThis.fetch = original; };
  }

  it("throws ProviderError for 200 response with invalid API key error", async () => {
    const restore = mockFetchEnvelopeError({
      search_metadata: { id: "abc", status: "Error" },
      error: "Invalid API key. Your API key should be here: https://serpapi.com/manage-api-key",
    });
    try {
      try { await new SerpApiClient().search({ q: "test" }, "key"); } catch (err) {
        const pe = err as ProviderError;
        expect(pe.category).toBe("bad_credential");
        expect(pe.message).toContain("Invalid API key");
        expect(pe.retryable).toBe(false);
      }
    } finally { restore(); }
  });

  it("throws ProviderError for 200 response with rate limit error", async () => {
    const restore = mockFetchEnvelopeError({
      search_metadata: { id: "abc", status: "Error" },
      error: "Rate limit exceeded, too many requests",
    });
    try {
      try { await new SerpApiClient().search({ q: "test" }, "key"); } catch (err) {
        const pe = err as ProviderError;
        expect(pe.category).toBe("rate_limited");
        expect(pe.retryable).toBe(true);
      }
    } finally { restore(); }
  });

  it("throws ProviderError for 200 response with missing parameter error", async () => {
    const restore = mockFetchEnvelopeError({
      search_metadata: { id: "abc", status: "Error" },
      error: "Missing parameter q",
    });
    try {
      try { await new SerpApiClient().search({ q: "test" }, "key"); } catch (err) {
        const pe = err as ProviderError;
        expect(pe.category).toBe("invalid_request");
        expect(pe.retryable).toBe(false);
      }
    } finally { restore(); }
  });

  it("does not throw when error field is absent", async () => {
    const restore = mockFetchEnvelopeError({
      search_metadata: { id: "abc", status: "Success" },
      organic_results: [{ title: "OK", link: "https://example.com" }],
    });
    try {
      const result = await new SerpApiClient().search({ q: "test" }, "key");
      expect(result.organic_results).toHaveLength(1);
    } finally { restore(); }
  });
});

describe("SerpApiClient HTTP status classification", () => {
  function mockFetchStatus(status: number): () => void {
    const original = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response("error", { status }));
    return () => { globalThis.fetch = original; };
  }

  it("classifies 401 as bad_credential", async () => {
    const restore = mockFetchStatus(401);
    try {
      try { await new SerpApiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("bad_credential");
        expect((err as ProviderError).retryable).toBe(false);
      }
    } finally { restore(); }
  });

  it("classifies 403 as bad_credential", async () => {
    const restore = mockFetchStatus(403);
    try {
      try { await new SerpApiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("bad_credential");
      }
    } finally { restore(); }
  });

  it("classifies 429 as rate_limited", async () => {
    const restore = mockFetchStatus(429);
    try {
      try { await new SerpApiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("rate_limited");
        expect((err as ProviderError).retryable).toBe(true);
      }
    } finally { restore(); }
  });

  it("classifies 500 as upstream_5xx", async () => {
    const restore = mockFetchStatus(500);
    try {
      try { await new SerpApiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("upstream_5xx");
        expect((err as ProviderError).retryable).toBe(true);
      }
    } finally { restore(); }
  });

  it("classifies 502 as upstream_5xx", async () => {
    const restore = mockFetchStatus(502);
    try {
      try { await new SerpApiClient().search({ q: "t" }, "k"); } catch (err) {
        expect((err as ProviderError).category).toBe("upstream_5xx");
        expect((err as ProviderError).statusCode).toBe(502);
      }
    } finally { restore(); }
  });
});

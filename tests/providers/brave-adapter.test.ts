import { describe, it, expect } from "vitest";
import { BraveAdapter } from "../../src/providers/brave/adapter.js";
import { toProviderParams, toCanonicalItems } from "../../src/providers/brave/mapper.js";
import type { CanonicalSearchRequest } from "../../src/providers/core/types.js";
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

import type { BraveSearchResponse } from "../../src/providers/brave/schemas.js";

/**
 * Default mock Brave response returned by mockBraveFetch().
 * Contains one web result, one news result, and one image result.
 */
export const MOCK_BRAVE_RESPONSE: BraveSearchResponse = {
  query: { original: "test" },
  web: {
    results: [
      {
        title: "Test Result",
        url: "https://example.com",
        description: "A mock result",
        page_age: "2024-01-01",
      },
    ],
  },
  news: {
    results: [
      {
        title: "Test News",
        url: "https://news.example.com",
        description: "Mock news",
        age: "1h ago",
      },
    ],
  },
  images: {
    results: [
      {
        title: "Test Image",
        url: "https://img.example.com/photo.jpg",
        thumbnail: { src: "https://img.example.com/thumb.jpg" },
        source: "example.com",
      },
    ],
  },
};

/**
 * Install a global fetch mock that intercepts Brave API calls and
 * returns MOCK_BRAVE_RESPONSE. Returns a teardown function.
 */
export function mockBraveFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("api.search.brave.com")) {
      return Promise.resolve(
        new Response(JSON.stringify(MOCK_BRAVE_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return original(input);
  };
  return () => {
    globalThis.fetch = original;
  };
}

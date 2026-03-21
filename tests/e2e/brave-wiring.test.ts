import { describe, test, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockBraveFetch } from "../helpers/mock-brave.js";
import { buildTestApp } from "../helpers/build-test-app.js";
import { TEST_BRAVE_CREDENTIAL } from "../helpers/seed-test-repos.js";

const AUTH_HEADER = { authorization: "Bearer sk_test_seekapi_demo_key_001" };

/**
 * End-to-end wiring test: auth → project context → credential lookup →
 * search service → Brave adapter → mock fetch → canonical response. [AC4]
 *
 * This test proves the full main path is connected, not returning stubs.
 */
describe("Brave adapter wiring (e2e)", () => {
  let app: FastifyInstance;
  let restoreFetch: () => void;

  beforeEach(async () => {
    restoreFetch = mockBraveFetch();
    app = await buildTestApp({ braveApiKey: TEST_BRAVE_CREDENTIAL });
    await app.ready();
  });

  afterEach(() => {
    restoreFetch();
  });

  test("POST /v1/search/web returns provider=brave with items (not stub)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello world" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Must NOT be the stub provider
    expect(body.provider).toBe("brave");
    expect(body.provider).not.toBe("stub");

    // Must have items from the mock Brave response
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].title).toBe("Test Result");
    expect(body.items[0].source_type).toBe("web");
    expect(body.capability).toBe("search.web");
    expect(body.latency_ms).toBeGreaterThanOrEqual(0);
  });

  test("POST /v1/search/news returns provider=brave with news items", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/news",
      payload: { query: "breaking" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.provider).toBe("brave");
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].source_type).toBe("news");
  });

  test("POST /v1/search/images returns provider=brave with image items", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/images",
      payload: { query: "cats" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.provider).toBe("brave");
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].source_type).toBe("image");
  });

  test("request passes credential from project context to Brave API", async () => {
    let capturedHeaders: Record<string, string> = {};
    const originalFetch = globalThis.fetch;

    // Override the mock to capture headers
    restoreFetch();
    globalThis.fetch = (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.headers) {
        const h = init.headers as Record<string, string>;
        capturedHeaders = { ...h };
      }
      return Promise.resolve(
        new Response(JSON.stringify({ web: { results: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    };

    try {
      await app.inject({
        method: "POST",
        url: "/v1/search/web",
        payload: { query: "credential check" },
        headers: AUTH_HEADER,
      });

      // Brave client sends the credential as X-Subscription-Token
      expect(capturedHeaders["X-Subscription-Token"]).toBe(TEST_BRAVE_CREDENTIAL);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

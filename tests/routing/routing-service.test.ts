import { describe, it, expect, vi } from "vitest";
import {
  RoutingService,
  RoutingError,
  type ProviderHealth,
  type RoutingConfig,
} from "../../src/modules/routing/service/routing-service.js";
import { classifyError } from "../../src/modules/routing/service/error-classifier.js";
import { ProviderError } from "../../src/providers/core/errors.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeHealth(
  healthy: Record<string, boolean> = {},
): ProviderHealth {
  return {
    isHealthy: (id: string) => healthy[id] ?? true,
  };
}

function makeConfig(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    defaultProvider: () => "brave",
    fallbackOrder: () => ["google", "bing"],
    allowedProviders: () => ["brave", "google", "bing"],  // capability param ignored in unit tests
    ...overrides,
  };
}

function makeService(
  healthMap: Record<string, boolean> = {},
  configOverrides: Partial<RoutingConfig> = {},
): RoutingService {
  return new RoutingService({
    health: makeHealth(healthMap),
    config: makeConfig(configOverrides),
  });
}

/* ------------------------------------------------------------------ */
/*  selectProvider                                                    */
/* ------------------------------------------------------------------ */

describe("RoutingService.selectProvider", () => {
  it("explicit provider wins when allowed", () => {
    const svc = makeService();
    const result = svc.selectProvider("search.web", "google");
    expect(result.providerId).toBe("google");
    expect(result.reason).toBe("explicit");
  });

  it("rejects explicit provider that is not allowed", () => {
    const svc = makeService({}, {
      allowedProviders: () => ["brave"],
    });
    expect(() => svc.selectProvider("search.web", "google")).toThrow(
      RoutingError,
    );
  });

  it("rejects explicit provider that is unhealthy", () => {
    const svc = makeService({ google: false });
    expect(() => svc.selectProvider("search.web", "google")).toThrow(
      RoutingError,
    );
  });

  it("project default provider is used when request omits provider", () => {
    const svc = makeService();
    const result = svc.selectProvider("search.web");
    expect(result.providerId).toBe("brave");
    expect(result.reason).toBe("default");
  });

  it("falls back when default provider is unhealthy", () => {
    const svc = makeService({ brave: false });
    const result = svc.selectProvider("search.web");
    expect(result.providerId).toBe("google");
    expect(result.reason).toBe("fallback");
  });

  it("throws when no healthy provider is available", () => {
    const svc = makeService({ brave: false, google: false, bing: false });
    expect(() => svc.selectProvider("search.web")).toThrow(RoutingError);
  });
});

/* ------------------------------------------------------------------ */
/*  executeWithFallback                                               */
/* ------------------------------------------------------------------ */

describe("RoutingService.executeWithFallback", () => {
  it("healthy fallback provider is selected after retryable failure", async () => {
    const svc = makeService();
    const executeFn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("upstream"), { statusCode: 502 }))
      .mockResolvedValueOnce("ok-from-google");

    const result = await svc.executeWithFallback(
      "search.web",
      undefined,
      executeFn,
    );

    expect(result).toBe("ok-from-google");
    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(executeFn).toHaveBeenNthCalledWith(1, "brave");
    expect(executeFn).toHaveBeenNthCalledWith(2, "google");
  });

  it("non-retryable auth errors do not fallback", async () => {
    const svc = makeService();
    const authErr = Object.assign(new Error("bad creds"), { statusCode: 401 });
    const executeFn = vi.fn().mockRejectedValueOnce(authErr);

    await expect(
      svc.executeWithFallback("search.web", undefined, executeFn),
    ).rejects.toThrow("bad creds");

    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it("explicit provider is used without fallback on success", async () => {
    const svc = makeService();
    const executeFn = vi.fn().mockResolvedValueOnce("ok-from-bing");

    const result = await svc.executeWithFallback(
      "search.web",
      "bing",
      executeFn,
    );

    expect(result).toBe("ok-from-bing");
    expect(executeFn).toHaveBeenCalledWith("bing");
  });

  it("explicit provider fails fast on retryable error (no fallback)", async () => {
    const svc = makeService();
    const retryableErr = Object.assign(new Error("upstream"), { statusCode: 502 });
    const executeFn = vi.fn().mockRejectedValueOnce(retryableErr);

    await expect(
      svc.executeWithFallback("search.web", "bing", executeFn),
    ).rejects.toThrow("upstream");

    // Only tried once — no fallback for explicit provider
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it("explicit provider throws RoutingError when unhealthy", async () => {
    const svc = makeService({ bing: false });
    const executeFn = vi.fn();

    await expect(
      svc.executeWithFallback("search.web", "bing", executeFn),
    ).rejects.toThrow(RoutingError);

    expect(executeFn).not.toHaveBeenCalled();
  });

  it("skips unhealthy providers in fallback chain", async () => {
    const svc = makeService({ brave: false, google: false });
    const executeFn = vi.fn().mockResolvedValueOnce("ok-from-bing");

    const result = await svc.executeWithFallback(
      "search.web",
      undefined,
      executeFn,
    );

    expect(result).toBe("ok-from-bing");
    expect(executeFn).toHaveBeenCalledWith("bing");
  });

  it("does not retry same provider twice", async () => {
    const svc = makeService({}, {
      defaultProvider: () => "brave",
      fallbackOrder: () => ["brave", "google"],
      allowedProviders: () => ["brave", "google"],
    });
    const executeFn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "TIMEOUT" }))
      .mockResolvedValueOnce("ok");

    const result = await svc.executeWithFallback(
      "search.web",
      undefined,
      executeFn,
    );

    expect(result).toBe("ok");
    // brave tried once (default), then google (fallback) — brave not retried
    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(executeFn).toHaveBeenNthCalledWith(1, "brave");
    expect(executeFn).toHaveBeenNthCalledWith(2, "google");
  });
});

/* ------------------------------------------------------------------ */
/*  classifyError                                                     */
/* ------------------------------------------------------------------ */

describe("classifyError", () => {
  it("classifies 401 as auth (non-retryable)", () => {
    const result = classifyError({ statusCode: 401 });
    expect(result.category).toBe("auth");
    expect(result.retryable).toBe(false);
  });

  it("classifies 403 as auth (non-retryable)", () => {
    const result = classifyError({ statusCode: 403 });
    expect(result.category).toBe("auth");
    expect(result.retryable).toBe(false);
  });

  it("classifies 500 as retryable", () => {
    const result = classifyError({ statusCode: 500 });
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies 502 as retryable", () => {
    const result = classifyError({ statusCode: 502 });
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies 429 as retryable", () => {
    const result = classifyError({ statusCode: 429 });
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies TIMEOUT as retryable", () => {
    const result = classifyError({ code: "TIMEOUT" });
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies 400 as invalid_request (non-retryable)", () => {
    const result = classifyError({ statusCode: 400 });
    expect(result.category).toBe("invalid_request");
    expect(result.retryable).toBe(false);
  });

  it("classifies PROJECT_RATE_LIMITED as non-retryable", () => {
    const result = classifyError({ code: "PROJECT_RATE_LIMITED" });
    expect(result.category).toBe("rate_limit_project");
    expect(result.retryable).toBe(false);
  });

  it("classifies unknown errors as non-retryable", () => {
    const result = classifyError(new Error("something"));
    expect(result.category).toBe("unknown");
    expect(result.retryable).toBe(false);
  });

  it("honours ProviderError timeout as retryable", () => {
    const err = new ProviderError({
      message: "request timed out",
      category: "timeout",
      provider: "brave",
    });
    const result = classifyError(err);
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("honours ProviderError bad_credential as auth (non-retryable)", () => {
    const err = new ProviderError({
      message: "invalid api key",
      category: "bad_credential",
      provider: "brave",
      statusCode: 401,
    });
    const result = classifyError(err);
    expect(result.category).toBe("auth");
    expect(result.retryable).toBe(false);
  });

  it("honours ProviderError upstream_5xx as retryable", () => {
    const err = new ProviderError({
      message: "internal server error",
      category: "upstream_5xx",
      provider: "brave",
      statusCode: 500,
    });
    const result = classifyError(err);
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });
});

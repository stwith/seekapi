/**
 * App shell bootstrap tests. [AC1]
 *
 * Verifies the operator console renders the login gate when no
 * admin key is configured, and the shell layout when one is.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { App } from "../app/App.js";

/** Realistic mock responses matching actual API shapes */
const MOCK_RESPONSES: Record<string, unknown> = {
  "/v1/health": { status: "ok" },
  "/admin/projects": [],
  "/admin/stats/dashboard": {
    totalRequests: 0,
    successCount: 0,
    failureCount: 0,
    avgLatencyMs: 0,
  },
  "/admin/stats/timeseries": { series: [] },
  "/admin/stats/capabilities": { capabilities: [] },
  "/admin/stats/providers": { providers: [] },
  "/admin/quotas": { quotas: [] },
};

function findMockResponse(url: string): unknown {
  for (const [key, value] of Object.entries(MOCK_RESPONSES)) {
    if (url.includes(key)) return value;
  }
  return { status: "ok" };
}

describe("App shell [AC1]", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const body = findMockResponse(url);
      return new Response(JSON.stringify(body), { status: 200 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the login gate when no admin key is set", () => {
    render(<App />);
    expect(screen.getByText("SeekAPI")).toBeInTheDocument();
    expect(screen.getByText("Operator Console")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter admin API key")).toBeInTheDocument();
  });

  it("renders the nav sidebar when admin key is stored", async () => {
    sessionStorage.setItem("seekapi_admin_key", "test_key");
    await act(async () => {
      render(<App />);
    });
    const nav = screen.getByTestId("nav-sidebar");
    expect(nav).toBeInTheDocument();
    expect(nav.textContent).toContain("Dashboard");
    expect(nav.textContent).toContain("Projects");
    expect(nav.textContent).toContain("API Keys");
    expect(nav.textContent).toContain("Usage");
    expect(nav.textContent).toContain("Flow Runner");
  });
});

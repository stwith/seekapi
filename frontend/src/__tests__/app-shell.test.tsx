/**
 * App shell bootstrap tests. [AC1]
 *
 * Verifies the operator console renders the login gate when no
 * admin key is configured, and the shell layout when one is.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { App } from "../app/App.js";

describe("App shell [AC1]", () => {
  beforeEach(() => {
    sessionStorage.clear();
    // Mock fetch so Overview's useEffect doesn't fire uncontrolled async updates
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes("/admin/projects")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
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
    expect(nav.textContent).toContain("Overview");
    expect(nav.textContent).toContain("Dashboard");
    expect(nav.textContent).toContain("Projects");
    expect(nav.textContent).toContain("API Keys");
    expect(nav.textContent).toContain("Usage");
    expect(nav.textContent).toContain("Subscriptions");
    expect(nav.textContent).toContain("Flow Runner");
  });
});

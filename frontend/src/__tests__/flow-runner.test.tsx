/**
 * Flow Runner tests. [AC3]
 *
 * Verifies:
 * - 10-step multi-provider workflow UI
 * - per-step success/failure state tracking
 * - HTTP status display for verification steps
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FlowRunner } from "../routes/flow-runner/FlowRunner.js";

vi.mock("../lib/api.js", () => ({
  api: {
    createProject: vi.fn(),
    upsertCredential: vi.fn(),
    configureBinding: vi.fn(),
    createApiKey: vi.fn(),
    disableApiKey: vi.fn(),
    search: vi.fn(),
  },
}));

import { api } from "../lib/api.js";
const mockApi = api as unknown as {
  createProject: ReturnType<typeof vi.fn>;
  upsertCredential: ReturnType<typeof vi.fn>;
  configureBinding: ReturnType<typeof vi.fn>;
  createApiKey: ReturnType<typeof vi.fn>;
  disableApiKey: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
};

describe("FlowRunner [AC3]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("alert", vi.fn());
  });

  it("renders all 10 step labels and provider selector", () => {
    render(
      <MemoryRouter>
        <FlowRunner adminKey="test-key" />
      </MemoryRouter>,
    );

    const table = screen.getByTestId("flow-steps");
    expect(table.textContent).toContain("1. Create Project");
    expect(table.textContent).toContain("3. Enable search.web");
    expect(table.textContent).toContain("4. Mint Key A");
    expect(table.textContent).toContain("10. Verify Key A still succeeds");

    // Default provider "brave" is shown
    expect(screen.getByText("brave")).toBeInTheDocument();
  });

  it("runs full flow successfully and shows all-passed message", async () => {
    mockApi.createProject.mockResolvedValue({ id: "proj-flow", name: "flow-test", status: "active" });
    mockApi.upsertCredential.mockResolvedValue({ id: "cred-1" });
    mockApi.configureBinding.mockResolvedValue({ status: "configured" });
    mockApi.createApiKey
      .mockResolvedValueOnce({ id: "key-a", projectId: "proj-flow", rawKey: "sk_aaa" })
      .mockResolvedValueOnce({ id: "key-b", projectId: "proj-flow", rawKey: "sk_bbb" });
    mockApi.disableApiKey.mockResolvedValue({ status: "disabled" });
    mockApi.search
      .mockResolvedValueOnce({ status: 200, body: { results: [] } })
      .mockResolvedValueOnce({ status: 200, body: { results: [] } })
      .mockResolvedValueOnce({ status: 401, body: null })
      .mockResolvedValueOnce({ status: 200, body: { results: [] } });

    render(
      <MemoryRouter>
        <FlowRunner adminKey="test-key" />
      </MemoryRouter>,
    );

    // Enter API secret — find by id since placeholder has i18n interpolation
    const secretInput = document.getElementById("api-secret") as HTMLInputElement;
    fireEvent.change(secretInput, { target: { value: "BSA_test" } });

    // Run flow
    fireEvent.click(screen.getByText("Run Flow"));

    await waitFor(
      () => {
        expect(screen.getByTestId("flow-success")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Verify provider passed correctly
    expect(mockApi.upsertCredential).toHaveBeenCalledWith("test-key", "proj-flow", "brave", "BSA_test");
    expect(mockApi.configureBinding).toHaveBeenCalledWith("test-key", "proj-flow", {
      provider: "brave", capability: "search.web", enabled: true, priority: 0,
    });
    expect(mockApi.createApiKey).toHaveBeenCalledTimes(2);
    expect(mockApi.search).toHaveBeenCalledTimes(4);
  });

  it("shows failure when search step returns unexpected status", async () => {
    mockApi.createProject.mockResolvedValue({ id: "proj-flow", name: "flow-test", status: "active" });
    mockApi.upsertCredential.mockResolvedValue({ id: "cred-1" });
    mockApi.configureBinding.mockResolvedValue({ status: "configured" });
    mockApi.createApiKey
      .mockResolvedValueOnce({ id: "key-a", projectId: "proj-flow", rawKey: "sk_aaa" })
      .mockResolvedValueOnce({ id: "key-b", projectId: "proj-flow", rawKey: "sk_bbb" });
    mockApi.search.mockResolvedValueOnce({ status: 500, body: { error: "Internal Server Error" } });

    render(
      <MemoryRouter>
        <FlowRunner adminKey="test-key" />
      </MemoryRouter>,
    );

    const secretInput = document.getElementById("api-secret") as HTMLInputElement;
    fireEvent.change(secretInput, { target: { value: "BSA_test" } });
    fireEvent.click(screen.getByText("Run Flow"));

    await waitFor(
      () => {
        const table = screen.getByTestId("flow-steps");
        expect(table.textContent).toContain("failure");
        expect(table.textContent).toContain("HTTP 500");
      },
      { timeout: 5000 },
    );
  });

  it("shows correct HTTP status for verification steps", async () => {
    mockApi.createProject.mockResolvedValue({ id: "proj-flow", name: "flow-test", status: "active" });
    mockApi.upsertCredential.mockResolvedValue({ id: "cred-1" });
    mockApi.configureBinding.mockResolvedValue({ status: "configured" });
    mockApi.createApiKey
      .mockResolvedValueOnce({ id: "key-a", projectId: "proj-flow", rawKey: "sk_aaa" })
      .mockResolvedValueOnce({ id: "key-b", projectId: "proj-flow", rawKey: "sk_bbb" });
    mockApi.disableApiKey.mockResolvedValue({ status: "disabled" });
    mockApi.search
      .mockResolvedValueOnce({ status: 200, body: {} })
      .mockResolvedValueOnce({ status: 200, body: {} })
      .mockResolvedValueOnce({ status: 401, body: null })
      .mockResolvedValueOnce({ status: 200, body: {} });

    render(
      <MemoryRouter>
        <FlowRunner adminKey="test-key" />
      </MemoryRouter>,
    );

    const secretInput = document.getElementById("api-secret") as HTMLInputElement;
    fireEvent.change(secretInput, { target: { value: "BSA_test" } });
    fireEvent.click(screen.getByText("Run Flow"));

    await waitFor(
      () => {
        const table = screen.getByTestId("flow-steps");
        expect(table.textContent).toContain("HTTP 401 (expected)");
        expect(table.textContent).toContain("HTTP 200");
      },
      { timeout: 5000 },
    );
  });
});

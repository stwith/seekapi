/**
 * Flow Runner tests. [AC3]
 *
 * Verifies:
 * - 10-step Phase 2.5 workflow UI
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

  it("renders all 10 step labels", () => {
    render(
      <MemoryRouter>
        <FlowRunner adminKey="test-key" />
      </MemoryRouter>,
    );

    const table = screen.getByTestId("flow-steps");
    expect(table.textContent).toContain("1. Create Project");
    expect(table.textContent).toContain("2. Attach Brave Credential");
    expect(table.textContent).toContain("3. Enable search.web");
    expect(table.textContent).toContain("4. Mint Key A");
    expect(table.textContent).toContain("5. Mint Key B");
    expect(table.textContent).toContain("6. Search with Key A");
    expect(table.textContent).toContain("7. Search with Key B");
    expect(table.textContent).toContain("8. Disable Key B");
    expect(table.textContent).toContain("9. Verify Key B gets 401");
    expect(table.textContent).toContain("10. Verify Key A still succeeds");
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
      .mockResolvedValueOnce({ status: 200, body: { results: [] } })  // Key A search
      .mockResolvedValueOnce({ status: 200, body: { results: [] } })  // Key B search
      .mockResolvedValueOnce({ status: 401, body: null })             // Key B verify (disabled)
      .mockResolvedValueOnce({ status: 200, body: { results: [] } }); // Key A verify

    render(
      <MemoryRouter>
        <FlowRunner adminKey="test-key" />
      </MemoryRouter>,
    );

    // Enter brave secret
    const secretInput = screen.getByPlaceholderText("Brave API Secret");
    fireEvent.change(secretInput, { target: { value: "BSA_test" } });

    // Run flow
    fireEvent.click(screen.getByText("Run Flow"));

    await waitFor(
      () => {
        expect(screen.getByTestId("flow-success")).toBeInTheDocument();
        expect(screen.getByTestId("flow-success").textContent).toContain("All 10 steps passed");
      },
      { timeout: 5000 },
    );

    // Verify all steps were called
    expect(mockApi.createProject).toHaveBeenCalledTimes(1);
    expect(mockApi.upsertCredential).toHaveBeenCalledTimes(1);
    expect(mockApi.configureBinding).toHaveBeenCalledTimes(1);
    expect(mockApi.createApiKey).toHaveBeenCalledTimes(2);
    expect(mockApi.disableApiKey).toHaveBeenCalledWith("test-key", "key-b");
    expect(mockApi.search).toHaveBeenCalledTimes(4);
  });

  it("shows failure when search step returns unexpected status", async () => {
    mockApi.createProject.mockResolvedValue({ id: "proj-flow", name: "flow-test", status: "active" });
    mockApi.upsertCredential.mockResolvedValue({ id: "cred-1" });
    mockApi.configureBinding.mockResolvedValue({ status: "configured" });
    mockApi.createApiKey
      .mockResolvedValueOnce({ id: "key-a", projectId: "proj-flow", rawKey: "sk_aaa" })
      .mockResolvedValueOnce({ id: "key-b", projectId: "proj-flow", rawKey: "sk_bbb" });
    // Search with Key A fails with 500
    mockApi.search.mockResolvedValueOnce({ status: 500, body: { error: "Internal Server Error" } });

    render(
      <MemoryRouter>
        <FlowRunner adminKey="test-key" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Brave API Secret"), { target: { value: "BSA_test" } });
    fireEvent.click(screen.getByText("Run Flow"));

    await waitFor(
      () => {
        const table = screen.getByTestId("flow-steps");
        // Step 6 should show failure with HTTP 500
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

    fireEvent.change(screen.getByPlaceholderText("Brave API Secret"), { target: { value: "BSA_test" } });
    fireEvent.click(screen.getByText("Run Flow"));

    await waitFor(
      () => {
        const table = screen.getByTestId("flow-steps");
        // Step 9: Key B should show 401 (expected)
        expect(table.textContent).toContain("HTTP 401 (expected)");
        // Step 10: Key A should show HTTP 200
        expect(table.textContent).toContain("HTTP 200");
      },
      { timeout: 5000 },
    );
  });
});

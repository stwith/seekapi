/**
 * AC8 — Providers page shows credential-level usage and capacity.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProvidersPage } from "../routes/providers/ProvidersPage.js";

vi.mock("../lib/api.js", () => ({
  api: {
    listProviders: vi.fn(),
    listGlobalCredentials: vi.fn(),
    getCredentialUsage: vi.fn(),
    getCredentialCapacity: vi.fn(),
  },
}));

import { api } from "../lib/api.js";
const mockApi = api as unknown as {
  listProviders: ReturnType<typeof vi.fn>;
  listGlobalCredentials: ReturnType<typeof vi.fn>;
  getCredentialUsage: ReturnType<typeof vi.fn>;
  getCredentialCapacity: ReturnType<typeof vi.fn>;
};

describe("AC8 — Credential usage display on Providers page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows usage data for each credential", async () => {
    mockApi.listProviders.mockResolvedValue({
      providers: [{ id: "brave", capabilities: ["search.web"] }],
    });
    mockApi.listGlobalCredentials.mockResolvedValue({
      credentials: [
        { id: "cred-1", name: "Brave Key 1", provider: "brave", status: "active" },
      ],
    });
    mockApi.getCredentialUsage.mockResolvedValue({
      credentialId: "cred-1",
      totalRequests: 42,
      dailyRequests: 10,
      monthlyRequests: 42,
    });
    mockApi.getCredentialCapacity.mockRejectedValue(new Error("not found"));

    render(
      <MemoryRouter>
        <ProvidersPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Brave Key 1/)).toBeInTheDocument();
    });

    // Usage data should be displayed
    await waitFor(() => {
      expect(screen.getByText(/10/)).toBeInTheDocument();
      expect(screen.getByText(/42/)).toBeInTheDocument();
    });
  });

  it("shows capacity data when available", async () => {
    mockApi.listProviders.mockResolvedValue({
      providers: [{ id: "brave", capabilities: ["search.web"] }],
    });
    mockApi.listGlobalCredentials.mockResolvedValue({
      credentials: [
        { id: "cred-2", name: "Brave Key 2", provider: "brave", status: "active" },
      ],
    });
    mockApi.getCredentialUsage.mockResolvedValue({
      credentialId: "cred-2",
      totalRequests: 50,
      dailyRequests: 15,
      monthlyRequests: 50,
    });
    mockApi.getCredentialCapacity.mockResolvedValue({
      credentialId: "cred-2",
      dailyLimit: 100,
      monthlyLimit: 1000,
      currentDailyUsage: 15,
      currentMonthlyUsage: 50,
    });

    render(
      <MemoryRouter>
        <ProvidersPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Brave Key 2/)).toBeInTheDocument();
    });

    // Capacity display: "15 / 100" and "50 / 1000"
    await waitFor(() => {
      expect(screen.getByText(/15 \/ 100/)).toBeInTheDocument();
      expect(screen.getByText(/50 \/ 1000/)).toBeInTheDocument();
    });
  });
});

/**
 * Tests for new pages: Dashboard, KeysPage, UsagePage, SubscriptionsPage.
 * [Task 35][Task 36][Task 37][Task 38]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "../routes/dashboard/Dashboard.js";
import { KeysPage } from "../routes/keys/KeysPage.js";
import { UsagePage } from "../routes/usage/UsagePage.js";
import { SubscriptionsPage } from "../routes/subscriptions/SubscriptionsPage.js";

vi.mock("../lib/api.js", () => ({
  api: {
    getDashboardStats: vi.fn(),
    getTimeSeries: vi.fn(),
    getCapabilityBreakdown: vi.fn(),
    listProjects: vi.fn(),
    getPerKeyStats: vi.fn(),
    listProjectKeys: vi.fn(),
    createApiKey: vi.fn(),
    disableApiKey: vi.fn(),
    queryUsageEvents: vi.fn(),
    listQuotas: vi.fn(),
    updateProjectQuota: vi.fn(),
  },
}));

import { api } from "../lib/api.js";
const mockApi = vi.mocked(api);

describe("Dashboard [Task 35]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProjects.mockResolvedValue([
      { id: "proj-1", name: "Project One", status: "active" },
    ]);
    mockApi.listProjectKeys.mockResolvedValue([
      { id: "key-1", projectId: "proj-1", status: "active" },
      { id: "key-2", projectId: "proj-1", status: "disabled" },
    ]);
  });

  it("renders stat cards with data including active keys", async () => {
    mockApi.getDashboardStats.mockResolvedValue({
      totalRequests: 100,
      successCount: 95,
      failureCount: 5,
      avgLatencyMs: 150,
    });
    mockApi.getTimeSeries.mockResolvedValue({ series: [] });
    mockApi.getCapabilityBreakdown.mockResolvedValue({ capabilities: [] });

    render(
      <MemoryRouter>
        <Dashboard adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const cards = screen.getByTestId("stats-cards");
      expect(cards.textContent).toContain("100");
      expect(cards.textContent).toContain("95.0%");
      expect(cards.textContent).toContain("5");
      expect(cards.textContent).toContain("150ms");
      // Active Keys card (1 active out of 2)
      expect(cards.textContent).toContain("Active Keys");
    });
  });

  it("has project-scoped filter", async () => {
    mockApi.getDashboardStats.mockResolvedValue({
      totalRequests: 10,
      successCount: 10,
      failureCount: 0,
      avgLatencyMs: 50,
    });
    mockApi.getTimeSeries.mockResolvedValue({ series: [] });
    mockApi.getCapabilityBreakdown.mockResolvedValue({ capabilities: [] });

    render(
      <MemoryRouter>
        <Dashboard adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("project-filter")).toBeInTheDocument();
      expect(screen.getByDisplayValue("All projects")).toBeInTheDocument();
    });
  });

  it("renders time series and capability breakdown", async () => {
    mockApi.getDashboardStats.mockResolvedValue({
      totalRequests: 10,
      successCount: 10,
      failureCount: 0,
      avgLatencyMs: 50,
    });
    mockApi.getTimeSeries.mockResolvedValue({
      series: [{ bucket: "2026-03-21T10:00:00Z", count: 5, successCount: 5, failureCount: 0 }],
    });
    mockApi.getCapabilityBreakdown.mockResolvedValue({
      capabilities: [{ capability: "search.web", count: 10 }],
    });

    render(
      <MemoryRouter>
        <Dashboard adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("time-series")).toBeInTheDocument();
      expect(screen.getByTestId("capability-breakdown")).toBeInTheDocument();
      // search.web appears in both project filter option and capability breakdown
      expect(screen.getByText("search.web")).toBeInTheDocument();
    });
  });
});

describe("KeysPage [Task 36]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders keys with lifecycle controls", async () => {
    mockApi.listProjects.mockResolvedValue([
      { id: "proj-1", name: "Project One", status: "active" },
    ]);
    mockApi.listProjectKeys.mockResolvedValue([
      { id: "key-1", projectId: "proj-1", status: "active", createdAt: "2026-03-20T12:00:00Z", lastUsedAt: "2026-03-21T08:00:00Z" },
    ]);

    render(
      <MemoryRouter>
        <KeysPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("key-1")).toBeInTheDocument();
      // "Project One" appears in both the mint dropdown and the table
      expect(screen.getAllByText("Project One").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Disable")).toBeInTheDocument();
      expect(screen.getByTestId("mint-section")).toBeInTheDocument();
    });
  });

  it("shows empty state when no keys", async () => {
    mockApi.listProjects.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <KeysPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
  });

  it("mints a new key with reveal-once display", async () => {
    mockApi.listProjects.mockResolvedValue([
      { id: "proj-1", name: "Project One", status: "active" },
    ]);
    mockApi.listProjectKeys.mockResolvedValue([]);
    mockApi.createApiKey.mockResolvedValue({
      id: "key-new",
      projectId: "proj-1",
      rawKey: "sk_testapikey123",
    });

    render(
      <MemoryRouter>
        <KeysPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mint-section")).toBeInTheDocument();
    });

    // Select project and mint
    fireEvent.change(screen.getByDisplayValue("Select project..."), { target: { value: "proj-1" } });
    fireEvent.click(screen.getByText("Mint New Key"));

    await waitFor(() => {
      expect(screen.getByTestId("revealed-key")).toBeInTheDocument();
      expect(screen.getByText("sk_testapikey123")).toBeInTheDocument();
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });
  });
});

describe("UsagePage [Task 37]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProjects.mockResolvedValue([]);
  });

  it("renders paginated usage events with timestamp and fallback columns", async () => {
    mockApi.queryUsageEvents.mockResolvedValue({
      items: [
        {
          requestId: "req-001",
          projectId: "proj-1",
          apiKeyId: "key-1",
          provider: "brave",
          capability: "search.web",
          statusCode: 200,
          success: true,
          latencyMs: 100,
          resultCount: 10,
          fallbackCount: 2,
          createdAt: "2026-03-21T10:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });

    render(
      <MemoryRouter>
        <UsagePage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("data-table")).toBeInTheDocument();
      expect(screen.getByText("brave")).toBeInTheDocument();
      expect(screen.getByText("100ms")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument(); // fallback count
      expect(screen.getByTestId("pagination")).toBeInTheDocument();
      expect(screen.getByTestId("csv-export")).toBeInTheDocument();
    });
  });

  it("shows empty state with no matching records", async () => {
    mockApi.queryUsageEvents.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });

    render(
      <MemoryRouter>
        <UsagePage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
  });

  it("has project, key, capability, status, and date range filters", async () => {
    mockApi.listProjects.mockResolvedValue([
      { id: "proj-1", name: "Project One", status: "active" },
    ]);
    mockApi.queryUsageEvents.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });

    render(
      <MemoryRouter>
        <UsagePage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Project filter
      expect(screen.getByDisplayValue("All projects")).toBeInTheDocument();
      // Capability filter
      expect(screen.getByDisplayValue("All capabilities")).toBeInTheDocument();
      // Status filter
      expect(screen.getByDisplayValue("All statuses")).toBeInTheDocument();
      // API Key ID filter
      expect(screen.getByPlaceholderText("API Key ID")).toBeInTheDocument();
      // Date range picker
      expect(screen.getByTestId("date-range-picker")).toBeInTheDocument();
    });
  });
});

describe("SubscriptionsPage [Task 38]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProjects.mockResolvedValue([
      { id: "proj-1", name: "Project One", status: "active" },
    ]);
    mockApi.listProjectKeys.mockResolvedValue([
      { id: "key-1", projectId: "proj-1", status: "active" },
      { id: "key-2", projectId: "proj-1", status: "active" },
    ]);
  });

  it("renders quota cards with project name and key count", async () => {
    mockApi.listQuotas.mockResolvedValue({
      quotas: [
        {
          id: "q1",
          projectId: "proj-1",
          dailyRequestLimit: 1000,
          monthlyRequestLimit: 10000,
          maxKeys: 5,
          rateLimitRpm: 60,
          status: "active",
          currentDailyUsage: 500,
          currentMonthlyUsage: 3000,
        },
      ],
    });

    render(
      <MemoryRouter>
        <SubscriptionsPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const card = screen.getByTestId("quota-card");
      expect(card).toBeInTheDocument();
      // Should show project name, not truncated ID
      expect(card.textContent).toContain("Project One");
      // Key count vs max
      expect(card.textContent).toContain("Keys: 2 / 5");
      expect(card.textContent).toContain("500");
      expect(card.textContent).toContain("1000");
      // Suspend/Activate button
      expect(screen.getByTestId("toggle-status")).toBeInTheDocument();
      expect(screen.getByText("Suspend")).toBeInTheDocument();
    });
  });

  it("opens edit modal on click", async () => {
    mockApi.listQuotas.mockResolvedValue({
      quotas: [
        {
          id: "q1",
          projectId: "proj-1",
          dailyRequestLimit: 1000,
          monthlyRequestLimit: null,
          maxKeys: 10,
          rateLimitRpm: 60,
          status: "active",
          currentDailyUsage: 0,
          currentMonthlyUsage: 0,
        },
      ],
    });

    render(
      <MemoryRouter>
        <SubscriptionsPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Quota")).toBeInTheDocument();
    });

    // Click "Edit Quota" button on card
    fireEvent.click(screen.getByText("Edit Quota"));

    await waitFor(() => {
      // Modal should appear with "Save Changes" button
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });
  });

  it("shows empty state with no quotas", async () => {
    mockApi.listQuotas.mockResolvedValue({ quotas: [] });

    render(
      <MemoryRouter>
        <SubscriptionsPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
  });
});

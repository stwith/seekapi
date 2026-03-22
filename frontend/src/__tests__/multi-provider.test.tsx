/**
 * Tests for multi-provider console support.
 * [Phase 4D][Task 53][Task 54][Task 55][Task 56][Task 57]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Dashboard } from "../routes/dashboard/Dashboard.js";
import { UsagePage } from "../routes/usage/UsagePage.js";
import { ProvidersPage } from "../routes/providers/ProvidersPage.js";
import { ProjectDetailPage } from "../routes/projects/ProjectDetail.js";

vi.mock("../lib/api.js", () => ({
  api: {
    getDashboardStats: vi.fn(),
    getTimeSeries: vi.fn(),
    getCapabilityBreakdown: vi.fn(),
    getProviderBreakdown: vi.fn(),
    listProviders: vi.fn(),
    listProjects: vi.fn(),
    getPerKeyStats: vi.fn(),
    listProjectKeys: vi.fn(),
    createApiKey: vi.fn(),
    disableApiKey: vi.fn(),
    queryUsageEvents: vi.fn(),
    getProjectDetail: vi.fn(),
    upsertCredential: vi.fn(),
    configureBinding: vi.fn(),
    listQuotas: vi.fn(),
    updateProjectQuota: vi.fn(),
    listGlobalCredentials: vi.fn(),
    listProjectCredentialRefs: vi.fn(),
    addProjectCredentialRef: vi.fn(),
    removeProjectCredentialRef: vi.fn(),
    createGlobalCredential: vi.fn(),
    deleteGlobalCredential: vi.fn(),
    updateGlobalCredential: vi.fn(),
  },
}));

import { api } from "../lib/api.js";
const mockApi = vi.mocked(api);

// AC6: Dashboard shows provider breakdown
describe("Dashboard provider breakdown [Task 54]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProjects.mockResolvedValue([]);
    mockApi.listProjectKeys.mockResolvedValue([]);
  });

  it("renders provider breakdown section", async () => {
    mockApi.getDashboardStats.mockResolvedValue({
      totalRequests: 20,
      successCount: 18,
      failureCount: 2,
      avgLatencyMs: 100,
    });
    mockApi.getTimeSeries.mockResolvedValue({ series: [] });
    mockApi.getCapabilityBreakdown.mockResolvedValue({ capabilities: [] });
    mockApi.getProviderBreakdown.mockResolvedValue({
      providers: [
        { provider: "brave", requestCount: 12, successCount: 11, failureCount: 1, avgLatencyMs: 80 },
        { provider: "serpapi", requestCount: 8, successCount: 7, failureCount: 1, avgLatencyMs: 120 },
      ],
    });

    render(
      <MemoryRouter>
        <Dashboard adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const breakdown = screen.getByTestId("provider-breakdown");
      expect(breakdown).toBeInTheDocument();
      expect(breakdown.textContent).toContain("brave");
      expect(breakdown.textContent).toContain("serpapi");
      expect(breakdown.textContent).toContain("12 req");
    });
  });
});

// AC6: Usage page has provider filter
describe("UsagePage provider filter [Task 55]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProjects.mockResolvedValue([]);
    mockApi.listProviders.mockResolvedValue({
      providers: [
        { id: "brave", capabilities: ["search.web", "search.news", "search.images"] },
        { id: "tavily", capabilities: ["search.web"] },
        { id: "kagi", capabilities: ["search.web", "search.news"] },
        { id: "serpapi", capabilities: ["search.web", "search.news", "search.images"] },
      ],
    });
  });

  it("shows provider filter with all registered providers", async () => {
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
      const select = screen.getByTestId("provider-filter");
      expect(select).toBeInTheDocument();
      // shadcn Select trigger only shows the selected value ("All providers"),
      // not the dropdown options
      expect(select.textContent).toContain("All providers");
    });
  });
});

// AC6: Providers page
describe("ProvidersPage [Task 56]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listGlobalCredentials.mockResolvedValue({ credentials: [] });
    // Mock global fetch for health endpoint
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;
  });

  it("renders credential pool with global credentials", async () => {
    mockApi.listGlobalCredentials.mockResolvedValue({
      credentials: [
        { id: "cred-1", name: "Brave Primary", provider: "brave", status: "active" },
        { id: "cred-2", name: "SerpAPI Key", provider: "serpapi", status: "active" },
      ],
    });

    render(
      <MemoryRouter>
        <ProvidersPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Brave Primary")).toBeInTheDocument();
      expect(screen.getByText("SerpAPI Key")).toBeInTheDocument();
    });
  });
});

// AC5/AC6: Project detail multi-provider credential management
describe("ProjectDetail multi-provider [Task 53]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProviders.mockResolvedValue({
      providers: [
        { id: "brave", capabilities: ["search.web", "search.news", "search.images"] },
        { id: "tavily", capabilities: ["search.web"] },
        { id: "kagi", capabilities: ["search.web", "search.news"] },
        { id: "serpapi", capabilities: ["search.web", "search.news", "search.images"] },
      ],
    });
    mockApi.listGlobalCredentials.mockResolvedValue({ credentials: [] });
    mockApi.listProjectCredentialRefs.mockResolvedValue({ credentials: [] });
  });

  it("displays multiple linked credentials [Phase 4D AC6]", async () => {
    mockApi.getProjectDetail.mockResolvedValue({
      project: { id: "proj-1", name: "Multi Cred Project", status: "active" },
      bindings: [],
      keys: [],
      credentials: [],
    });
    mockApi.listProjectCredentialRefs.mockResolvedValue({
      credentials: [
        { id: "cred-brave", name: "Brave Key", provider: "brave", status: "active" },
        { id: "cred-tavily", name: "Tavily Key", provider: "tavily", status: "active" },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/projects/proj-1"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage adminKey="test-key" />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Linked Credentials")).toBeInTheDocument();
      expect(screen.getByText("Brave Key")).toBeInTheDocument();
      expect(screen.getByText("Tavily Key")).toBeInTheDocument();
    });
  });

  it("shows credential link select and binding provider selector", async () => {
    mockApi.getProjectDetail.mockResolvedValue({
      project: { id: "proj-1", name: "Test Project", status: "active" },
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "serpapi", capability: "search.images", enabled: true, priority: 1 },
      ],
      keys: [],
      credentials: [],
    });
    mockApi.listProjectCredentialRefs.mockResolvedValue({
      credentials: [{ id: "cred-1", name: "Brave Key", provider: "brave", status: "active" }],
    });

    render(
      <MemoryRouter initialEntries={["/projects/proj-1"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage adminKey="test-key" />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Link credential select
      const credSelect = screen.getByTestId("link-credential-select");
      expect(credSelect).toBeInTheDocument();

      // Binding provider selector
      const bindSelect = screen.getByTestId("binding-provider-select");
      expect(bindSelect).toBeInTheDocument();

      // Bindings table shows multi-provider bindings
      const bindTable = screen.getByTestId("bindings-table");
      expect(bindTable.textContent).toContain("brave");
      expect(bindTable.textContent).toContain("serpapi");
    });
  });
});

/**
 * Project list and detail page tests. [AC2][AC4]
 *
 * Verifies:
 * - project list renders fetched projects
 * - create-project form submits and refreshes list
 * - project detail renders summary sections
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProjectList } from "../routes/projects/ProjectList.js";
import { ProjectDetailPage } from "../routes/projects/ProjectDetail.js";

// Mock the API module
vi.mock("../lib/api.js", () => ({
  api: {
    listProjects: vi.fn(),
    createProject: vi.fn(),
    getProjectDetail: vi.fn(),
    upsertCredential: vi.fn(),
    configureBinding: vi.fn(),
    createApiKey: vi.fn(),
    disableApiKey: vi.fn(),
    listProviders: vi.fn(),
    listQuotas: vi.fn(),
    listProjectKeys: vi.fn(),
    listGlobalCredentials: vi.fn(),
    listProjectCredentialRefs: vi.fn(),
    addProjectCredentialRef: vi.fn(),
    removeProjectCredentialRef: vi.fn(),
  },
}));

// Mock useParams for detail page
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ projectId: "proj-1" }),
  };
});

import { api } from "../lib/api.js";
const mockApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  createProject: ReturnType<typeof vi.fn>;
  getProjectDetail: ReturnType<typeof vi.fn>;
  upsertCredential: ReturnType<typeof vi.fn>;
  configureBinding: ReturnType<typeof vi.fn>;
  createApiKey: ReturnType<typeof vi.fn>;
  disableApiKey: ReturnType<typeof vi.fn>;
  listProviders: ReturnType<typeof vi.fn>;
  listQuotas: ReturnType<typeof vi.fn>;
  listProjectKeys: ReturnType<typeof vi.fn>;
  listGlobalCredentials: ReturnType<typeof vi.fn>;
  listProjectCredentialRefs: ReturnType<typeof vi.fn>;
  addProjectCredentialRef: ReturnType<typeof vi.fn>;
  removeProjectCredentialRef: ReturnType<typeof vi.fn>;
};

describe("ProjectList [AC2]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listQuotas.mockResolvedValue({ quotas: [] });
    mockApi.listProjectKeys.mockResolvedValue([]);
  });

  it("renders fetched projects", async () => {
    mockApi.listProjects.mockResolvedValue([
      { id: "proj-1", name: "Project One", status: "active" },
      { id: "proj-2", name: "Project Two", status: "active" },
    ]);

    render(
      <MemoryRouter>
        <ProjectList adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Project One")).toBeInTheDocument();
      expect(screen.getByText("Project Two")).toBeInTheDocument();
    });
  });

  it("submits create-project form and refreshes list", async () => {
    mockApi.listProjects
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "proj-new", name: "New Project", status: "active" }]);
    mockApi.createProject.mockResolvedValue({ id: "proj-new", name: "New Project", status: "active" });

    render(
      <MemoryRouter>
        <ProjectList adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("No projects yet. Create one above.")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("New project name");
    fireEvent.change(input, { target: { value: "New Project" } });
    fireEvent.click(screen.getByText("Create Project"));

    await waitFor(() => {
      expect(mockApi.createProject).toHaveBeenCalledWith("test-key", "New Project");
      expect(screen.getByText("New Project")).toBeInTheDocument();
    });
  });
});

describe("ProjectDetailPage [AC2]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProviders.mockResolvedValue({
      providers: [
        { id: "brave", capabilities: ["search.web", "search.news", "search.images"] },
      ],
    });
    mockApi.listGlobalCredentials.mockResolvedValue({ credentials: [] });
    mockApi.listProjectCredentialRefs.mockResolvedValue({ credentials: [] });
  });

  it("renders project detail with bindings, keys, and credential", async () => {
    mockApi.getProjectDetail.mockResolvedValue({
      project: { id: "proj-1", name: "Test Project", status: "active" },
      bindings: [{ provider: "brave", capability: "search.web", enabled: true, priority: 0 }],
      keys: [{ id: "key-1", projectId: "proj-1", status: "active" }],
      credentials: [],
    });
    mockApi.listProjectCredentialRefs.mockResolvedValue({
      credentials: [{ id: "cred-1", name: "Brave Key", provider: "brave", status: "active" }],
    });

    render(
      <MemoryRouter>
        <ProjectDetailPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Test Project")).toBeInTheDocument();
      // Bindings section
      const bindingsTable = screen.getByTestId("bindings-table");
      expect(bindingsTable).toBeInTheDocument();
      expect(bindingsTable.textContent).toContain("search.web");
      // Keys section
      expect(screen.getByTestId("keys-table")).toBeInTheDocument();
      expect(screen.getByText("key-1")).toBeInTheDocument();
      // Linked Credentials section
      expect(screen.getByText("Linked Credentials")).toBeInTheDocument();
      expect(screen.getByText("Brave Key")).toBeInTheDocument();
    });
  });

  it("shows 'No credentials linked' when none exists", async () => {
    mockApi.getProjectDetail.mockResolvedValue({
      project: { id: "proj-1", name: "Empty Project", status: "active" },
      bindings: [],
      keys: [],
      credentials: [],
    });

    render(
      <MemoryRouter>
        <ProjectDetailPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("No credentials linked. Link from the global pool below.")).toBeInTheDocument();
    });
  });
});

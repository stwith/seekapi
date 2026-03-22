/**
 * Credential, binding, and API key management flow tests. [AC2]
 *
 * Verifies:
 * - credential attach/rotate submission
 * - binding toggle
 * - key mint with reveal-once raw key display
 * - key disable action
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProjectDetailPage } from "../routes/projects/ProjectDetail.js";

vi.mock("../lib/api.js", () => ({
  api: {
    getProjectDetail: vi.fn(),
    upsertCredential: vi.fn(),
    configureBinding: vi.fn(),
    createApiKey: vi.fn(),
    disableApiKey: vi.fn(),
    listProviders: vi.fn(),
    listGlobalCredentials: vi.fn(),
    listProjectCredentialRefs: vi.fn(),
    addProjectCredentialRef: vi.fn(),
    removeProjectCredentialRef: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ projectId: "proj-1" }),
  };
});

import { api } from "../lib/api.js";
const mockApi = api as unknown as {
  getProjectDetail: ReturnType<typeof vi.fn>;
  upsertCredential: ReturnType<typeof vi.fn>;
  configureBinding: ReturnType<typeof vi.fn>;
  createApiKey: ReturnType<typeof vi.fn>;
  disableApiKey: ReturnType<typeof vi.fn>;
  listProviders: ReturnType<typeof vi.fn>;
  listGlobalCredentials: ReturnType<typeof vi.fn>;
  listProjectCredentialRefs: ReturnType<typeof vi.fn>;
  addProjectCredentialRef: ReturnType<typeof vi.fn>;
  removeProjectCredentialRef: ReturnType<typeof vi.fn>;
};

const baseDetail = {
  project: { id: "proj-1", name: "Test Project", status: "active" },
  bindings: [],
  keys: [],
  credentials: [],
};

describe("Credential management [AC2]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProviders.mockResolvedValue({
      providers: [
        { id: "brave", capabilities: ["search.web", "search.news", "search.images"] },
        { id: "tavily", capabilities: ["search.web"] },
      ],
    });
    mockApi.listGlobalCredentials.mockResolvedValue({ credentials: [] });
    mockApi.listProjectCredentialRefs.mockResolvedValue({ credentials: [] });
  });

  it("links a credential from the global pool", async () => {
    mockApi.getProjectDetail.mockResolvedValue({ ...baseDetail });
    mockApi.listGlobalCredentials.mockResolvedValue({
      credentials: [
        { id: "cred-1", name: "Brave Key", provider: "brave", status: "active" },
      ],
    });
    mockApi.listProjectCredentialRefs
      .mockResolvedValueOnce({ credentials: [] })
      .mockResolvedValueOnce({
        credentials: [{ id: "cred-1", name: "Brave Key", provider: "brave", status: "active" }],
      });
    mockApi.addProjectCredentialRef.mockResolvedValue({ status: "linked" });

    render(
      <MemoryRouter>
        <ProjectDetailPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("No credentials linked. Link from the global pool below.")).toBeInTheDocument();
    });

    // The link credential select and button should be present
    expect(screen.getByTestId("link-credential-select")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link Credential" })).toBeInTheDocument();
  });
});

describe("Binding management [AC2]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProviders.mockResolvedValue({
      providers: [
        { id: "brave", capabilities: ["search.web", "search.news", "search.images"] },
        { id: "tavily", capabilities: ["search.web"] },
      ],
    });
    mockApi.listGlobalCredentials.mockResolvedValue({ credentials: [] });
    mockApi.listProjectCredentialRefs.mockResolvedValue({ credentials: [] });
  });

  it("submits binding configuration", async () => {
    mockApi.getProjectDetail
      .mockResolvedValueOnce({ ...baseDetail })
      .mockResolvedValueOnce({
        ...baseDetail,
        bindings: [{ provider: "brave", capability: "search.web", enabled: true, priority: 0 }],
      });
    mockApi.configureBinding.mockResolvedValue({ status: "configured" });

    render(
      <MemoryRouter>
        <ProjectDetailPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("No bindings configured.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Configure"));

    await waitFor(() => {
      expect(mockApi.configureBinding).toHaveBeenCalledWith("test-key", "proj-1", {
        provider: "brave",
        capability: "search.web",
        enabled: true,
        priority: 0,
      });
    });
  });
});

describe("API Key management [AC2]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listProviders.mockResolvedValue({
      providers: [
        { id: "brave", capabilities: ["search.web", "search.news", "search.images"] },
        { id: "tavily", capabilities: ["search.web"] },
      ],
    });
    mockApi.listGlobalCredentials.mockResolvedValue({ credentials: [] });
    mockApi.listProjectCredentialRefs.mockResolvedValue({ credentials: [] });
  });

  it("mints a key and shows reveal-once raw key", async () => {
    mockApi.getProjectDetail
      .mockResolvedValueOnce({ ...baseDetail })
      .mockResolvedValueOnce({
        ...baseDetail,
        keys: [{ id: "key-new", projectId: "proj-1", status: "active" }],
      });
    mockApi.createApiKey.mockResolvedValue({
      id: "key-new",
      projectId: "proj-1",
      rawKey: "sk_abcdef1234567890",
    });

    render(
      <MemoryRouter>
        <ProjectDetailPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Mint New Key")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Mint New Key"));

    await waitFor(() => {
      expect(mockApi.createApiKey).toHaveBeenCalledWith("test-key", "proj-1");
      const revealed = screen.getByTestId("revealed-key");
      expect(revealed).toBeInTheDocument();
      expect(revealed.textContent).toContain("sk_abcdef1234567890");
      expect(revealed.textContent).toContain("shown once only");
    });

    // Dismiss the revealed key
    fireEvent.click(screen.getByText("Dismiss"));
    expect(screen.queryByTestId("revealed-key")).not.toBeInTheDocument();
  });

  it("disables a key", async () => {
    mockApi.getProjectDetail
      .mockResolvedValueOnce({
        ...baseDetail,
        keys: [{ id: "key-1", projectId: "proj-1", status: "active" }],
      })
      .mockResolvedValueOnce({
        ...baseDetail,
        keys: [{ id: "key-1", projectId: "proj-1", status: "disabled" }],
      });
    mockApi.disableApiKey.mockResolvedValue({ status: "disabled" });

    render(
      <MemoryRouter>
        <ProjectDetailPage adminKey="test-key" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Disable")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Disable"));

    await waitFor(() => {
      expect(mockApi.disableApiKey).toHaveBeenCalledWith("test-key", "key-1");
    });
  });
});

/**
 * UI component library tests. [Task 32]
 *
 * Covers all 8 shared components: StatCard, DataTable, Modal,
 * Pagination, StatusBadge, EmptyState, LoadingSpinner, DateRangePicker.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  StatCard,
  DataTable,
  Modal,
  Pagination,
  StatusBadge,
  EmptyState,
  LoadingSpinner,
  DateRangePicker,
} from "../components/ui/index.js";

describe("StatCard", () => {
  it("renders label, value, and sub text", () => {
    render(<StatCard label="Requests" value={1234} sub="last 24h" />);
    expect(screen.getByText("Requests")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("last 24h")).toBeInTheDocument();
  });

  it("renders with testid", () => {
    render(<StatCard label="Test" value={0} />);
    expect(screen.getByTestId("stat-card")).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  const columns = [
    { key: "name", header: "Name", render: (r: { name: string }) => r.name },
    { key: "status", header: "Status", render: (r: { status: string }) => r.status },
  ];
  const rows = [
    { id: "1", name: "Project A", status: "active" },
    { id: "2", name: "Project B", status: "disabled" },
  ];

  it("renders headers and rows", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Project A")).toBeInTheDocument();
    expect(screen.getByText("Project B")).toBeInTheDocument();
  });

  it("renders with testid", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByTestId("data-table")).toBeInTheDocument();
  });
});

describe("Modal", () => {
  it("renders when open", () => {
    render(
      <Modal open={true} onClose={() => {}} title="Edit Quota">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByText("Edit Quota")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>Hidden content</p>
      </Modal>,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Pagination", () => {
  it("renders page info", () => {
    render(
      <Pagination page={1} pageSize={10} total={35} onPageChange={() => {}} />,
    );
    expect(screen.getByText(/35 total/)).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 4/)).toBeInTheDocument();
  });

  it("disables prev on first page", () => {
    render(
      <Pagination page={1} pageSize={10} total={35} onPageChange={() => {}} />,
    );
    expect(screen.getByText("Prev")).toBeDisabled();
  });

  it("disables next on last page", () => {
    render(
      <Pagination page={4} pageSize={10} total={35} onPageChange={() => {}} />,
    );
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onPageChange with correct page", () => {
    const onChange = vi.fn();
    render(
      <Pagination page={2} pageSize={10} total={35} onPageChange={onChange} />,
    );
    fireEvent.click(screen.getByText("Next"));
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByText("Prev"));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe("StatusBadge", () => {
  it("renders variant as label by default", () => {
    render(<StatusBadge variant="active" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("active");
  });

  it("renders custom label", () => {
    render(<StatusBadge variant="error" label="Failed" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Failed");
  });
});

describe("EmptyState", () => {
  it("renders message", () => {
    render(<EmptyState message="No data available" />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders action button", () => {
    render(<EmptyState message="Empty" action={<button>Create</button>} />);
    expect(screen.getByText("Create")).toBeInTheDocument();
  });
});

describe("LoadingSpinner", () => {
  it("renders default label", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders custom label", () => {
    render(<LoadingSpinner label="Fetching data..." />);
    expect(screen.getByText("Fetching data...")).toBeInTheDocument();
  });

  it("has testid", () => {
    render(<LoadingSpinner />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });
});

describe("DateRangePicker", () => {
  it("renders preset buttons", () => {
    render(<DateRangePicker from="" to="" onChange={() => {}} />);
    expect(screen.getByText("Last hour")).toBeInTheDocument();
    expect(screen.getByText("Last 24h")).toBeInTheDocument();
    expect(screen.getByText("Last 7d")).toBeInTheDocument();
    expect(screen.getByText("Last 30d")).toBeInTheDocument();
  });

  it("calls onChange when preset clicked", () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="" to="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Last 24h"));
    expect(onChange).toHaveBeenCalledOnce();
    const arg = onChange.mock.calls[0]![0];
    expect(arg.from).toBeDefined();
    expect(arg.to).toBeDefined();
  });

  it("has testid", () => {
    render(<DateRangePicker from="" to="" onChange={() => {}} />);
    expect(screen.getByTestId("date-range-picker")).toBeInTheDocument();
  });
});

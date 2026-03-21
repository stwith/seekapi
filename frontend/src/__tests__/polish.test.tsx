/**
 * Interaction polish tests — ErrorBoundary, ConfirmDialog, Toast. [Task 39]
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ErrorBoundary, ConfirmDialog, Toast } from "../components/ui/index.js";

// ErrorBoundary test helper
function BrokenChild(): React.JSX.Element {
  throw new Error("render crash");
}

describe("ErrorBoundary [Task 39]", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <p>Safe content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Safe content")).toBeInTheDocument();
  });

  it("catches render error and shows recovery UI", () => {
    // Suppress console.error for the expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("render crash")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe("ConfirmDialog [Task 39]", () => {
  it("renders when open", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Disable Key?"
        message="This cannot be undone."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Disable Key?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-btn")).toBeInTheDocument();
  });

  it("calls onConfirm when confirmed", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete?"
        message="Are you sure?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("confirm-btn"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancelled", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="X?"
        message="Y"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("does not render when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        message="Hidden"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});

describe("Toast [Task 39]", () => {
  it("renders message", () => {
    render(<Toast message="Key created!" onDismiss={() => {}} />);
    expect(screen.getByTestId("toast")).toBeInTheDocument();
    expect(screen.getByText("Key created!")).toBeInTheDocument();
  });

  it("auto-dismisses after duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Saved" onDismiss={onDismiss} durationMs={2000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

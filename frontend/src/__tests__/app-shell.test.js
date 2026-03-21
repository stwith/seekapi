import { jsx as _jsx } from "react/jsx-runtime";
/**
 * App shell bootstrap tests. [AC1]
 *
 * Verifies the operator console renders the login gate when no
 * admin key is configured, and the shell layout when one is.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../app/App.js";
describe("App shell [AC1]", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    it("renders the login gate when no admin key is set", () => {
        render(_jsx(App, {}));
        expect(screen.getByText("SeekAPI Operator Console")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("ADMIN_API_KEY")).toBeInTheDocument();
    });
    it("renders the nav sidebar when admin key is stored", () => {
        localStorage.setItem("seekapi_admin_key", "test_key");
        render(_jsx(App, {}));
        const nav = screen.getByTestId("nav-sidebar");
        expect(nav).toBeInTheDocument();
        expect(nav.textContent).toContain("Overview");
        expect(nav.textContent).toContain("Projects");
        expect(nav.textContent).toContain("Flow Runner");
    });
});

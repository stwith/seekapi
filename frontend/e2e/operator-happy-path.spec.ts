import { test, expect } from "@playwright/test";

/**
 * Minimal operator console E2E — happy path.
 *
 * Covers: login → create project → view project detail.
 * Runs against a real backend (in-memory mode) and real frontend dev server.
 */

const ADMIN_KEY = "test_admin_key";

test.describe("Operator console happy path", () => {
  test("login, create project, and view project detail", async ({ page }) => {
    // 1. Navigate to the console — should see the login gate
    await page.goto("/");
    await expect(page.getByText("SeekAPI Operator Console")).toBeVisible();

    // 2. Enter admin key and submit
    await page.getByPlaceholder("ADMIN_API_KEY").fill(ADMIN_KEY);
    await page.getByRole("button", { name: "Connect" }).click();

    // 3. Should see the nav sidebar after login
    await expect(page.getByTestId("nav-sidebar")).toBeVisible();

    // 4. Navigate to Projects page
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByText("Projects")).toBeVisible();

    // 5. Create a project
    const projectName = `e2e-test-${Date.now()}`;
    await page.getByPlaceholder("New project name").fill(projectName);
    await page.getByRole("button", { name: "Create Project" }).click();

    // 6. Wait for the project to appear in the table
    await expect(page.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 5000,
    });

    // 7. Click into the project detail
    await page.getByRole("link", { name: projectName }).click();

    // 8. Assert project detail page shows the project name and key sections
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await expect(page.getByText("Brave Credential")).toBeVisible();
    await expect(page.getByText("Capability Bindings")).toBeVisible();
    await expect(page.getByText("API Keys")).toBeVisible();
  });

  test("attach credential and mint key from project detail", async ({ page }) => {
    // Setup: login and create a project
    await page.goto("/");
    await page.getByPlaceholder("ADMIN_API_KEY").fill(ADMIN_KEY);
    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByTestId("nav-sidebar")).toBeVisible();

    await page.getByRole("link", { name: "Projects" }).click();

    const projectName = `e2e-cred-${Date.now()}`;
    await page.getByPlaceholder("New project name").fill(projectName);
    await page.getByRole("button", { name: "Create Project" }).click();
    await expect(page.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    // Attach a Brave credential
    await page.getByPlaceholder("Brave API secret").fill("BSA_fake_test_key");
    await page.getByRole("button", { name: "Attach" }).click();

    // Wait for credential to show up
    await expect(page.getByText("brave", { exact: false })).toBeVisible();

    // Mint a key
    await page.getByRole("button", { name: "Mint New Key" }).click();

    // The revealed key banner should appear
    await expect(page.getByTestId("revealed-key")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("shown once only", { exact: false })).toBeVisible();
  });
});

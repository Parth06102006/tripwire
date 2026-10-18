import { expect, test, type Page } from "@playwright/test";

/**
 * Smoke tests for the primary flows against the live stack. The investigated
 * transaction must be present in the loaded graph: set E2E_TRANSACTION_ID, or
 * the first alert in the queue is used.
 */

async function transactionId(page: Page): Promise<string> {
  if (process.env.E2E_TRANSACTION_ID) return process.env.E2E_TRANSACTION_ID;
  await page.goto("/overview");
  const first = page.locator("tbody a[href^='/investigation/']").first();
  await expect(first).toBeVisible();
  return (await first.innerText()).trim();
}

async function startReview(page: Page, id: string): Promise<void> {
  await page.goto(`/investigation/${encodeURIComponent(id)}`);
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByTestId("verdict")).toBeVisible({ timeout: 30_000 });
}

test("overview lists scored alerts with their route and opens an investigation", async ({
  page,
}) => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText(/Rows 1 to \d+ of [\d,]+, highest score first/)).toBeVisible();
  await expect(page.getByText("Scored transactions", { exact: true })).toBeVisible();
  await expect(
    page
      .locator("tbody")
      .getByText(/Blocked by rule|Flagged for review|Standard path/)
      .first(),
  ).toBeVisible();

  const first = page.locator("tbody a[href^='/investigation/']").first();
  const id = (await first.innerText()).trim();
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/investigation/${id}$`));
  await expect(page.getByRole("heading", { name: new RegExp(id) })).toBeVisible();
});

test("agent review streams tool calls with Cypher, grows the graph and ends with a verdict", async ({
  page,
}) => {
  const id = await transactionId(page);
  await page.goto(`/investigation/${encodeURIComponent(id)}`);
  await page.getByRole("button", { name: "Start review" }).click();

  // Tool calls appear before the verdict, and the graph exists before it too.
  await expect(page.locator("[data-tool-call]").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("verdict")).toBeVisible({ timeout: 30_000 });

  expect(await page.locator("[data-tool-call][data-status=ok]").count()).toBeGreaterThanOrEqual(2);
  expect(await page.locator(".react-flow__node").count()).toBeGreaterThan(1);
  await expect(page.locator(".react-flow__node-alert")).toHaveCount(1);

  await page.locator("[data-tool-call] button[aria-expanded]").first().click();
  await expect(page.locator("[data-tool-call] pre code").first()).toContainText("MATCH");

  const verdict = page.getByTestId("verdict");
  await expect(verdict).toContainText("Decision (simulated)");
  await expect(verdict).toContainText("Risk level");
  await expect(verdict.getByText("Review routing")).toBeVisible();

  await page.getByRole("button", { name: "Evidence list" }).click();
  await page
    .locator("section[aria-labelledby=tx-heading]")
    .getByRole("button", { name: id })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Selected element" }).getByText("Transaction ID"),
  ).toBeVisible();
});

test("case action goes through the gate and an analyst decision persists", async ({ page }) => {
  const id = await transactionId(page);
  await startReview(page, id);

  const gate = page.getByRole("button", { name: /through the gate/ });
  await expect(gate).toBeEnabled();
  await gate.click();
  await expect(
    page.getByText(/The action gate (opened a case|attached this evidence|denied the proposal)/),
  ).toBeVisible({ timeout: 30_000 });

  // The gate opens a case for a review decision with evidence; dismiss it so
  // the test can run again (a dismissal never blocks a new case).
  const activeCase = page.getByTestId("active-case");
  await expect(activeCase).toBeVisible();
  await activeCase.getByRole("button", { name: "Dismiss" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reviewer ID").fill("e2e-smoke");
  await dialog.getByRole("button", { name: "Dismiss case" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Dismissed earlier")).toBeVisible();
  await expect(page.getByRole("button", { name: /Propose case through the gate/ })).toBeVisible();
});

test("performance shows measured benchmarks with provenance", async ({ page }) => {
  await page.goto("/performance");
  await expect(page.getByRole("heading", { name: /Recorded run, measured/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Detection on the frozen test cohort" }),
  ).toBeVisible();
  await expect(page.locator("figure svg").first()).toBeVisible();
  await expect(page.getByText(/No precision-recall curve is drawn/)).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("LightGBM");
});

test("landing page opens the workbench and shares its theme", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Follow the money.");
  // The hero link, not the collapsed mobile menu copy that sits under the header.
  await page
    .locator("main")
    .getByRole("link", { name: /Open the workbench/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // One theme: the workbench canvas is the landing canvas.
  const canvas = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(canvas).toBe("rgb(8, 9, 9)");
});

test("overview fits one viewport and filters the whole queue by route", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.locator("tbody a[href^='/investigation/']").first()).toBeVisible();
  const fits = await page.evaluate(
    () => document.documentElement.scrollHeight <= window.innerHeight,
  );
  expect(fits).toBe(true);

  await page.getByRole("button", { name: /Blocked by rule/ }).click();
  await expect(page.getByText(/scored transactions match, highest score first/)).toBeVisible();
  const routes = await page.locator("tbody tr td:last-child").allInnerTexts();
  expect(routes.length).toBeGreaterThan(0);
  expect(routes.every((text) => text.includes("Blocked by rule"))).toBe(true);

  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(page.getByText(/^Rows 1 to \d+ of [\d,]+, highest score first$/)).toBeVisible();
});

import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke tests run against a live stack: FalkorDB with a loaded
// graph, the FastAPI service, and this app. They exercise real responses and
// write to the case store, so point the API at a scratch
// TRACEAML_CASE_DB_PATH. Port 3100 avoids reusing an unrelated server on 3000.
const port = process.env.E2E_PORT ?? "3100";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start --port ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

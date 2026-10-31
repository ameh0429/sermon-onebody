import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
// Tests use the same local development database as the API; credentials never enter the browser bundle.
if (existsSync("../backend-sermon-api/.env"))
  process.loadEnvFile("../backend-sermon-api/.env");
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: [
    {
      command:
        "npm --prefix ../backend-sermon-api run build && npm --prefix ../backend-sermon-api start",
      url: "http://127.0.0.1:3010/health",
      env: { PORT: "3010", DB_SYNC: "false", NODE_ENV: "development" },
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: "npm run build && npm run preview -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: {
        API_PROXY_TARGET: "http://127.0.0.1:3010",
        NODE_ENV: "production",
      },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});

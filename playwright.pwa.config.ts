import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  outputDir: "test-results-pwa",
  testMatch: "**/pwa.spec.ts",
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:4174",
    serviceWorkers: "allow",
  },
  webServer: {
    command: "npm.cmd run preview -- --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 60000,
  },
});

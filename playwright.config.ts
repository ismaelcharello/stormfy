import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", timezoneId: "America/Sao_Paulo" },
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/app",
    reuseExistingServer: !process.env.CI,
    env: { SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", OPENAI_API_KEY: "" },
    timeout: 120000,
  },
});

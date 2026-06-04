import { defineConfig, devices } from '@playwright/test'

const e2eHost = process.env.E2E_HOST ?? '127.0.0.1'
const e2ePort = Number(process.env.E2E_PORT ?? 5174)
const e2eBaseURL = `http://${e2eHost}:${e2ePort}`

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [['list']],
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: e2eBaseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run dev -- --host ${e2eHost} --port ${e2ePort} --strictPort`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: e2eBaseURL,
  },
})

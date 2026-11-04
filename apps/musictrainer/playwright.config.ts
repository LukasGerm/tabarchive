import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30000,
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: 'http://127.0.0.1:3102',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'pnpm run dev --port 3102',
    url: 'http://127.0.0.1:3102',
    reuseExistingServer: false,
  },
})

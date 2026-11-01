import { defineConfig, devices } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30000,
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'pnpm run dev --port 3100 --strictPort',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    env: {
      ARCHIVE_PASSWORD: 'disposable-browser-test-password',
      SESSION_SECRET: 'disposable-browser-test-secret-at-least-32-characters',
      APP_ORIGIN: 'http://127.0.0.1:3100',
      ARCHIVE_DATA_DIR: mkdtempSync(
        path.join(os.tmpdir(), 'tabarchive-browser-'),
      ),
    },
  },
})

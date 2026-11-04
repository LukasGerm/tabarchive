import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { alphaTab } from '@coderline/alphatab-vite'

export default defineConfig({
  // Keep TanStack's transitive imports bound to this workspace's versions.
  // Otherwise the second Nitro build can resolve unrelated ancestor installs.
  ssr: { noExternal: [/^@tanstack\//] },
  plugins: [
    tanstackStart(),
    nitro({ preset: 'node-server' }),
    react(),
    alphaTab(),
  ],
})

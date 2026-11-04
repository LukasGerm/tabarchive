import { build } from 'esbuild'

await build({
  entryPoints: ['scripts/backup-cli.ts'],
  outfile: '.output/backup.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
})

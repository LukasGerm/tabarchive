# Tab Archive & Music Trainer

Two independently built and deployed applications in one pnpm workspace.

| App           | Source                                   | Production                                                               | Access                         |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| Tab Archive   | [`apps/tabarchive`](apps/tabarchive)     | [tabs.lukasgermerott.de](https://tabs.lukasgermerott.de)                 | Private owner login            |
| Music Trainer | [`apps/musictrainer`](apps/musictrainer) | [musictrainer.lukasgermerott.de](https://musictrainer.lukasgermerott.de) | Public, no account or password |

## Local development

Requires Node 22.14+ and pnpm 11.5.0.

```sh
pnpm install --frozen-lockfile
pnpm run setup       # Create apps/tabarchive/.env once
pnpm dev             # Archive: http://127.0.0.1:3000
pnpm dev:trainer     # Trainer: http://127.0.0.1:3002 (another terminal)
```

The archive's private local credentials and music live in `apps/tabarchive/.env` and `apps/tabarchive/.data/`. When updating an older checkout, move its root `.env` and `.data/` into `apps/tabarchive/` before starting it. Preserve any absolute `ARCHIVE_DATA_DIR` override. Never commit either location. The trainer needs no environment variables, backend, or library data.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:browser
pnpm test:production  # Archive's built server: login, storage, API protection
```

Use `pnpm --filter tabarchive <script>` or `pnpm --filter musictrainer <script>` to work on just one app. Browser tests use disposable archive storage on port 3100 and the trainer on port 3102.

## Deployment

Both Dockerfiles use the **repository root** as the build context:

```sh
docker build -f apps/tabarchive/Dockerfile -t tabarchive .
docker build -f apps/musictrainer/Dockerfile -t musictrainer .
```

In Coolify, keep Base Directory `/` and choose the relevant Dockerfile above. Both containers listen on port `3000`. Retain Tab Archive's current environment variables, `/data` volume, and scheduled backups. Music Trainer needs no secrets, mounts, or password protection. It serves only its static build and exposes `/healthz` for health checks.

The archive's Trainer link and existing `/?view=trainer` bookmarks redirect to the public trainer. Settings previously stored on the archive domain stay there; the new domain starts with defaults.

See [archive documentation](apps/tabarchive/README.md), [trainer documentation](apps/musictrainer/README.md), and [Coolify deployment and backups](apps/tabarchive/docs/coolify.md).

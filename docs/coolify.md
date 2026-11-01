# Coolify deployment and backups

## Deploy this application

Create a Git-backed **Dockerfile** application from this repository. Use the repository root as the build context, `Dockerfile` as its Dockerfile, port `3000`, and your HTTPS domain. Coolify supplies the reverse proxy and TLS; the repository's Caddy Compose stack is for standalone hosting. See [Coolify's Dockerfile guide](https://coolify.io/docs/applications/builds/dockerfile).

Configure these **runtime** environment variables:

| Variable           | Value                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| `ARCHIVE_PASSWORD` | Your owner password, at least 16 characters                                   |
| `SESSION_SECRET`   | A random secret, at least 32 characters; generate with `openssl rand -hex 32` |
| `APP_ORIGIN`       | Your exact origin, e.g. `https://tabs.example.com`, without a trailing slash  |
| `ARCHIVE_DATA_DIR` | `/data`                                                                       |

The image already sets `NODE_ENV=production`, `HOST=0.0.0.0`, and `PORT=3000`. Run one application replica. Open the HTTPS URL and enter `ARCHIVE_PASSWORD`; there is no username or registration step.

Under **Configuration → Persistent Storage → Add → Volume Mount**, add `archive_data` with destination `/data`, then deploy. Coolify prefixes the actual volume name. Verify an imported arrangement survives a redeployment. See [volume mounts](https://coolify.io/docs/core/persistent-storage/storage-mounts/volume-mounts).

Locally, the same data lives in `.data/`. Each UUID directory contains `metadata.json`, the unchanged `original`, and, when available, `score.json` and `revisions/`. To migrate your existing library, stop writes and privately copy the entire contents of `.data/` into the production volume. The image runs as UID/GID `1000:1000`; the destination must be writable by that user. Never put the library in the image or Git. Trainer progress needs no backup.

## Recommended backup setup

Current Coolify supports application storage backups:

1. Open **Backups → Storage backups → Add** and select the `/data` volume.
2. Schedule a nightly backup. Check the schedule's displayed timezone.
3. Choose **Stop containers during archive** for a consistent copy; expect brief downtime.
4. Enable a validated S3 destination on a different service/server.
5. Set retention; a starting point for this small archive is 7 local and 30 remote backups.
6. Run **Back up now** and verify both completion and remote availability.

These are file archives, not database dumps. An S3 warning means the remote upload failed. See [storage backup settings](https://coolify.io/docs/core/persistent-storage/storage-mounts/backups).

Keep the owner credentials and deployment configuration in your password manager too. A [Coolify instance backup](https://coolify.io/docs/core/backup-and-recovery/instance-backup) covers Coolify's settings, not this application's volume.

## Test recovery

Storage backups have no dashboard restore action. Download an archive and inspect its paths. Restore into a **new, empty test volume**, with the UUID directories directly under `/data`; preserve all original files, metadata, scores, and revisions. Set ownership to `1000:1000`, attach it to an isolated instance, and configure its own origin and credentials. Verify login, original downloads, edited scores, and practice notes. Keep the live volume intact throughout the drill. Repeat after changing the backup setup.

Documentation checked 1 November 2026. This guide does not create a Coolify deployment or backup schedule.

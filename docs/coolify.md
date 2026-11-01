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

## Scheduled S3 backups (including older Coolify versions)

The deployed Coolify v4.0.0-beta.442 instance does not expose native volume backups. This repository therefore includes a standalone backup command in the production image. S3 is a **backup destination**; the app continues saving immediately to the persistent `/data` volume.

Add these runtime-only variables (disable **Available at Buildtime**, including after a bulk edit):

| Variable                      | OVH example                        |
| ----------------------------- | ---------------------------------- |
| `BACKUP_S3_ENDPOINT`          | `https://s3.de.io.cloud.ovh.net`   |
| `BACKUP_S3_REGION`            | `de`                               |
| `BACKUP_S3_BUCKET`            | `tabarchive`                       |
| `BACKUP_S3_ACCESS_KEY_ID`     | Dedicated backup user's access key |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Dedicated backup user's secret key |

Redeploy, then create **Scheduled Tasks → Add** with command `node /app/.output/backup.mjs`, frequency `0 3 * * *`, and an empty container name for this single-container application. The cron time follows Coolify's configured scheduling timezone. Use **Execute Now**, open the execution, and require both a successful exit and `"status":"verified"` in its output. See [Coolify scheduled tasks](https://coolify.io/docs/core/automation/scheduled-tasks/create-a-task).

Each run copies committed arrangements into a private temporary directory, compresses them, uploads a uniquely named `backups/<timestamp>-<uuid>.tar.gz`, then downloads it and verifies its SHA-256 checksum. It includes the Bin, original files, metadata, current scores and older revisions. Unfinished imports and writes are excluded. Current score files are atomically captured before copying their immutable older revisions; edits made during a run may first appear in the next backup. This is a per-arrangement copy, not a transaction across the whole library. Failed reads, uploads or checksum verification fail the task. Temporary local copies are removed afterward.

Use a new OVH S3 user, not the bucket owner or a general administrator. Import [ovh-backup-policy.json](./ovh-backup-policy.json) for that user. It permits bucket listing and reads/writes under `backups/`, explicitly denies deletion and administration, and grants nothing on other buckets. Do not additionally grant broad ACL/profile access: OVH can fall back to ACLs when no policy statement matches. OVH does not support `NotAction`, `NotResource`, or the action name `DeleteObjectVersion`; the policy uses its supported `Delete*` wildcard. See [OVH's policy documentation](https://docs.ovhcloud.com/en/guides/storage-and-backup/object-storage/s3-identity-and-access-management).

Backups are retained indefinitely; this job never deletes remote objects. Set an explicit retention policy separately when desired. A daily snapshot can lose up to a day's changes if the server fails. Keep credentials in your password manager as well: archive backups intentionally contain no environment secrets. The current command supports compressed archives up to 5 GB; larger libraries need multipart upload support.

To check a downloaded snapshot, inspect its archive paths, extract it into a new empty directory, then run `node .output/backup.mjs verify /path/to/extracted-backup`. This checks the hashes in `BACKUP_MANIFEST.json`. After verification, restore only the UUID directories into a **new** `/data` volume, set ownership to `1000:1000`, and test the app against that volume. Never extract over a live library. The manifest is not a signature; obtain the backup from your trusted private bucket.

## Alternative on newer Coolify versions

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

Documentation checked 1 November 2026. Deployment and schedule configuration are separate from the repository; follow the steps above when provisioning another instance.

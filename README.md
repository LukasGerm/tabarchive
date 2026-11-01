# Tab Archive

A mobile-first, private guitar repertoire app built with TanStack Start, React, and a Node server. The application can be publicly hosted; an owner login protects all library data, source imports, and original files. There is no public registration or tab sharing.

## Run locally

Requires Node 22.14 or newer and pnpm 11.5.0 (pinned in `package.json`). With a Corepack-enabled Node installation, run `corepack enable` once to make the pinned package manager available. Use `pnpm run setup` for this project’s setup script; `pnpm setup` is a different, built-in pnpm command.

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm run dev
```

`setup` creates a gitignored `.env` with a randomly generated owner password and session secret. It prints the password only when creating the file; existing credentials are never overwritten. Sign in with `ARCHIVE_PASSWORD` from that file. Keep it private. Local default: <http://127.0.0.1:3000>.

There is no username or sign-up: paste only the value after `ARCHIVE_PASSWORD=` into **Your password**, then choose **Open my archive**. Use **Repertoire → Add arrangement** to import music, open an arrangement to read/edit it, or choose **Trainer** to practice notes and chord shapes.

If that port is occupied, change `APP_ORIGIN` in `.env` to `http://127.0.0.1:3001` and run `pnpm run dev --port 3001`. The origin must match the browser address exactly. Changing the password or session secret invalidates all existing sessions.

## Import and read

- **From a link:** enter a public Ultimate Guitar text-tab or chord URL, preview its content, review the metadata, and save it. The importer preserves the source URL, contributor credit, and version. It makes a normal public-page request and reads the page's embedded tab data. It does not use private APIs, authenticated cookies, bypass access checks, or fetch protected Guitar Pro downloads. A source being technically accessible does not establish permission to copy it.
- **Upload:** Guitar Pro 3–8 (`.gp3`, `.gp4`, `.gp5`, `.gpx`, `.gp`), MusicXML (`.xml`, `.musicxml`, `.mxl`), alphaTex (`.alphatex`, `.atex`), plain text (`.txt`), or PDF. Originals are retained unchanged. Limit: 10 MB per file. Format support depends on alphaTab's importer; not every format feature is supported.
- **Paste text:** copy an authorized tab's text directly. Recognized standard six-string systems become an editable draft. Original text remains available, with mobile wrapping that preserves note columns.
- **AI/manual fallback:** expand “Prepare an import with AI,” copy the prompt, supply the source page or text, and paste the resulting `tabarchive/v1` JSON. Click “Apply import document” to populate the fields, review the text, and save. AI is not required or called by this app. It should preserve supplied notation, not invent missing notes or rhythm. See [the format](docs/import-format.md).
- **Save link only:** keep a source reference and practice notes without copying its tab content. Add an alphaTex transcription later to read and edit it here.

Structured files are converted through alphaTab's score model into canonical alphaTex, with responsive SVG notation, instrument selection, and zoom. The complete original is retained separately. PDFs are displayed through PDF.js (up to 100 pages).

## Edit arrangements

Open **Edit score**, tap a fret number, change its fret, duration, or dots, then choose **Apply note**. Duration affects all notes in that beat. **Save score** persists the edited alphaTex; **Undo** reverses local changes. Other tracks are preserved. The advanced alphaTex editor handles adding/removing notes and rests, bars, techniques, tuning, and repeats. Apply source changes to validate and preview them before saving. Export edits as `.alphatex` at any time, including when resolving a save conflict.

For hammer-ons and pull-offs, tap the **starting note**, choose **Technique to next note**, then **Apply note → Save score**. Choose **None** to remove the link. The destination is the following fretted note on that string: higher for a hammer-on, lower for a pull-off. alphaTex represents both with `{h}` on the starting note ([alphaTab reference](https://www.alphatab.net/docs/alphatex/note-properties#h)).

Conversion has three outcomes:

- Guitar Pro, MusicXML, and valid alphaTex become an editable score automatically. Conversion fidelity is limited by alphaTab's import/export support; originals remain available for comparison.
- Recognized six-string ASCII systems in standard tuning become **drafts**. String/fret onsets, column-aligned chords, and explicit ascending `h` / descending `p` links (including chains) are transcribed, with eighth-note placeholder durations. Rhythm, rests, meter, repeat instructions, ambiguous technique markings, and other techniques require review. Prose, lyrics, and chord charts remain in the original. The converter does not claim to reconstruct missing musical information.
- PDF, source links, unsupported tuning/layouts, and unparseable files remain **awaiting transcription**. The editor accepts manual alphaTex or offers a copyable AI transcription prompt. There is no automatic PDF optical music recognition or AI backend. A blank score starts with rests; enter notes in alphaTex.

Use **Original reference** in the editor to compare text/PDF sources. Mark a draft reviewed only after checking the music. You can save incomplete work as a draft. Changing duration does not automatically rebalance measures; use alphaTex to adjust rests and barlines. Non-string and tied destination notes require advanced editing.

Each save validates notation on the server, increments a revision, retains the previous revision privately, and leaves the original unchanged. Concurrent edits return a conflict rather than overwriting newer work. Download your edits, close the editor, and reopen it to load the latest version. Revision history is retained on disk; a history/restore UI is not implemented yet. Existing library entries are converted lazily when opened.

Untouched text drafts from the older converter are upgraded on opening to recover hammer-ons and pull-offs. The previous draft is retained as revision 1. Edited or reviewed scores are never automatically rebuilt.

## Bin and restore

Use **Move to Bin** beside **Edit score** to remove an arrangement from the repertoire. Open **Bin** in the main navigation and choose **Restore** to bring it back. The original, score, revision history, metadata, and practice notes are all retained. Bin entries never expire and remain part of your data-directory backups; there is no permanent-delete action. The API's `DELETE /api/tabs/:id` now moves to Bin, `GET /api/tabs?view=bin` lists removed entries, and `PATCH /api/tabs/:id` with `{ "trashed": false }` restores one.

Autoscroll is adjustable in pixels per second, starts after a three-second countdown, stops at the bottom, and pauses on manual interaction or when the page is hidden. A screen wake lock is requested where the browser supports it. This is continuous reading scroll, not beat-synchronized playback.

“Print / PDF” opens the browser's print flow. Structured scores use alphaTab's print layout; text/PDF readers use print CSS. Choose “Save as PDF” in the browser. There is no server-side PDF-generation queue. Existing PDF layouts cannot reflow like structured scores.

The repertoire stores learning status, notes, and the last practice date. The included demo is an original exercise created for this project. Third-party music is not part of the source repository or test fixtures.

## Fretboard trainer

Open **Trainer** in the main navigation after signing in (direct link: `/?view=trainer`). Three exercises use standard guitar tuning:

- **Find a note:** tap a matching fret on the requested string. Open strings and the octave at fret 12 both count when available. Arrow keys move keyboard focus around the fretboard; Enter or Space submits.
- **Name a note** (default): identify the red marker from five answers beside the neck. Note names include sounding-pitch octaves, such as E2 for open low E; switch to note-only labels in Practice settings.
- **Chord shapes:** identify one of 21 open and barre fingerings, including major, minor, and dominant seventh chords. Answers explain the chord tones.

The trainer uses the archive’s cream and green theme, shared typography, and persistent main navigation. It starts with frets **0–12** and all twelve notes selected. Visible range buttons select **0–5**, **0–12**, **5–12**, or **12–24**; both the questions and the displayed neck use that range. Chord mode has visible open/barre/all filters. The settings button selects a single string or all strings, natural or all twelve notes, sharp or flat spelling, and octave labels. Note names use international B/B♭ notation. Diagrams run from low E on the left to high E on the right. Name and chord exercises keep the board and choices together on a phone; Find a note allows scrolling to preserve large fret touch targets.

Retries and revealed answers are separate from first-try successes. Answer counts and streaks live only in React memory: leaving the trainer or refreshing starts over. The trainer requires no database, files, local storage, or practice API calls; it uses the existing owner login.

## Storage and architecture

```text
TanStack Start + Node
  ├── Owner login and signed, expiring session cookie
  ├── Authenticated source preview / import API
  ├── Private library and original-file API
  └── ARCHIVE_DATA_DIR (persistent private volume)
        └── <random UUID>/
              ├── metadata.json
              ├── original
              ├── score.json       # alphaTex source + revision/review metadata
              └── revisions/       # previous score documents
```

For a single owner and a modest library, atomic filesystem storage avoids requiring a database. Files are staged before publication, metadata writes use atomic rename, and same-entry updates/deletion are serialized within the Node process. Run **one application process/replica** with a local filesystem supporting atomic rename. This is not a distributed storage design.

Postgres is deliberately not required. If this becomes a multiuser/multireplica service, replace the storage module with Postgres metadata and private object storage, add user-scoped authorization, and move login rate limiting into shared storage. The reader/import document format does not depend on the storage implementation.

Locally, data is in gitignored `.data/`. Production uses `/data`. Never point `ARCHIVE_DATA_DIR` at `public/`, a build output, or a publicly served directory. `.dockerignore` allowlists only build inputs so local music, secrets, and browser artifacts do not enter the image. Back up the entire data directory/volume; source control is not a backup for your library. Restore it together with the owner configuration.

## Public hosting

For Coolify, deploy the Dockerfile application, mount `/data`, and configure storage backups. See [the Coolify deployment and backup guide](docs/coolify.md). The Compose instructions below are for a standalone server using the included Caddy proxy.

The repository includes a Node container and Caddy reverse proxy with automatic HTTPS. On a host with Docker Compose:

1. Point a hostname's DNS records to the host and allow inbound TCP 80/443 (UDP 443 is optional).
2. Create `.env` with `pnpm run setup`, or generate strong `ARCHIVE_PASSWORD` (at least 16 characters) and `SESSION_SECRET` (at least 32 characters) values yourself.
3. Add `ARCHIVE_DOMAIN=tabs.example.com` to `.env`. Do not include a URL scheme or path. Compose sets `APP_ORIGIN=https://<ARCHIVE_DOMAIN>` for the app.
4. Run `docker compose up --build -d`.
5. Open the HTTPS URL and sign in. Make a backup plan for the `archive_data` volume. Do not run `docker compose down -v` unless you intend to delete the library and certificates.

To use an existing reverse proxy or Node host instead:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm start
```

Set `NODE_ENV=production`, an exact HTTPS `APP_ORIGIN`, `ARCHIVE_PASSWORD`, `SESSION_SECRET`, and an absolute `ARCHIVE_DATA_DIR` on persistent private storage. Set `HOST` and `PORT` as required by your platform. Terminate TLS at the trusted reverse proxy. Never use Vite's development server as the public deployment.

Authentication fails closed if credentials are missing or production is configured without an HTTPS origin. Session cookies are signed, HttpOnly, SameSite=Strict, Secure in production, and expire after seven days. Every data endpoint checks authentication; writes check Origin. API responses use `private, no-store`. Login attempts are throttled globally for this single owner (10 attempts per 15 minutes); the counter is in memory and resets on process restart. A managed identity provider and persistent edge rate limits would be a next step for a broader service.

## Source rights

Public application code and private imported music have different permissions. Do not commit third-party tabs, lyrics, PDFs, screenshots, or exports unless you have distribution rights. Private storage does not automatically grant copying rights. In Germany, written music is subject to special copying rules; “personal use” is not a blanket exemption. Ultimate Guitar's terms restrict copying and redistribution. This app is an import tool, not a license grant; import only material you are authorized to store. For a permission-based product integration, arrange access with the provider rather than relying on page structure.

Sources checked 1 November 2026:

- [Ultimate Guitar terms, especially sections 6 and 14](https://www.ultimate-guitar.com/about/tos.htm)
- [German UrhG §53, including written music in paragraph 4](https://www.gesetze-im-internet.de/urhg/__53.html)
- [UrhG §19a: public availability](https://www.gesetze-im-internet.de/urhg/__19a.html)
- [alphaTab input formats](https://www.alphatab.net/docs/category/formats/)
- [TanStack Start Node hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)

The UG page parser is an unofficial adapter and may stop working if the source changes or blocks requests. Paste/import JSON and file upload are independent fallback paths. No availability guarantee is implied.

## Validation

```sh
pnpm run build       # Generates the route tree and production Node output
pnpm run typecheck
pnpm test
pnpm exec playwright install chromium
pnpm run test:browser
pnpm run test:production
```

Alternatively, use an installed Chrome: `PLAYWRIGHT_CHANNEL=chrome pnpm run test:browser`. Browser tests use port 3100 and disposable credentials/temporary storage, never your owner library. The production smoke test uses port 3101 and temporary storage. Automated fixtures contain only original, invented exercises. Live source availability is intentionally not a CI requirement.

## Current boundaries

- One owner; no sign-up, password-reset email, sharing, cloud sync, or offline mode.
- Source URL extraction supports accessible UG text tabs/chords. Other sources use upload, paste, or import JSON.
- Continuous autoscroll; no audio player or tempo synchronization yet.
- Filesystem volume with backups; no Postgres dependency or multi-instance coordination yet.
- Browser print-to-PDF; no unattended server PDF rendering.
- Deployment files are included; this checkout is not automatically deployed to a hosting account.

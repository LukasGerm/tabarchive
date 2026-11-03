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

The reader opens with the score first. **Notes** expands familiarity and practice notes; **More** contains editing, printing, downloads, source links, and Move to Bin. Zoom, scroll speed, and instrument selection are remembered per arrangement in this browser.

Practice notes save automatically after a short pause. A browser-local draft is kept immediately, so navigating away or refreshing before a save does not lose your text. Failed saves expose a retry; stale saves cannot overwrite notes changed in another window. If a conflict occurs, copy your draft before choosing **Use saved notes**. When browser draft storage is unavailable, the reader warns before leaving with unsaved notes.

Import details and pasted text are kept as a browser-local draft across method changes, closing, and refreshes. A selected upload stays available when closing and reopening the dialog in the same visit; after a refresh, choose the file again. Permission confirmation is not restored after refreshing. A successful import clears its draft; **Discard draft** clears it explicitly. Drafts stay in this browser, including after signing out, until saved or discarded; they do not sync between devices and are not included in server backups.

The repertoire stores learning status, notes, and the last practice date. Tap **Played today** in the reader to record practice. In the collection, **Sort by → Least recently played** brings never-played pieces first, followed by those you have left the longest. You can also sort by most recently played, recently added (the default), or title. Each row shows its last practice date, and your sort choice is remembered in this browser. Sorting works together with search and familiarity filters.

The included demo is an original exercise created for this project. Third-party music is not part of the source repository or test fixtures.

## Fretboard trainer

Open **Trainer** in the main navigation after signing in (direct link: `/?view=trainer`). The exercises use standard guitar tuning:

- **Find a note:** tap a matching fret on the requested string. Open strings and the octave at fret 12 both count when available. Arrow keys move keyboard focus around the fretboard; Enter or Space submits.
- **Name a note** (default): identify the red marker from five answers beside the neck. Note names include sounding-pitch octaves, such as E2 for open low E; switch to note-only labels in Practice settings.
- **Chord shapes:** identify one of 69 open and movable fingerings across 18 chord qualities: major, minor, dominant 7, maj7, m7, dim, dim7, m7♭5, aug, sus2, sus4, 6, m6, add9, m(add9), add11, m(add11), and 9. Answers explain the chord tones, and equivalent harmonies never compete as answer choices.
- **Chord tones → Find the root:** tap every root in the named shape. Correct taps stay selected; a question completes only when every root is found. Inversions such as C/E teach the difference between the root and the bass. Only sounding chord notes are selectable; arrow keys move between them, and Enter or Space submits.
- **Chord tones → Note roles:** name the highlighted note’s role, such as root, major third, minor seventh (♭7), or major seventh (7). Answers explain the interval in semitones, label every sounding note in the diagram, and show the chord’s formula and notes. Diminished sevenths, sixths, suspended tones, and added tones retain their distinct roles and correct note spellings. An omitted tone is identified in the breakdown.
- **Intervals → Read notes / By ear:** identify the distance between two pitches. Read correctly spelled notes with octave labels, or hide the pitches and identify the sound by ear. Choose ascending, descending, or together playback. **Foundations** covers minor/major thirds and sevenths, perfect fourths/fifths, and octaves; **Unison–octave** covers all thirteen semitone distances from perfect unison through the octave. Answer reviews reveal both pitches, explain the interval in semitones and guitar frets, and show a distance diagram. Playback starts only on Play, can be replayed without affecting scores, and stops on Stop, answer/reveal, question/settings changes, reset, mode changes, and navigation. Audio uses the same local synthesizer as Harmony. If audio is unavailable, switch to Read notes. Session scores, retries, and reveals follow the other trainer modes.
- **Harmony → Chords in a key:** recall answers without a visible scale or multiple-choice clues. **Mix all three** (the default) asks for chord names from Roman numerals, Roman numerals from chord names, and every note in a chord. Use **Recall** to focus on one direction. Type your answer and press Enter or **Check answer**. Chord names accept common forms such as `Am`, `A minor`, `CM7`, and `Bm7b5`; `#` and `b` work for sharps and flats. Chord tones can be entered in any order, separated by spaces or commas, but must use the key’s spelling. Roman numeral case matters: IV is major four, iv is minor four, and vi is minor six. Reviews explain the actual intervals from the root and show the scale and all seven diatonic chords.
- **Harmony → Chord functions:** identify tonic (I), predominant (ii/IV), or dominant (V/vii°) function. Listen to the tonic followed by the target chord. Context-dependent iii/vi functions are excluded from this introductory exercise.
- **Harmony → Complete a progression:** type the missing chord in a named Roman-numeral pattern, including ii–V–I, I–IV–V–I, turnarounds, pop loops, and plagal/deceptive cadences. Playback leaves the missing chord silent until the answer is resolved; the review explains the progression and the actual upper-note movements used in playback. Questions ask for a specific pattern rather than claiming only one chord could work musically.

Harmony keeps the scale hidden until you answer or ask for help. **Give me a hint** offers a way to reason about the answer; **Show scale** adds the numbered scale as a second hint. Hints mark the question as assisted, so it cannot count toward first-try successes or the streak. Missed, hinted, and revealed answers are queued to return after two intervening answers, without the previous hints or input. Only a first-try answer without hints clears that recall check. Reviews respect the selected key, chord type, exercise, and recall direction; switching settings keeps other checks queued until you return. The review queue is session-only and clears on reset, refresh, or leaving the trainer.

Chord-tone exercises start with **Foundations**: major, minor, 7, maj7, and m7 chords, plus four inversions. Select **All chord types** under **Practice settings → Chord vocabulary** to include the full collection. Open/movable/all shape filters apply to both exercises. Partial root answers, retries, reveals, changing modes, and resets use the same session-only progress as the other exercises.

Harmony starts in **C major** with **triads**. Choose any of the twelve major keys or switch to **seventh chords** above the question; note spelling follows the key (including E♯ in F♯ major). Sound is synthesized locally using Web Audio and starts only on Play. Where supported, Play requests a music-playback audio session to avoid [iPhone Silent Mode muting the default ambient session](https://bugs.webkit.org/show_bug.cgi?id=252746). Stop, resolving a question, changing settings/questions, resetting, or leaving Harmony closes playback and clears scheduled notes. The quiz also works visually when audio is unavailable. Harmony shares the trainer’s session totals and resets on refresh. The function model follows the common major-key examples in [Music Theory for the 21st-Century Classroom](https://musictheory.pugetsound.edu/mt21c/HarmonicFunctionInClassicalMusic.html).

The trainer opens a dedicated practice screen with the archive’s cream and green theme and shared typography. A compact back button returns to the repertoire; the archive header and navigation stay out of the practice area. It starts with frets **0–12** and all twelve notes selected. Visible range buttons select **0–5**, **0–12**, **5–12**, or **12–24**; both the questions and the displayed neck use that range. Chord mode starts with all shapes and has visible open/movable/all filters. Movable includes both barre chords and compact fingerings with no open strings. The settings button selects a single string or all strings, natural or all twelve notes, sharp or flat spelling, and octave labels. Note names use international B/B♭ notation. Diagrams run from low E on the left to high E on the right. Name and chord exercises keep the board and choices alongside each other on a phone. Short screens scroll to preserve readable frets and prevent controls from overlapping; Find a note keeps large fret touch targets. Starting or advancing a question brings its prompt into view.

Retries and revealed answers are separate from first-try successes. Answer counts and streaks live only in React memory: leaving the trainer or refreshing starts over. Trainer settings—including mode, range, string, note labels, and theory choices—are remembered in this browser. Session scores and recall queues still reset on leaving or refreshing. The trainer requires no database, files, or practice API calls; it uses the existing owner login. If browser storage is unavailable, settings work for the current visit.

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

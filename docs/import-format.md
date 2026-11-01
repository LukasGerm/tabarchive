# Portable tab import

Paste a `tabarchive/v1` JSON document in **Add arrangement → Paste text**, then click **Apply import document**. Review the populated title, source, attribution, and content before saving. The original text and the app's metadata are stored separately.

```json
{
  "schema": "tabarchive/v1",
  "title": "Original open-string study",
  "artist": "Your name",
  "sourceUrl": "",
  "attribution": "Original exercise",
  "tuning": "E A D G B E",
  "capo": 0,
  "format": "text",
  "content": "e|--0-----0--|\nB|-----0-----|\nG|-----------|\nD|-----------|\nA|-----------|\nE|--0-----0--|",
  "notes": "Keep the bass quiet.",
  "status": "learning"
}
```

Required: `schema`, nonempty `title`, `format` (`text` or `alphatex`), nonempty `content`. JSON strings use `\n` for newlines and `\\` for backslashes. The paste screen also accepts a JSON Markdown code fence. Limit: 500,000 content characters.

Optional: `artist`, `sourceUrl` (HTTP/HTTPS or empty), `attribution`, `tuning`, `capo` (0–12), `notes`, and `status` (`learning`, `familiar`, `solid`). If not supplied, tuning defaults to standard tuning and capo to zero; verify these for every arrangement. A source URL is provenance, not proof of permission.

For another website, a person or AI can prepare this document from text they are allowed to copy. Preserve spaces, line breaks, source credit, and copyright notices. Strip only presentation markup, such as UG's `[tab]` and `[ch]` markers. Do not scrape access-controlled content or invent missing notation. An AI that cannot access a page should ask for the copied text instead.

Plain ASCII tabs usually do not encode enough timing to reconstruct a score accurately. Import the original as `text`; the app creates a draft transcription for recognized standard six-string systems, with explicitly unverified eighth-note placeholder durations. Review rhythm, techniques, repeats, and notes against the original. Guitar Pro and MusicXML should be uploaded in their original formats and are converted to alphaTex automatically.

JSON is the optional metadata envelope for ingestion. **alphaTex is the editable musical source**, stored with revision/review metadata separately from the immutable original. You can paste raw alphaTex directly using the alphaTex format option; JSON is not required. Inside **Edit score → Advanced: alphaTex**, paste only alphaTex, preview, then save. That editor also provides an AI transcription prompt for manually converting text or PDFs; missing rhythm must be called out and reviewed rather than presented as known.

For direct UG import, the preview endpoint returns the same document shape. The adapter is isolated in `src/server/import-source.ts`; additional providers can produce this format without changing the reader or private storage.

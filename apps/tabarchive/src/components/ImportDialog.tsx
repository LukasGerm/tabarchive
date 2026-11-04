import { useEffect, useRef, useState, type FormEvent } from 'react'
import { readStored, removeStored, writeStored } from '../lib/browser-storage'
import {
  emptyImportDraft,
  hasImportDraft,
  importDraftKey,
  importDraftSchema,
  type ImportDraft,
} from '../lib/import-draft'
import { Clipboard, FileUp, Link2, TextCursorInput, X } from 'lucide-react'
import { api, message } from '../lib/client'
import { detectFormat, type ArchivedTab } from '../lib/archive'
import {
  aiImportPrompt,
  cleanTabText,
  parsePastedDocument,
  type ImportDocument,
} from '../lib/import-document'

export function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: (tab: ArchivedTab) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(emptyImportDraft)
  const draftRef = useRef(draft)
  const { mode, source, preview, pasted, textFormat, fields, fileName } = draft
  const [file, setFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [permission, setPermission] = useState(false)
  const [draftProtected, setDraftProtected] = useState(true)
  const [discarding, setDiscarding] = useState(false)
  useEffect(() => {
    const saved = readStored(importDraftKey, importDraftSchema)
    if (saved) {
      draftRef.current = saved
      setDraft(saved)
    }
  }, [])
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  useEffect(() => {
    if (!file && (draftProtected || !hasImportDraft(draft))) return
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [file, draftProtected, draft])

  function change(update: Partial<ImportDraft>) {
    const next = { ...draftRef.current, ...update }
    draftRef.current = next
    setDraft(next)
    setDraftProtected(writeStored(importDraftKey, next))
  }
  function field(name: keyof ImportDraft['fields'], value: string) {
    change({ fields: { ...draftRef.current.fields, [name]: value } })
  }
  function clearDraft() {
    removeStored(importDraftKey)
    draftRef.current = emptyImportDraft
    setDraft(emptyImportDraft)
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
    setPermission(false)
    setError('')
    setDiscarding(false)
    setDraftProtected(true)
  }
  function close() {
    if (busy) return
    if (
      !draftProtected &&
      hasImportDraft(draft) &&
      !window.confirm(
        'This draft could not be saved in your browser. Close anyway?',
      )
    )
      return
    onClose()
  }
  function applyDocument(document: ImportDocument) {
    change({
      preview: document,
      pasted: document.content,
      textFormat: document.format,
      fields: {
        title: document.title,
        artist: document.artist,
        sourceUrl: document.sourceUrl,
        tuning: document.tuning,
        capo: String(document.capo),
        attribution: document.attribution,
        notes: document.notes,
      },
    })
    setPermission(false)
  }

  async function fetchSource() {
    setBusy(true)
    setError('')
    change({ preview: null })
    try {
      applyDocument(
        await api<ImportDocument>('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: source }),
        }),
      )
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  function applyPaste() {
    setError('')
    try {
      const document = parsePastedDocument(pasted)
      if (!document)
        throw new Error(
          'Paste a tabarchive/v1 JSON document to fill the details automatically. Plain text can be saved directly.',
        )
      applyDocument(document)
    } catch (err) {
      setError(message(err))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const form = new FormData(event.currentTarget)
    try {
      if (mode === 'file') {
        if (!file) throw new Error('Choose a file to import.')
        if (!detectFormat(file.name))
          throw new Error('That file type isn’t supported yet.')
        if (file.size > 10 * 1024 * 1024)
          throw new Error('Choose a file smaller than 10 MB.')
        form.set('file', file)
      } else if (mode === 'text' || mode === 'url') {
        if (mode === 'url' && !preview)
          throw new Error('Preview the source tab before saving.')
        const text = mode === 'url' ? preview!.content : pasted
        if (!text.trim()) throw new Error('Paste your tab before saving.')
        const document = mode === 'text' ? parsePastedDocument(text) : null
        if (document)
          throw new Error(
            'Use “Apply import document” first to review its title, source, and content.',
          )
        const format = mode === 'url' ? preview!.format : textFormat
        form.set(
          'file',
          new File(
            [format === 'text' ? cleanTabText(text) : text],
            format === 'alphatex' ? 'arrangement.alphatex' : 'arrangement.txt',
            { type: 'text/plain' },
          ),
        )
      }
      if (mode === 'url' && preview)
        form.set('sourceUrl', fields.sourceUrl || preview.sourceUrl || source)
      const tab = await api<ArchivedTab>('/api/tabs', {
        method: 'POST',
        body: form,
      })
      clearDraft()
      setBusy(false)
      onImported(tab)
    } catch (err) {
      setError(message(err))
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <dialog
      ref={dialog}
      className="import-dialog"
      aria-labelledby="import-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">MAKE IT PART OF YOUR REPERTOIRE</p>
          <h2 id="import-title">Add an arrangement</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close import"
          onClick={close}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <div className="segmented" aria-label="Import method">
        {(
          [
            ['url', Link2, 'From a link'],
            ['file', FileUp, 'Upload a file'],
            ['text', TextCursorInput, 'Paste text'],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            className={
              mode === value || (value === 'url' && mode === 'link')
                ? 'active'
                : ''
            }
            aria-pressed={
              mode === value || (value === 'url' && mode === 'link')
            }
            disabled={busy}
            onClick={() => {
              change({ mode: value })
              setError('')
            }}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      {(mode === 'url' || mode === 'link') && (
        <div className="source-import">
          <label>
            Ultimate Guitar tab URL
            <input
              type="url"
              value={source}
              onChange={(event) => {
                change({
                  source: event.target.value,
                  preview: null,
                  fields: {
                    ...fields,
                    sourceUrl:
                      !fields.sourceUrl || fields.sourceUrl === source
                        ? event.target.value
                        : fields.sourceUrl,
                  },
                })
                setPermission(false)
              }}
              placeholder="https://tabs.ultimate-guitar.com/tab/…"
              disabled={busy}
            />
          </label>
          <div className="source-actions">
            <button
              className="secondary"
              type="button"
              disabled={busy || !source}
              onClick={() => {
                change({ mode: 'url' })
                void fetchSource()
              }}
            >
              {busy ? 'Fetching…' : 'Preview tab'}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => {
                change({
                  mode: 'link',
                  fields: { ...fields, sourceUrl: fields.sourceUrl || source },
                })
              }}
            >
              Save link only
            </button>
          </div>
          <p className="hint">
            Public text tabs and chords. For other sources, upload a file or
            paste text.
          </p>
          {preview && mode === 'url' && (
            <div className="import-preview">
              <strong>
                {preview.title} · {preview.artist}
              </strong>
              <span>
                {preview.content.split('\n').length} lines ·{' '}
                {preview.attribution}
              </span>
              <pre>{preview.content}</pre>
            </div>
          )}
        </div>
      )}
      {discarding && (
        <div className="import-discard" role="alert">
          <p>Discard the saved import draft?</p>
          <button
            className="secondary"
            type="button"
            onClick={() => setDiscarding(false)}
          >
            Keep editing
          </button>
          <button className="danger" type="button" onClick={clearDraft}>
            Discard import draft
          </button>
        </div>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {mode === 'file' && (
            <label className="upload-zone">
              <FileUp size={28} />
              <strong>
                {file?.name ??
                  (fileName
                    ? `Choose ${fileName} again`
                    : 'Choose a tab from your files')}
              </strong>
              <span>
                Guitar Pro, MusicXML, alphaTex, TXT or PDF · up to 10 MB
              </span>
              <input
                ref={fileInput}
                aria-label="Tab file"
                type="file"
                accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl,.alphatex,.atex,.txt,.pdf"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null
                  setFile(selected)
                  change({ fileName: selected?.name ?? '' })
                  setPermission(false)
                }}
              />
            </label>
          )}
          {mode === 'text' && (
            <>
              <label>
                Text format
                <select
                  name="textFormat"
                  value={textFormat}
                  onChange={(event) =>
                    change({
                      textFormat: event.target.value as 'text' | 'alphatex',
                    })
                  }
                >
                  <option value="text">
                    Plain-text tablature / import JSON
                  </option>
                  <option value="alphatex">alphaTex notation</option>
                </select>
              </label>
              <label>
                Your tab
                <textarea
                  className="tab-input"
                  name="content"
                  value={pasted}
                  onChange={(event) => {
                    change({ pasted: event.target.value })
                    setPermission(false)
                  }}
                  maxLength={500000}
                  rows={7}
                  placeholder="Paste tablature or a tabarchive/v1 JSON document…"
                  required
                />
              </label>
              <button className="secondary" type="button" onClick={applyPaste}>
                Apply import document
              </button>
              <details className="ai-help">
                <summary>Prepare an import with AI</summary>
                <p className="hint">
                  Give your AI the source page or the tab text you copied,
                  together with this prompt. Paste its JSON result above, then
                  apply it and check that nothing is missing.
                </p>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(aiImportPrompt + source)
                      .then(() => setCopied(true))
                      .catch(() => setCopied(false))
                  }}
                >
                  <Clipboard size={15} />
                  {copied ? 'Prompt copied' : 'Copy AI prompt'}
                </button>
                <textarea
                  aria-label="AI import prompt"
                  readOnly
                  value={aiImportPrompt + source}
                  rows={5}
                />
              </details>
            </>
          )}
          {mode === 'link' && (
            <p className="hint inset">
              Keep an Ultimate Guitar or other source link with your notes.
              You’ll open the original site to view the tab.
            </p>
          )}
          <label>
            Title
            <input
              name="title"
              value={fields.title}
              onChange={(event) => field('title', event.target.value)}
              placeholder="Name of the piece"
              required
              maxLength={160}
            />
          </label>
          <label>
            Artist / composer
            <input
              name="artist"
              value={fields.artist}
              onChange={(event) => field('artist', event.target.value)}
              placeholder="Who wrote it?"
              maxLength={160}
            />
          </label>
          <label>
            Source link{' '}
            {mode !== 'link' && <span className="optional">optional</span>}
            <input
              name="sourceUrl"
              type="url"
              value={fields.sourceUrl}
              onChange={(event) => field('sourceUrl', event.target.value)}
              placeholder="https://…"
              required={mode === 'link'}
            />
          </label>
          <details>
            <summary>Arrangement details</summary>
            <div className="form-row">
              <label>
                Tuning
                <input
                  name="tuning"
                  value={fields.tuning}
                  onChange={(event) => field('tuning', event.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Capo
                <input
                  name="capo"
                  type="number"
                  min={0}
                  max={12}
                  value={fields.capo}
                  onChange={(event) => field('capo', event.target.value)}
                />
              </label>
            </div>
            <label>
              Arranger / attribution
              <input
                name="attribution"
                value={fields.attribution}
                onChange={(event) => field('attribution', event.target.value)}
                placeholder="Credit the arrangement"
                maxLength={300}
              />
            </label>
            <label>
              Practice notes
              <textarea
                name="notes"
                value={fields.notes}
                onChange={(event) => field('notes', event.target.value)}
                rows={3}
                maxLength={10000}
                placeholder="A tricky transition, a fingering to remember…"
              />
            </label>
          </details>
          {mode !== 'link' && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={permission}
                onChange={(event) => setPermission(event.target.checked)}
                name="permission"
                value="confirmed"
                required
              />
              <span>
                I created this tab or have permission to store it in my private
                archive.
              </span>
            </label>
          )}
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <div className="hint">
            {hasImportDraft(draft)
              ? draftProtected
                ? 'Draft kept in this browser.'
                : 'Browser draft storage unavailable. Keep this window open.'
              : 'Only visible to you.'}
            {file && <p>Choose the file again after a page refresh.</p>}
            {hasImportDraft(draft) && (
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => setDiscarding(true)}
              >
                Discard draft
              </button>
            )}
          </div>
          <button
            className="primary"
            disabled={busy || (mode === 'url' && !preview)}
          >
            {busy
              ? 'Saving…'
              : mode === 'link'
                ? 'Save source link'
                : 'Add to archive'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

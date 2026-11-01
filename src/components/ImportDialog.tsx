import { useEffect, useRef, useState, type FormEvent } from 'react'
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
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: (tab: ArchivedTab) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<'url' | 'file' | 'text' | 'link'>('url')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState('')
  const [preview, setPreview] = useState<ImportDocument | null>(null)
  const [pasted, setPasted] = useState('')
  const [textFormat, setTextFormat] = useState('text')
  const [formVersion, setFormVersion] = useState(0)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  function applyDocument(document: ImportDocument) {
    setPreview(document)
    setPasted(document.content)
    setTextFormat(document.format)
    setFormVersion((value) => value + 1)
  }

  async function fetchSource() {
    setBusy(true)
    setError('')
    setPreview(null)
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
      const tab = await api<ArchivedTab>('/api/tabs', {
        method: 'POST',
        body: form,
      })
      onImported(tab)
    } catch (err) {
      setError(message(err))
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="import-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">MAKE IT PART OF YOUR REPERTOIRE</p>
          <h2>Add an arrangement</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close import"
          onClick={onClose}
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
              if (value !== mode) {
                setPreview(null)
                setFormVersion((version) => version + 1)
              }
              setMode(value)
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
                setSource(event.target.value)
                setPreview(null)
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
                setMode('url')
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
                setMode('link')
                setPreview(null)
                setFormVersion((value) => value + 1)
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
      <form key={formVersion} onSubmit={submit}>
        <fieldset disabled={busy}>
          {mode === 'file' && (
            <label className="upload-zone">
              <FileUp size={28} />
              <strong>{file?.name ?? 'Choose a tab from your files'}</strong>
              <span>
                Guitar Pro, MusicXML, alphaTex, TXT or PDF · up to 10 MB
              </span>
              <input
                aria-label="Tab file"
                type="file"
                accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl,.alphatex,.atex,.txt,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
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
                  onChange={(event) => setTextFormat(event.target.value)}
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
                  onChange={(event) => setPasted(event.target.value)}
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
              defaultValue={preview?.title ?? ''}
              placeholder="Name of the piece"
              required
              maxLength={160}
            />
          </label>
          <label>
            Artist / composer
            <input
              name="artist"
              defaultValue={preview?.artist ?? ''}
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
              defaultValue={preview?.sourceUrl ?? source}
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
                  defaultValue={preview?.tuning ?? 'E A D G B E'}
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
                  defaultValue={preview?.capo ?? 0}
                />
              </label>
            </div>
            <label>
              Arranger / attribution
              <input
                name="attribution"
                defaultValue={preview?.attribution ?? ''}
                placeholder="Credit the arrangement"
                maxLength={300}
              />
            </label>
            <label>
              Practice notes
              <textarea
                name="notes"
                defaultValue={preview?.notes ?? ''}
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
          <span className="hint">Only visible to you.</span>
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

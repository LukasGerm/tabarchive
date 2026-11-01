import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { model } from '@coderline/alphatab'
import { Download, Save, Undo2, X } from 'lucide-react'
import type { ArchivedTab } from '../lib/archive'
import { api, message } from '../lib/client'
import {
  downloadAlphaTex,
  durationOptions,
  type NotePosition,
  type ScoreDocument,
} from '../lib/score-document'
import {
  editNote,
  noteAt,
  noteTechnique,
  techniqueTarget,
  parseScore,
  positionOf,
  type NoteTechnique,
} from '../lib/score-model'
import { aiTranscriptionPrompt } from '../lib/import-document'
import { Score } from './Score'
import { TextScore } from './TextScore'
import { PdfScore } from './PdfScore'

const noop = () => {}

export default function ScoreEditor({
  tab,
  original,
  document,
  onSaved,
  onClose,
}: {
  tab: ArchivedTab
  original: Uint8Array | null
  document: ScoreDocument
  onSaved: (document: ScoreDocument) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [saved, setSaved] = useState(document)
  const [source, setSource] = useState(document.alphaTex ?? '')
  const [input, setInput] = useState(source)
  const [history, setHistory] = useState<string[]>([])
  const [position, setPosition] = useState<NotePosition | null>(null)
  const [fret, setFret] = useState('0')
  const [duration, setDuration] = useState(4)
  const [dots, setDots] = useState(0)
  const [technique, setTechnique] = useState<NoteTechnique>('none')
  const [reviewed, setReviewed] = useState(document.status === 'ready')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [copied, setCopied] = useState(false)
  const score = useMemo(() => (source ? parseScore(source) : null), [source])
  const bytes = useMemo(() => new TextEncoder().encode(source), [source])
  const selected = score && position ? noteAt(score, position) : null
  const pendingNote = Boolean(
    selected &&
    (fret !== String(selected.fret) ||
      duration !== selected.beat.duration ||
      dots !== selected.beat.dots ||
      technique !== noteTechnique(selected)),
  )
  const dirty =
    pendingNote ||
    input !== (saved.alphaTex ?? '') ||
    source !== (saved.alphaTex ?? '') ||
    reviewed !== (saved.status === 'ready')
  const pendingSource = input !== source
  const nextNote = selected ? techniqueTarget(selected) : null
  const canEditFret =
    selected?.isStringed && !selected.isTieDestination && !selected.isDead
  const measureNeedsReview =
    selected &&
    !selected.beat.voice.bar.masterBar.isAnacrusis &&
    selected.beat.voice.calculateDuration() !==
      selected.beat.voice.bar.masterBar.calculateDuration()

  useEffect(() => {
    const readingPosition = window.scrollY
    const style = window.document.body.style
    const previous = {
      overflow: style.overflow,
      position: style.position,
      top: style.top,
      width: style.width,
    }
    style.overflow = 'hidden'
    style.position = 'fixed'
    style.top = `${-readingPosition}px`
    style.width = '100%'
    window.scrollTo({ top: 0, behavior: 'instant' })
    dialog.current?.showModal()
    return () => {
      Object.assign(style, previous)
      window.scrollTo({ top: readingPosition, behavior: 'instant' })
    }
  }, [])
  useEffect(() => {
    if (!dirty) return
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [dirty])

  const selectNote = useCallback(
    (note: model.Note) => {
      if (pendingNote) {
        setError(
          'Apply or reset the current note changes before selecting another note.',
        )
        return
      }
      setPosition(positionOf(note))
      setFret(String(note.fret))
      setDuration(note.beat.duration)
      setDots(note.beat.dots)
      setTechnique(noteTechnique(note))
      setNotice('')
    },
    [pendingNote],
  )

  function apply(next: string) {
    parseScore(next)
    setHistory((previous) => [...previous, source].slice(-50))
    setSource(next)
    setInput(next)
    setError('')
    setNotice('Preview updated. Save when you’re ready.')
  }

  async function save() {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const result = await api<ScoreDocument>(`/api/tabs/${tab.id}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision: saved.revision,
          alphaTex: source,
          reviewed,
        }),
      })
      setSaved(result)
      onSaved(result)
      setNotice(
        `Saved revision ${result.revision}${result.status === 'draft' ? ' as a draft' : ''}.`,
      )
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  function close() {
    if (busy) return
    if (dirty) setDiscarding(true)
    else onClose()
  }

  return (
    <dialog
      ref={dialog}
      className="score-editor"
      aria-labelledby="editor-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <header className="editor-header">
        <div>
          <p className="eyebrow">EDIT ARRANGEMENT</p>
          <h2 id="editor-title">{tab.title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close editor"
          onClick={close}
          disabled={busy}
        >
          <X size={21} />
        </button>
      </header>
      <div className="editor-toolbar">
        <button
          className="secondary"
          disabled={!history.length || busy}
          onClick={() => {
            const previous = history[history.length - 1]
            setSource(previous)
            setInput(previous)
            setHistory((items) => items.slice(0, -1))
            setPosition(null)
            setError('')
            setNotice('Last change undone.')
          }}
        >
          <Undo2 size={16} /> Undo
        </button>
        <button
          className="text-button"
          disabled={!input}
          onClick={() => downloadAlphaTex(input, tab.title)}
        >
          <Download size={16} /> Export edits
        </button>
        <button
          className="primary"
          disabled={busy || !source || pendingSource || pendingNote || !dirty}
          onClick={() => void save()}
        >
          <Save size={16} /> {busy ? 'Saving…' : 'Save score'}
        </button>
      </div>
      {discarding && (
        <div className="editor-discard" role="alert">
          <p>You have unsaved edits.</p>
          <button className="secondary" onClick={() => setDiscarding(false)}>
            Keep editing
          </button>
          <button className="danger" onClick={onClose}>
            Discard edits
          </button>
        </div>
      )}
      <div className="editor-feedback">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="hint" role="status">
          {pendingNote
            ? 'Apply note changes before saving, or reset them.'
            : notice ||
              (pendingSource
                ? 'Apply your alphaTex changes before saving or editing notes.'
                : dirty
                  ? 'Unsaved changes'
                  : `Revision ${saved.revision} · ${saved.status === 'ready' ? 'Ready to play' : 'Needs review'}`)}
        </p>
      </div>
      <div className="editor-scroll">
        {document.warnings.length > 0 && (
          <details
            className="conversion-details"
            open={document.status !== 'ready'}
          >
            <summary>Conversion notes</summary>
            {document.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </details>
        )}
        <details className="original-reference">
          <summary>Original reference</summary>
          {original ? (
            tab.format === 'text' ? (
              <TextScore text={new TextDecoder().decode(original)} zoom={1} />
            ) : tab.format === 'pdf' ? (
              <PdfScore bytes={original} zoom={1} onReady={noop} />
            ) : (
              <a
                href={`/api/tabs/${tab.id}/file`}
                download
                className="text-button"
              >
                Download the original score
              </a>
            )
          ) : (
            <a
              href={tab.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-button"
            >
              Open the original source
            </a>
          )}
        </details>
        <details
          className="advanced-editor"
          open={!document.alphaTex || undefined}
        >
          <summary>Advanced: alphaTex</summary>
          <p className="hint">
            Edit the complete score, including notes, rests, bars, tuning, and
            techniques. Apply to preview, then save.{' '}
            <a
              href="https://alphatab.net/docs/alphatex/introduction"
              target="_blank"
              rel="noreferrer"
            >
              Syntax reference ↗
            </a>
          </p>
          <details className="transcription-help">
            <summary>Prepare alphaTex with AI</summary>
            <p className="hint">
              Give your AI the source and this prompt, then paste its alphaTex
              below. Check its work before marking it reviewed.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(aiTranscriptionPrompt + tab.sourceUrl)
                  .then(() => setCopied(true))
                  .catch(() =>
                    setError('Copy the prompt from the text box below.'),
                  )
              }
            >
              {copied ? 'Prompt copied' : 'Copy transcription prompt'}
            </button>
            <textarea
              aria-label="AI transcription prompt"
              readOnly
              rows={5}
              value={aiTranscriptionPrompt + tab.sourceUrl}
            />
          </details>
          <label>
            alphaTex source
            <textarea
              value={input}
              spellCheck={false}
              rows={12}
              maxLength={500000}
              onChange={(event) => {
                setInput(event.target.value)
                setNotice('')
              }}
            />
          </label>
          <div className="editor-source-actions">
            <button
              className="secondary"
              disabled={!input || input === source || busy || pendingNote}
              onClick={() => {
                try {
                  apply(input)
                  setPosition(null)
                } catch (err) {
                  setError(message(err))
                }
              }}
            >
              Apply alphaTex
            </button>
            {pendingSource && (
              <button
                className="text-button"
                onClick={() => {
                  setInput(source)
                  setError('')
                }}
              >
                Reset source changes
              </button>
            )}
            {!source && (
              <button
                className="text-button"
                onClick={() => {
                  apply('.\n:4 r r r r')
                  setPosition(null)
                }}
              >
                Start a blank score
              </button>
            )}
          </div>
        </details>
        {source && (
          <>
            <p className="editor-instruction">
              Tap a fret number to edit it. Duration applies to all notes at
              that beat. Add a hammer-on or pull-off on the starting note. Use
              alphaTex to add notes, rests, or other techniques.
            </p>
            <div
              className={`sheet editor-sheet ${pendingSource ? 'source-pending' : ''}`}
            >
              <Score
                bytes={bytes}
                format="alphatex"
                zoom={1.1}
                onReady={noop}
                onPrintReady={noop}
                onNoteSelect={selectNote}
                onTrackChange={() => setPosition(null)}
                selectionLocked={pendingSource || pendingNote}
                selectedNote={
                  position ? Object.values(position).join(':') : undefined
                }
              />
            </div>
            <label className="review-score">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              I have checked the notes, rhythm, tuning, and repeats against the
              source.
            </label>
            {!reviewed && (
              <p className="hint">
                You can save your work as a draft and finish reviewing later.
              </p>
            )}
          </>
        )}
      </div>
      {selected && (
        <form
          className="note-inspector"
          onSubmit={(event) => {
            event.preventDefault()
            try {
              if (!position || !fret.trim())
                throw new Error('Enter a fret number.')
              apply(
                editNote(source, position, {
                  fret: Number(fret),
                  duration,
                  dots,
                  technique,
                }),
              )
            } catch (err) {
              setError(message(err))
            }
          }}
        >
          <div className="note-location">
            <strong>
              Bar {position!.bar + 1} · Beat {position!.beat + 1} · String{' '}
              {selected.beat.voice.bar.staff.tuning.length -
                selected.string +
                1}
            </strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Deselect note"
              disabled={pendingNote}
              onClick={() => setPosition(null)}
            >
              <X size={16} />
            </button>
          </div>
          {!canEditFret && (
            <p className="hint">
              Edit this tied, unpitched, or non-string note in alphaTex.
            </p>
          )}
          {measureNeedsReview && (
            <p className="hint measure-warning">
              This voice does not fill the measure’s time signature. Check
              durations, rests, and barlines in alphaTex.
            </p>
          )}
          <fieldset
            disabled={busy || pendingSource || !canEditFret}
            className="note-fields"
          >
            <label>
              Fret
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={36}
                step={1}
                value={fret}
                onChange={(event) => setFret(event.target.value)}
              />
            </label>
            <label>
              Duration
              <select
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              >
                {durationOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dots
              <select
                value={dots}
                onChange={(event) => setDots(Number(event.target.value))}
              >
                <option value={0}>None</option>
                <option value={1}>One</option>
                <option value={2}>Two</option>
              </select>
            </label>
            <label className="technique-field">
              Technique to next note
              <select
                value={technique}
                onChange={(event) =>
                  setTechnique(event.target.value as NoteTechnique)
                }
              >
                <option value="none">None</option>
                <option value="hammer-on">Hammer-on</option>
                <option value="pull-off">Pull-off</option>
              </select>
            </label>
            <button className="primary" type="submit" disabled={!pendingNote}>
              Apply note
            </button>
          </fieldset>
          <p className="hint technique-hint">
            {nextNote
              ? `Links to fret ${nextNote.fret} on this string (bar ${nextNote.beat.voice.bar.index + 1}, beat ${nextNote.beat.index + 1}).`
              : 'No following fretted note on this string. Add one in alphaTex to link a technique.'}
          </p>
          {pendingNote && (
            <button
              type="button"
              className="text-button reset-note"
              onClick={() => {
                setFret(String(selected.fret))
                setDuration(selected.beat.duration)
                setDots(selected.beat.dots)
                setTechnique(noteTechnique(selected))
                setError('')
              }}
            >
              Reset note changes
            </button>
          )}
        </form>
      )}
    </dialog>
  )
}

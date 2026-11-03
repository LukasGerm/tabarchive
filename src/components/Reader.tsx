import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Download,
  ExternalLink,
  Minus,
  Pause,
  Play,
  Plus,
  Printer,
  Pencil,
  Trash2,
  NotebookPen,
  MoreHorizontal,
} from 'lucide-react'
import { formatLabels, statusLabels, type ArchivedTab } from '../lib/archive'
import { api, message, patch } from '../lib/client'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { Score } from './Score'
import { PdfScore } from './PdfScore'
import { TextScore } from './TextScore'
import { downloadAlphaTex, type ScoreDocument } from '../lib/score-document'
import { usePracticeNotes } from '../hooks/usePracticeNotes'
import { readStored, writeStored } from '../lib/browser-storage'
import {
  defaultReaderPreferences,
  readerPreferencesSchema,
} from '../lib/reader-preferences'

const ScoreEditor = lazy(() => import('./ScoreEditor'))

export function Reader({
  tab,
  onUpdated,
  onTrashed,
}: {
  tab: ArchivedTab
  onUpdated: (tab: ArchivedTab) => void
  onTrashed: () => void
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const preferenceKey = `tabarchive:reader:${tab.id}`
  const [preferences, setPreferences] = useState(defaultReaderPreferences)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const { zoom, speed, track } = preferences
  const notes = usePracticeNotes(tab, onUpdated)
  const [notesOpen, setNotesOpen] = useState(false)
  const actions = useRef<HTMLDetailsElement>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [printScore, setPrintScore] = useState<(() => void) | null>(null)
  const [scoreDocument, setScoreDocument] = useState<ScoreDocument | null>(null)
  const [editing, setEditing] = useState(false)
  const savedWhileEditing = useRef<ScoreDocument | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const scoreBytes = useMemo(
    () =>
      scoreDocument?.alphaTex
        ? new TextEncoder().encode(scoreDocument.alphaTex)
        : null,
    [scoreDocument?.alphaTex],
  )
  const useScore = Boolean(scoreBytes && !showOriginal)
  const { running, countdown, toggle, pause } = useAutoScroll(speed)
  const onReady = useCallback(() => setReady(true), [])
  const onPrintReady = useCallback(
    (callback: (() => void) | null) => setPrintScore(() => callback),
    [],
  )

  useEffect(() => {
    setPreferences(
      readStored(preferenceKey, readerPreferencesSchema) ??
        defaultReaderPreferences,
    )
    setPreferencesLoaded(true)
  }, [preferenceKey])
  useEffect(() => {
    if (preferencesLoaded) writeStored(preferenceKey, preferences)
  }, [preferenceKey, preferences, preferencesLoaded])
  const onTrackSelected = useCallback((track: number) => {
    setPreferences((current) => ({ ...current, track }))
  }, [])
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (actions.current && !actions.current.contains(event.target as Node))
        actions.current.open = false
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
    if (tab.format === 'link') return
    const controller = new AbortController()
    void fetch(`/api/tabs/${tab.id}/file`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401)
          window.dispatchEvent(new Event('archive:unauthorized'))
        if (!response.ok)
          throw new Error(
            'The original file could not be opened. Please sign in again or retry.',
          )
        setBytes(new Uint8Array(await response.arrayBuffer()))
        if (tab.format === 'text') setReady(true)
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err))
      })
    return () => controller.abort()
  }, [tab.id, tab.format])

  useEffect(() => {
    const controller = new AbortController()
    void api<ScoreDocument>(`/api/tabs/${tab.id}/score`, {
      signal: controller.signal,
    })
      .then(setScoreDocument)
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err))
      })
    return () => controller.abort()
  }, [tab.id])

  async function update(data: unknown, success: string) {
    pause()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      onUpdated(await patch<ArchivedTab>(`/api/tabs/${tab.id}`, data))
      setNotice(success)
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  async function openEditor() {
    pause()
    setBusy(true)
    setError('')
    try {
      setScoreDocument(await api<ScoreDocument>(`/api/tabs/${tab.id}/score`))
      setEditing(true)
      if (actions.current) actions.current.open = false
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    pause()
    setBusy(true)
    setError('')
    try {
      await api(`/api/tabs/${tab.id}`, { method: 'DELETE' })
      onTrashed()
    } catch (err) {
      setError(message(err))
      setBusy(false)
    }
  }

  function print() {
    pause()
    if (printScore) printScore()
    else window.print()
  }

  return (
    <main className="reader">
      <div className="reader-navigation">
        <Link to="/" search={{}} className="text-button">
          <ArrowLeft size={18} /> Your repertoire
        </Link>
        <span className="format-label">{formatLabels[tab.format]}</span>
      </div>
      <header className="piece-heading">
        <h1>{tab.title}</h1>
        <p className="artist">{tab.artist || 'Your arrangement'}</p>
        <div className="piece-meta">
          <span>
            Source tuning <strong>{tab.tuning}</strong>
          </span>
          <span>
            Source capo{' '}
            <strong>{tab.capo ? `fret ${tab.capo}` : 'none'}</strong>
          </span>
          {tab.attribution && (
            <span>
              Arrangement <strong>{tab.attribution}</strong>
            </span>
          )}
        </div>
      </header>
      <div className="reader-quick-actions">
        <button
          className="secondary"
          aria-label="Notes & practice"
          aria-expanded={notesOpen}
          aria-controls="practice-notes-panel"
          onClick={() => {
            pause()
            setNotesOpen((value) => !value)
          }}
        >
          <NotebookPen size={17} /> Notes
          {notes.dirty && <span className="draft-indicator">Draft</span>}
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            void update({ markPlayed: true }, 'Today’s practice is recorded.')
          }
        >
          <Check size={17} /> Played today
        </button>
        <details
          className="reader-more"
          ref={actions}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && actions.current?.open) {
              actions.current.open = false
              actions.current.querySelector('summary')?.focus()
            }
          }}
        >
          <summary aria-label="Arrangement actions">
            <MoreHorizontal size={19} /> <span>More</span>
          </summary>
          <div className="reader-actions">
            <button
              className="secondary"
              disabled={!scoreDocument || busy}
              onClick={() => void openEditor()}
            >
              <Pencil size={16} /> Edit score
            </button>
            {(tab.format !== 'link' || useScore) && (
              <>
                <button className="secondary" onClick={print} disabled={!ready}>
                  <Printer size={16} /> Print / PDF
                </button>
                {tab.format !== 'link' && (
                  <a
                    className="text-button"
                    href={`/api/tabs/${tab.id}/file`}
                    download
                  >
                    <Download size={16} /> Original
                  </a>
                )}
              </>
            )}
            {scoreDocument?.alphaTex && (
              <button
                className="text-button"
                onClick={() =>
                  downloadAlphaTex(scoreDocument.alphaTex!, tab.title)
                }
              >
                <Download size={16} /> alphaTex
              </button>
            )}
            {tab.sourceUrl && (
              <a
                className="text-button"
                href={tab.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} /> Source
              </a>
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 size={16} /> Move to Bin
            </button>
          </div>
        </details>
      </div>
      <section
        id="practice-notes-panel"
        className="practice-panel"
        hidden={!notesOpen}
      >
        <div className="practice-controls">
          <label>
            Familiarity
            <select
              value={tab.status}
              disabled={busy}
              onChange={(event) =>
                void update(
                  { status: event.target.value },
                  'Familiarity updated.',
                )
              }
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            {tab.lastPlayedAt
              ? `Last played ${new Date(tab.lastPlayedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'No practice recorded yet.'}
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void notes.save()
          }}
        >
          <label>
            Practice notes
            <textarea
              value={notes.text}
              onChange={(event) => {
                setNotice('')
                notes.change(event.target.value)
              }}
              maxLength={10000}
              rows={3}
              aria-describedby="reader-feedback"
              placeholder="A tricky transition. A fingering. Something for next time."
            />
          </label>
          <div className="notes-footer">
            <span className="hint">Changes save automatically.</span>
            {notes.conflict ? (
              <button
                type="button"
                className="secondary"
                onClick={() => void notes.loadSaved()}
              >
                Use saved notes
              </button>
            ) : (
              <button
                className="secondary"
                disabled={notes.saving || !notes.dirty}
              >
                {notes.saving
                  ? 'Saving…'
                  : notes.error
                    ? 'Retry saving notes'
                    : 'Save notes'}
              </button>
            )}
          </div>
        </form>
      </section>
      {(notesOpen || notes.dirty || notice) && (
        <p className="reader-feedback hint" id="reader-feedback" role="status">
          {notes.dirty ? notes.status : notice || notes.status}
        </p>
      )}
      {notes.error && (
        <p className="error" role="alert">
          {notes.error}
        </p>
      )}
      {scoreDocument && (
        <div
          className={`score-status ${scoreDocument.status === 'ready' ? 'score-ready' : ''}`}
        >
          <div>
            <strong>
              {scoreDocument.status === 'ready'
                ? 'Editable score'
                : scoreDocument.status === 'draft'
                  ? 'Transcription draft · needs review'
                  : 'Transcription needed'}
            </strong>
            {scoreDocument.status !== 'ready' && (
              <p>
                {scoreDocument.status === 'draft'
                  ? 'Check the draft against the original, especially rhythm and techniques, before marking it ready.'
                  : scoreDocument.warnings[0]}
              </p>
            )}
          </div>
          {scoreBytes && (
            <button
              className="secondary"
              onClick={() => {
                pause()
                setReady(false)
                setPrintScore(null)
                setShowOriginal((value) => !value)
                if (tab.format === 'text' && !showOriginal) setReady(true)
              }}
            >
              {showOriginal ? 'Show editable score' : 'Show original'}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="sheet" aria-label="Tab reader">
        {useScore && scoreBytes ? (
          <Score
            bytes={scoreBytes}
            format="alphatex"
            zoom={zoom}
            onReady={onReady}
            onPrintReady={onPrintReady}
            initialTrack={track}
            onTrackSelected={onTrackSelected}
          />
        ) : tab.format === 'link' ? (
          <div className="empty">
            <ExternalLink size={32} />
            <h2>A place in your repertoire</h2>
            <p>
              This arrangement is saved as a link.
              <br />
              Open the original source to play it.
            </p>
            <a
              className="primary"
              href={tab.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open source <ExternalLink size={16} />
            </a>
          </div>
        ) : (
          <>
            {!ready && !error && (
              <p className="loading" role="status">
                Preparing your arrangement…
              </p>
            )}
            {bytes &&
              (tab.format === 'text' ? (
                <TextScore text={new TextDecoder().decode(bytes)} zoom={zoom} />
              ) : tab.format === 'pdf' ? (
                <PdfScore bytes={bytes} zoom={zoom} onReady={onReady} />
              ) : (
                <Score
                  bytes={bytes}
                  format={tab.format}
                  zoom={zoom}
                  onReady={onReady}
                  onPrintReady={onPrintReady}
                  initialTrack={track}
                  onTrackSelected={onTrackSelected}
                />
              ))}
          </>
        )}
      </section>
      {editing && scoreDocument && (
        <Suspense
          fallback={
            <p className="loading" role="status">
              Opening editor…
            </p>
          }
        >
          <ScoreEditor
            tab={tab}
            original={bytes}
            document={scoreDocument}
            onSaved={(document) => {
              savedWhileEditing.current = document
            }}
            onClose={() => {
              // Keep the inert reader's height stable while the modal is open.
              // Reflowing it on every save can move the page's scroll anchor.
              if (savedWhileEditing.current) {
                setScoreDocument(savedWhileEditing.current)
                setShowOriginal(false)
                savedWhileEditing.current = null
              }
              setEditing(false)
            }}
          />
        </Suspense>
      )}
      {(tab.format !== 'link' || useScore) && (
        <div className="transport" aria-label="Practice controls">
          <button
            className={`scroll-button ${running ? 'playing' : ''}`}
            onClick={toggle}
            disabled={!ready}
            aria-label={running ? 'Pause autoscroll' : 'Start autoscroll'}
          >
            {countdown ? (
              <strong>{countdown}</strong>
            ) : running ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
            <span>
              {countdown ? 'Get ready…' : running ? 'Pause' : 'Autoscroll'}
            </span>
          </button>
          <label className="speed-control">
            <span>
              Scroll speed <strong>{speed} px/s</strong>
            </span>
            <input
              aria-label="Scroll speed"
              type="range"
              min={5}
              max={80}
              step={1}
              value={speed}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  speed: Number(event.target.value),
                }))
              }
            />
          </label>
          <div className="zoom-control">
            <button
              className="icon-button"
              aria-label="Smaller notation"
              disabled={zoom <= 0.7}
              onClick={() => {
                pause()
                setPreferences((current) => ({
                  ...current,
                  zoom: Math.max(0.7, +(current.zoom - 0.1).toFixed(1)),
                }))
              }}
            >
              <Minus size={17} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="icon-button"
              aria-label="Larger notation"
              disabled={zoom >= 1.8}
              onClick={() => {
                pause()
                setPreferences((current) => ({
                  ...current,
                  zoom: Math.min(1.8, +(current.zoom + 0.1).toFixed(1)),
                }))
              }}
            >
              <Plus size={17} />
            </button>
          </div>
          <button
            className="icon-button back-top"
            aria-label="Back to top"
            onClick={() => {
              pause()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            <ArrowUp size={19} />
          </button>
        </div>
      )}
    </main>
  )
}

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
} from 'lucide-react'
import { formatLabels, statusLabels, type ArchivedTab } from '../lib/archive'
import { api, message, patch } from '../lib/client'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { Score } from './Score'
import { PdfScore } from './PdfScore'
import { TextScore } from './TextScore'
import { downloadAlphaTex, type ScoreDocument } from '../lib/score-document'

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
  const [zoom, setZoom] = useState(1)
  const [speed, setSpeed] = useState(24)
  const [notes, setNotes] = useState(tab.notes)
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
        <p className="eyebrow">A LITTLE TIME WITH YOUR GUITAR</p>
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
      <section className="practice-panel">
        <div>
          <p className="eyebrow">LEAVE A NOTE FOR NEXT TIME</p>
          <h2>How’s it feeling?</h2>
          <p className="hint">
            {tab.lastPlayedAt
              ? `Last played ${new Date(tab.lastPlayedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'Your practice history starts here.'}
          </p>
        </div>
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
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void update({ markPlayed: true }, 'Today’s practice is recorded.')
            }
          >
            <Check size={17} /> Played today
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void update({ notes }, 'Notes saved.')
          }}
        >
          <label>
            Practice notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={10000}
              rows={4}
              placeholder="The transition to the B section. A better fingering. Something to return to."
            />
          </label>
          <div className="notes-footer">
            <p className="hint" role="status">
              {notice}
            </p>
            <button
              className="secondary"
              disabled={busy || notes === tab.notes}
            >
              Save notes
            </button>
          </div>
        </form>
      </section>
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
            onClick={() => downloadAlphaTex(scoreDocument.alphaTex!, tab.title)}
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
      {scoreDocument && (
        <div className="score-status">
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
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </label>
          <div className="zoom-control">
            <button
              className="icon-button"
              aria-label="Smaller notation"
              disabled={zoom <= 0.7}
              onClick={() => {
                pause()
                setZoom((value) => Math.max(0.7, +(value - 0.1).toFixed(1)))
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
                setZoom((value) => Math.min(1.8, +(value + 0.1).toFixed(1)))
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

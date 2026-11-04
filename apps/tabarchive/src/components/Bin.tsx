import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FileMusic, RotateCcw, Search, Trash2 } from 'lucide-react'
import type { ArchivedTab } from '../lib/archive'
import { message, patch } from '../lib/client'

export function Bin({
  tabs,
  loading,
  onRestored,
}: {
  tabs: ArchivedTab[]
  loading: boolean
  onRestored: (tab: ArchivedTab) => void
}) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [restored, setRestored] = useState<ArchivedTab | null>(null)
  const filtered = tabs.filter((tab) =>
    `${tab.title} ${tab.artist}`.toLowerCase().includes(query.toLowerCase()),
  )

  async function restore(tab: ArchivedTab) {
    setBusy(tab.id)
    setError('')
    try {
      const updated = await patch<ArchivedTab>(`/api/tabs/${tab.id}`, {
        trashed: false,
      })
      onRestored(updated)
      setRestored(updated)
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="library-heading">
        <div>
          <p className="eyebrow">ROOM TO CHANGE YOUR MIND</p>
          <h1>
            Bin<span>.</span>
          </h1>
          <p>
            Restore any arrangement with its original file, score edits, and
            practice notes. Nothing here expires.
          </p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {restored && (
        <p className="archive-notice" role="status">
          “{restored.title}” restored.{' '}
          <Link to="/" search={{ tab: restored.id }}>
            Open arrangement
          </Link>
        </p>
      )}
      <section className="arrangements">
        <div className="section-heading">
          <h2>
            Removed arrangements <span>{tabs.length}</span>
          </h2>
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Search Bin"
              placeholder="Find a piece or artist"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {loading ? (
          <div className="empty" role="status">
            Loading your Bin…
          </div>
        ) : !filtered.length ? (
          <div className="empty">
            <Trash2 size={30} strokeWidth={1.4} />
            <h2>{tabs.length ? 'No pieces found' : 'Your Bin is empty'}</h2>
            <p>
              {tabs.length
                ? 'Try another title or artist.'
                : 'Use “Move to Bin” when viewing an arrangement to put it here.'}
            </p>
            <Link to="/" search={{}} className="secondary">
              Back to repertoire
            </Link>
          </div>
        ) : (
          <div className="piece-list">
            {filtered.map((tab) => (
              <article className="bin-row" key={tab.id} aria-label={tab.title}>
                <FileMusic size={24} strokeWidth={1.5} aria-hidden="true" />
                <div className="piece-name">
                  <strong>{tab.title}</strong>
                  <span>
                    {tab.artist || 'Your arrangement'} · Removed{' '}
                    {new Date(tab.trashedAt!).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className="secondary"
                  disabled={busy !== null}
                  onClick={() => void restore(tab)}
                >
                  <RotateCcw size={16} />{' '}
                  {busy === tab.id ? 'Restoring…' : 'Restore'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

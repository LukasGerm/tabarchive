import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  type FormEvent,
} from 'react'
import {
  ArrowRight,
  BookOpen,
  FileMusic,
  Guitar,
  Library,
  Link2,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'
import { api, message } from '../lib/client'
import {
  isRepertoireSort,
  repertoireSortLabels,
  sortRepertoire,
  type RepertoireSort,
} from '../lib/repertoire'
import {
  demoTex,
  formatLabels,
  statusLabels,
  type ArchivedTab,
  type PracticeStatus,
} from '../lib/archive'
import { ImportDialog } from '../components/ImportDialog'
import { Reader } from '../components/Reader'
import { Bin } from '../components/Bin'

const Trainer = lazy(() => import('../components/Trainer'))
const sortPreferenceKey = 'tabarchive:repertoire-sort'

export const Route = createFileRoute('/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: string; view?: 'trainer' | 'bin' } => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
    view:
      search.view === 'trainer' || search.view === 'bin'
        ? search.view
        : undefined,
  }),
  component: Archive,
})

function Brand() {
  return (
    <Link to="/" search={{}} className="brand">
      <span className="brand-mark">
        <Library size={22} strokeWidth={1.7} />
      </span>
      <span>
        tab<span className="brand-light">archive</span>
        <small>KEEP THE MUSIC CLOSE</small>
      </span>
    </Link>
  )
}

function Archive() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [tabs, setTabs] = useState<ArchivedTab[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PracticeStatus | 'all'>('all')
  const [sort, setSort] = useState<RepertoireSort>('added')
  const [creatingDemo, setCreatingDemo] = useState(false)
  const [notice, setNotice] = useState('')
  const { tab: selectedId, view } = Route.useSearch()
  const training = view === 'trainer'
  const inBin = view === 'bin'
  const navigate = useNavigate({ from: '/' })
  const loadSequence = useRef(0)

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setLoading(true)
    setTabs([])
    setError('')
    try {
      const result = await api<ArchivedTab[]>(
        inBin ? '/api/tabs?view=bin' : '/api/tabs',
      )
      if (sequence === loadSequence.current) setTabs(result)
    } catch (err) {
      if (sequence === loadSequence.current) setError(message(err))
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [inBin])

  const checkSession = useCallback(async () => {
    setError('')
    try {
      const data = await api<{ authenticated: boolean }>('/api/session')
      setAuthenticated(data.authenticated)
    } catch (err) {
      setAuthenticated(false)
      setError(message(err))
    }
  }, [])

  useEffect(() => {
    void checkSession()
  }, [checkSession])
  useEffect(() => {
    try {
      const saved = localStorage.getItem(sortPreferenceKey)
      if (isRepertoireSort(saved)) setSort(saved)
    } catch {
      // Sorting still works when browser storage is unavailable.
    }
  }, [])
  useEffect(() => {
    if (authenticated && !training) void load()
    return () => {
      loadSequence.current++
    }
  }, [authenticated, training, load])
  useEffect(() => {
    const expired = () => {
      setAuthenticated(false)
      setTabs([])
      setImporting(false)
    }
    window.addEventListener('archive:unauthorized', expired)
    return () => window.removeEventListener('archive:unauthorized', expired)
  }, [])

  async function signOut() {
    try {
      await api('/api/session', { method: 'DELETE' })
      setAuthenticated(false)
      setTabs([])
      await navigate({ search: {} })
    } catch (err) {
      setError(message(err))
    }
  }

  function imported(tab: ArchivedTab) {
    setTabs((current) => [tab, ...current])
    setImporting(false)
    void navigate({ search: { tab: tab.id } })
  }
  async function demo() {
    setCreatingDemo(true)
    setError('')
    try {
      const form = new FormData()
      form.set('title', 'A little room to play')
      form.set('artist', 'Tab Archive')
      form.set('attribution', 'Original exercise created for Tab Archive')
      form.set('file', new File([demoTex], 'original-study.alphatex'))
      form.set('permission', 'confirmed')
      imported(
        await api<ArchivedTab>('/api/tabs', { method: 'POST', body: form }),
      )
    } catch (err) {
      setError(message(err))
    } finally {
      setCreatingDemo(false)
    }
  }

  const filtered = useMemo(
    () =>
      sortRepertoire(
        tabs.filter(
          (tab) =>
            (filter === 'all' || tab.status === filter) &&
            `${tab.title} ${tab.artist} ${tab.attribution}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        ),
        sort,
      ),
    [tabs, query, filter, sort],
  )
  const selected = tabs.find((tab) => tab.id === selectedId)
  const recent = sortRepertoire(
    tabs.filter((tab) => tab.format !== 'link'),
    'most-recent',
  )[0]

  return (
    <>
      {!(authenticated && training) && (
        <header className="site-header">
          <div className="header-inner">
            <Brand />
            {authenticated && (
              <div className="header-right">
                <span className="private-label">
                  <LockKeyhole size={13} /> Private archive
                </span>
                <button
                  className="icon-button"
                  onClick={() => void signOut()}
                  aria-label="Sign out"
                >
                  <LogOut size={19} />
                </button>
              </div>
            )}
          </div>
        </header>
      )}
      {authenticated && !training && (
        <nav className="app-navigation" aria-label="Main navigation">
          <Link
            to="/"
            search={{}}
            activeOptions={{ exact: true }}
            aria-current={!training && !inBin ? 'page' : undefined}
          >
            <Library size={16} /> Repertoire
          </Link>
          <Link
            to="/"
            search={{ view: 'trainer' }}
            activeOptions={{ exact: true }}
            aria-current={training ? 'page' : undefined}
          >
            <Target size={16} /> Trainer
          </Link>
          <Link
            to="/"
            search={{ view: 'bin' }}
            activeOptions={{ exact: true }}
            aria-current={inBin ? 'page' : undefined}
          >
            <Trash2 size={16} /> Bin
          </Link>
        </nav>
      )}
      {authenticated === null ? (
        <main className="loading" role="status">
          Opening your archive…
        </main>
      ) : !authenticated ? (
        <Login onLogin={() => setAuthenticated(true)} setupError={error} />
      ) : training ? (
        <Suspense
          fallback={
            <main className="loading" role="status">
              Opening your trainer…
            </main>
          }
        >
          <Trainer />
        </Suspense>
      ) : inBin ? (
        <main className="library-page">
          {error && (
            <p className="error" role="alert">
              {error}{' '}
              <button className="text-button" onClick={() => void load()}>
                Retry
              </button>
            </p>
          )}
          <Bin
            tabs={tabs.filter((tab) => tab.trashedAt)}
            loading={loading}
            onRestored={(restored) =>
              setTabs((current) =>
                current.filter((tab) => tab.id !== restored.id),
              )
            }
          />
        </main>
      ) : selectedId ? (
        <>
          {selected ? (
            <Reader
              key={selected.id}
              tab={selected}
              onUpdated={(updated) =>
                setTabs((current) =>
                  current.map((tab) => (tab.id === updated.id ? updated : tab)),
                )
              }
              onTrashed={() => {
                setTabs((current) =>
                  current.filter((tab) => tab.id !== selected.id),
                )
                setNotice(`“${selected.title}” moved to the Bin.`)
                void navigate({ search: {} })
              }}
            />
          ) : (
            <main className="empty">
              {loading ? (
                <p>Opening your arrangement…</p>
              ) : (
                <>
                  <h1>Arrangement unavailable</h1>
                  <p>{error || 'This arrangement may have been removed.'}</p>
                  <Link to="/" search={{ view: 'bin' }} className="text-button">
                    Look in the Bin
                  </Link>
                  <Link to="/" search={{}} className="primary">
                    Back to your archive
                  </Link>
                </>
              )}
            </main>
          )}
        </>
      ) : (
        <main className="library-page">
          {notice && (
            <p className="archive-notice" role="status">
              {notice}{' '}
              <Link to="/" search={{ view: 'bin' }}>
                Open Bin to restore
              </Link>
              <button className="text-button" onClick={() => setNotice('')}>
                Dismiss
              </button>
            </p>
          )}
          <div className="library-heading">
            <div>
              <p className="eyebrow">YOUR PERSONAL MUSIC SHELF</p>
              <h1>
                Your repertoire<span>.</span>
              </h1>
              <p>The pieces you love. Right where you left them.</p>
            </div>
            <button className="primary" onClick={() => setImporting(true)}>
              <Plus size={18} /> Add arrangement
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}{' '}
              <button className="text-button" onClick={() => void load()}>
                Retry
              </button>
            </div>
          )}
          <div className="overview">
            <div>
              <span className="stat-number">
                {String(tabs.length).padStart(2, '0')}
              </span>
              <span>arrangements</span>
            </div>
            <div>
              <span className="stat-number">
                {String(
                  tabs.filter((tab) => tab.status === 'learning').length,
                ).padStart(2, '0')}
              </span>
              <span>in progress</span>
            </div>
            <div>
              <span className="stat-number">
                {String(
                  tabs.filter((tab) => tab.status === 'solid').length,
                ).padStart(2, '0')}
              </span>
              <span>in the fingers</span>
            </div>
            <Guitar className="overview-guitar" size={54} strokeWidth={1} />
          </div>
          {recent && (
            <Link to="/" search={{ tab: recent.id }} className="continue-card">
              <div>
                <p className="eyebrow">A FEW MINUTES WELL SPENT</p>
                <h2>Pick up where you left off.</h2>
                <p>
                  {recent.title}
                  <span> · {recent.artist || 'Your arrangement'}</span>
                </p>
              </div>
              <span className="continue-arrow">
                <ArrowRight size={24} />
              </span>
            </Link>
          )}
          <section className="arrangements">
            <div className="section-heading">
              <h2>
                The collection <span>{tabs.length}</span>
              </h2>
              <label className="search">
                <Search size={18} />
                <input
                  aria-label="Search arrangements"
                  placeholder="Find a piece or artist"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="filter-row" aria-label="Filter by familiarity">
              {(['all', 'learning', 'familiar', 'solid'] as const).map(
                (value) => (
                  <button
                    aria-pressed={filter === value}
                    key={value}
                    className={filter === value ? 'active' : ''}
                    onClick={() => setFilter(value)}
                  >
                    {value === 'all' ? 'All pieces' : statusLabels[value]}
                  </button>
                ),
              )}
            </div>
            <div className="collection-sort">
              <label htmlFor="repertoire-sort">Sort by</label>
              <select
                id="repertoire-sort"
                value={sort}
                aria-describedby={
                  sort === 'least-recent' ? 'sort-hint' : undefined
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!isRepertoireSort(value)) return
                  setSort(value)
                  try {
                    localStorage.setItem(sortPreferenceKey, value)
                  } catch {
                    // Keep the selection for this visit if storage is unavailable.
                  }
                }}
              >
                {Object.entries(repertoireSortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {sort === 'least-recent' && (
                <p id="sort-hint">
                  Never played first, then the longest time away.
                </p>
              )}
            </div>
            {loading ? (
              <div className="empty" role="status">
                Loading your repertoire…
              </div>
            ) : tabs.length === 0 ? (
              <div className="empty first-piece">
                <div className="empty-art">
                  <FileMusic size={48} strokeWidth={1} />
                  <span>
                    <Plus size={18} />
                  </span>
                </div>
                <p className="eyebrow">EVERY REPERTOIRE STARTS SOMEWHERE</p>
                <h2>Give your music a home.</h2>
                <p>
                  Bring in a tab, save a source, and make it easier
                  <br className="desktop-break" /> to come back to the pieces
                  you love.
                </p>
                <button className="primary" onClick={() => setImporting(true)}>
                  <Plus size={17} /> Add your first arrangement
                </button>
                <button
                  className="text-button demo-button"
                  onClick={() => void demo()}
                  disabled={creatingDemo}
                >
                  <Sparkles size={15} />
                  {creatingDemo
                    ? 'Preparing the study…'
                    : 'Try the reader with an original study'}
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <Search size={28} />
                <h2>No pieces found</h2>
                <p>Try another title, artist, or familiarity filter.</p>
                <button
                  className="secondary"
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                  }}
                >
                  Show all arrangements
                </button>
              </div>
            ) : (
              <div className="piece-list">
                {filtered.map((tab, index) => (
                  <Link
                    className="piece-row"
                    to="/"
                    search={{ tab: tab.id }}
                    key={tab.id}
                  >
                    <span className="piece-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`piece-icon ${tab.format === 'link' ? 'link-icon' : ''}`}
                    >
                      {tab.format === 'link' ? (
                        <Link2 size={22} />
                      ) : (
                        <FileMusic size={25} strokeWidth={1.5} />
                      )}
                    </span>
                    <span className="piece-name">
                      <strong>{tab.title}</strong>
                      <span>
                        {tab.artist || 'Your arrangement'}
                        <span className="row-format">
                          {' '}
                          · {formatLabels[tab.format]}
                        </span>
                      </span>
                      <span className="piece-last-played">
                        {tab.lastPlayedAt ? (
                          <>
                            Last played{' '}
                            <time dateTime={tab.lastPlayedAt}>
                              {new Date(tab.lastPlayedAt).toLocaleDateString(
                                undefined,
                                {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                },
                              )}
                            </time>
                          </>
                        ) : (
                          'Never played'
                        )}
                      </span>
                    </span>
                    <span className={`status-dot ${tab.status}`}>
                      <i />
                      {statusLabels[tab.status]}
                    </span>
                    <ArrowRight size={18} className="row-arrow" />
                  </Link>
                ))}
              </div>
            )}
          </section>
          <footer className="library-footer">
            <ShieldCheck size={15} />
            <span>
              Your music, your space. Only you can access this archive.
            </span>
          </footer>
        </main>
      )}
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImported={imported}
        />
      )}
    </>
  )
}

function Login({
  onLogin,
  setupError,
}: {
  onLogin: () => void
  setupError: string
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const password = new FormData(event.currentTarget).get('password')
    try {
      await api('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      onLogin()
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="login-page">
      <div className="login-intro">
        <span className="login-icon">
          <BookOpen size={34} strokeWidth={1.2} />
        </span>
        <p className="eyebrow">A PERSONAL ARCHIVE FOR YOUR GUITAR</p>
        <h1>
          Keep the
          <br />
          music close<span>.</span>
        </h1>
        <p>
          Less searching. More playing.
          <br />A quiet home for your growing repertoire.
        </p>
        <div className="string-decoration" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((number) => (
            <span key={number}>
              <i style={{ left: `${20 + number * 10}%` }} />
            </span>
          ))}
        </div>
      </div>
      <div className="login-card">
        <LockKeyhole size={23} strokeWidth={1.5} />
        <h2>Welcome back.</h2>
        <p>Sign in to your private archive.</p>
        <form onSubmit={submit}>
          <label>
            Your password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              autoFocus
            />
          </label>
          {(error || setupError) && (
            <p className="error" role="alert">
              {error || setupError}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Open my archive'}
            <ArrowRight size={17} />
          </button>
        </form>
        <span className="login-footnote">
          <ShieldCheck size={14} /> Your arrangements stay private.
        </span>
      </div>
    </main>
  )
}

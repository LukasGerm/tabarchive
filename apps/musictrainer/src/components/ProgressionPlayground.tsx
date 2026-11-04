import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Play,
  Plus,
  Repeat2,
  Save,
  Square,
  Trash2,
} from 'lucide-react'
import { HarmonyPlayer } from '../lib/harmony-audio'
import { type HarmonySound, type ChordSize } from '../lib/harmony'
import { instruments, type Instrument } from '../lib/instruments'
import { readStored, writeStored } from '../lib/browser-storage'
import { pitchAt, positionKey } from '../lib/trainer'
import {
  changedTones,
  defaultPlayground,
  playgroundChords,
  playgroundKeyName,
  playgroundPresets,
  playgroundScale,
  playgroundSchema,
  playgroundStorageKey,
  progressionChords,
  progressionSounds,
  toneRole,
  type KeyMode,
  type PlaybackStyle,
  type Progression,
  type ProgressionStep,
} from '../lib/playground'
import { TrainerFretboard } from './TrainerFretboard'
import { PlaygroundPractice } from './PlaygroundPractice'
import '../playground.css'

export function ProgressionPlayground({
  instrument,
}: {
  instrument: Instrument
}) {
  const [data, setData] = useState(
    () =>
      readStored(playgroundStorageKey, playgroundSchema) ?? defaultPlayground,
  )
  const [selected, setSelected] = useState(0)
  const [paletteSize, setPaletteSize] = useState<ChordSize>('triads')
  const [snapshot, setSnapshot] = useState<Progression | null>(null)
  const [practice, setPractice] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [notice, setNotice] = useState('')
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [playing, setPlaying] = useState('')
  const [playingStep, setPlayingStep] = useState<number | null>(null)
  const [audioError, setAudioError] = useState('')
  const player = useRef<HarmonyPlayer | null>(null)
  const playbackRequest = useRef(0)
  const { draft, tempo, style, loop, saved } = data
  const chords = progressionChords(draft)
  const selectedIndex = Math.min(selected, Math.max(0, chords.length - 1))
  const chord = chords[selectedIndex]
  const step = draft.steps[selectedIndex]
  const palette = playgroundChords(draft.tonic, draft.mode, paletteSize)
  const scale = playgroundScale(draft.tonic, draft.mode)
  const originalChord = snapshot && progressionChords(snapshot)[selectedIndex]
  const difference =
    originalChord && chord ? changedTones(originalChord, chord) : null

  useEffect(() => {
    setStorageAvailable(writeStored(playgroundStorageKey, data))
  }, [data])
  useEffect(
    () => () => {
      playbackRequest.current++
      player.current?.stop()
    },
    [],
  )
  useEffect(() => {
    stop()
  }, [instrument])

  function stop() {
    playbackRequest.current++
    player.current?.stop()
    setPlaying('')
    setPlayingStep(null)
  }
  async function play(sounds: HarmonySound[], label: string, repeat = false) {
    stop()
    if (!sounds.length) return
    const request = playbackRequest.current
    setAudioError('')
    setPlaying(label)
    player.current ??= new HarmonyPlayer()
    try {
      await player.current.play(
        sounds,
        (index) => setPlayingStep(index),
        () => {
          setPlaying('')
          setPlayingStep(null)
        },
        { loop: repeat },
      )
    } catch {
      if (playbackRequest.current !== request) return
      setPlaying('')
      setPlayingStep(null)
      setAudioError(
        'Audio could not start. Try Play again with audio enabled. You can still build and explore your progression.',
      )
    }
  }
  function update(next: Progression, index = selectedIndex) {
    stop()
    setPractice(false)
    setData((current) => ({ ...current, draft: next }))
    setSelected(Math.max(0, Math.min(index, next.steps.length - 1)))
    setNotice('')
  }
  function editStep(change: Partial<ProgressionStep>) {
    update({
      ...draft,
      steps: draft.steps.map((item, index) =>
        index === selectedIndex ? { ...item, ...change } : item,
      ),
    })
  }
  function move(direction: number) {
    const steps = [...draft.steps]
    const next = selectedIndex + direction
    if (next < 0 || next >= steps.length) return
    ;[steps[selectedIndex], steps[next]] = [steps[next], steps[selectedIndex]]
    update({ ...draft, steps }, next)
  }
  function playProgression(
    progression: Progression,
    label: string,
    repeat = loop,
  ) {
    void play(progressionSounds(progression, tempo, style), label, repeat)
  }
  const toneLabels: Record<string, string> = {}
  if (chord)
    instruments[instrument].strings.forEach((_, string) => {
      for (let fret = 0; fret <= 5; fret++) {
        const position = { string, fret }
        const tone = chord.pitches.indexOf(pitchAt(position, instrument))
        if (tone !== -1) toneLabels[positionKey(position)] = chord.notes[tone]
      }
    })

  return (
    <section className="playground" aria-labelledby="playground-title">
      <div className="playground-heading">
        <span className="playground-eyebrow">Make a little music</span>
        <h2 id="playground-title">Chord playground</h2>
        <p>Build a progression. Follow your ears. Discover what’s inside.</p>
      </div>
      {practice ? (
        <PlaygroundPractice
          progression={draft}
          targetIndex={selectedIndex}
          instrument={instrument}
          onPlay={(sounds, label) => void play(sounds, label)}
          onStop={stop}
          onClose={() => {
            stop()
            setPractice(false)
          }}
        />
      ) : (
        <>
          <div className="playground-keybar">
            <label>
              Key
              <select
                value={draft.tonic}
                onChange={(event) =>
                  update({ ...draft, tonic: Number(event.target.value) })
                }
              >
                {Array.from({ length: 12 }, (_, pitch) => (
                  <option key={pitch} value={pitch}>
                    {playgroundScale(pitch, draft.mode)[0].name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Scale
              <select
                value={draft.mode}
                onChange={(event) =>
                  update({ ...draft, mode: event.target.value as KeyMode })
                }
              >
                <option value="major">Major</option>
                <option value="minor">Natural minor</option>
              </select>
            </label>
            <div className="playground-scale">
              <span>{playgroundKeyName(draft)}</span>
              <p>{scale.map((note) => note.name).join(' · ')}</p>
            </div>
          </div>
          <section className="playground-palette" aria-label="Chord palette">
            <div className="playground-section-heading">
              <div>
                <h3>Pick your chords</h3>
                <p>Tap to add. Every chord here belongs to your key.</p>
              </div>
              <label>
                <span className="playground-sr-only">Palette chord type</span>
                <select
                  value={paletteSize}
                  onChange={(event) =>
                    setPaletteSize(event.target.value as ChordSize)
                  }
                >
                  <option value="triads">Triads</option>
                  <option value="sevenths">Sevenths</option>
                </select>
              </label>
            </div>
            <div className="playground-chord-palette">
              {palette.map((item) => (
                <button
                  key={item.degree}
                  aria-label={`Add ${item.name} (${item.roman})`}
                  disabled={draft.steps.length >= 16}
                  onClick={() =>
                    update(
                      {
                        ...draft,
                        steps: [
                          ...draft.steps,
                          { degree: item.degree, size: paletteSize, beats: 4 },
                        ],
                      },
                      draft.steps.length,
                    )
                  }
                >
                  <span>{item.roman}</span>
                  <strong>{item.name}</strong>
                  <Plus size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
            {draft.steps.length >= 16 && (
              <p>16 chords reached. Remove a chord to add another.</p>
            )}
          </section>
          <section
            className="playground-composition"
            aria-label="Progression builder"
          >
            <div className="playground-section-heading">
              <div>
                <h3>Your progression</h3>
                <p>Select a chord to change it or explore its notes.</p>
              </div>
              <button
                className="playground-text-button"
                disabled={!chords.length}
                onClick={() => update({ ...draft, steps: [] })}
              >
                Clear
              </button>
            </div>
            <ol
              className="playground-progression"
              aria-label="Your progression"
            >
              {chords.map((item, index) => (
                <li key={index}>
                  <button
                    className={`${index === selectedIndex ? 'is-selected' : ''} ${playingStep === index && (playing === 'Your progression' || playing === 'Version B') ? 'is-playing' : ''}`}
                    aria-label={`Chord ${index + 1}: ${item.name}, ${item.roman}`}
                    aria-pressed={index === selectedIndex}
                    onClick={() => setSelected(index)}
                  >
                    <span className="playground-slot-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>{item.roman}</span>
                    <strong>{item.name}</strong>
                    <small>
                      {draft.steps[index].beats}{' '}
                      {draft.steps[index].beats === 1 ? 'beat' : 'beats'}
                    </small>
                  </button>
                </li>
              ))}
            </ol>
            {!chords.length && (
              <p className="playground-empty">
                Your next idea starts here. Add a chord above or try a starter
                below.
              </p>
            )}
            <div className="playground-presets">
              <span>Start with</span>
              {playgroundPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() =>
                    update(
                      {
                        ...draft,
                        steps: preset[draft.mode].map((degree) => ({
                          degree,
                          size: paletteSize,
                          beats: 4,
                        })),
                      },
                      0,
                    )
                  }
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="playground-transport">
              <button
                className="trainer-primary"
                disabled={!chords.length}
                onClick={() =>
                  playing ? stop() : playProgression(draft, 'Your progression')
                }
              >
                {playing ? <Square size={17} /> : <Play size={17} />}
                {playing ? 'Stop playback' : 'Play progression'}
              </button>
              <button
                className="playground-loop"
                aria-label="Loop progression"
                aria-pressed={loop}
                onClick={() => {
                  stop()
                  setData({ ...data, loop: !loop })
                }}
              >
                <Repeat2 size={19} />
                <span>Loop</span>
              </button>
              <label>
                Tempo
                <select
                  value={tempo}
                  onChange={(event) => {
                    stop()
                    setData({ ...data, tempo: Number(event.target.value) })
                  }}
                >
                  {Array.from(
                    { length: 17 },
                    (_, index) => 40 + index * 10,
                  ).map((bpm) => (
                    <option key={bpm} value={bpm}>
                      {bpm} BPM
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sound
                <select
                  value={style}
                  onChange={(event) => {
                    stop()
                    setData({
                      ...data,
                      style: event.target.value as PlaybackStyle,
                    })
                  }}
                >
                  <option value="chords">Full chords</option>
                  <option value="arpeggio">Arpeggios</option>
                  <option value="roots">Roots only</option>
                </select>
              </label>
            </div>
          </section>
          {chord && (
            <section
              className="playground-explore"
              aria-label="Explore selected chord"
            >
              <div className="playground-chord-details">
                <span className="playground-eyebrow">
                  Inside chord {selectedIndex + 1}
                </span>
                <h3 className="playground-chord-title">
                  {chord.name} <span>{chord.roman}</span>
                </h3>
                <div className="playground-step-settings">
                  <label>
                    Replace chord
                    <select
                      value={step.degree}
                      onChange={(event) =>
                        editStep({ degree: Number(event.target.value) })
                      }
                    >
                      {playgroundChords(draft.tonic, draft.mode, step.size).map(
                        (item) => (
                          <option key={item.degree} value={item.degree}>
                            {item.name} · {item.roman}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Chord type
                    <select
                      value={step.size}
                      onChange={(event) =>
                        editStep({ size: event.target.value as ChordSize })
                      }
                    >
                      <option value="triads">Triad</option>
                      <option value="sevenths">Seventh</option>
                    </select>
                  </label>
                  <label>
                    Beats
                    <select
                      value={step.beats}
                      onChange={(event) =>
                        editStep({ beats: Number(event.target.value) })
                      }
                    >
                      {Array.from({ length: 8 }, (_, index) => (
                        <option key={index} value={index + 1}>
                          {index + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="playground-edit-actions">
                  <button
                    aria-label="Move chord earlier"
                    disabled={selectedIndex === 0}
                    onClick={() => move(-1)}
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <button
                    aria-label="Move chord later"
                    disabled={selectedIndex === chords.length - 1}
                    onClick={() => move(1)}
                  >
                    <ArrowRight size={17} />
                  </button>
                  <button
                    disabled={chords.length >= 16}
                    onClick={() =>
                      update(
                        {
                          ...draft,
                          steps: [
                            ...draft.steps.slice(0, selectedIndex + 1),
                            { ...step },
                            ...draft.steps.slice(selectedIndex + 1),
                          ],
                        },
                        selectedIndex + 1,
                      )
                    }
                  >
                    <Copy size={16} />
                    Duplicate
                  </button>
                  <button
                    onClick={() =>
                      update({
                        ...draft,
                        steps: draft.steps.filter(
                          (_, index) => index !== selectedIndex,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                    Remove
                  </button>
                </div>
                <ul className="playground-tones" aria-label="Chord tones">
                  {chord.notes.map((note, index) => (
                    <li key={note}>
                      <strong>{note}</strong>
                      <span>{toneRole(chord.intervals[index])}</span>
                      <small>
                        {chord.intervals[index] === 0
                          ? 'The starting note'
                          : `${chord.intervals[index]} semitones`}
                      </small>
                    </li>
                  ))}
                </ul>
                <div className="playground-preview-actions">
                  <button
                    className="playground-secondary"
                    onClick={() =>
                      void play(
                        progressionSounds(
                          { ...draft, steps: [step] },
                          tempo,
                          'chords',
                        ),
                        'Selected chord',
                      )
                    }
                  >
                    <Play size={15} />
                    Hear chord
                  </button>
                  <button
                    className="playground-secondary"
                    onClick={() =>
                      void play(
                        progressionSounds(
                          { ...draft, steps: [step] },
                          tempo,
                          'arpeggio',
                        ),
                        'Chord tones',
                      )
                    }
                  >
                    <Play size={15} />
                    Hear each note
                  </button>
                </div>
                <p className="playground-footnote">
                  Notes shown across frets 0–5. Play them separately to explore
                  an arpeggio.
                </p>
              </div>
              <div className="playground-explore-board">
                <TrainerFretboard
                  instrument={instrument}
                  maxFret={5}
                  spelling="sharps"
                  toneLabels={toneLabels}
                />
                <p className="playground-sr-only">
                  {chord.notes.join(', ')} on the {instrument} fretboard.
                </p>
              </div>
            </section>
          )}
          <div className="playground-bottom-grid">
            <section
              className="playground-comparison"
              aria-label="Compare variations"
            >
              <h3>What changes if…?</h3>
              <p>Keep version A, change a chord, then listen to both.</p>
              <button
                className="playground-secondary"
                disabled={!chords.length}
                onClick={() => {
                  setSnapshot(structuredClone(draft))
                  setNotice(
                    'Version A captured. Edit your progression to create version B.',
                  )
                }}
              >
                {snapshot ? 'Capture a new A' : 'Keep as version A'}
              </button>
              {snapshot && (
                <div className="playground-versions">
                  <p>
                    <strong>A</strong>{' '}
                    {progressionChords(snapshot)
                      .map((item) => item.name)
                      .join(' → ')}{' '}
                    <small>({playgroundKeyName(snapshot)})</small>
                  </p>
                  <p>
                    <strong>B</strong>{' '}
                    {chords.map((item) => item.name).join(' → ') || 'Empty'}{' '}
                    <small>({playgroundKeyName(draft)})</small>
                  </p>
                  <div className="playground-preview-actions">
                    <button
                      className="playground-secondary"
                      onClick={() =>
                        playProgression(snapshot, 'Version A', false)
                      }
                    >
                      <Play size={15} />
                      Play A
                    </button>
                    <button
                      className="playground-secondary"
                      disabled={!chords.length}
                      onClick={() => playProgression(draft, 'Version B', false)}
                    >
                      <Play size={15} />
                      Play B
                    </button>
                  </div>
                  {difference && (
                    <p className="playground-difference">
                      At position {selectedIndex + 1}: {originalChord!.name} →{' '}
                      {chord.name}.{' '}
                      {difference.kept.length > 0 &&
                        `Shared: ${difference.kept.join(', ')}. `}
                      {difference.removed.length > 0 &&
                        `Removed: ${difference.removed.join(', ')}. `}
                      {difference.added.length > 0 &&
                        `Added: ${difference.added.join(', ')}.`}
                    </p>
                  )}
                </div>
              )}
            </section>
            <section className="playground-practice-invite">
              <span className="playground-eyebrow">Connect the dots</span>
              <h3>Learn from your own music.</h3>
              <p>
                Name a chord. Find its root. Hear its third. Recall your
                sequence.
              </p>
              <button
                className="trainer-primary"
                disabled={!chords.length}
                onClick={() => {
                  stop()
                  setPractice(true)
                }}
              >
                Practice my progression <ArrowRight size={17} />
              </button>
              <p className="playground-footnote">
                Starts with the selected chord. Four steps, at your pace.
              </p>
            </section>
          </div>
          <section
            className="playground-library"
            aria-label="Saved progressions"
          >
            <div className="playground-section-heading">
              <div>
                <h3>Keep your ideas</h3>
                <p>Your draft and saved progressions stay in this browser.</p>
              </div>
            </div>
            <form
              className="playground-save"
              onSubmit={(event) => {
                event.preventDefault()
                if (!saveName.trim() || !chords.length || saved.length >= 20)
                  return
                setData({
                  ...data,
                  saved: [
                    ...saved,
                    {
                      id: crypto.randomUUID(),
                      name: saveName.trim(),
                      progression: structuredClone(draft),
                    },
                  ],
                })
                setSaveName('')
                setNotice(`Saved “${saveName.trim()}”.`)
              }}
            >
              <label>
                <span className="playground-sr-only">Progression name</span>
                <input
                  value={saveName}
                  maxLength={60}
                  placeholder="Give this idea a name…"
                  onChange={(event) => setSaveName(event.target.value)}
                />
              </label>
              <button
                className="playground-secondary"
                disabled={
                  !chords.length || !saveName.trim() || saved.length >= 20
                }
              >
                <Save size={16} />
                Save
              </button>
            </form>
            {saved.length >= 20 && (
              <p>20 saved ideas reached. Delete one to make room.</p>
            )}
            {saved.length > 0 && (
              <ul className="playground-saved-list">
                {saved.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() =>
                        update(structuredClone(item.progression), 0)
                      }
                    >
                      <strong>{item.name}</strong>
                      <span>
                        {playgroundKeyName(item.progression)} ·{' '}
                        {progressionChords(item.progression)
                          .map((chord) => chord.name)
                          .join(' – ')}
                      </span>
                    </button>
                    <button
                      aria-label={`Delete ${item.name}`}
                      onClick={() => {
                        setData({
                          ...data,
                          saved: saved.filter((entry) => entry.id !== item.id),
                        })
                        setNotice(`Deleted “${item.name}”.`)
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {practice && playing && (
        <button className="playground-secondary" onClick={stop}>
          <Square size={16} />
          Stop playback
        </button>
      )}
      <p className="playground-notice" role="status">
        {playing ? `Playing: ${playing}` : notice}
      </p>
      {audioError && (
        <p className="harmony-audio-error" role="alert">
          {audioError}
        </p>
      )}
      {!storageAvailable && (
        <p role="alert">
          Browser storage is unavailable. Your ideas will last for this visit
          only.
        </p>
      )}
    </section>
  )
}

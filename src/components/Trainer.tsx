import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Flame,
  RotateCcw,
  Settings2,
  X,
} from 'lucide-react'
import {
  availablePositions,
  guitarStrings,
  initialTrainerState,
  midiAt,
  nextQuestion,
  noteName,
  pitchAt,
  pitchName,
  positionKey,
  trainerReducer,
  type TrainerMode,
  type TrainerSettings,
} from '../lib/trainer'
import { TrainerFretboard } from './TrainerFretboard'

const modes: { value: TrainerMode; label: string }[] = [
  { value: 'name', label: 'Name a note' },
  { value: 'find', label: 'Find a note' },
  { value: 'chords', label: 'Chord shapes' },
]
const ranges = [
  { minFret: 0, maxFret: 5 },
  { minFret: 0, maxFret: 12 },
  { minFret: 5, maxFret: 12 },
  { minFret: 12, maxFret: 24 },
] as const

export default function Trainer() {
  const [state, dispatch] = useReducer(trainerReducer, initialTrainerState)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const prompt = useRef<HTMLHeadingElement>(null)
  const focusNext = useRef(false)
  const { settings, question, status, wrongAnswers } = state
  const resolved = status !== 'waiting'
  useLayoutEffect(() => {
    if (!focusNext.current) return
    focusNext.current = false
    prompt.current?.focus({ preventScroll: true })
    prompt.current?.scrollIntoView({ block: 'nearest' })
  }, [question, settings.mode])
  useEffect(() => {
    if (settingsOpen) dialog.current?.showModal()
    else dialog.current?.close()
  }, [settingsOpen])

  function begin(config = settings, focus = false) {
    focusNext.current = focus
    dispatch({
      type: 'question',
      settings: config,
      question: nextQuestion(config, question?.id),
    })
  }
  function configure(update: Partial<TrainerSettings>) {
    const config = { ...settings, ...update }
    if (question) begin(config)
    else dispatch({ type: 'settings', settings: config })
  }

  const correctValue =
    question?.mode === 'chords'
      ? question.shape.name
      : question
        ? String(
            question.mode === 'name' && settings.octaves
              ? midiAt(question.position)
              : question.pitch,
          )
        : ''
  const answerName =
    question?.mode === 'chords'
      ? question.shape.name
      : question
        ? noteName(
            midiAt(question.position),
            settings.spelling,
            question.mode === 'name' && settings.octaves,
          )
        : ''
  const answerLocation =
    question?.mode === 'find'
      ? availablePositions({
          ...settings,
          notes: 'all',
          string: question.position.string,
        })
          .filter((position) => pitchAt(position) === question.pitch)
          .map(({ fret }) => (fret === 0 ? 'open' : `fret ${fret}`))
          .join(' or ')
      : ''
  let feedback = 'Choose the note at the red marker.'
  if (!question) feedback = 'Start a session. Nothing is saved when you leave.'
  else if (status === 'correct')
    feedback = `${wrongAnswers.length ? 'You found it' : 'Correct'} — ${answerName}.`
  else if (status === 'revealed') feedback = `The answer is ${answerName}.`
  else if (wrongAnswers.length) {
    if (question.mode === 'find') {
      const [string, fret] = wrongAnswers.at(-1)!.split(':').map(Number)
      feedback = `That’s ${pitchName(pitchAt({ string, fret }), settings.spelling)}. ${string !== question.position.string ? `Use string ${6 - question.position.string}.` : 'Try another fret.'}`
    } else feedback = 'Not quite. Try another answer.'
  } else if (question.mode === 'chords')
    feedback = 'Name the chord. × mute · ○ open · line = barre.'
  else if (question.mode === 'find')
    feedback = 'Tap a matching fret on the highlighted string.'

  return (
    <main className={`trainer-page mode-${settings.mode}`}>
      <div className="trainer-shell">
        <header className="trainer-topbar">
          <Link
            to="/"
            search={{}}
            className="trainer-icon-button"
            aria-label="Back to repertoire"
          >
            <ArrowLeft size={21} />
          </Link>
          <h1>Fretboard trainer</h1>
          <button
            ref={settingsButton}
            className="trainer-icon-button"
            aria-label="Practice settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={21} />
          </button>
        </header>
        <div className="trainer-modes" role="group" aria-label="Exercise mode">
          {modes.map((mode) => (
            <button
              key={mode.value}
              aria-pressed={settings.mode === mode.value}
              onClick={() => configure({ mode: mode.value })}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {settings.mode === 'chords' ? (
          <div
            className="trainer-ranges"
            role="group"
            aria-label="Chord collection"
          >
            <span>Shapes</span>
            {(['open', 'barre', 'all'] as const).map((value) => (
              <button
                key={value}
                aria-pressed={settings.chords === value}
                onClick={() => configure({ chords: value })}
              >
                {value === 'all' ? 'All' : value === 'open' ? 'Open' : 'Barre'}
              </button>
            ))}
          </div>
        ) : (
          <div className="trainer-ranges" role="group" aria-label="Fret range">
            <span>Frets</span>
            {ranges.map((range) => (
              <button
                key={`${range.minFret}-${range.maxFret}`}
                aria-label={`Frets ${range.minFret} to ${range.maxFret}`}
                aria-pressed={
                  settings.minFret === range.minFret &&
                  settings.maxFret === range.maxFret
                }
                onClick={() => configure(range)}
              >
                {range.minFret}–{range.maxFret}
              </button>
            ))}
          </div>
        )}
        <section className="trainer-exercise" aria-labelledby="trainer-prompt">
          <div className="trainer-question-heading">
            <div>
              <h2 id="trainer-prompt" ref={prompt} tabIndex={-1}>
                {settings.mode === 'find' ? (
                  <>
                    Find{' '}
                    <span className="target-note">
                      {answerName || 'the note'}
                    </span>
                  </>
                ) : settings.mode === 'chords' ? (
                  'Which chord is this?'
                ) : (
                  'What note is marked?'
                )}
              </h2>
              <p className="exercise-description">
                {!question
                  ? 'Standard tuning · low E on the left'
                  : question.mode === 'chords'
                    ? 'Low E → high E · standard tuning'
                    : `String ${6 - question.position.string} · ${guitarStrings[question.position.string].name}${question.mode === 'name' ? ` · ${question.position.fret === 0 ? 'open' : `fret ${question.position.fret}`}` : ' · tap the fretboard'}`}
              </p>
            </div>
            <span className="trainer-question-count">
              {question ? `#${state.completed + (resolved ? 0 : 1)}` : 'Ready?'}
            </span>
          </div>
          <div
            className={`trainer-workspace ${!question ? 'not-started' : ''}`}
          >
            <TrainerFretboard
              key={question?.id ?? 'preview'}
              minFret={settings.minFret}
              maxFret={settings.maxFret}
              spelling={settings.spelling}
              activeString={
                question?.mode === 'find' ? question.position.string : undefined
              }
              marked={question?.mode === 'name' ? question.position : undefined}
              answerPitch={
                question?.mode === 'find' && resolved
                  ? question.pitch
                  : undefined
              }
              wrongPositions={question?.mode === 'find' ? wrongAnswers : []}
              onPick={
                question?.mode === 'find'
                  ? (position) =>
                      dispatch({
                        type: 'answer',
                        answer: positionKey(position),
                      })
                  : undefined
              }
              shape={question?.mode === 'chords' ? question.shape : undefined}
              resolved={resolved}
            />
            {question && question.mode !== 'find' && (
              <div
                className="trainer-choices"
                role="group"
                aria-label="Answer choices"
              >
                {question.choices.map((choice) => (
                  <button
                    key={choice.value}
                    className={`${resolved && choice.value === correctValue ? 'correct-choice' : ''} ${wrongAnswers.includes(choice.value) ? 'wrong-choice' : ''}`}
                    aria-disabled={
                      resolved || wrongAnswers.includes(choice.value)
                    }
                    onClick={() => {
                      if (!resolved)
                        dispatch({ type: 'answer', answer: choice.value })
                    }}
                  >
                    <span>{choice.label}</span>
                    {resolved && choice.value === correctValue && (
                      <Check size={18} />
                    )}
                    {wrongAnswers.includes(choice.value) && <X size={16} />}
                  </button>
                ))}
              </div>
            )}
            {!question && (
              <div className="trainer-start">
                <span className="trainer-start-kicker">
                  LEARN THE WHOLE NECK
                </span>
                <h3>
                  {settings.mode === 'find'
                    ? 'Find your way.'
                    : settings.mode === 'chords'
                      ? 'Know the shapes.'
                      : 'See it. Name it.'}
                </h3>
                <p>
                  {settings.mode === 'name'
                    ? 'A red marker. Five answers. Every fret in your chosen range.'
                    : settings.mode === 'find'
                      ? 'A note and a string. Tap the right position.'
                      : 'Recognize open and barre chord shapes.'}
                </p>
                <button
                  className="trainer-primary"
                  onClick={() => begin(settings, true)}
                >
                  Start practice <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
          <div className="trainer-response">
            <div
              className={`trainer-feedback ${status === 'correct' ? 'correct' : wrongAnswers.length && !resolved ? 'retry' : ''}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <p>{feedback}</p>
              {resolved && question && (
                <p className="answer-detail">
                  {question.mode === 'chords'
                    ? `Chord tones: ${question.shape.tones}.`
                    : question.mode === 'find'
                      ? `Play ${answerLocation} on string ${6 - question.position.string}.`
                      : `${guitarStrings[question.position.string].name} string + ${question.position.fret} semitones${settings.octaves ? ' · sounding pitch' : ''}.`}
                </p>
              )}
            </div>
            {question &&
              (resolved ? (
                <button
                  className="trainer-primary"
                  onClick={() => begin(settings, true)}
                >
                  Next question <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  className="trainer-reveal"
                  onClick={() => dispatch({ type: 'reveal' })}
                >
                  <CircleHelp size={17} /> Show answer
                </button>
              ))}
          </div>
        </section>
        <footer className="trainer-session" aria-label="Session progress">
          <span>
            <strong data-testid="trainer-completed">{state.completed}</strong>{' '}
            answered
          </span>
          <span>
            <strong data-testid="trainer-first-try">
              {state.firstTry}/{state.completed}
            </strong>{' '}
            first try
          </span>
          <span>
            <Flame size={15} />
            <strong data-testid="trainer-streak">{state.streak}</strong> streak
          </span>
          <button
            className="trainer-icon-button"
            aria-label="Reset session"
            disabled={!question && !state.completed}
            onClick={() => dispatch({ type: 'reset' })}
          >
            <RotateCcw size={18} />
          </button>
        </footer>
      </div>
      <dialog
        ref={dialog}
        className="trainer-settings-dialog"
        aria-labelledby="trainer-settings-title"
        onClose={() => {
          setSettingsOpen(false)
          settingsButton.current?.focus({ preventScroll: true })
        }}
      >
        <div className="trainer-dialog-heading">
          <h2 id="trainer-settings-title">Practice settings</h2>
          <button
            className="trainer-icon-button"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          >
            <X size={21} />
          </button>
        </div>
        <p>Standard tuning · E A D G B E</p>
        {settings.mode !== 'chords' && (
          <div className="trainer-settings-fields">
            <label>
              Focus string
              <select
                value={settings.string}
                onChange={(event) =>
                  configure({
                    string:
                      event.target.value === 'all'
                        ? 'all'
                        : Number(event.target.value),
                  })
                }
              >
                <option value="all">All six strings</option>
                {guitarStrings.map((string, index) => (
                  <option key={index} value={index}>
                    {string.number} · {string.name}
                    {index === 0 ? ' (low)' : index === 5 ? ' (high)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note set
              <select
                value={settings.notes}
                onChange={(event) =>
                  configure({
                    notes: event.target.value as TrainerSettings['notes'],
                  })
                }
              >
                <option value="all">All 12 notes</option>
                <option value="natural">Natural notes (A–G)</option>
              </select>
            </label>
            <label>
              Note names
              <select
                value={settings.spelling}
                onChange={(event) =>
                  configure({
                    spelling: event.target.value as TrainerSettings['spelling'],
                  })
                }
              >
                <option value="sharps">Sharps (♯)</option>
                <option value="flats">Flats (♭)</option>
              </select>
            </label>
            {settings.mode === 'name' && (
              <label>
                Octave labels
                <select
                  value={String(settings.octaves)}
                  onChange={(event) =>
                    configure({ octaves: event.target.value === 'true' })
                  }
                >
                  <option value="true">Note + octave (E2)</option>
                  <option value="false">Note only (E)</option>
                </select>
              </label>
            )}
          </div>
        )}
        <p className="trainer-settings-hint">
          Choose frets and chord collections above the board. Changing a setting
          starts a fresh question; your session totals stay.
        </p>
        <details>
          <summary>How to read the fretboard</summary>
          <p>
            Low E (string 6) is on the left; high E (string 1) is on the right.
            Each fret raises the pitch by one semitone. Frets 12 and 24 repeat
            the open note in higher octaves.
          </p>
          <p>
            The red marker is the note to name. E2 is the open low E’s sounding
            pitch. Note names use international B / B♭ notation. C♯ and D♭ are
            the same pitch here.
          </p>
          <p>
            For chords: × means mute, ○ means open, and a line joins a barre. In
            Find a note, arrow keys move between frets; Enter or Space answers.
          </p>
          <p>
            Retries and revealed answers break your streak. Practice stays in
            memory only and resets when you leave or refresh.
          </p>
        </details>
        <button
          className="trainer-primary"
          onClick={() => setSettingsOpen(false)}
        >
          Back to practice <ArrowRight size={17} />
        </button>
      </dialog>
    </main>
  )
}

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
  chordPositions,
  guitarStrings,
  initialTrainerState,
  midiAt,
  nextPracticeQuestion,
  noteName,
  pitchAt,
  pitchName,
  positionKey,
  trainerReducer,
  type TrainerMode,
  type TrainerSettings,
} from '../lib/trainer'
import { TrainerFretboard } from './TrainerFretboard'
import { FretboardStudy } from './FretboardStudy'
import {
  chordRoles,
  chordToneName,
  explainChordRole,
  roleAtPitch,
} from '../lib/chord-tones'
import { ChordToneReview } from './ChordToneReview'
import { HarmonyTrainer } from './HarmonyTrainer'
import { IntervalTrainer } from './IntervalTrainer'
import { readStored, writeStored } from '../lib/browser-storage'
import {
  trainerPreferencesKey,
  trainerPreferencesSchema,
} from '../lib/trainer-preferences'

const modes: { value: TrainerMode; label: string }[] = [
  { value: 'name', label: 'Name a note' },
  { value: 'find', label: 'Find a note' },
  { value: 'chords', label: 'Chord shapes' },
  { value: 'roots', label: 'Chord tones' },
  { value: 'intervals', label: 'Intervals' },
  { value: 'harmony', label: 'Harmony' },
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
  const [studyOpen, setStudyOpen] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  useEffect(() => {
    const saved = readStored(trainerPreferencesKey, trainerPreferencesSchema)
    if (saved) dispatch({ type: 'settings', settings: saved })
    setPreferencesLoaded(true)
  }, [])
  useEffect(() => {
    if (preferencesLoaded) writeStored(trainerPreferencesKey, state.settings)
  }, [state.settings, preferencesLoaded])
  const dialog = useRef<HTMLDialogElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const prompt = useRef<HTMLHeadingElement>(null)
  const focusNext = useRef(false)
  const { settings, question: currentQuestion, status, wrongAnswers } = state
  const question =
    currentQuestion?.mode === 'harmony' || currentQuestion?.mode === 'intervals'
      ? null
      : currentQuestion
  const theoryMode =
    settings.mode === 'harmony' || settings.mode === 'intervals'
  const resolved = status !== 'waiting'
  const toneMode = settings.mode === 'roots' || settings.mode === 'roles'
  const chordMode = toneMode || settings.mode === 'chords'
  const shapeQuestion = question && 'shape' in question ? question : null
  const toneQuestion =
    question?.mode === 'roots' || question?.mode === 'roles' ? question : null
  useLayoutEffect(() => {
    if (!focusNext.current) return
    focusNext.current = false
    prompt.current?.focus({ preventScroll: true })
    prompt.current?.scrollIntoView({ block: 'nearest' })
  }, [currentQuestion, settings.mode])
  useEffect(() => {
    if (settingsOpen) dialog.current?.showModal()
    else dialog.current?.close()
  }, [settingsOpen])

  function begin(config = settings, focus = false) {
    focusNext.current = focus
    dispatch({
      type: 'question',
      settings: config,
      question: nextPracticeQuestion(state, config),
    })
  }
  function configure(update: Partial<TrainerSettings>) {
    const config = { ...settings, ...update }
    if (currentQuestion) begin(config)
    else dispatch({ type: 'settings', settings: config })
  }

  const correctValue =
    question?.mode === 'chords'
      ? question.shape.name
      : question?.mode === 'roles'
        ? question.role
        : question?.mode === 'roots'
          ? ''
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
      : question?.mode === 'roles'
        ? `${chordRoles[question.role].label.toLowerCase()} (${question.role})`
        : question?.mode === 'roots'
          ? `${chordToneName(question.shape, '1')} is the root`
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
  if (!question)
    feedback = 'Start a session. Your practice settings are remembered.'
  else if (status === 'correct')
    feedback = `${wrongAnswers.length ? 'You found it' : 'Correct'} — ${answerName}.`
  else if (status === 'revealed')
    feedback =
      question.mode === 'roots'
        ? `${chordToneName(question.shape, '1')} is the root. Every root is labeled 1.`
        : `The answer is ${answerName}.`
  else if (wrongAnswers.length) {
    if (question.mode === 'find') {
      const [string, fret] = wrongAnswers.at(-1)!.split(':').map(Number)
      feedback = `That’s ${pitchName(pitchAt({ string, fret }), settings.spelling)}. ${string !== question.position.string ? `Use string ${6 - question.position.string}.` : 'Try another fret.'}`
    } else feedback = 'Not quite. Try another answer.'
  } else if (question.mode === 'chords')
    feedback = 'Name the chord. × mute · ○ open · line = barre.'
  else if (question.mode === 'find')
    feedback = 'Tap a matching fret on the highlighted string.'
  if (question?.mode === 'roots' && !resolved) {
    feedback = `Tap every root note in this shape. ${state.foundRoots.length} of ${question.roots.length} found.`
    if (wrongAnswers.length) {
      const [string, fret] = wrongAnswers.at(-1)!.split(':').map(Number)
      const role = roleAtPitch(question.shape, pitchAt({ string, fret }))
      feedback += ` ${chordToneName(question.shape, role)} is the ${chordRoles[role].label.toLowerCase()} (${role}); keep looking for roots.`
    }
  } else if (question?.mode === 'roles' && !resolved && !wrongAnswers.length) {
    feedback = 'Name the role of the red note, measured from the chord’s root.'
  }

  return (
    <main
      className={`trainer-page mode-${studyOpen ? 'study' : settings.mode}`}
    >
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
          {!studyOpen && (
            <button
              ref={settingsButton}
              className="trainer-icon-button"
              aria-label="Practice settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={21} />
            </button>
          )}
        </header>
        <div className="trainer-modes" role="group" aria-label="Exercise mode">
          <button
            aria-label="Learn fretboard"
            aria-pressed={studyOpen}
            onClick={() => setStudyOpen(true)}
          >
            Learn
          </button>
          {modes.map((mode) => (
            <button
              key={mode.value}
              aria-pressed={
                !studyOpen &&
                (settings.mode === mode.value ||
                  (mode.value === 'roots' && toneMode))
              }
              onClick={() => {
                setStudyOpen(false)
                const sameExercise =
                  settings.mode === mode.value ||
                  (mode.value === 'roots' && toneMode)
                if (!studyOpen || !sameExercise) configure({ mode: mode.value })
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {studyOpen ? (
          <FretboardStudy spelling={settings.spelling} />
        ) : settings.mode === 'intervals' ? (
          <IntervalTrainer
            question={
              currentQuestion?.mode === 'intervals' ? currentQuestion : null
            }
            settings={settings}
            status={status}
            wrongAnswers={wrongAnswers}
            completed={state.completed}
            onConfigure={configure}
            onBegin={() => begin()}
            onAnswer={(answer) => dispatch({ type: 'answer', answer })}
            onReveal={() => dispatch({ type: 'reveal' })}
          />
        ) : settings.mode === 'harmony' ? (
          <HarmonyTrainer
            question={
              currentQuestion?.mode === 'harmony' ? currentQuestion : null
            }
            settings={settings}
            status={status}
            wrongAnswers={wrongAnswers}
            completed={state.completed}
            hintsUsed={state.hintsUsed}
            reviewing={state.harmonyReviews.some(
              ({ question }) => question.id === currentQuestion?.id,
            )}
            reviewCount={state.harmonyReviews.length}
            onConfigure={configure}
            onBegin={() => begin()}
            onAnswer={(answer) => dispatch({ type: 'answer', answer })}
            onReveal={() => dispatch({ type: 'reveal' })}
            onHint={() => dispatch({ type: 'hint' })}
          />
        ) : (
          <>
            {toneMode && (
              <div
                className="trainer-tone-exercises"
                role="group"
                aria-label="Chord tone exercise"
              >
                <button
                  aria-pressed={settings.mode === 'roots'}
                  onClick={() => configure({ mode: 'roots' })}
                >
                  Find the root
                </button>
                <button
                  aria-pressed={settings.mode === 'roles'}
                  onClick={() => configure({ mode: 'roles' })}
                >
                  Note roles
                </button>
              </div>
            )}
            {chordMode ? (
              <div
                className="trainer-ranges"
                role="group"
                aria-label="Chord collection"
              >
                <span>Shapes</span>
                {(['open', 'movable', 'all'] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={settings.chords === value}
                    onClick={() => configure({ chords: value })}
                  >
                    {value === 'all'
                      ? 'All'
                      : value === 'open'
                        ? 'Open'
                        : 'Movable'}
                  </button>
                ))}
              </div>
            ) : (
              <div
                className="trainer-ranges"
                role="group"
                aria-label="Fret range"
              >
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
            <section
              className="trainer-exercise"
              aria-labelledby="trainer-prompt"
            >
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
                    ) : settings.mode === 'roots' ? (
                      'Find every root note.'
                    ) : settings.mode === 'roles' ? (
                      'What is this note’s role?'
                    ) : (
                      'What note is marked?'
                    )}
                  </h2>
                  <p className="exercise-description">
                    {!question
                      ? 'Standard tuning · low E on the left'
                      : toneQuestion
                        ? `${toneQuestion.shape.name} · ${settings.toneVocabulary === 'foundation' ? 'Foundations' : 'Full vocabulary'}${toneQuestion.mode === 'roles' ? ` · string ${6 - toneQuestion.position.string}, ${toneQuestion.position.fret === 0 ? 'open' : `fret ${toneQuestion.position.fret}`}` : ' · tap the chord notes'}`
                        : question.mode === 'chords'
                          ? 'Low E → high E · standard tuning'
                          : 'position' in question
                            ? `String ${6 - question.position.string} · ${guitarStrings[question.position.string].name}${question.mode === 'name' ? ` · ${question.position.fret === 0 ? 'open' : `fret ${question.position.fret}`}` : ' · tap the fretboard'}`
                            : ''}
                  </p>
                </div>
                <span className="trainer-question-count">
                  {question
                    ? `#${state.completed + (resolved ? 0 : 1)}`
                    : 'Ready?'}
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
                    question?.mode === 'find'
                      ? question.position.string
                      : undefined
                  }
                  marked={
                    question?.mode === 'name' || question?.mode === 'roles'
                      ? question.position
                      : undefined
                  }
                  answerPitch={
                    question?.mode === 'find' && resolved
                      ? question.pitch
                      : undefined
                  }
                  wrongPositions={
                    question?.mode === 'find' || question?.mode === 'roots'
                      ? wrongAnswers
                      : []
                  }
                  foundRoots={
                    question?.mode === 'roots' ? state.foundRoots : []
                  }
                  toneLabels={
                    toneQuestion && resolved
                      ? Object.fromEntries(
                          chordPositions(toneQuestion.shape).map((position) => [
                            positionKey(position),
                            roleAtPitch(toneQuestion.shape, pitchAt(position)),
                          ]),
                        )
                      : undefined
                  }
                  onPick={
                    question?.mode === 'find' || question?.mode === 'roots'
                      ? (position) =>
                          dispatch({
                            type: 'answer',
                            answer: positionKey(position),
                          })
                      : undefined
                  }
                  shape={shapeQuestion?.shape}
                  resolved={resolved}
                />
                {question &&
                  question.mode !== 'find' &&
                  question.mode !== 'roots' && (
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
                          {wrongAnswers.includes(choice.value) && (
                            <X size={16} />
                          )}
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
                        : toneMode
                          ? 'Know every note.'
                          : settings.mode === 'chords'
                            ? 'Know the shapes.'
                            : 'See it. Name it.'}
                    </h3>
                    <p>
                      {settings.mode === 'name'
                        ? 'A red marker. Five answers. Every fret in your chosen range.'
                        : settings.mode === 'roots'
                          ? 'Find every root in a named chord. Learn why the root and the bass can differ.'
                          : settings.mode === 'roles'
                            ? 'Root, third, fifth, or seventh? Learn what each note contributes to a chord.'
                            : settings.mode === 'find'
                              ? 'A note and a string. Tap the right position.'
                              : 'Major, minor, dim7, add9, add11, and more. Learn open and movable shapes.'}
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
                        : question.mode === 'roots'
                          ? explainChordRole(question.shape, '1')
                          : question.mode === 'roles'
                            ? explainChordRole(question.shape, question.role)
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
              {toneQuestion && resolved && (
                <ChordToneReview shape={toneQuestion.shape} />
              )}
            </section>
          </>
        )}
        {!studyOpen && (
          <footer className="trainer-session" aria-label="Session progress">
            <span>
              <strong data-testid="trainer-completed">{state.completed}</strong>{' '}
              answered
            </span>
            <span>
              <strong data-testid="trainer-first-try">
                {state.firstTry}/{state.completed}
              </strong>{' '}
              first try · unaided
            </span>
            <span>
              <Flame size={15} />
              <strong data-testid="trainer-streak">{state.streak}</strong>{' '}
              streak
            </span>
            <button
              className="trainer-icon-button"
              aria-label="Reset session"
              disabled={!currentQuestion && !state.completed}
              onClick={() => dispatch({ type: 'reset' })}
            >
              <RotateCcw size={18} />
            </button>
          </footer>
        )}
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
        <p>
          {theoryMode
            ? settings.mode === 'intervals'
              ? 'Intervals · learn the distance between two pitches.'
              : 'Major-key harmony · listen, answer, and explore the notes.'
            : 'Standard tuning · E A D G B E'}
        </p>
        {!chordMode && !theoryMode && (
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
        {toneMode && (
          <div className="trainer-settings-fields">
            <label>
              Chord vocabulary
              <select
                value={settings.toneVocabulary}
                onChange={(event) =>
                  configure({
                    toneVocabulary: event.target
                      .value as TrainerSettings['toneVocabulary'],
                  })
                }
              >
                <option value="foundation">Foundations</option>
                <option value="all">All chord types</option>
              </select>
            </label>
            <p>
              Foundations covers major, minor, 7, maj7, and m7 chords, including
              inversions. All adds diminished, suspended, and extended chords.
            </p>
          </div>
        )}
        <p className="trainer-settings-hint">
          {theoryMode
            ? settings.mode === 'intervals'
              ? 'Choose Read notes or By ear, playback direction, and interval vocabulary above the question. Playback starts only when you press Play.'
              : 'Choose the exercise, major key, and chord type above the question. Playback starts only when you press Play.'
            : 'Choose frets and chord collections above the board.'}{' '}
          Changing a setting starts a fresh question; your session totals stay.
        </p>
        {chordMode && (
          <p>
            Open shapes use open strings. Movable shapes include barres and
            compact fingerings with no open strings. All mixes both collections.
          </p>
        )}
        {!theoryMode && (
          <details>
            <summary>How to read the fretboard</summary>
            <p>
              Low E (string 6) is on the left; high E (string 1) is on the
              right. Each fret raises the pitch by one semitone. Frets 12 and 24
              repeat the open note in higher octaves.
            </p>
            <p>
              The red marker is the note to name. E2 is the open low E’s
              sounding pitch. Note names use international B / B♭ notation. C♯
              and D♭ are the same pitch here.
            </p>
            <p>
              For chords: × means mute, ○ means open, and a line joins a barre.
              In Find a note, arrow keys move between frets; Enter or Space
              answers.
            </p>
            <p>
              Retries and revealed answers break your streak. Session scores
              reset when you leave or refresh. Your practice settings are
              remembered in this browser.
            </p>
          </details>
        )}
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

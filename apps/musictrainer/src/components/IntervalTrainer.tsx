import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  CircleHelp,
  Headphones,
  Play,
  Square,
  X,
} from 'lucide-react'
import {
  intervalExplanation,
  intervalSounds,
  type IntervalQuestion,
  type IntervalSettings,
} from '../lib/intervals'
import { HarmonyPlayer } from '../lib/harmony-audio'

export function IntervalTrainer({
  question,
  settings,
  status,
  wrongAnswers,
  completed,
  onConfigure,
  onBegin,
  onAnswer,
  onReveal,
}: {
  question: IntervalQuestion | null
  settings: IntervalSettings
  status: 'waiting' | 'correct' | 'revealed'
  wrongAnswers: string[]
  completed: number
  onConfigure: (settings: Partial<IntervalSettings>) => void
  onBegin: () => void
  onAnswer: (answer: string) => void
  onReveal: () => void
}) {
  const player = useRef<HarmonyPlayer | null>(null)
  const prompt = useRef<HTMLHeadingElement>(null)
  const [playing, setPlaying] = useState(false)
  const [playingStep, setPlayingStep] = useState<number | null>(null)
  const [audioError, setAudioError] = useState('')
  const resolved = status !== 'waiting'
  const visibleNotes = settings.intervalExercise === 'notes' || resolved

  useEffect(() => {
    player.current?.stop()
    setPlaying(false)
    setPlayingStep(null)
    setAudioError('')
    return () => player.current?.stop()
  }, [question, status])
  useEffect(() => {
    if (!question) return
    prompt.current?.focus({ preventScroll: true })
    prompt.current?.scrollIntoView({ block: 'nearest' })
  }, [question])

  function stop() {
    player.current?.stop()
    setPlaying(false)
    setPlayingStep(null)
  }
  async function play() {
    if (!question) return
    setAudioError('')
    setPlaying(true)
    player.current ??= new HarmonyPlayer()
    try {
      await player.current.play(
        intervalSounds(question),
        setPlayingStep,
        () => {
          setPlaying(false)
          setPlayingStep(null)
        },
      )
    } catch {
      setPlaying(false)
      setPlayingStep(null)
      setAudioError(
        'Audio could not start. Try Play again with audio enabled, or choose Read notes to practice visually.',
      )
    }
  }

  const feedback = !question
    ? 'Choose how to practice. Progress stays in this session.'
    : status === 'correct'
      ? `${wrongAnswers.length ? 'You found it' : 'Correct'} — ${question.interval.label.toLowerCase()}.`
      : status === 'revealed'
        ? `The answer is ${question.interval.label.toLowerCase()}.`
        : wrongAnswers.length
          ? 'Not quite. Compare the distance and try another interval.'
          : visibleNotes
            ? 'Name the distance between these two notes. Octave numbers show their register.'
            : 'Press Play interval, listen to the distance, and choose its name.'

  return (
    <section
      className="interval-trainer trainer-exercise"
      aria-labelledby="interval-prompt"
    >
      <div
        className="trainer-tone-exercises"
        role="group"
        aria-label="Interval exercise"
      >
        <button
          aria-pressed={settings.intervalExercise === 'notes'}
          onClick={() => onConfigure({ intervalExercise: 'notes' })}
        >
          Read notes
        </button>
        <button
          aria-pressed={settings.intervalExercise === 'ear'}
          onClick={() => onConfigure({ intervalExercise: 'ear' })}
        >
          By ear
        </button>
      </div>
      <div className="harmony-settings">
        <label>
          Playback
          <select
            value={settings.intervalDirection}
            onChange={(event) =>
              onConfigure({
                intervalDirection: event.target
                  .value as IntervalSettings['intervalDirection'],
              })
            }
          >
            <option value="ascending">Ascending ↑</option>
            <option value="descending">Descending ↓</option>
            <option value="harmonic">Together</option>
          </select>
        </label>
        <label>
          Intervals
          <select
            value={settings.intervalVocabulary}
            onChange={(event) =>
              onConfigure({
                intervalVocabulary: event.target
                  .value as IntervalSettings['intervalVocabulary'],
              })
            }
          >
            <option value="foundation">Foundations</option>
            <option value="all">Unison–octave</option>
          </select>
        </label>
      </div>
      <div className="trainer-question-heading">
        <div>
          <h2 id="interval-prompt" ref={prompt} tabIndex={-1}>
            {question ? 'Which interval is this?' : 'Get to know the distance.'}
          </h2>
          <p className="exercise-description">
            {settings.intervalDirection === 'harmonic'
              ? 'Two notes together'
              : settings.intervalDirection === 'descending'
                ? 'Two notes, descending'
                : 'Two notes, ascending'}
            {' · '}
            {settings.intervalExercise === 'ear'
              ? 'Listen and identify'
              : 'Read, listen, and identify'}
          </p>
        </div>
        <span className="trainer-question-count">
          {question ? `#${completed + (resolved ? 0 : 1)}` : 'Ready?'}
        </span>
      </div>
      {!question ? (
        <div className="harmony-intro">
          <Headphones size={32} strokeWidth={1.5} aria-hidden="true" />
          <h3>Two notes. One interval.</h3>
          <p>
            An interval is the distance between two pitches. Start with minor
            and major thirds and sevenths, perfect fourths, fifths, and octaves.
            Unison–octave adds every distance within an octave.
          </p>
          <p>
            Read the notes or identify the sound by ear. After each answer,
            explore the semitone distance and how it translates to guitar frets.
            Sound starts when you press Play.
          </p>
          <button className="trainer-primary" onClick={onBegin}>
            Start practice <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <div
            className="interval-notes"
            role="group"
            aria-label={
              visibleNotes ? 'Interval notes' : 'Hidden notes — identify by ear'
            }
          >
            {question.notes.map((note, index) => (
              <div
                key={index}
                className={`interval-note ${playing && (question.direction === 'harmonic' || playingStep === index) ? 'playing-note' : ''}`}
              >
                <span>
                  {question.direction === 'harmonic'
                    ? index === 0
                      ? 'Lower note'
                      : 'Upper note'
                    : index === 0
                      ? 'First note'
                      : 'Second note'}
                </span>
                <strong>
                  {visibleNotes ? (
                    note.name
                  ) : (
                    <Headphones size={32} aria-label="Hidden pitch" />
                  )}
                </strong>
              </div>
            ))}
            <span className="interval-connector" aria-hidden="true">
              {question.direction === 'harmonic' ? '+' : '→'}
            </span>
          </div>
          <div className="harmony-playback">
            <button className="trainer-reveal" onClick={playing ? stop : play}>
              {playing ? <Square size={16} /> : <Play size={16} />}
              {playing ? 'Stop playback' : 'Play interval'}
            </button>
            <span>Replay as often as you like.</span>
          </div>
          {audioError && (
            <p className="harmony-audio-error" role="alert">
              {audioError}
            </p>
          )}
          <div
            className="interval-choices trainer-choices"
            role="group"
            aria-label="Answer choices"
          >
            {question.choices.map((choice) => (
              <button
                key={choice.value}
                className={`${resolved && choice.value === question.answer ? 'correct-choice' : ''} ${wrongAnswers.includes(choice.value) ? 'wrong-choice' : ''}`}
                aria-disabled={resolved || wrongAnswers.includes(choice.value)}
                onClick={() => {
                  if (!resolved) onAnswer(choice.value)
                }}
              >
                <span>{choice.label}</span>
                {resolved && choice.value === question.answer && (
                  <Check size={18} />
                )}
                {wrongAnswers.includes(choice.value) && <X size={16} />}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="trainer-response">
        <div
          className={`trainer-feedback ${status === 'correct' ? 'correct' : wrongAnswers.length && !resolved ? 'retry' : ''}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <p>{feedback}</p>
        </div>
        {question &&
          (resolved ? (
            <button className="trainer-primary" onClick={onBegin}>
              Next question <ArrowRight size={18} />
            </button>
          ) : (
            <button className="trainer-reveal" onClick={onReveal}>
              <CircleHelp size={17} /> Show answer
            </button>
          ))}
      </div>
      {question && resolved && (
        <section
          className="chord-tone-review interval-review"
          aria-label="Interval explanation"
        >
          <h3>
            {question.interval.label}
            <span>
              {question.interval.short} · {question.interval.semitones}{' '}
              semitones
            </span>
          </h3>
          <p>{intervalExplanation(question)}</p>
          <ol className="interval-distance" aria-label="Semitone distance">
            {Array.from({ length: 13 }, (_, step) => (
              <li
                key={step}
                className={
                  step === question.interval.semitones
                    ? 'interval-destination'
                    : step < question.interval.semitones
                      ? 'interval-traversed'
                      : ''
                }
              >
                {step}
              </li>
            ))}
          </ol>
          <p>
            Each step is one semitone, like moving one fret along a string.
            Count the gaps between notes.
          </p>
        </section>
      )}
    </section>
  )
}

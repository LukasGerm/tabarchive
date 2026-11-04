import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Play, Square, X } from 'lucide-react'
import {
  chordsInKey,
  harmonicFunctions,
  harmonyExercises,
  harmonyExplanation,
  harmonyHint,
  harmonyPrompt,
  harmonySounds,
  majorKeys,
  majorScale,
  progressionVoiceLeading,
  type HarmonyQuestion,
  type HarmonySettings,
} from '../lib/harmony'
import { HarmonyPlayer } from '../lib/harmony-audio'

export function HarmonyTrainer({
  question,
  settings,
  status,
  wrongAnswers,
  completed,
  hintsUsed,
  reviewing,
  reviewCount,
  onConfigure,
  onBegin,
  onAnswer,
  onReveal,
  onHint,
}: {
  question: HarmonyQuestion | null
  settings: HarmonySettings
  status: 'waiting' | 'correct' | 'revealed'
  wrongAnswers: string[]
  completed: number
  hintsUsed: number
  reviewing: boolean
  reviewCount: number
  onConfigure: (settings: Partial<HarmonySettings>) => void
  onBegin: () => void
  onAnswer: (answer: string) => void
  onReveal: () => void
  onHint: () => void
}) {
  const player = useRef<HarmonyPlayer | null>(null)
  const prompt = useRef<HTMLHeadingElement>(null)
  const [playing, setPlaying] = useState(false)
  const [playingStep, setPlayingStep] = useState<number | null>(null)
  const [audioError, setAudioError] = useState('')
  const [answer, setAnswer] = useState('')
  const resolved = status !== 'waiting'
  const exercise = harmonyExercises.find(
    (item) => item.value === settings.harmonyExercise,
  )!
  const key =
    question?.key ??
    majorKeys.find((item) => item.name === settings.harmonyKey)!
  const scale = majorScale(key)
  const chords = chordsInKey(key, settings.harmonyChords)
  const leading =
    question && resolved ? progressionVoiceLeading(question) : null

  useEffect(() => {
    player.current?.stop()
    setPlaying(false)
    setPlayingStep(null)
    setAudioError('')
    return () => player.current?.stop()
  }, [question, status])
  useEffect(() => {
    setAnswer('')
    if (!question) return
    prompt.current?.focus({ preventScroll: true })
    prompt.current?.scrollIntoView({ block: 'nearest' })
  }, [question])

  async function play() {
    if (!question) return
    setAudioError('')
    setPlaying(true)
    player.current ??= new HarmonyPlayer()
    try {
      await player.current.play(
        harmonySounds(question, resolved),
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
        'Audio could not start. Try Play again in a browser with audio enabled; you can still answer visually.',
      )
    }
  }
  function stop() {
    player.current?.stop()
    setPlaying(false)
    setPlayingStep(null)
  }

  const playLabel =
    question?.exercise === 'progressions'
      ? resolved
        ? 'Play complete progression'
        : 'Play with the gap'
      : question?.exercise === 'functions'
        ? 'Play tonic → chord'
        : resolved
          ? 'Play answer chord'
          : 'Play major scale'
  const answerName =
    question?.exercise === 'functions'
      ? harmonicFunctions[question.function].label
      : question?.answer
  const recall = question?.exercise === 'key-chords' ? question.recall : 'name'
  const answerLabel =
    recall === 'numeral'
      ? 'Roman numeral'
      : recall === 'notes'
        ? 'Chord notes'
        : 'Chord name'
  const answerHelp =
    recall === 'numeral'
      ? 'Use uppercase for major and lowercase for minor; add 7, maj7, °, or ø7 when needed. Type o for ° or /o for ø.'
      : recall === 'notes'
        ? 'Separate notes with spaces or commas, in any order. Use the key’s spelling; # and b work for ♯ and ♭.'
        : 'Use a root and quality: m for minor, dim for diminished, 7, maj7, m7, or m7b5. # and b work for ♯ and ♭.'
  const feedback = !question
    ? 'Choose an exercise and start. Progress stays in this session.'
    : status === 'correct'
      ? `${hintsUsed ? 'With help' : wrongAnswers.length ? 'You found it' : 'Correct'} — ${answerName}.${wrongAnswers.length || hintsUsed ? ' You’ll revisit this after two other questions.' : ' Recalled without help.'}`
      : status === 'revealed'
        ? `The answer is ${answerName}. You’ll revisit this after two other questions.`
        : wrongAnswers.length
          ? question.exercise === 'functions'
            ? 'Not quite. Compare this chord with the key’s tonic, then try another function.'
            : question.exercise === 'progressions'
              ? 'Not quite. Use the given Roman-numeral pattern and try another chord.'
              : recall === 'notes'
                ? 'Not quite. Check every chord tone, its accidental, and the number of notes. Use the key’s spelling.'
                : recall === 'numeral'
                  ? 'Not quite. Check the root’s scale degree and the numeral’s case. IV is major four; iv is minor four; vi is minor six.'
                  : 'Not quite. Check both the root and the chord quality. IV is major four; iv is minor four; vi is minor six.'
          : question.exercise === 'key-chords'
            ? 'Recall it first. If you’re stuck, take a hint, then try again later without help.'
            : question.exercise === 'functions'
              ? 'Think home, preparation, or the pull back to home.'
              : 'Fill the gap to match this specific pattern. Other chords can work in other progressions.'
  const scaleDiagram = (
    <ol className="harmony-scale" aria-label={`${key.name} major scale`}>
      {scale.map((note, index) => (
        <li
          key={note.name}
          className={`${resolved && question?.target.pitches.includes(note.pitch) ? 'selected-tone' : ''} ${playing && playingStep !== null && question?.exercise === 'key-chords' && !resolved && playingStep % 7 === index ? 'playing-tone' : ''}`}
        >
          <span>{index + 1}</span>
          <strong>{note.name}</strong>
        </li>
      ))}
    </ol>
  )

  return (
    <section
      className="harmony-trainer trainer-exercise"
      aria-labelledby="harmony-prompt"
    >
      <div
        className="harmony-exercises trainer-tone-exercises"
        role="group"
        aria-label="Harmony exercise"
      >
        {harmonyExercises.map((item) => (
          <button
            key={item.value}
            aria-pressed={settings.harmonyExercise === item.value}
            onClick={() => onConfigure({ harmonyExercise: item.value })}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="harmony-settings">
        <label>
          Major key
          <select
            value={settings.harmonyKey}
            onChange={(event) =>
              onConfigure({
                harmonyKey: event.target.value as HarmonySettings['harmonyKey'],
              })
            }
          >
            {majorKeys.map((key) => (
              <option key={key.name} value={key.name}>
                {key.name} major
              </option>
            ))}
          </select>
        </label>
        <label>
          Chord type
          <select
            value={settings.harmonyChords}
            onChange={(event) =>
              onConfigure({
                harmonyChords: event.target
                  .value as HarmonySettings['harmonyChords'],
              })
            }
          >
            <option value="triads">Triads</option>
            <option value="sevenths">Sevenths</option>
          </select>
        </label>
        {settings.harmonyExercise === 'key-chords' && (
          <label className="harmony-recall-setting">
            Recall
            <select
              value={settings.harmonyRecall}
              onChange={(event) =>
                onConfigure({
                  harmonyRecall: event.target
                    .value as HarmonySettings['harmonyRecall'],
                })
              }
            >
              <option value="mixed">Mix all three</option>
              <option value="name">Chord names</option>
              <option value="numeral">Roman numerals</option>
              <option value="notes">Chord tones</option>
            </select>
          </label>
        )}
      </div>
      <div className="trainer-question-heading">
        <div>
          <h2 id="harmony-prompt" ref={prompt} tabIndex={-1}>
            {question
              ? harmonyPrompt(question)
              : 'Know the chord. Recall the notes.'}
          </h2>
          <p className="exercise-description">
            {key.name} major ·{' '}
            {reviewing && !resolved
              ? 'Recall check · Try this one again without help.'
              : exercise.description}
          </p>
        </div>
        <span className="trainer-question-count">
          {question ? `#${completed + (resolved ? 0 : 1)}` : 'Ready?'}
        </span>
      </div>
      {!question ? (
        <div className="harmony-intro">
          <h3>{exercise.label}</h3>
          <p>{exercise.description}</p>
          <p>
            Answer from memory, then explore the scale and chord breakdown.
            Hints are always available. Missed, hinted, or revealed answers
            return after two other questions; only a first try without hints
            counts toward your streak.
          </p>
          <p>
            IV = major four · iv = minor four · vi = minor six. ° means
            diminished; ø means half-diminished.
          </p>
          <button className="trainer-primary" onClick={onBegin}>
            Start practice <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <>
          {question.exercise === 'progressions' ? (
            <ol className="harmony-progression" aria-label="Progression">
              {question.progression.map((chord, index) => (
                <li
                  key={index}
                  data-step={index}
                  className={`${index === question.missing ? 'missing-chord' : ''} ${playing && playingStep === index ? 'playing-chord' : ''}`}
                  aria-current={
                    playing && playingStep === index ? 'step' : undefined
                  }
                >
                  <span>{chord.roman}</span>
                  <strong>
                    {index === question.missing && !resolved ? '?' : chord.name}
                  </strong>
                  <small>
                    {index === question.missing
                      ? resolved
                        ? 'Your answer'
                        : 'Fill this gap'
                      : `Chord ${index + 1}`}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <div className="harmony-target">
              <span>
                {question.exercise === 'functions'
                  ? 'Chord to understand'
                  : recall === 'name'
                    ? 'Name this chord'
                    : recall === 'numeral'
                      ? 'Find its Roman numeral'
                      : 'Spell this chord'}
              </span>
              <strong>
                {question.exercise === 'functions' || recall !== 'name'
                  ? question.target.name
                  : question.target.roman}
              </strong>
              <p>
                {question.exercise === 'functions'
                  ? question.target.notes.join(' · ')
                  : recall === 'notes'
                    ? `${question.size === 'triads' ? 'Three' : 'Four'} notes, including the root`
                    : `${key.name} major · answer from memory`}
              </p>
            </div>
          )}
          <div className="harmony-playback">
            <button
              className="trainer-reveal"
              onClick={() => void play()}
              disabled={playing}
            >
              <Play size={17} />
              {playLabel}
            </button>
            {playing && (
              <button className="trainer-reveal" onClick={stop}>
                <Square size={15} />
                Stop playback
              </button>
            )}
            <span>
              {playing ? 'Playing…' : 'Sound plays only when you press Play.'}
            </span>
          </div>
          {audioError && (
            <p className="harmony-audio-error" role="alert">
              {audioError}
            </p>
          )}
          {!resolved && hintsUsed > 0 && (
            <aside className="harmony-hint" aria-label="Practice hint">
              <strong>Hint {hintsUsed} of 2 · assisted practice</strong>
              <p>{harmonyHint(question)}</p>
              {hintsUsed === 2 && scaleDiagram}
            </aside>
          )}
          {question.exercise === 'functions' ? (
            <div
              className="trainer-choices harmony-choices"
              role="group"
              aria-label="Answer choices"
            >
              {question.choices.map((choice) => (
                <button
                  key={choice.value}
                  className={`${resolved && choice.value === question.answer ? 'correct-choice' : ''} ${wrongAnswers.includes(choice.value) ? 'wrong-choice' : ''}`}
                  aria-disabled={
                    resolved || wrongAnswers.includes(choice.value)
                  }
                  onClick={() => {
                    if (!resolved && !wrongAnswers.includes(choice.value))
                      onAnswer(choice.value)
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
          ) : (
            <form
              className="harmony-answer"
              onSubmit={(event) => {
                event.preventDefault()
                if (!resolved && answer.trim()) onAnswer(answer.trim())
              }}
            >
              <label htmlFor="harmony-answer">{answerLabel}</label>
              <div className="harmony-answer-row">
                <input
                  id="harmony-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-describedby="harmony-answer-help"
                  readOnly={resolved}
                  maxLength={80}
                />
                <button
                  className="trainer-primary"
                  type="submit"
                  disabled={resolved || !answer.trim()}
                >
                  Check answer <Check size={17} />
                </button>
              </div>
              <p id="harmony-answer-help">{answerHelp}</p>
            </form>
          )}
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
            <div className="harmony-help-actions">
              {hintsUsed < 2 && (
                <button className="trainer-reveal" onClick={onHint}>
                  <CircleHelp size={17} />
                  {hintsUsed === 0 ? 'Give me a hint' : 'Show scale'}
                </button>
              )}
              <button className="trainer-reveal" onClick={onReveal}>
                Show answer
              </button>
            </div>
          ))}
      </div>
      {question && resolved && (
        <section
          className="harmony-review chord-tone-review"
          aria-label="Harmony explanation"
        >
          <h3>
            {answerName}
            <span>
              {question.target.roman} · {key.name} major
            </span>
          </h3>
          <p>{harmonyExplanation(question)}</p>
          {scaleDiagram}
          {question.exercise === 'functions' ? (
            <>
              <ol className="harmony-function-flow">
                {Object.entries(harmonicFunctions).map(([value, item]) => (
                  <li
                    key={value}
                    className={
                      value === question.function ? 'selected-function' : ''
                    }
                  >
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                    <small>
                      {value === 'tonic'
                        ? chords[0].roman
                        : value === 'predominant'
                          ? `${chords[1].roman} · ${chords[3].roman}`
                          : `${chords[4].roman} · ${chords[6].roman}`}{' '}
                      in a major key
                    </small>
                  </li>
                ))}
              </ol>
              <p>
                These are common major-key functions. iii and vi depend more on
                context, so this exercise focuses on the clearest examples.
              </p>
            </>
          ) : (
            <div
              className="harmony-key-chords"
              role="list"
              aria-label="Chords in this key"
            >
              {chords.map((chord) => (
                <div
                  role="listitem"
                  key={chord.degree}
                  className={
                    chord.name === question.target.name ? 'selected-tone' : ''
                  }
                >
                  <span>{chord.roman}</span>
                  <strong>{chord.name}</strong>
                  <small>{chord.notes.join(' · ')}</small>
                </div>
              ))}
            </div>
          )}
          {leading && (
            <div className="harmony-voice-leading">
              <h4>
                Hear the notes move: {leading.from} → {leading.to}
              </h4>
              <p>
                The playback keeps upper notes close together. In this voicing:
              </p>
              <ul>
                {leading.movements.map((move, index) => (
                  <li key={index}>
                    <strong>
                      {move.from} → {move.to}
                    </strong>
                    <span>
                      {move.semitones === 0
                        ? 'Same pitch'
                        : `${move.semitones > 0 ? 'Up' : 'Down'} ${Math.abs(move.semitones)} semitone${Math.abs(move.semitones) === 1 ? '' : 's'}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      {reviewCount > 0 && (
        <p className="harmony-review-count">
          {reviewCount} recall {reviewCount === 1 ? 'check' : 'checks'} queued
          this session. Return to the same key and exercise to review.
        </p>
      )}
    </section>
  )
}

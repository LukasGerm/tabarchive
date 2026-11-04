import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Play } from 'lucide-react'
import { TrainerFretboard } from './TrainerFretboard'
import { instruments, type Instrument } from '../lib/instruments'
import { pitchAt, positionKey } from '../lib/trainer'
import { type HarmonySound } from '../lib/harmony'
import {
  playgroundChords,
  playgroundKeyName,
  progressionChords,
  progressionSounds,
  toneRole,
  type Progression,
} from '../lib/playground'

export function PlaygroundPractice({
  progression,
  targetIndex,
  instrument,
  onPlay,
  onStop,
  onClose,
}: {
  progression: Progression
  targetIndex: number
  instrument: Instrument
  onPlay: (sounds: HarmonySound[], label: string) => void
  onStop: () => void
  onClose: () => void
}) {
  const [stage, setStage] = useState(0)
  const [resolved, setResolved] = useState(false)
  const [assisted, setAssisted] = useState(false)
  const [recalled, setRecalled] = useState(0)
  const [feedback, setFeedback] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const chords = progressionChords(progression)
  const target = chords[targetIndex]
  const choices = playgroundChords(
    progression.tonic,
    progression.mode,
    progression.steps[targetIndex].size,
  )
  const keyName = playgroundKeyName(progression)
  const third = target.intervals[1]
  const answer =
    stage === 1 ? target.notes[0] : stage === 2 ? toneRole(third)! : target.name
  const sounds = progressionSounds(progression, 100, 'chords')
  const rootLabels: Record<string, string> = {}
  if (resolved)
    instruments[instrument].strings.forEach((_, string) => {
      for (let fret = 0; fret <= 5; fret++) {
        if (pitchAt({ string, fret }, instrument) === target.root)
          rootLabels[positionKey({ string, fret })] = target.notes[0]
      }
    })
  useEffect(() => {
    heading.current?.focus()
  }, [stage])

  function check(correct: boolean) {
    if (resolved) return
    onStop()
    if (!correct) {
      setAssisted(true)
      setFeedback('Not quite. Take another look and try again.')
      return
    }
    setResolved(true)
    if (!assisted) setRecalled((value) => value + 1)
    setFeedback(
      `Correct — ${answer}. ${stage === 2 ? `${third} semitones above ${target.notes[0]}.` : ''}`,
    )
  }
  function advance() {
    onStop()
    setStage(stage + 1)
    setResolved(false)
    setAssisted(false)
    setFeedback('')
  }
  return (
    <section
      className="playground-practice"
      aria-label="Practice my progression"
    >
      <div className="playground-section-heading">
        <span className="playground-eyebrow">
          Your music, four perspectives
        </span>
        <button className="playground-text-button" onClick={onClose}>
          Back to playground
        </button>
      </div>
      {stage === 4 ? (
        <>
          <h2 ref={heading} tabIndex={-1}>
            You’ve explored your progression.
          </h2>
          <p>
            {recalled} of 4 recalled without help. You connected chord names,
            roots, intervals, and the sequence you created.
          </p>
          <p className="playground-recap">
            {chords.map((chord) => chord.name).join(' → ')}
          </p>
          <p>
            Take it to your {instrument}: play the roots, then the root and
            third of each chord.
          </p>
          <button className="trainer-primary" onClick={onClose}>
            Back to playing <ArrowRight size={17} />
          </button>
        </>
      ) : (
        <>
          <div
            className="playground-lesson-steps"
            aria-label={`Step ${stage + 1} of 4`}
          >
            {['Name', 'Find', 'Understand', 'Recall'].map((name, index) => (
              <span
                key={name}
                aria-current={index === stage ? 'step' : undefined}
              >
                {index + 1}. {name}
              </span>
            ))}
          </div>
          <h2 ref={heading} tabIndex={-1}>
            {stage === 0
              ? `Which chord is ${target.roman} in ${keyName}?`
              : stage === 1
                ? `Find ${target.notes[0]}: the root of ${target.name}.`
                : stage === 2
                  ? `${target.notes[0]} → ${target.notes[1]}: which interval?`
                  : 'Recall the missing chord from your progression.'}
          </h2>
          <p>
            {stage === 1
              ? 'Tap any matching root within frets 0–5.'
              : stage === 2
                ? 'Measure upward from the root to the chord’s third.'
                : stage === 3
                  ? 'Remember the sequence you built. Other chords could work musically; this checks your original.'
                  : 'Connect the scale degree with its chord name. Listen if you like.'}
          </p>
          {stage === 3 && (
            <ol
              className="playground-recall-row"
              aria-label="Progression with a gap"
            >
              {chords.map((chord, index) => (
                <li key={index}>
                  {index === targetIndex && !resolved ? '?' : chord.name}
                </li>
              ))}
            </ol>
          )}
          <button
            className="playground-secondary"
            onClick={() =>
              onPlay(
                stage === 3
                  ? sounds.map((sound, index) => ({
                      ...sound,
                      notes:
                        index === targetIndex && !resolved ? [] : sound.notes,
                    }))
                  : stage === 2
                    ? [0, third].map((interval, step) => ({
                        notes: [48 + target.root + interval],
                        seconds: 0.7,
                        step,
                      }))
                    : [sounds[targetIndex]],
                'Practice audio',
              )
            }
          >
            <Play size={16} />
            {stage === 3
              ? 'Hear the sequence'
              : stage === 2
                ? 'Hear the interval'
                : 'Hear the chord'}
          </button>
          {stage === 1 ? (
            <div className="playground-practice-board">
              <TrainerFretboard
                instrument={instrument}
                maxFret={5}
                spelling="sharps"
                resolved={resolved}
                toneLabels={resolved ? rootLabels : undefined}
                onPick={(position) =>
                  check(pitchAt(position, instrument) === target.root)
                }
              />
            </div>
          ) : (
            <div
              className="playground-answer-choices"
              role="group"
              aria-label="Practice answers"
            >
              {(stage === 2
                ? [
                    'Minor third',
                    'Major third',
                    'Perfect fourth',
                    'Perfect fifth',
                  ]
                : choices.map((chord) => chord.name)
              ).map((choice) => (
                <button
                  key={choice}
                  disabled={resolved}
                  onClick={() => check(choice === answer)}
                  className={resolved && choice === answer ? 'is-correct' : ''}
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
          <p role="status">{feedback}</p>
          {resolved ? (
            <button className="trainer-primary" onClick={advance}>
              {stage === 3 ? 'Finish practice' : 'Next perspective'}{' '}
              <ArrowRight size={17} />
            </button>
          ) : (
            <button
              className="playground-text-button"
              onClick={() => {
                onStop()
                setResolved(true)
                setAssisted(true)
                setFeedback(`The answer is ${answer}.`)
              }}
            >
              Show answer
            </button>
          )}
        </>
      )}
    </section>
  )
}

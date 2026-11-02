import { describe, expect, it } from 'vitest'
import {
  defaultIntervalSettings,
  foundationIntervals,
  intervalExplanation,
  intervalSounds,
  intervals,
  nextIntervalQuestion,
} from '../src/lib/intervals'
import {
  defaultTrainerSettings,
  initialTrainerState,
  isCorrectAnswer,
  nextQuestion,
  trainerReducer,
} from '../src/lib/trainer'

function randomSequence() {
  let seed = 2026
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
}

function midiFromName(name: string) {
  const [, letter, accidentals, octave] = /^([A-G])([♯♭]*)(\d+)$/.exec(name)!
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]!
  return (
    (Number(octave) + 1) * 12 +
    natural +
    [...accidentals].reduce((sum, symbol) => sum + (symbol === '♯' ? 1 : -1), 0)
  )
}

describe('interval questions', () => {
  it('covers every semitone distance from unison to octave', () => {
    expect(
      intervals.map((interval) => [interval.semitones, interval.short]),
    ).toEqual([
      [0, 'P1'],
      [1, 'm2'],
      [2, 'M2'],
      [3, 'm3'],
      [4, 'M3'],
      [5, 'P4'],
      [6, 'TT'],
      [7, 'P5'],
      [8, 'm6'],
      [9, 'M6'],
      [10, 'm7'],
      [11, 'M7'],
      [12, 'P8'],
    ])
  })

  it('generates correctly spelled, nonrepeating pairs and valid choices in every configuration', () => {
    const random = randomSequence()
    for (const intervalExercise of ['notes', 'ear'] as const)
      for (const intervalDirection of [
        'ascending',
        'descending',
        'harmonic',
      ] as const)
        for (const intervalVocabulary of ['foundation', 'all'] as const) {
          const settings = {
            intervalExercise,
            intervalDirection,
            intervalVocabulary,
          }
          let previous: string | undefined
          const seen = new Set<number>()
          for (let index = 0; index < 400; index++) {
            const question = nextIntervalQuestion(settings, previous, random)
            expect(question.id).not.toBe(previous)
            previous = question.id
            expect(question.exercise).toBe(intervalExercise)
            expect(question.direction).toBe(intervalDirection)
            const [first, second] = question.notes
            const semitones = question.interval.semitones
            seen.add(semitones)
            expect(second.midi - first.midi).toBe(
              intervalDirection === 'descending' && semitones
                ? -semitones
                : semitones,
            )
            for (const note of question.notes) {
              expect(midiFromName(note.name), note.name).toBe(note.midi)
              expect(note.midi).toBeGreaterThanOrEqual(48)
              expect(note.midi).toBeLessThanOrEqual(83)
            }
            const [low, high] =
              intervalDirection === 'descending'
                ? [second, first]
                : [first, second]
            const letterDistance =
              'CDEFGAB'.indexOf(high.name[0]) -
              'CDEFGAB'.indexOf(low.name[0]) +
              (Number(high.name.at(-1)) - Number(low.name.at(-1))) * 7
            expect(letterDistance).toBe(question.interval.steps)
            expect(
              question.choices.filter(
                (choice) => choice.value === question.answer,
              ),
            ).toHaveLength(1)
            expect(
              question.choices.map((choice) => Number(choice.value)),
            ).toEqual(
              intervalVocabulary === 'foundation'
                ? foundationIntervals
                : Array.from({ length: 13 }, (_, step) => step),
            )
          }
          expect([...seen].sort((a, b) => a - b)).toEqual(
            intervalVocabulary === 'foundation'
              ? foundationIntervals
              : Array.from({ length: 13 }, (_, step) => step),
          )
        }
  })

  it('plays the exact quiz pitches, sequentially or together, and explains the actual distance', () => {
    for (const interval of intervals)
      for (const intervalDirection of [
        'ascending',
        'descending',
        'harmonic',
      ] as const) {
        const question = nextIntervalQuestion(
          {
            ...defaultIntervalSettings,
            intervalVocabulary: 'all',
            intervalDirection,
          },
          undefined,
          () => (interval.semitones * 14 + 13.5) / (13 * 14),
        )
        expect(question.interval).toBe(interval)
        const sounds = intervalSounds(question)
        expect(sounds.flatMap((sound) => sound.notes)).toEqual(
          question.notes.map((note) => note.midi),
        )
        expect(sounds).toHaveLength(intervalDirection === 'harmonic' ? 1 : 2)
        expect(sounds.every((sound) => sound.seconds >= 0.8)).toBe(true)
        const explanation = intervalExplanation(question)
        for (const note of question.notes)
          expect(explanation).toContain(note.name)
        expect(explanation).toContain(`${interval.semitones} semitone`)
        if (interval.semitones === 6)
          expect(explanation).toContain('augmented fourth')
      }
  })

  it('shares scoring, retries, reveals, and resets with the other trainer modes', () => {
    const settings = { ...defaultTrainerSettings, mode: 'intervals' as const }
    const question = nextQuestion(settings, undefined, () => 0)
    if (question.mode !== 'intervals')
      throw new Error('Expected interval question')
    expect(question.notes.map((note) => note.name)).toEqual(['C3', 'E♭3'])
    expect(isCorrectAnswer(question, '3', settings)).toBe(true)
    expect(isCorrectAnswer(question, '4', settings)).toBe(false)
    let state = trainerReducer(initialTrainerState, {
      type: 'question',
      settings,
      question,
    })
    state = trainerReducer(state, { type: 'answer', answer: '4' })
    expect(state).toMatchObject({
      completed: 0,
      streak: 0,
      wrongAnswers: ['4'],
    })
    expect(trainerReducer(state, { type: 'answer', answer: '4' })).toBe(state)
    state = trainerReducer(state, { type: 'answer', answer: '3' })
    expect(state).toMatchObject({
      status: 'correct',
      completed: 1,
      firstTry: 0,
      streak: 0,
    })
    expect(trainerReducer(state, { type: 'answer', answer: '3' })).toBe(state)
    state = trainerReducer(state, { type: 'question', settings, question })
    state = trainerReducer(state, { type: 'answer', answer: '3' })
    expect(state).toMatchObject({ completed: 2, firstTry: 1, streak: 1 })
    state = trainerReducer(state, { type: 'question', settings, question })
    state = trainerReducer(state, { type: 'reveal' })
    expect(state).toMatchObject({
      status: 'revealed',
      completed: 3,
      firstTry: 1,
      streak: 0,
    })
    state = trainerReducer(state, {
      type: 'settings',
      settings: { ...settings, intervalExercise: 'ear' },
    })
    expect(state).toMatchObject({
      question: null,
      completed: 3,
      wrongAnswers: [],
    })
    state = trainerReducer(state, { type: 'reset' })
    expect(state).toMatchObject({
      question: null,
      completed: 0,
      firstTry: 0,
      streak: 0,
      settings: { mode: 'intervals', intervalExercise: 'ear' },
    })
  })
})

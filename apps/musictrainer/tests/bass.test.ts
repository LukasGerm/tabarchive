import { describe, expect, it } from 'vitest'
import { bassChordShapes } from '../src/lib/bass-chord-shapes'
import {
  chordPositions,
  defaultTrainerSettings,
  isCorrectAnswer,
  midiAt,
  nextQuestion,
  noteName,
  pitchAt,
  positionKey,
  type TrainerSettings,
} from '../src/lib/trainer'
import { foundationQualities, roleAtPitch } from '../src/lib/chord-tones'
import { trainerPreferencesSchema } from '../src/lib/trainer-preferences'

const bassSettings: TrainerSettings = {
  ...defaultTrainerSettings,
  instrument: 'bass',
}
const tuning = [28, 33, 38, 43]
const intervals: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 2, 4, 7],
  madd9: [0, 2, 3, 7],
}
function randomSequence() {
  let seed = 887
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
}
function pitches(shape: (typeof bassChordShapes)[number]) {
  return [
    ...new Set(
      chordPositions(shape).map(
        ({ string, fret }) => (tuning[string] + fret) % 12,
      ),
    ),
  ].sort((a, b) => a - b)
}

describe('four-string bass', () => {
  it('uses E1 A1 D2 G2 and the correct sounding octaves through fret 24', () => {
    expect(
      tuning.map((_, string) => noteName(midiAt({ string, fret: 0 }, 'bass'))),
    ).toEqual(['E1', 'A1', 'D2', 'G2'])
    expect(noteName(midiAt({ string: 0, fret: 12 }, 'bass'))).toBe('E2')
    expect(noteName(midiAt({ string: 3, fret: 24 }, 'bass'))).toBe('G4')
    expect(noteName(midiAt({ string: 0, fret: 0 }, 'guitar'))).toBe('E2')
  })

  it('generates and grades notes on only four strings across every range and note setting', () => {
    const random = randomSequence()
    for (const mode of ['name', 'find'] as const)
      for (const [minFret, maxFret] of [
        [0, 5],
        [0, 12],
        [5, 12],
        [12, 24],
      ] as const)
        for (const string of ['all', 0, 1, 2, 3] as const)
          for (const notes of ['natural', 'all'] as const)
            for (const octaves of [true, false]) {
              const settings = {
                ...bassSettings,
                mode,
                minFret,
                maxFret,
                string,
                notes,
                octaves,
              }
              let previous: string | undefined
              for (let sample = 0; sample < 10; sample++) {
                const question = nextQuestion(settings, previous, random)
                if (question.mode !== 'name' && question.mode !== 'find')
                  throw new Error('Expected note')
                expect(question.id).not.toBe(previous)
                expect(question.position.string).toBeLessThan(4)
                if (string !== 'all')
                  expect(question.position.string).toBe(string)
                expect(question.position.fret).toBeGreaterThanOrEqual(minFret)
                expect(question.position.fret).toBeLessThanOrEqual(maxFret)
                const midi =
                  tuning[question.position.string] + question.position.fret
                if (notes === 'natural')
                  expect([0, 2, 4, 5, 7, 9, 11]).toContain(midi % 12)
                expect(question.pitch).toBe(midi % 12)
                expect(question.choices).toHaveLength(5)
                const value = String(
                  mode === 'name' && octaves ? midi : midi % 12,
                )
                expect(
                  question.choices.map((choice) => choice.value),
                ).toContain(value)
                expect(
                  isCorrectAnswer(
                    question,
                    mode === 'find' ? positionKey(question.position) : value,
                    settings,
                  ),
                ).toBe(true)
                if (mode === 'name' && octaves)
                  expect(
                    isCorrectAnswer(question, String(midi + 12), settings),
                  ).toBe(false)
                if (mode === 'find')
                  expect(
                    isCorrectAnswer(
                      question,
                      `4:${question.position.fret}`,
                      settings,
                    ),
                  ).toBe(false)
                previous = question.id
              }
            }
  })

  it('every bass shape contains its complete named harmony within the diagram span', () => {
    expect(new Set(bassChordShapes.map((shape) => shape.id)).size).toBe(
      bassChordShapes.length,
    )
    expect(new Set(bassChordShapes.map((shape) => shape.quality)).size).toBe(15)
    for (const shape of bassChordShapes) {
      expect(shape.frets).toHaveLength(4)
      const actual = [
        ...new Set(
          chordPositions(shape).map(
            ({ string, fret }) =>
              (tuning[string] + fret - shape.root + 12) % 12,
          ),
        ),
      ].sort((a, b) => a - b)
      expect(actual, shape.id).toEqual(intervals[shape.quality])
      expect(shape.frets.includes(0)).toBe(shape.family === 'open')
      const fretted = shape.frets.filter(
        (fret): fret is number => fret !== null && fret > 0,
      )
      expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThan(5)
      expect(
        shape.frets.every((fret) => fret === null || (fret >= 0 && fret <= 24)),
      ).toBe(true)
    }
  })

  it('keeps recognition choices distinct from equivalent bass harmonies', () => {
    for (const chords of ['open', 'movable', 'all'] as const) {
      const settings = { ...bassSettings, mode: 'chords' as const, chords }
      const pool = bassChordShapes.filter(
        (shape) => chords === 'all' || shape.family === chords,
      )
      for (const [index, shape] of pool.entries()) {
        let selecting = true
        const random = randomSequence()
        const question = nextQuestion(settings, undefined, () => {
          if (!selecting) return random()
          selecting = false
          return (index + 0.5) / pool.length
        })
        if (question.mode !== 'chords') throw new Error('Expected chord')
        expect(question.shape.id).toBe(shape.id)
        expect(question.choices).toHaveLength(4)
        expect(
          new Set(question.choices.map((choice) => choice.value)).size,
        ).toBe(4)
        const equivalents = bassChordShapes
          .filter(
            (other) => pitches(other).join(',') === pitches(shape).join(','),
          )
          .map((other) => other.name)
        expect(
          question.choices
            .filter((choice) => equivalents.includes(choice.value))
            .map((choice) => choice.value),
        ).toEqual([shape.name])
      }
    }
  })

  it('uses bass shapes for every root/role collection and vocabulary', () => {
    const random = randomSequence()
    for (const mode of ['roots', 'roles'] as const)
      for (const chords of ['open', 'movable', 'all'] as const)
        for (const toneVocabulary of ['foundation', 'all'] as const) {
          const settings = { ...bassSettings, mode, chords, toneVocabulary }
          let previous: string | undefined
          for (let sample = 0; sample < 40; sample++) {
            const question = nextQuestion(settings, previous, random)
            if (question.mode !== 'roots' && question.mode !== 'roles')
              throw new Error('Expected chord tones')
            expect(question.id).not.toBe(previous)
            expect(question.shape.frets).toHaveLength(4)
            if (chords !== 'all') expect(question.shape.family).toBe(chords)
            if (toneVocabulary === 'foundation')
              expect(foundationQualities).toContain(question.shape.quality)
            if (question.mode === 'roots') {
              const roots = chordPositions(question.shape).filter(
                (position) => pitchAt(position, 'bass') === question.shape.root,
              )
              expect(roots.length).toBeGreaterThan(0)
              expect(question.roots).toEqual(roots)
              for (const root of roots)
                expect(
                  isCorrectAnswer(question, positionKey(root), settings),
                ).toBe(true)
            } else {
              expect(question.role).toBe(
                roleAtPitch(question.shape, pitchAt(question.position, 'bass')),
              )
              expect(
                question.choices
                  .filter((choice) =>
                    isCorrectAnswer(question, choice.value, settings),
                  )
                  .map((choice) => choice.value),
              ).toEqual([question.role])
            }
            previous = question.id
          }
        }
  })

  it('preserves legacy guitar settings and safely repairs an unavailable bass focus string', () => {
    expect(
      trainerPreferencesSchema.parse({ string: 5, spelling: 'flats' }),
    ).toMatchObject({ instrument: 'guitar', string: 5, spelling: 'flats' })
    expect(
      trainerPreferencesSchema.parse({
        instrument: 'bass',
        string: 5,
        spelling: 'flats',
      }),
    ).toMatchObject({ instrument: 'bass', string: 'all', spelling: 'flats' })
    expect(
      trainerPreferencesSchema.parse({ instrument: 'bass', string: 3 }),
    ).toMatchObject({ instrument: 'bass', string: 3 })
    expect(
      trainerPreferencesSchema.safeParse({ instrument: 'piano' }).success,
    ).toBe(false)
  })
})

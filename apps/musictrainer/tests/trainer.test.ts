import { describe, expect, it } from 'vitest'
import {
  chordShapes,
  defaultTrainerSettings,
  initialTrainerState,
  isCorrectAnswer,
  nextQuestion,
  pitchAt,
  pitchName,
  noteName,
  midiAt,
  trainerReducer,
  type ChordShape,
  type NoteQuestion,
  type TrainerSettings,
} from '../src/lib/trainer'

const chordIntervals: Record<ChordShape['quality'], number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 2, 4, 7],
  madd9: [0, 2, 3, 7],
  add11: [0, 4, 5, 7],
  madd11: [0, 3, 5, 7],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  m7b5: [0, 3, 6, 10],
  '9': [0, 2, 4, 7, 10],
}

function soundingPitches(shape: ChordShape) {
  return [
    ...new Set(
      shape.frets.flatMap((fret, string) =>
        fret === null ? [] : [pitchAt({ string, fret })],
      ),
    ),
  ].sort((a, b) => a - b)
}

// Deterministic sampling without tying the tests to one shuffled order.
function randomSequence() {
  let seed = 1987
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

describe('fretboard music and questions', () => {
  it('defaults to the full first octave and names sounding pitches across the upper neck', () => {
    expect(defaultTrainerSettings).toMatchObject({
      mode: 'name',
      minFret: 0,
      maxFret: 12,
      notes: 'all',
      octaves: true,
      chords: 'all',
    })
    expect(noteName(midiAt({ string: 0, fret: 0 }))).toBe('E2')
    expect(noteName(midiAt({ string: 0, fret: 12 }))).toBe('E3')
    expect(noteName(midiAt({ string: 0, fret: 24 }))).toBe('E4')
    expect(noteName(midiAt({ string: 4, fret: 0 }))).toBe('B3')
    expect(noteName(midiAt({ string: 4, fret: 1 }))).toBe('C4')
    expect(noteName(midiAt({ string: 5, fret: 24 }))).toBe('E6')
    const question: NoteQuestion = {
      mode: 'name',
      id: 'name:0:12',
      position: { string: 0, fret: 12 },
      pitch: 4,
      choices: [],
    }
    expect(isCorrectAnswer(question, '52', defaultTrainerSettings)).toBe(true)
    expect(isCorrectAnswer(question, '40', defaultTrainerSettings)).toBe(false)
    expect(
      isCorrectAnswer(question, '4', {
        ...defaultTrainerSettings,
        octaves: false,
      }),
    ).toBe(true)
    const random = randomSequence()
    const frets = new Set(
      Array.from({ length: 160 }, () => {
        const next = nextQuestion(defaultTrainerSettings, undefined, random)
        if (next.mode !== 'name' && next.mode !== 'find')
          throw new Error('Expected note')
        return next.position.fret
      }),
    )
    expect([...frets].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 13 }, (_, fret) => fret),
    )
  })

  it('finds octave repetitions only inside the chosen upper-fret window', () => {
    const settings: TrainerSettings = {
      ...defaultTrainerSettings,
      mode: 'find',
      minFret: 12,
      maxFret: 24,
    }
    const question: NoteQuestion = {
      mode: 'find',
      id: 'find:0:4',
      position: { string: 0, fret: 12 },
      pitch: 4,
      choices: [],
    }
    expect(isCorrectAnswer(question, '0:0', settings)).toBe(false)
    expect(isCorrectAnswer(question, '0:12', settings)).toBe(true)
    expect(isCorrectAnswer(question, '0:24', settings)).toBe(true)
  })

  it('uses standard tuning, semitone steps, octave repetition, and enharmonic names', () => {
    expect(
      Array.from({ length: 6 }, (_, string) => pitchAt({ string, fret: 0 })),
    ).toEqual([4, 9, 2, 7, 11, 4])
    expect(pitchName(pitchAt({ string: 0, fret: 1 }))).toBe('F')
    expect(pitchName(pitchAt({ string: 4, fret: 1 }))).toBe('C')
    expect(pitchName(pitchAt({ string: 1, fret: 4 }), 'sharps')).toBe('C♯')
    expect(pitchName(pitchAt({ string: 1, fret: 4 }), 'flats')).toBe('D♭')
    for (let string = 0; string < 6; string++)
      expect(pitchAt({ string, fret: 12 })).toBe(pitchAt({ string, fret: 0 }))
  })

  it('every chord fingering produces its named harmony and has a playable barre', () => {
    const tuning = [4, 9, 2, 7, 11, 4]
    expect(new Set(chordShapes.map((shape) => shape.id)).size).toBe(
      chordShapes.length,
    )
    for (const shape of chordShapes) {
      expect(shape.frets, shape.name).toHaveLength(6)
      const intervals = [
        ...new Set(
          shape.frets.flatMap((fret, string) =>
            fret === null
              ? []
              : [(tuning[string] + fret - shape.root + 12) % 12],
          ),
        ),
      ].sort((a, b) => a - b)
      const expected = chordIntervals[shape.quality]
      // The familiar C7 x32310 voicing intentionally omits the fifth.
      expect(intervals, shape.id).toEqual(
        shape.id === 'c7-open' ? [0, 4, 10] : expected,
      )
      expect(shape.frets.includes(0), shape.id).toBe(shape.family === 'open')
      const fretted = shape.frets.filter(
        (fret): fret is number => fret !== null && fret > 0,
      )
      expect(
        Math.max(...fretted) - Math.min(...fretted),
        shape.id,
      ).toBeLessThan(5)
      const namedPitches = shape.tones
        .replace(/ \(.*\)/, '')
        .split(' · ')
        .map((tone) => {
          const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[
            tone[0]
          ]!
          const accidentals = [...tone.slice(1)].reduce(
            (offset, symbol) => offset + (symbol === '♯' ? 1 : -1),
            0,
          )
          return (natural + accidentals + 12) % 12
        })
        .sort((a, b) => a - b)
      expect(namedPitches, shape.id).toEqual(soundingPitches(shape))
      if (shape.barre) {
        const { from, to, fret } = shape.barre
        expect(shape.frets[from], shape.id).toBe(fret)
        expect(shape.frets[to], shape.id).toBe(fret)
        for (let string = from; string <= to; string++) {
          expect(shape.frets[string], shape.id).not.toBeNull()
          expect(shape.frets[string], shape.id).toBeGreaterThanOrEqual(fret)
        }
      }
    }
  })

  it('includes multiple voicings of every chord quality in the full collection', () => {
    for (const quality of Object.keys(chordIntervals)) {
      expect(
        chordShapes.filter((shape) => shape.quality === quality).length,
        quality,
      ).toBeGreaterThanOrEqual(2)
    }
  })

  it('generates playable, nonrepeating questions within every note setting', () => {
    const random = randomSequence()
    for (const mode of ['find', 'name'] as const)
      for (const [minFret, maxFret] of [
        [0, 5],
        [0, 12],
        [5, 12],
        [12, 24],
      ] as const)
        for (const notes of ['natural', 'all'] as const)
          for (const string of ['all', 0, 1, 2, 3, 4, 5] as const) {
            const settings = {
              ...defaultTrainerSettings,
              mode,
              minFret,
              maxFret,
              notes,
              string,
            }
            let previous: string | undefined
            for (let sample = 0; sample < 20; sample++) {
              const question = nextQuestion(settings, previous, random)
              expect(question.mode).toBe(mode)
              expect(question.id).not.toBe(previous)
              if (question.mode !== 'name' && question.mode !== 'find')
                throw new Error('Expected note')
              expect(question.position.fret).toBeGreaterThanOrEqual(minFret)
              expect(question.position.fret).toBeLessThanOrEqual(maxFret)
              if (string !== 'all')
                expect(question.position.string).toBe(string)
              if (notes === 'natural')
                expect([0, 2, 4, 5, 7, 9, 11]).toContain(question.pitch)
              expect(question.choices).toHaveLength(5)
              expect(
                new Set(question.choices.map(({ value }) => value)).size,
              ).toBe(5)
              expect(question.choices.map(({ value }) => value)).toContain(
                String(
                  mode === 'name'
                    ? [40, 45, 50, 55, 59, 64][question.position.string] +
                        question.position.fret
                    : question.pitch,
                ),
              )
              const answer =
                mode === 'find'
                  ? `${question.position.string}:${question.position.fret}`
                  : String(
                      [40, 45, 50, 55, 59, 64][question.position.string] +
                        question.position.fret,
                    )
              expect(isCorrectAnswer(question, answer, settings)).toBe(true)
              previous = question.id
            }
          }
  })

  it('keeps chord choices unambiguous when the collection has several shapes of one chord', () => {
    const random = randomSequence()
    for (const chords of ['open', 'movable', 'all'] as const) {
      const settings: TrainerSettings = {
        ...defaultTrainerSettings,
        mode: 'chords',
        chords,
      }
      let previous: string | undefined
      for (let sample = 0; sample < 60; sample++) {
        const question = nextQuestion(settings, previous, random)
        if (question.mode !== 'chords') throw new Error('Expected chord')
        expect(question.id).not.toBe(previous)
        if (chords !== 'all') expect(question.shape.family).toBe(chords)
        expect(question.choices).toHaveLength(4)
        expect(new Set(question.choices.map(({ value }) => value)).size).toBe(4)
        expect(
          question.choices.filter(({ value }) =>
            isCorrectAnswer(question, value, settings),
          ),
        ).toEqual([{ value: question.shape.name, label: question.shape.name }])
        previous = question.id
      }
    }
  })

  it('can quiz every shape without offering another name for the same pitches', () => {
    for (const chords of ['open', 'movable', 'all'] as const) {
      const settings: TrainerSettings = {
        ...defaultTrainerSettings,
        mode: 'chords',
        chords,
      }
      const pool = chordShapes.filter(
        (shape) => chords === 'all' || shape.family === chords,
      )
      for (const [index, shape] of pool.entries()) {
        const random = randomSequence()
        for (let sample = 0; sample < 8; sample++) {
          let selecting = true
          const question = nextQuestion(settings, undefined, () => {
            if (!selecting) return random()
            selecting = false
            return (index + 0.5) / pool.length
          })
          if (question.mode !== 'chords') throw new Error('Expected chord')
          expect(question.shape.id).toBe(shape.id)
          expect(question.choices).toHaveLength(4)
          const equivalentNames = chordShapes
            .filter(
              (other) =>
                soundingPitches(other).join(',') ===
                soundingPitches(shape).join(','),
            )
            .map((other) => other.name)
          expect(
            question.choices.filter(({ value }) =>
              equivalentNames.includes(value),
            ),
          ).toEqual([{ value: shape.name, label: shape.name }])
        }
      }
    }
  })

  it('accepts both open and fret 12, but rejects a different string or an out-of-range fret', () => {
    const settings: TrainerSettings = { ...defaultTrainerSettings, maxFret: 12 }
    const question: NoteQuestion = {
      mode: 'find',
      id: 'find:0:4',
      position: { string: 0, fret: 0 },
      pitch: 4,
      choices: [],
    }
    for (const answer of ['0:0', '0:12'])
      expect(isCorrectAnswer(question, answer, settings)).toBe(true)
    for (const answer of ['5:0', '0:24', '0:1', '-1:0', '6:0', 'bad', '0:1:2'])
      expect(isCorrectAnswer(question, answer, settings)).toBe(false)
    expect(
      isCorrectAnswer(question, '0:12', {
        ...defaultTrainerSettings,
        maxFret: 5,
      }),
    ).toBe(false)
  })
})

describe('session progress', () => {
  it('counts each question once, distinguishes retries and reveals, and resets in memory', () => {
    const settings = { ...defaultTrainerSettings, octaves: false }
    const question: NoteQuestion = {
      mode: 'name',
      id: 'name:0:0',
      position: { string: 0, fret: 0 },
      pitch: 4,
      choices: [],
    }
    let state = trainerReducer(initialTrainerState, {
      type: 'question',
      question,
      settings,
    })
    state = trainerReducer(state, { type: 'answer', answer: '4' })
    expect(state).toMatchObject({
      status: 'correct',
      completed: 1,
      firstTry: 1,
      streak: 1,
    })
    expect(trainerReducer(state, { type: 'answer', answer: '4' })).toBe(state)
    expect(trainerReducer(state, { type: 'reveal' })).toBe(state)
    state = trainerReducer(state, { type: 'question', question, settings })
    state = trainerReducer(state, { type: 'answer', answer: '5' })
    expect(trainerReducer(state, { type: 'answer', answer: '5' })).toBe(state)
    expect(state).toMatchObject({
      status: 'waiting',
      completed: 1,
      streak: 0,
      wrongAnswers: ['5'],
    })
    state = trainerReducer(state, { type: 'answer', answer: '4' })
    expect(state).toMatchObject({ completed: 2, firstTry: 1, streak: 0 })
    state = trainerReducer(state, { type: 'question', question, settings })
    state = trainerReducer(state, { type: 'reveal' })
    expect(state).toMatchObject({
      status: 'revealed',
      completed: 3,
      firstTry: 1,
      streak: 0,
    })
    expect(trainerReducer(state, { type: 'answer', answer: '4' })).toBe(state)
    state = trainerReducer(state, {
      type: 'settings',
      settings: { ...settings, spelling: 'flats' },
    })
    expect(state).toMatchObject({
      question: null,
      completed: 3,
      firstTry: 1,
      wrongAnswers: [],
    })
    state = trainerReducer(state, { type: 'reset' })
    expect(state).toMatchObject({
      question: null,
      completed: 0,
      firstTry: 0,
      streak: 0,
      settings: { spelling: 'flats' },
    })
    expect(initialTrainerState.completed).toBe(0)
  })
})

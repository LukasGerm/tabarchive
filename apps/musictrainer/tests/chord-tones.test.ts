import { describe, expect, it } from 'vitest'
import {
  chordFormulas,
  chordRoles,
  chordToneName,
  chordToneShapes,
  explainChordRole,
  foundationQualities,
  roleAtPitch,
} from '../src/lib/chord-tones'
import {
  chordPositions,
  defaultTrainerSettings,
  initialTrainerState,
  isCorrectAnswer,
  nextQuestion,
  pitchAt,
  positionKey,
  trainerReducer,
  type RootQuestion,
  type TrainerSettings,
} from '../src/lib/trainer'

const shape = (id: string) => chordToneShapes.find((item) => item.id === id)!

describe('chord tone theory', () => {
  it('distinguishes minor, major, and diminished sevenths from sixths', () => {
    expect(roleAtPitch(shape('c7-open'), 10)).toBe('♭7')
    expect(roleAtPitch(shape('cmaj7-open'), 11)).toBe('7')
    expect(roleAtPitch(shape('cdim7-movable'), 9)).toBe('♭♭7')
    expect(roleAtPitch(shape('c6-movable'), 9)).toBe('6')
    expect(chordToneName(shape('cdim7-movable'), '♭♭7')).toBe('B♭♭')
    expect(chordToneName(shape('ddim7-open'), '♭♭7')).toBe('C♭')
    expect(chordToneName(shape('eaug-open'), '♯5')).toBe('B♯')
    expect(explainChordRole(shape('c7-open'), '♭7')).toContain('10 semitones')
    expect(explainChordRole(shape('cmaj7-open'), '7')).toContain('11 semitones')
  })

  it('keeps added ninths/elevenths distinct from suspended seconds/fourths', () => {
    expect(roleAtPitch(shape('aadd9-open'), 11)).toBe('9')
    expect(roleAtPitch(shape('asus2-open'), 11)).toBe('2')
    expect(roleAtPitch(shape('cadd11-open'), 5)).toBe('11')
    expect(roleAtPitch(shape('asus4-open'), 2)).toBe('4')
    expect(explainChordRole(shape('aadd9-open'), '9')).toContain('14 semitones')
    expect(explainChordRole(shape('cadd11-open'), '11')).toContain(
      '17 semitones',
    )
  })

  it('labels every sounding tone with the catalog’s spelling, including inversions and omitted fifths', () => {
    for (const chord of chordToneShapes) {
      const roles = [
        ...new Set(
          chordPositions(chord).map((position) =>
            roleAtPitch(chord, pitchAt(position)),
          ),
        ),
      ]
      expect(
        roles.map((role) => chordToneName(chord, role)).sort(),
        chord.id,
      ).toEqual(
        chord.tones
          .replace(/ \(.*\)/, '')
          .split(' · ')
          .sort(),
      )
      expect(
        chordPositions(chord).some(
          (position) => pitchAt(position) === chord.root,
        ),
        chord.id,
      ).toBe(true)
    }
    expect(chordFormulas['7']).toContain('5')
    expect(
      chordPositions(shape('c7-open')).some(
        (position) => roleAtPitch(shape('c7-open'), pitchAt(position)) === '5',
      ),
    ).toBe(false)
  })
})

describe('chord tone exercises', () => {
  it('generates distinct, valid exercises for every collection and vocabulary', () => {
    let seed = 223
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
    for (const mode of ['roots', 'roles'] as const)
      for (const chords of ['open', 'movable', 'all'] as const)
        for (const toneVocabulary of ['foundation', 'all'] as const) {
          const settings: TrainerSettings = {
            ...defaultTrainerSettings,
            mode,
            chords,
            toneVocabulary,
          }
          let previous: string | undefined
          for (let sample = 0; sample < 120; sample++) {
            const question = nextQuestion(settings, previous, random)
            if (question.mode !== 'roots' && question.mode !== 'roles')
              throw new Error('Expected chord tones')
            expect(question.mode).toBe(mode)
            expect(question.id).not.toBe(previous)
            if (chords !== 'all') expect(question.shape.family).toBe(chords)
            if (toneVocabulary === 'foundation')
              expect(foundationQualities).toContain(question.shape.quality)
            if (question.mode === 'roots') {
              const roots = chordPositions(question.shape).filter(
                (position) => pitchAt(position) === question.shape.root,
              )
              expect(question.roots).toEqual(roots)
              for (const root of roots)
                expect(
                  isCorrectAnswer(question, positionKey(root), settings),
                ).toBe(true)
            } else {
              expect(question.shape.frets[question.position.string]).toBe(
                question.position.fret,
              )
              expect(
                roleAtPitch(question.shape, pitchAt(question.position)),
              ).toBe(question.role)
              expect(question.choices).toHaveLength(4)
              expect(
                new Set(question.choices.map((choice) => choice.value)).size,
              ).toBe(4)
              expect(
                question.choices.filter((choice) =>
                  isCorrectAnswer(question, choice.value, settings),
                ),
              ).toEqual([
                {
                  value: question.role,
                  label: `${chordRoles[question.role].label} · ${question.role}`,
                },
              ])
              if (question.role === '7' || question.role === '♭7')
                expect(question.choices.map((choice) => choice.value)).toEqual(
                  expect.arrayContaining(['7', '♭7']),
                )
            }
            previous = question.id
          }
        }
  })

  const question: RootQuestion = {
    mode: 'roots',
    id: 'roots:c-over-e',
    shape: shape('c-over-e'),
    roots: [
      { string: 1, fret: 3 },
      { string: 4, fret: 1 },
    ],
  }
  const settings: TrainerSettings = { ...defaultTrainerSettings, mode: 'roots' }

  it('requires all roots, rejects bass notes and unplayed positions, and counts a multi-root question once', () => {
    for (const answer of ['0:0', '5:0', '0:8', '1:15', '-1:3', 'bad', '1:3:0'])
      expect(isCorrectAnswer(question, answer, settings)).toBe(false)
    let state = trainerReducer(initialTrainerState, {
      type: 'question',
      settings,
      question,
    })
    state = trainerReducer(state, { type: 'answer', answer: '1:3' })
    expect(state).toMatchObject({
      status: 'waiting',
      completed: 0,
      foundRoots: ['1:3'],
    })
    expect(trainerReducer(state, { type: 'answer', answer: '1:3' })).toBe(state)
    state = trainerReducer(state, { type: 'answer', answer: '4:1' })
    expect(state).toMatchObject({
      status: 'correct',
      completed: 1,
      firstTry: 1,
      streak: 1,
      foundRoots: ['1:3', '4:1'],
    })
    expect(trainerReducer(state, { type: 'answer', answer: '4:1' })).toBe(state)
    expect(
      trainerReducer(state, { type: 'question', settings, question })
        .foundRoots,
    ).toEqual([])
    expect(
      trainerReducer(state, { type: 'settings', settings }).foundRoots,
    ).toEqual([])
    expect(trainerReducer(state, { type: 'reset' }).foundRoots).toEqual([])
  })

  it('keeps retries and partial reveals out of first-try scores', () => {
    let state = trainerReducer(initialTrainerState, {
      type: 'question',
      settings,
      question,
    })
    state = trainerReducer(state, { type: 'answer', answer: '1:3' })
    state = trainerReducer(state, { type: 'answer', answer: '0:0' })
    expect(state).toMatchObject({
      status: 'waiting',
      completed: 0,
      firstTry: 0,
      foundRoots: ['1:3'],
      wrongAnswers: ['0:0'],
    })
    const revealed = trainerReducer(state, { type: 'reveal' })
    expect(revealed).toMatchObject({
      status: 'revealed',
      completed: 1,
      firstTry: 0,
      streak: 0,
    })
    expect(trainerReducer(revealed, { type: 'answer', answer: '4:1' })).toBe(
      revealed,
    )
    state = trainerReducer(state, { type: 'answer', answer: '4:1' })
    expect(state).toMatchObject({
      status: 'correct',
      completed: 1,
      firstTry: 0,
      streak: 0,
    })
  })
})

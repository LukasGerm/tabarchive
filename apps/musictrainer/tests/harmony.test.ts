import { describe, expect, it } from 'vitest'
import {
  chordsInKey,
  defaultHarmonySettings,
  functionDegrees,
  harmonyExplanation,
  harmonyPrompt,
  harmonySounds,
  harmonyHint,
  isHarmonyAnswer,
  majorKeys,
  majorScale,
  nextHarmonyQuestion,
  progressionPatterns,
  progressionVoiceLeading,
  voiceChords,
  type HarmonyQuestion,
  type HarmonySettings,
} from '../src/lib/harmony'
import {
  defaultTrainerSettings,
  initialTrainerState,
  nextQuestion,
  nextPracticeQuestion,
  trainerReducer,
  type TrainerState,
} from '../src/lib/trainer'
import { midiFrequency } from '../src/lib/harmony-audio'

function randomSequence() {
  let seed = 2026
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
}

function notePitch(name: string) {
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[name[0]]!
  return (
    (natural +
      [...name.slice(1)].reduce(
        (sum, symbol) => sum + (symbol === '♯' ? 1 : -1),
        0,
      ) +
      12) %
    12
  )
}

describe('major-key harmony', () => {
  it('builds correctly spelled scales and chords in all twelve keys', () => {
    expect(majorKeys).toHaveLength(12)
    expect(new Set(majorKeys.map((key) => key.pitch)).size).toBe(12)
    for (const key of majorKeys) {
      const scale = majorScale(key)
      expect(new Set(scale.map((note) => note.name[0])).size).toBe(7)
      expect(scale.map((note) => (note.pitch - key.pitch + 12) % 12)).toEqual([
        0, 2, 4, 5, 7, 9, 11,
      ])
      for (const note of scale)
        expect(notePitch(note.name), `${key.name}: ${note.name}`).toBe(
          note.pitch,
        )
      for (const size of ['triads', 'sevenths'] as const) {
        const chords = chordsInKey(key, size)
        for (const chord of chords) {
          expect(chord.notes).toHaveLength(size === 'triads' ? 3 : 4)
          expect(chord.notes.map(notePitch)).toEqual(chord.pitches)
          expect(
            chord.pitches.every((pitch) =>
              scale.some((note) => note.pitch === pitch),
            ),
          ).toBe(true)
        }
        expect(chords.map((chord) => chord.intervals)).toEqual(
          size === 'triads'
            ? [
                [0, 4, 7],
                [0, 3, 7],
                [0, 3, 7],
                [0, 4, 7],
                [0, 4, 7],
                [0, 3, 7],
                [0, 3, 6],
              ]
            : [
                [0, 4, 7, 11],
                [0, 3, 7, 10],
                [0, 3, 7, 10],
                [0, 4, 7, 11],
                [0, 4, 7, 10],
                [0, 3, 7, 10],
                [0, 3, 6, 10],
              ],
        )
      }
    }
    expect(
      chordsInKey(majorKeys[0], 'triads').map((chord) => chord.name),
    ).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'])
    expect(
      chordsInKey(majorKeys[0], 'sevenths').map((chord) => chord.name),
    ).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5'])
    expect(
      majorScale(majorKeys.find((key) => key.name === 'F♯')!).map(
        (note) => note.name,
      ),
    ).toEqual(['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'])
    expect(
      majorScale(majorKeys.find((key) => key.name === 'D♭')!).map(
        (note) => note.name,
      ),
    ).toEqual(['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'])
  })

  it('generates answerable, nonrepeating questions for every key, chord size, and exercise', () => {
    const random = randomSequence()
    for (const key of majorKeys)
      for (const harmonyChords of ['triads', 'sevenths'] as const)
        for (const harmonyExercise of [
          'key-chords',
          'functions',
          'progressions',
        ] as const) {
          const settings: HarmonySettings = {
            ...defaultHarmonySettings,
            harmonyKey: key.name,
            harmonyChords,
            harmonyExercise,
          }
          let previous: string | undefined
          for (let sample = 0; sample < 40; sample++) {
            const question = nextHarmonyQuestion(settings, previous, random)
            expect(question.id).not.toBe(previous)
            expect(question.key).toEqual(key)
            expect(question.size).toBe(harmonyChords)
            expect(question.exercise).toBe(harmonyExercise)
            expect(question.choices).toHaveLength(
              harmonyExercise === 'functions' ? 3 : 0,
            )
            expect(
              new Set(question.choices.map((choice) => choice.value)).size,
            ).toBe(question.choices.length)
            expect(isHarmonyAnswer(question, question.answer)).toBe(true)
            if (question.exercise === 'functions') {
              expect(
                question.choices.filter(
                  (choice) => choice.value === question.answer,
                ),
              ).toHaveLength(1)
              expect(
                functionDegrees.find(
                  (item) => item.degree === question.target.degree,
                )?.function,
              ).toBe(question.answer)
              expect([0, 1, 3, 4, 6]).toContain(question.target.degree)
            } else if (question.exercise === 'progressions') {
              expect(question.progression[question.missing]).toEqual(
                question.target,
              )
              expect(question.missing).toBeGreaterThan(0)
              expect(harmonyPrompt(question)).toContain(
                question.progression.map((chord) => chord.roman).join('–'),
              )
            } else {
              const chord = chordsInKey(key, harmonyChords)[
                question.target.degree
              ]
              expect(question.answer).toBe(
                question.recall === 'name'
                  ? chord.name
                  : question.recall === 'numeral'
                    ? chord.roman
                    : chord.notes.join(' '),
              )
            }
            previous = question.id
          }
        }
  })

  it('integrates retries, reveal, scores, and mode changes with the existing trainer', () => {
    const settings = { ...defaultTrainerSettings, mode: 'harmony' as const }
    const question = nextQuestion(settings, undefined, () => 0)
    if (question.mode !== 'harmony') throw new Error('Expected harmony')
    let state = trainerReducer(initialTrainerState, {
      type: 'question',
      settings,
      question,
    })
    state = trainerReducer(state, { type: 'answer', answer: question.answer })
    expect(state).toMatchObject({
      status: 'correct',
      completed: 1,
      firstTry: 1,
      streak: 1,
    })
    expect(
      trainerReducer(state, { type: 'answer', answer: question.answer }),
    ).toBe(state)
    state = trainerReducer(state, { type: 'question', settings, question })
    state = trainerReducer(state, {
      type: 'answer',
      answer: 'wrong',
    })
    state = trainerReducer(state, { type: 'reveal' })
    expect(state).toMatchObject({
      status: 'revealed',
      completed: 2,
      firstTry: 1,
      streak: 0,
    })
    state = trainerReducer(state, {
      type: 'settings',
      settings: { ...settings, mode: 'name' },
    })
    expect(state).toMatchObject({
      question: null,
      wrongAnswers: [],
      completed: 2,
      firstTry: 1,
    })
  })
})

describe('harmony recall', () => {
  function question(
    recall: HarmonySettings['harmonyRecall'],
    degree = 5,
    harmonyChords: HarmonySettings['harmonyChords'] = 'triads',
  ) {
    return nextHarmonyQuestion(
      { ...defaultHarmonySettings, harmonyRecall: recall, harmonyChords },
      undefined,
      () => (degree + 0.5) / 7,
    )
  }

  it('asks all three directions without choices or giving the reverse answer in the prompt', () => {
    expect(harmonyPrompt(question('name'))).toBe(
      'Which chord is vi in C major?',
    )
    expect(harmonyPrompt(question('numeral'))).toBe(
      'Which Roman numeral is Am in C major?',
    )
    expect(harmonyPrompt(question('notes'))).toBe(
      'What notes make Am in C major?',
    )
    const recalls = new Set(
      Array.from({ length: 21 }, (_, index) => {
        const item = nextHarmonyQuestion(
          defaultHarmonySettings,
          undefined,
          () => (index + 0.5) / 21,
        )
        expect(item.choices).toEqual([])
        return item.exercise === 'key-chords' && item.recall
      }),
    )
    expect(recalls).toEqual(new Set(['name', 'numeral', 'notes']))
  })

  it('accepts common chord notation while preserving quality and scale spelling', () => {
    for (const value of ['Am', 'a minor', 'Amin', ' Am '])
      expect(isHarmonyAnswer(question('name'), value)).toBe(true)
    for (const value of ['A', 'AM', 'Am7', '', 'garbage', 'Am extra'])
      expect(isHarmonyAnswer(question('name'), value)).toBe(false)
    for (const value of ['CM7', 'Cmaj7', 'C major7', 'CΔ7'])
      expect(isHarmonyAnswer(question('name', 0, 'sevenths'), value)).toBe(true)
    expect(isHarmonyAnswer(question('name', 0, 'sevenths'), 'Cm7')).toBe(false)
    for (const value of ['Bm7b5', 'Bm7♭5', 'Bø7'])
      expect(isHarmonyAnswer(question('name', 6, 'sevenths'), value)).toBe(true)
    for (const key of majorKeys) {
      const item = nextHarmonyQuestion(
        {
          ...defaultHarmonySettings,
          harmonyKey: key.name,
          harmonyRecall: 'name',
        },
        undefined,
        () => 0.2,
      )
      expect(
        isHarmonyAnswer(
          item,
          item.answer.replaceAll('♯', '#').replaceAll('♭', 'b'),
        ),
      ).toBe(true)
    }
  })

  it('requires numeral case and distinguishes four from six', () => {
    expect(isHarmonyAnswer(question('numeral'), 'vi')).toBe(true)
    for (const value of ['VI', 'iv', 'IV', '6'])
      expect(isHarmonyAnswer(question('numeral'), value)).toBe(false)
    expect(isHarmonyAnswer(question('numeral', 3), 'IV')).toBe(true)
    expect(isHarmonyAnswer(question('numeral', 3), 'iv')).toBe(false)
    expect(isHarmonyAnswer(question('numeral', 6), 'viio')).toBe(true)
    expect(isHarmonyAnswer(question('numeral', 6, 'sevenths'), 'vii/o7')).toBe(
      true,
    )
    expect(harmonyExplanation(question('name'))).toContain(
      'IV means four and vi means six',
    )
  })

  it('checks every distinct chord tone, accepts any order, and teaches correct spelling', () => {
    for (const value of ['A C E', 'e, a, c', 'A · C · E', 'A-C-E'])
      expect(isHarmonyAnswer(question('notes'), value)).toBe(true)
    for (const value of [
      'A C',
      'A C E E',
      'A A E',
      'A C F',
      'A C E G',
      'Am',
      '',
    ])
      expect(isHarmonyAnswer(question('notes'), value)).toBe(false)
    const item = nextHarmonyQuestion(
      {
        ...defaultHarmonySettings,
        harmonyKey: 'F♯',
        harmonyRecall: 'notes',
        harmonyChords: 'sevenths',
      },
      undefined,
      () => 0,
    )
    expect(isHarmonyAnswer(item, 'F# A# C# E#')).toBe(true)
    expect(isHarmonyAnswer(item, 'F# A# C# F')).toBe(false)
    expect(harmonyHint(item)).toContain('4, 7, 11 semitones')
    expect(harmonyExplanation(item)).toContain(
      'E♯ is a major seventh (11 semitones)',
    )
    expect(harmonyExplanation(question('notes'))).toContain(
      'C is a minor third (3 semitones)',
    )
  })

  it('revisits missed, revealed, and hinted answers after two others, clearing only unaided recall', () => {
    const settings = {
      ...defaultTrainerSettings,
      mode: 'harmony' as const,
      harmonyRecall: 'name' as const,
    }
    const start = (state: TrainerState) =>
      trainerReducer(state, {
        type: 'question',
        settings,
        question: nextPracticeQuestion(state, settings, () => 0),
      })
    const solve = (state: TrainerState) =>
      trainerReducer(state, {
        type: 'answer',
        answer: (state.question as HarmonyQuestion).answer,
      })
    for (const assistance of ['wrong', 'hint', 'reveal'] as const) {
      let state = start(initialTrainerState)
      const original = state.question!
      state = trainerReducer(
        state,
        assistance === 'wrong'
          ? { type: 'answer', answer: 'wrong' }
          : { type: assistance },
      )
      state = solve(state)
      expect(state).toMatchObject({ completed: 1, firstTry: 0, streak: 0 })
      expect(state.harmonyReviews).toHaveLength(1)
      for (let index = 0; index < 2; index++) {
        state = start(state)
        expect(state.question?.id).not.toBe(original.id)
        expect(state.hintsUsed).toBe(0)
        expect(state.wrongAnswers).toEqual([])
        state = solve(state)
      }
      state = start(state)
      expect(state.question).toEqual(original)
      state = solve(state)
      expect(state.harmonyReviews).toEqual([])
      expect(state).toMatchObject({ completed: 4, firstTry: 3, streak: 3 })
    }
  })

  it('keeps assisted reviews queued, respects settings, and clears all progress on reset', () => {
    const settings = {
      ...defaultTrainerSettings,
      mode: 'harmony' as const,
      harmonyRecall: 'name' as const,
    }
    let state = trainerReducer(initialTrainerState, {
      type: 'question',
      settings,
      question: question('name'),
    })
    state = trainerReducer(state, { type: 'hint' })
    state = trainerReducer(state, { type: 'hint' })
    expect(trainerReducer(state, { type: 'hint' })).toBe(state)
    state = trainerReducer(state, { type: 'answer', answer: 'Am' })
    expect(trainerReducer(state, { type: 'hint' })).toBe(state)
    state = { ...state, completed: 3, question: null }
    expect(
      (
        nextPracticeQuestion(state, {
          ...settings,
          harmonyKey: 'G',
        }) as HarmonyQuestion
      ).key.name,
    ).toBe('G')
    const reverse = nextPracticeQuestion(state, {
      ...settings,
      harmonyRecall: 'numeral',
    })
    expect(
      reverse.mode === 'harmony' &&
        reverse.exercise === 'key-chords' &&
        reverse.recall,
    ).toBe('numeral')
    state = trainerReducer(state, {
      type: 'question',
      settings,
      question: nextPracticeQuestion(state),
    })
    state = trainerReducer(state, { type: 'hint' })
    state = trainerReducer(state, { type: 'answer', answer: 'Am' })
    expect(state.harmonyReviews).toHaveLength(1)
    expect(state.harmonyReviews[0].due).toBe(6)
    expect(trainerReducer(state, { type: 'reset' })).toEqual({
      ...initialTrainerState,
      settings,
    })
  })
})

describe('harmony playback and explanations', () => {
  it('plays only the scale before a key-chord answer, then the target chord', () => {
    const question = nextHarmonyQuestion(
      { ...defaultHarmonySettings, harmonyKey: 'F♯' },
      undefined,
      () => 0,
    )
    expect(harmonySounds(question, false).map((sound) => sound.notes)).toEqual([
      [66],
      [68],
      [70],
      [71],
      [73],
      [75],
      [77],
      [78],
    ])
    const answer = harmonySounds(question, true)
    expect(answer).toHaveLength(1)
    expect(
      [...new Set(answer[0].notes.map((midi) => midi % 12))].sort(),
    ).toEqual([...question.target.pitches].sort())
    expect(midiFrequency(69)).toBe(440)
    expect(midiFrequency(81)).toBe(880)
    expect(midiFrequency(60)).toBeCloseTo(261.6256, 3)
  })

  it('establishes a tonic before the function target and explains the chosen role', () => {
    const question = nextHarmonyQuestion(
      { ...defaultHarmonySettings, harmonyExercise: 'functions' },
      undefined,
      () => 0.65,
    )
    if (question.exercise !== 'functions') throw new Error('Expected functions')
    expect(question.target.name).toBe('G')
    expect(question.answer).toBe('dominant')
    const sounds = harmonySounds(question, false)
    expect(
      [...new Set(sounds[0].notes.map((midi) => midi % 12))].sort(),
    ).toEqual([0, 4, 7])
    expect(
      [...new Set(sounds[1].notes.map((midi) => midi % 12))].sort(),
    ).toEqual([2, 7, 11].sort())
    expect(harmonyExplanation(question)).toContain('dominant function')
  })

  it('leaves a silent slot before revealing every possible progression gap', () => {
    for (const key of majorKeys)
      for (const size of ['triads', 'sevenths'] as const)
        for (const pattern of progressionPatterns) {
          const chords = chordsInKey(key, size)
          const progression = pattern.degrees.map((degree) => chords[degree])
          for (let missing = 1; missing < progression.length; missing++) {
            const question: HarmonyQuestion = {
              mode: 'harmony',
              exercise: 'progressions',
              id: 'test',
              key,
              size,
              progression,
              pattern,
              missing,
              target: progression[missing],
              answer: progression[missing].name,
              choices: [],
            }
            const before = harmonySounds(question, false)
            const after = harmonySounds(question, true)
            expect(before[missing].notes).toEqual([])
            expect(after[missing].notes.length).toBeGreaterThan(0)
            expect(before.map((sound) => sound.seconds)).toEqual(
              after.map((sound) => sound.seconds),
            )
            expect(before).toHaveLength(progression.length)
            for (let step = 0; step < progression.length; step++) {
              expect(
                [...new Set(after[step].notes.map((midi) => midi % 12))].sort(),
              ).toEqual([...progression[step].pitches].sort())
              if (step !== missing) expect(before[step]).toEqual(after[step])
            }
            const voices = voiceChords(progression)
            expect(
              voices.every((notes) =>
                notes.every((note) => note >= 48 && note <= 84),
              ),
            ).toBe(true)
            const leading = progressionVoiceLeading(question)!
            for (const movement of leading.movements) {
              expect(
                (notePitch(movement.from) + movement.semitones + 24) % 12,
              ).toBe(notePitch(movement.to))
            }
          }
        }
  })

  it('connects the audible G7 to Cmaj7 voices to the note-by-note explanation', () => {
    const chords = chordsInKey(majorKeys[0], 'sevenths')
    const progression = [chords[1], chords[4], chords[0]]
    const question: HarmonyQuestion = {
      mode: 'harmony',
      exercise: 'progressions',
      id: 'test',
      key: majorKeys[0],
      size: 'sevenths',
      pattern: progressionPatterns[0],
      progression,
      missing: 2,
      target: chords[0],
      answer: chords[0].name,
      choices: [],
    }
    const movements = progressionVoiceLeading(question)!.movements
    expect(movements).toEqual(
      expect.arrayContaining([
        { from: 'F', to: 'E', semitones: -1 },
        { from: 'B', to: 'B', semitones: 0 },
      ]),
    )
  })
})

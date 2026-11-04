import { instruments, type Instrument } from './instruments'
import { bassChordShapes } from './bass-chord-shapes'
export { guitarStrings } from './instruments'
import { chordShapes, type ChordShape } from './chord-shapes'
import {
  defaultIntervalSettings,
  nextIntervalQuestion,
  type IntervalQuestion,
  type IntervalSettings,
} from './intervals'
import {
  defaultHarmonySettings,
  harmonyConcept,
  isHarmonyAnswer,
  matchesHarmonySettings,
  nextHarmonyQuestion,
  type HarmonyQuestion,
  type HarmonySettings,
} from './harmony'
import {
  chordRoles,
  chordToneShapes,
  foundationQualities,
  roleAtPitch,
  type ChordRole,
} from './chord-tones'
export { chordShapes, type ChordShape } from './chord-shapes'

export const naturalPitches = [0, 2, 4, 5, 7, 9, 11]
export const allPitches = Array.from({ length: 12 }, (_, index) => index)
const sharps = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const flats = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
export type Spelling = 'sharps' | 'flats'
export const pitchName = (pitch: number, spelling: Spelling = 'sharps') =>
  (spelling === 'sharps' ? sharps : flats)[((pitch % 12) + 12) % 12]
export type Position = { string: number; fret: number }
export const positionKey = ({ string, fret }: Position) => `${string}:${fret}`
export const pitchAt = (
  position: Position,
  instrument: Instrument = 'guitar',
) => midiAt(position, instrument) % 12
export const midiAt = (
  { string, fret }: Position,
  instrument: Instrument = 'guitar',
) => instruments[instrument].strings[string].midi + fret
export const noteName = (
  midi: number,
  spelling: Spelling = 'sharps',
  octaves = true,
) => `${pitchName(midi, spelling)}${octaves ? Math.floor(midi / 12) - 1 : ''}`

export type TrainerMode =
  'find' | 'name' | 'chords' | 'roots' | 'roles' | 'harmony' | 'intervals'
export type TrainerSettings = HarmonySettings &
  IntervalSettings & {
    instrument: Instrument
    mode: TrainerMode
    minFret: 0 | 5 | 12
    maxFret: 5 | 12 | 24
    string: 'all' | number
    notes: 'natural' | 'all'
    spelling: Spelling
    octaves: boolean
    chords: ChordShape['family'] | 'all'
    toneVocabulary: 'foundation' | 'all'
  }
export const defaultTrainerSettings: TrainerSettings = {
  ...defaultHarmonySettings,
  ...defaultIntervalSettings,
  instrument: 'guitar',
  mode: 'name',
  minFret: 0,
  maxFret: 12,
  string: 'all',
  notes: 'all',
  spelling: 'sharps',
  octaves: true,
  chords: 'all',
  toneVocabulary: 'foundation',
}
export function normalizeTrainerSettings(
  settings: TrainerSettings,
): TrainerSettings {
  const strings = instruments[settings.instrument].strings
  return {
    ...settings,
    string:
      settings.string === 'all' || strings[settings.string]
        ? settings.string
        : 'all',
  }
}

type Choice = { value: string; label: string }
export type NoteQuestion = {
  mode: 'find' | 'name'
  id: string
  position: Position
  pitch: number
  choices: Choice[]
}
export type ChordQuestion = {
  mode: 'chords'
  id: string
  shape: ChordShape
  choices: Choice[]
}
export type RootQuestion = {
  mode: 'roots'
  id: string
  shape: ChordShape
  roots: Position[]
}
export type RoleQuestion = {
  mode: 'roles'
  id: string
  shape: ChordShape
  position: Position
  role: ChordRole
  choices: Choice[]
}
export type TrainerQuestion =
  | NoteQuestion
  | ChordQuestion
  | RootQuestion
  | RoleQuestion
  | HarmonyQuestion
  | IntervalQuestion

export function chordPositions(shape: ChordShape): Position[] {
  return shape.frets.flatMap((fret, string) =>
    fret === null ? [] : [{ string, fret }],
  )
}

export function availablePositions(settings: TrainerSettings): Position[] {
  const positions: Position[] = []
  for (
    let string = 0;
    string < instruments[settings.instrument].strings.length;
    string++
  ) {
    if (settings.string !== 'all' && settings.string !== string) continue
    for (let fret = settings.minFret; fret <= settings.maxFret; fret++) {
      const position = { string, fret }
      if (
        settings.notes === 'all' ||
        naturalPitches.includes(pitchAt(position, settings.instrument))
      )
        positions.push(position)
    }
  }
  return positions
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}
function choose<T extends { id: string }>(
  items: T[],
  previous: string | undefined,
  random: () => number,
): T {
  const different = items.filter((item) => item.id !== previous)
  const pool = different.length ? different : items
  if (!pool.length) throw new Error('No exercises match these settings.')
  return pool[Math.floor(random() * pool.length)]
}

function chordPitchKey(shape: ChordShape, instrument: Instrument): string {
  return [
    ...new Set(
      shape.frets.flatMap((fret, string) =>
        fret === null ? [] : [pitchAt({ string, fret }, instrument)],
      ),
    ),
  ]
    .sort((a, b) => a - b)
    .join(',')
}

const shapeCatalogs = { guitar: chordShapes, bass: bassChordShapes }
const toneCatalogs = { guitar: chordToneShapes, bass: bassChordShapes }
const chordPitchKeys = new Map(
  (Object.keys(shapeCatalogs) as Instrument[]).flatMap((instrument) =>
    shapeCatalogs[instrument].map(
      (shape) => [shape.id, chordPitchKey(shape, instrument)] as const,
    ),
  ),
)

export function nextQuestion(
  settings: TrainerSettings,
  previous?: string,
  random = Math.random,
): TrainerQuestion {
  if (settings.mode === 'intervals')
    return nextIntervalQuestion(settings, previous, random)
  if (settings.mode === 'harmony')
    return nextHarmonyQuestion(settings, previous, random)
  if (settings.mode === 'roots' || settings.mode === 'roles') {
    const shapes = toneCatalogs[settings.instrument].filter(
      (shape) =>
        (settings.chords === 'all' || shape.family === settings.chords) &&
        (settings.toneVocabulary === 'all' ||
          foundationQualities.includes(shape.quality)),
    )
    if (settings.mode === 'roots') {
      const selected = choose(
        shapes.map((shape) => ({ shape, id: `roots:${shape.id}` })),
        previous,
        random,
      )
      return {
        ...selected,
        mode: 'roots',
        roots: chordPositions(selected.shape).filter(
          (position) =>
            pitchAt(position, settings.instrument) === selected.shape.root,
        ),
      }
    }
    // Sample distinct roles so doubled roots don't drown out thirds and sevenths.
    const candidates = shapes.flatMap((shape) => {
      const roles = [
        ...new Set(
          chordPositions(shape).map((position) =>
            roleAtPitch(shape, pitchAt(position, settings.instrument)),
          ),
        ),
      ]
      return roles.map((role) => ({
        id: `roles:${shape.id}:${role}`,
        shape,
        role,
      }))
    })
    const selected = choose(candidates, previous, random)
    const positions = chordPositions(selected.shape).filter(
      (position) =>
        roleAtPitch(selected.shape, pitchAt(position, settings.instrument)) ===
        selected.role,
    )
    const vocabulary: ChordRole[] =
      settings.toneVocabulary === 'foundation'
        ? ['1', '♭3', '3', '5', '♭7', '7']
        : (Object.keys(chordRoles) as ChordRole[])
    const others = vocabulary.filter((role) => role !== selected.role)
    // Always compare the two common sevenths when either is the target.
    const counterpart =
      selected.role === '♭7' ? '7' : selected.role === '7' ? '♭7' : undefined
    const distractors = shuffle(
      others.filter((role) => role !== counterpart),
      random,
    ).slice(0, counterpart ? 2 : 3)
    if (counterpart) distractors.push(counterpart)
    return {
      ...selected,
      mode: 'roles',
      position: positions[Math.floor(random() * positions.length)],
      choices: shuffle([selected.role, ...distractors], random).map((role) => ({
        value: role,
        label: `${chordRoles[role].label} · ${role}`,
      })),
    }
  }
  if (settings.mode === 'chords') {
    const catalog = shapeCatalogs[settings.instrument]
    const pool = catalog.filter(
      (shape) => settings.chords === 'all' || shape.family === settings.chords,
    )
    const shape = choose(pool, previous, random)
    // Different names can describe the same pitches (e.g. C6 and Am7,
    // or inversions of symmetrical dim7/aug chords). Don't offer those together.
    const equivalentNames = new Set(
      catalog
        .filter(
          (item) =>
            chordPitchKeys.get(item.id) === chordPitchKeys.get(shape.id),
        )
        .map((item) => item.name),
    )
    const otherNames = [...new Set(pool.map((item) => item.name))].filter(
      (name) => name !== shape.name && !equivalentNames.has(name),
    )
    const names = [shape.name, ...shuffle(otherNames, random).slice(0, 3)]
    return {
      mode: 'chords',
      id: shape.id,
      shape,
      choices: shuffle(names, random).map((name) => ({
        value: name,
        label: name,
      })),
    }
  }
  const candidates = availablePositions(settings).map((position) => ({
    position,
    pitch: pitchAt(position, settings.instrument),
    id:
      settings.mode === 'find'
        ? `find:${position.string}:${pitchAt(position, settings.instrument)}`
        : `name:${positionKey(position)}`,
  }))
  const pool = [...new Map(candidates.map((item) => [item.id, item])).values()]
  const selected = choose(pool, previous, random)
  const withOctave = settings.mode === 'name' && settings.octaves
  const correct = withOctave
    ? midiAt(selected.position, settings.instrument)
    : selected.pitch
  const pitches = withOctave
    ? [
        ...new Set(
          availablePositions({ ...settings, string: 'all' }).map((position) =>
            midiAt(position, settings.instrument),
          ),
        ),
      ]
    : settings.notes === 'natural'
      ? naturalPitches
      : allPitches
  const answers = [
    correct,
    ...shuffle(
      pitches.filter((pitch) => pitch !== correct),
      random,
    ).slice(0, 4),
  ]
  return {
    ...selected,
    mode: settings.mode,
    choices: shuffle(answers, random).map((pitch) => ({
      value: String(pitch),
      label: noteName(pitch, settings.spelling, withOctave),
    })),
  }
}

export function isCorrectAnswer(
  question: TrainerQuestion,
  answer: string,
  settings: TrainerSettings,
) {
  if (question.mode === 'harmony') return isHarmonyAnswer(question, answer)
  if (question.mode === 'intervals') return answer === question.answer
  if (question.mode === 'chords') return answer === question.shape.name
  if (question.mode === 'roles') return answer === question.role
  if (question.mode === 'roots')
    return question.roots.some((position) => positionKey(position) === answer)
  if (question.mode === 'name')
    return (
      answer ===
      String(
        settings.octaves
          ? midiAt(question.position, settings.instrument)
          : question.pitch,
      )
    )
  const parts = answer.split(':')
  if (parts.length !== 2 || !parts.every((part) => /^\d+$/.test(part)))
    return false
  const [string, fret] = parts.map(Number)
  return (
    string === question.position.string &&
    fret >= settings.minFret &&
    fret <= settings.maxFret &&
    pitchAt({ string, fret }, settings.instrument) === question.pitch
  )
}

export type TrainerState = {
  settings: TrainerSettings
  question: TrainerQuestion | null
  status: 'waiting' | 'correct' | 'revealed'
  wrongAnswers: string[]
  foundRoots: string[]
  completed: number
  firstTry: number
  streak: number
  hintsUsed: number
  harmonyReviews: { question: HarmonyQuestion; due: number }[]
}
export const initialTrainerState: TrainerState = {
  settings: defaultTrainerSettings,
  question: null,
  status: 'waiting',
  wrongAnswers: [],
  foundRoots: [],
  completed: 0,
  firstTry: 0,
  streak: 0,
  hintsUsed: 0,
  harmonyReviews: [],
}
export type TrainerAction =
  | { type: 'question'; question: TrainerQuestion; settings: TrainerSettings }
  | { type: 'answer'; answer: string }
  | { type: 'reveal' }
  | { type: 'hint' }
  | { type: 'settings'; settings: TrainerSettings }
  | { type: 'reset' }

export function nextPracticeQuestion(
  state: TrainerState,
  settings = state.settings,
  random = Math.random,
): TrainerQuestion {
  if (settings.mode !== 'harmony')
    return nextQuestion(settings, state.question?.id, random)
  const reviews = state.harmonyReviews.filter(({ question }) =>
    matchesHarmonySettings(question, settings),
  )
  const due = reviews.find(
    ({ question, due }) =>
      due <= state.completed && question.id !== state.question?.id,
  )
  return (
    due?.question ??
    nextHarmonyQuestion(
      settings,
      state.question?.id,
      random,
      reviews.map(({ question }) => harmonyConcept(question)),
    )
  )
}

function updateHarmonyReviews(state: TrainerState, recalled: boolean) {
  const question = state.question
  if (question?.mode !== 'harmony') return state.harmonyReviews
  const others = state.harmonyReviews.filter(
    (review) => review.question.id !== question.id,
  )
  // Return after two intervening answers; only unaided recall clears a review.
  return recalled ? others : [...others, { question, due: state.completed + 3 }]
}

export function trainerReducer(
  state: TrainerState,
  action: TrainerAction,
): TrainerState {
  if (action.type === 'reset')
    return { ...initialTrainerState, settings: state.settings }
  if (action.type === 'settings')
    return {
      ...state,
      settings: action.settings,
      question: null,
      status: 'waiting',
      wrongAnswers: [],
      foundRoots: [],
      hintsUsed: 0,
    }
  if (action.type === 'question')
    return {
      ...state,
      settings: action.settings,
      question: action.question,
      status: 'waiting',
      wrongAnswers: [],
      foundRoots: [],
      hintsUsed: 0,
    }
  if (!state.question || state.status !== 'waiting') return state
  if (action.type === 'hint')
    return state.question.mode === 'harmony' && state.hintsUsed < 2
      ? { ...state, hintsUsed: state.hintsUsed + 1, streak: 0 }
      : state
  if (action.type === 'reveal')
    return {
      ...state,
      status: 'revealed',
      completed: state.completed + 1,
      streak: 0,
      harmonyReviews: updateHarmonyReviews(state, false),
    }
  if (state.wrongAnswers.includes(action.answer)) return state
  if (state.foundRoots.includes(action.answer)) return state
  if (!isCorrectAnswer(state.question, action.answer, state.settings))
    return {
      ...state,
      wrongAnswers: [...state.wrongAnswers, action.answer],
      streak: 0,
    }
  const foundRoots =
    state.question.mode === 'roots' ? [...state.foundRoots, action.answer] : []
  if (
    state.question.mode === 'roots' &&
    foundRoots.length < state.question.roots.length
  )
    return { ...state, foundRoots }
  const firstTry = state.wrongAnswers.length === 0 && state.hintsUsed === 0
  return {
    ...state,
    status: 'correct',
    foundRoots,
    completed: state.completed + 1,
    firstTry: state.firstTry + Number(firstTry),
    streak: firstTry ? state.streak + 1 : 0,
    harmonyReviews: updateHarmonyReviews(state, firstTry),
  }
}

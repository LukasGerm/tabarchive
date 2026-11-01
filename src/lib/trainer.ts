import { chordShapes, type ChordShape } from './chord-shapes'
export { chordShapes, type ChordShape } from './chord-shapes'

// Strings run left-to-right in a chord diagram: low E (6) to high E (1).
export const guitarStrings = [
  { name: 'E', number: 6, midi: 40 },
  { name: 'A', number: 5, midi: 45 },
  { name: 'D', number: 4, midi: 50 },
  { name: 'G', number: 3, midi: 55 },
  { name: 'B', number: 2, midi: 59 },
  { name: 'E', number: 1, midi: 64 },
] as const

export const naturalPitches = [0, 2, 4, 5, 7, 9, 11]
export const allPitches = Array.from({ length: 12 }, (_, index) => index)
const sharps = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const flats = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
export type Spelling = 'sharps' | 'flats'
export const pitchName = (pitch: number, spelling: Spelling = 'sharps') =>
  (spelling === 'sharps' ? sharps : flats)[((pitch % 12) + 12) % 12]
export type Position = { string: number; fret: number }
export const positionKey = ({ string, fret }: Position) => `${string}:${fret}`
export const pitchAt = ({ string, fret }: Position) =>
  (guitarStrings[string].midi + fret) % 12
export const midiAt = ({ string, fret }: Position) =>
  guitarStrings[string].midi + fret
export const noteName = (
  midi: number,
  spelling: Spelling = 'sharps',
  octaves = true,
) => `${pitchName(midi, spelling)}${octaves ? Math.floor(midi / 12) - 1 : ''}`

export type TrainerMode = 'find' | 'name' | 'chords'
export type TrainerSettings = {
  mode: TrainerMode
  minFret: 0 | 5 | 12
  maxFret: 5 | 12 | 24
  string: 'all' | number
  notes: 'natural' | 'all'
  spelling: Spelling
  octaves: boolean
  chords: ChordShape['family'] | 'all'
}
export const defaultTrainerSettings: TrainerSettings = {
  mode: 'name',
  minFret: 0,
  maxFret: 12,
  string: 'all',
  notes: 'all',
  spelling: 'sharps',
  octaves: true,
  chords: 'all',
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
export type TrainerQuestion = NoteQuestion | ChordQuestion

export function availablePositions(settings: TrainerSettings): Position[] {
  const positions: Position[] = []
  for (let string = 0; string < 6; string++) {
    if (settings.string !== 'all' && settings.string !== string) continue
    for (let fret = settings.minFret; fret <= settings.maxFret; fret++) {
      const position = { string, fret }
      if (
        settings.notes === 'all' ||
        naturalPitches.includes(pitchAt(position))
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

function chordPitchKey(shape: ChordShape): string {
  return [
    ...new Set(
      shape.frets.flatMap((fret, string) =>
        fret === null ? [] : [pitchAt({ string, fret })],
      ),
    ),
  ]
    .sort((a, b) => a - b)
    .join(',')
}

const chordPitchKeys = new Map(
  chordShapes.map((shape) => [shape.id, chordPitchKey(shape)]),
)

export function nextQuestion(
  settings: TrainerSettings,
  previous?: string,
  random = Math.random,
): TrainerQuestion {
  if (settings.mode === 'chords') {
    const pool = chordShapes.filter(
      (shape) => settings.chords === 'all' || shape.family === settings.chords,
    )
    const shape = choose(pool, previous, random)
    // Different names can describe the same pitches (e.g. C6 and Am7,
    // or inversions of symmetrical dim7/aug chords). Don't offer those together.
    const equivalentNames = new Set(
      chordShapes
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
    pitch: pitchAt(position),
    id:
      settings.mode === 'find'
        ? `find:${position.string}:${pitchAt(position)}`
        : `name:${positionKey(position)}`,
  }))
  const pool = [...new Map(candidates.map((item) => [item.id, item])).values()]
  const selected = choose(pool, previous, random)
  const withOctave = settings.mode === 'name' && settings.octaves
  const correct = withOctave ? midiAt(selected.position) : selected.pitch
  const pitches = withOctave
    ? [
        ...new Set(
          availablePositions({ ...settings, string: 'all' }).map(midiAt),
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
  if (question.mode === 'chords') return answer === question.shape.name
  if (question.mode === 'name')
    return (
      answer ===
      String(settings.octaves ? midiAt(question.position) : question.pitch)
    )
  const parts = answer.split(':')
  if (parts.length !== 2 || !parts.every((part) => /^\d+$/.test(part)))
    return false
  const [string, fret] = parts.map(Number)
  return (
    string === question.position.string &&
    fret >= settings.minFret &&
    fret <= settings.maxFret &&
    pitchAt({ string, fret }) === question.pitch
  )
}

export type TrainerState = {
  settings: TrainerSettings
  question: TrainerQuestion | null
  status: 'waiting' | 'correct' | 'revealed'
  wrongAnswers: string[]
  completed: number
  firstTry: number
  streak: number
}
export const initialTrainerState: TrainerState = {
  settings: defaultTrainerSettings,
  question: null,
  status: 'waiting',
  wrongAnswers: [],
  completed: 0,
  firstTry: 0,
  streak: 0,
}
export type TrainerAction =
  | { type: 'question'; question: TrainerQuestion; settings: TrainerSettings }
  | { type: 'answer'; answer: string }
  | { type: 'reveal' }
  | { type: 'settings'; settings: TrainerSettings }
  | { type: 'reset' }

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
    }
  if (action.type === 'question')
    return {
      ...state,
      settings: action.settings,
      question: action.question,
      status: 'waiting',
      wrongAnswers: [],
    }
  if (!state.question || state.status !== 'waiting') return state
  if (action.type === 'reveal')
    return {
      ...state,
      status: 'revealed',
      completed: state.completed + 1,
      streak: 0,
    }
  if (state.wrongAnswers.includes(action.answer)) return state
  if (!isCorrectAnswer(state.question, action.answer, state.settings))
    return {
      ...state,
      wrongAnswers: [...state.wrongAnswers, action.answer],
      streak: 0,
    }
  const firstTry = state.wrongAnswers.length === 0
  return {
    ...state,
    status: 'correct',
    completed: state.completed + 1,
    firstTry: state.firstTry + Number(firstTry),
    streak: firstTry ? state.streak + 1 : 0,
  }
}

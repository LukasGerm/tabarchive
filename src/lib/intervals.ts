import type { HarmonySound } from './harmony'

export const intervals = [
  { semitones: 0, steps: 0, label: 'Perfect unison', short: 'P1' },
  { semitones: 1, steps: 1, label: 'Minor second', short: 'm2' },
  { semitones: 2, steps: 1, label: 'Major second', short: 'M2' },
  { semitones: 3, steps: 2, label: 'Minor third', short: 'm3' },
  { semitones: 4, steps: 2, label: 'Major third', short: 'M3' },
  { semitones: 5, steps: 3, label: 'Perfect fourth', short: 'P4' },
  { semitones: 6, steps: 3, label: 'Tritone', short: 'TT' },
  { semitones: 7, steps: 4, label: 'Perfect fifth', short: 'P5' },
  { semitones: 8, steps: 5, label: 'Minor sixth', short: 'm6' },
  { semitones: 9, steps: 5, label: 'Major sixth', short: 'M6' },
  { semitones: 10, steps: 6, label: 'Minor seventh', short: 'm7' },
  { semitones: 11, steps: 6, label: 'Major seventh', short: 'M7' },
  { semitones: 12, steps: 7, label: 'Perfect octave', short: 'P8' },
] as const
export type Interval = (typeof intervals)[number]
export const foundationIntervals = [3, 4, 5, 7, 12]
export type IntervalSettings = {
  intervalExercise: 'notes' | 'ear'
  intervalDirection: 'ascending' | 'descending' | 'harmonic'
  intervalVocabulary: 'foundation' | 'all'
}
export const defaultIntervalSettings: IntervalSettings = {
  intervalExercise: 'notes',
  intervalDirection: 'ascending',
  intervalVocabulary: 'foundation',
}
export type IntervalNote = { midi: number; name: string }
export type IntervalQuestion = {
  mode: 'intervals'
  id: string
  exercise: IntervalSettings['intervalExercise']
  direction: IntervalSettings['intervalDirection']
  interval: Interval
  notes: [IntervalNote, IntervalNote]
  answer: string
  choices: { value: string; label: string }[]
}

const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const naturalPitches = [0, 2, 4, 5, 7, 9, 11]

// Spell by letter distance as well as pitch: B–D♯ is a third, B–E♭ is not.
function notePair(
  root: number,
  interval: Interval,
): [IntervalNote, IntervalNote] {
  const rootLetter = root % 7
  const octave = 3 + Math.floor(root / 7)
  const low = (octave + 1) * 12 + naturalPitches[rootLetter]
  const highLetter = (rootLetter + interval.steps) % 7
  const highOctave = octave + Math.floor((rootLetter + interval.steps) / 7)
  const high = low + interval.semitones
  const accidental = high - ((highOctave + 1) * 12 + naturalPitches[highLetter])
  return [
    { midi: low, name: `${letters[rootLetter]}${octave}` },
    {
      midi: high,
      name: `${letters[highLetter]}${accidental > 0 ? '♯'.repeat(accidental) : '♭'.repeat(-accidental)}${highOctave}`,
    },
  ]
}

export function nextIntervalQuestion(
  settings: IntervalSettings,
  previous?: string,
  random = Math.random,
): IntervalQuestion {
  const vocabulary = intervals.filter(
    (interval) =>
      settings.intervalVocabulary === 'all' ||
      foundationIntervals.includes(interval.semitones),
  )
  const candidates = vocabulary.flatMap((interval) =>
    Array.from({ length: 14 }, (_, root) => ({
      interval,
      root,
      id: `intervals:${interval.semitones}:${root}:${settings.intervalDirection}`,
    })),
  )
  const pool = candidates.filter((item) => item.id !== previous)
  const selected = pool[Math.floor(random() * pool.length)]
  const pair = notePair(selected.root, selected.interval)
  return {
    mode: 'intervals',
    id: selected.id,
    exercise: settings.intervalExercise,
    direction: settings.intervalDirection,
    interval: selected.interval,
    notes:
      settings.intervalDirection === 'descending' ? [pair[1], pair[0]] : pair,
    answer: String(selected.interval.semitones),
    // Keep the full vocabulary visible, ordered by size, for deliberate comparison.
    choices: vocabulary.map((interval) => ({
      value: String(interval.semitones),
      label: interval.label,
    })),
  }
}

export function intervalSounds(question: IntervalQuestion): HarmonySound[] {
  if (question.direction === 'harmonic')
    return [
      { notes: question.notes.map((note) => note.midi), seconds: 1.6, step: 0 },
    ]
  return question.notes.map((note, step) => ({
    notes: [note.midi],
    seconds: step === 0 ? 0.8 : 1.2,
    step,
  }))
}

export function intervalExplanation(question: IntervalQuestion): string {
  const { semitones, label } = question.interval
  const [first, second] = question.notes
  const movement =
    semitones === 0
      ? 'the same pitch'
      : `${semitones} semitone${semitones === 1 ? '' : 's'} ${question.direction === 'harmonic' ? 'apart' : question.direction === 'descending' ? 'down' : 'up'}`
  return `${first.name} ${question.direction === 'harmonic' ? 'and' : '→'} ${second.name}: ${movement}. ${label} (${question.interval.short}) spans ${semitones} semitone${semitones === 1 ? '' : 's'} — ${semitones === 0 ? 'the same fret' : `${semitones} fret${semitones === 1 ? '' : 's'} apart`} on one guitar string.${semitones === 6 ? ' These notes spell an augmented fourth; a diminished fifth also spans six semitones.' : ''}`
}

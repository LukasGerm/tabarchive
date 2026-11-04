export const majorKeys = [
  { name: 'C', pitch: 0 },
  { name: 'G', pitch: 7 },
  { name: 'D', pitch: 2 },
  { name: 'A', pitch: 9 },
  { name: 'E', pitch: 4 },
  { name: 'B', pitch: 11 },
  { name: 'F♯', pitch: 6 },
  { name: 'D♭', pitch: 1 },
  { name: 'A♭', pitch: 8 },
  { name: 'E♭', pitch: 3 },
  { name: 'B♭', pitch: 10 },
  { name: 'F', pitch: 5 },
] as const
export type MajorKey = (typeof majorKeys)[number]
export type HarmonyExercise = 'key-chords' | 'functions' | 'progressions'
export type ChordSize = 'triads' | 'sevenths'
export type HarmonyRecall = 'name' | 'numeral' | 'notes'
export type HarmonySettings = {
  harmonyExercise: HarmonyExercise
  harmonyKey: MajorKey['name']
  harmonyChords: ChordSize
  harmonyRecall: HarmonyRecall | 'mixed'
}
export const defaultHarmonySettings: HarmonySettings = {
  harmonyExercise: 'key-chords',
  harmonyKey: 'C',
  harmonyChords: 'triads',
  harmonyRecall: 'mixed',
}

export const harmonyExercises: {
  value: HarmonyExercise
  label: string
  description: string
}[] = [
  {
    value: 'key-chords',
    label: 'Chords in a key',
    description:
      'Recall chord names, Roman numerals, and chord tones without a scale to copy.',
  },
  {
    value: 'functions',
    label: 'Chord functions',
    description:
      'Hear how tonic, predominant, and dominant chords work in a major key.',
  },
  {
    value: 'progressions',
    label: 'Complete a progression',
    description:
      'Hear a progression with a gap. Fill it using the given Roman-numeral pattern.',
  },
]

export type HarmonicFunction = 'tonic' | 'predominant' | 'dominant'
// Common major-key functions, rather than context-dependent iii/vi labels.
// https://musictheory.pugetsound.edu/mt21c/HarmonicFunctionInClassicalMusic.html
export const harmonicFunctions = {
  tonic: {
    label: 'Tonic',
    description: 'Establishes home and a sense of rest.',
  },
  predominant: {
    label: 'Predominant',
    description: 'Moves away from home and prepares the dominant.',
  },
  dominant: {
    label: 'Dominant',
    description: 'Creates tension that tends to resolve to the tonic.',
  },
} as const
export const functionDegrees: { degree: number; function: HarmonicFunction }[] =
  [
    { degree: 0, function: 'tonic' },
    { degree: 1, function: 'predominant' },
    { degree: 3, function: 'predominant' },
    { degree: 4, function: 'dominant' },
    { degree: 6, function: 'dominant' },
  ]

const scaleSteps = [0, 2, 4, 5, 7, 9, 11]
const triadRomans = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const seventhRomans = ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']
const triadSuffixes = ['', 'm', 'm', '', '', 'm', 'dim']
const seventhSuffixes = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7♭5']

export type ScaleNote = { name: string; pitch: number }
export type HarmonyChord = {
  name: string
  roman: string
  degree: number
  notes: string[]
  pitches: number[]
  root: number
  intervals: number[]
}

export function majorScale(key: MajorKey): ScaleNote[] {
  const letters = 'CDEFGAB'
  const naturals = [0, 2, 4, 5, 7, 9, 11]
  return scaleSteps.map((step, index) => {
    const pitch = (key.pitch + step) % 12
    const letter = (letters.indexOf(key.name[0]) + index) % 7
    const accidental = ((pitch - naturals[letter] + 18) % 12) - 6
    return {
      pitch,
      name:
        letters[letter] +
        (accidental < 0 ? '♭' : '♯').repeat(Math.abs(accidental)),
    }
  })
}

export function chordsInKey(key: MajorKey, size: ChordSize): HarmonyChord[] {
  const scale = majorScale(key)
  return scale.map((root, degree) => {
    const tones = (size === 'triads' ? [0, 2, 4] : [0, 2, 4, 6]).map(
      (offset) => scale[(degree + offset) % 7],
    )
    return {
      degree,
      root: root.pitch,
      name:
        root.name +
        (size === 'triads' ? triadSuffixes : seventhSuffixes)[degree],
      roman: (size === 'triads' ? triadRomans : seventhRomans)[degree],
      notes: tones.map((tone) => tone.name),
      pitches: tones.map((tone) => tone.pitch),
      intervals: tones.map((tone) => (tone.pitch - root.pitch + 12) % 12),
    }
  })
}

export const progressionPatterns = [
  {
    id: 'ii-v-i',
    name: 'ii–V–I cadence',
    degrees: [1, 4, 0],
    detail: 'The ii chord prepares V; V then resolves to I.',
  },
  {
    id: 'i-iv-v-i',
    name: 'I–IV–V–I cadence',
    degrees: [0, 3, 4, 0],
    detail:
      'Start at home, move to the predominant, then use V to return to I.',
  },
  {
    id: 'i-vi-ii-v',
    name: 'I–vi–ii–V turnaround',
    degrees: [0, 5, 1, 4],
    detail: 'This turnaround ends on V, ready to loop back to I.',
  },
  {
    id: 'i-v-vi-iv',
    name: 'I–V–vi–IV loop',
    degrees: [0, 4, 5, 3],
    detail:
      'A common pop loop. After V, vi gives a different color from an immediate return to I.',
  },
  {
    id: 'iv-i',
    name: 'IV–I plagal cadence',
    degrees: [3, 0],
    detail:
      'IV moves directly to I. Compare this arrival with the stronger dominant pull of V–I.',
  },
  {
    id: 'v-vi',
    name: 'V–vi deceptive cadence',
    degrees: [4, 5],
    detail: 'V moves to vi instead of the expected I: a deceptive arrival.',
  },
] as const

type HarmonyQuestionBase = {
  mode: 'harmony'
  id: string
  key: MajorKey
  size: ChordSize
  target: HarmonyChord
  answer: string
  choices: { value: string; label: string }[]
}
export type HarmonyQuestion = HarmonyQuestionBase &
  (
    | { exercise: 'key-chords'; recall: HarmonyRecall }
    | { exercise: 'functions'; function: HarmonicFunction }
    | {
        exercise: 'progressions'
        pattern: (typeof progressionPatterns)[number]
        progression: HarmonyChord[]
        missing: number
      }
  )

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

export function nextHarmonyQuestion(
  settings: HarmonySettings,
  previous?: string,
  random = Math.random,
  excludedConcepts: string[] = [],
): HarmonyQuestion {
  const key = majorKeys.find((key) => key.name === settings.harmonyKey)!
  const size = settings.harmonyChords
  const chords = chordsInKey(key, size)
  const base = { mode: 'harmony' as const, key, size, choices: [] }
  const prefix = `harmony:${settings.harmonyExercise}:${key.name}:${size}`
  let candidates: HarmonyQuestion[]
  if (settings.harmonyExercise === 'functions') {
    candidates = functionDegrees.map((item) => ({
      ...base,
      exercise: 'functions',
      id: `${prefix}:${item.degree}`,
      target: chords[item.degree],
      answer: item.function,
      function: item.function,
    }))
  } else if (settings.harmonyExercise === 'progressions') {
    candidates = progressionPatterns.flatMap((pattern) =>
      pattern.degrees.slice(1).map((degree, index) => ({
        ...base,
        exercise: 'progressions',
        id: `${prefix}:${pattern.id}:${index + 1}`,
        pattern,
        progression: pattern.degrees.map((degree) => chords[degree]),
        missing: index + 1,
        target: chords[degree],
        answer: chords[degree].name,
      })),
    )
  } else {
    const recalls: HarmonyRecall[] =
      settings.harmonyRecall === 'mixed'
        ? ['name', 'numeral', 'notes']
        : [settings.harmonyRecall]
    candidates = chords.flatMap((target) =>
      recalls.map((recall) => ({
        ...base,
        exercise: 'key-chords' as const,
        recall,
        id: `${prefix}:${target.degree}:${recall}`,
        target,
        answer:
          recall === 'numeral'
            ? target.roman
            : recall === 'notes'
              ? target.notes.join(' ')
              : target.name,
      })),
    )
  }
  const different = candidates.filter((question) => question.id !== previous)
  const fresh = different.filter(
    (question) => !excludedConcepts.includes(harmonyConcept(question)),
  )
  const pool = fresh.length ? fresh : different
  const question = pool[Math.floor(random() * pool.length)]
  const choices =
    question.exercise === 'functions'
      ? Object.entries(harmonicFunctions).map(([value, item]) => ({
          value,
          label: item.label,
        }))
      : []
  return { ...question, choices: shuffle(choices, random) }
}

export function harmonyPrompt(question: HarmonyQuestion): string {
  if (question.exercise === 'key-chords') {
    if (question.recall === 'numeral')
      return `Which Roman numeral is ${question.target.name} in ${question.key.name} major?`
    if (question.recall === 'notes')
      return `What notes make ${question.target.name} in ${question.key.name} major?`
    return `Which chord is ${question.target.roman} in ${question.key.name} major?`
  }
  if (question.exercise === 'functions')
    return `What is ${question.target.name}’s function in ${question.key.name} major?`
  return `Complete the ${question.progression.map((chord) => chord.roman).join('–')} pattern.`
}

export function harmonyExplanation(question: HarmonyQuestion): string {
  const chord = question.target
  const stack = `${chord.name} is ${chord.roman} in ${question.key.name} major. Starting on scale degree ${chord.degree + 1} and taking every other scale note gives ${chord.notes.join(' · ')}.`
  if (question.exercise === 'functions')
    return `${chord.name} (${chord.roman}) has ${question.function} function here. ${harmonicFunctions[question.function].description} Its notes are ${chord.notes.join(' · ')}.`
  if (question.exercise === 'progressions')
    return `${stack} ${question.pattern.detail}`
  const third =
    chord.intervals[1] === 3
      ? 'minor third (3 semitones)'
      : 'major third (4 semitones)'
  const fifth =
    chord.intervals[2] === 6
      ? 'diminished fifth (6 semitones)'
      : 'perfect fifth (7 semitones)'
  const seventh =
    question.size === 'sevenths'
      ? `, and ${chord.notes[3]} is a ${chord.intervals[3] === 10 ? 'minor seventh (10 semitones)' : 'major seventh (11 semitones)'}`
      : ''
  return `${stack} Measured from ${chord.notes[0]}, ${chord.notes[1]} is a ${third}, ${chord.notes[2]} is a ${fifth}${seventh}. ${chord.degree === 3 || chord.degree === 5 ? 'IV means four and vi means six. Lowercase iv would be a minor chord on degree four, borrowed from outside this major scale.' : 'The numeral gives the root’s scale degree; its case and symbols describe the chord quality.'}`
}

export function harmonyConcept(question: HarmonyQuestion): string {
  return question.exercise === 'key-chords'
    ? `${question.key.name}:${question.size}:${question.target.degree}`
    : question.id
}

export function matchesHarmonySettings(
  question: HarmonyQuestion,
  settings: HarmonySettings,
): boolean {
  return (
    question.key.name === settings.harmonyKey &&
    question.size === settings.harmonyChords &&
    question.exercise === settings.harmonyExercise &&
    (question.exercise !== 'key-chords' ||
      settings.harmonyRecall === 'mixed' ||
      question.recall === settings.harmonyRecall)
  )
}

function normalizeAccidentals(value: string): string {
  return value.trim().replaceAll('♯', '#').replaceAll('♭', 'b')
}

function normalizeNote(value: string): string | null {
  const match = normalizeAccidentals(value).match(/^([a-g])([#b]{0,2})$/i)
  return match ? match[1].toUpperCase() + match[2].toLowerCase() : null
}

function normalizeChord(value: string): string | null {
  const match = normalizeAccidentals(value)
    .replace(/\s+/g, '')
    .match(/^([a-g])([#b]{0,2})(.*)$/i)
  if (!match) return null
  const aliases: Record<string, string> = {
    '': '',
    maj: '',
    major: '',
    M: '',
    m: 'm',
    min: 'm',
    minor: 'm',
    '7': '7',
    dom7: '7',
    dominant7: '7',
    maj7: 'maj7',
    major7: 'maj7',
    M7: 'maj7',
    Δ7: 'maj7',
    m7: 'm7',
    min7: 'm7',
    minor7: 'm7',
    dim: 'dim',
    diminished: 'dim',
    '°': 'dim',
    o: 'dim',
    m7b5: 'm7b5',
    ø: 'm7b5',
    ø7: 'm7b5',
  }
  const quality = aliases[match[3]]
  return quality === undefined
    ? null
    : match[1].toUpperCase() + match[2].toLowerCase() + quality
}

export function isHarmonyAnswer(
  question: HarmonyQuestion,
  answer: string,
): boolean {
  if (question.exercise === 'functions') return answer === question.answer
  if (question.exercise === 'key-chords' && question.recall === 'numeral') {
    const normalize = (value: string) =>
      value
        .trim()
        .replace(/\s+/g, '')
        .replaceAll('/o', 'ø')
        .replaceAll('o', '°')
        .replaceAll('º', '°')
        .replaceAll('Ø', 'ø')
        .replace(/(?:M|Δ)7$/, 'maj7')
    // Case carries chord quality: IV and iv are not interchangeable.
    return normalize(answer) === normalize(question.answer)
  }
  if (question.exercise === 'key-chords' && question.recall === 'notes') {
    const notes = answer
      .trim()
      .split(/[\s,;·–—/\-]+/)
      .map(normalizeNote)
    const expected = question.target.notes.map(normalizeNote)
    return (
      notes.length === expected.length &&
      new Set(notes).size === expected.length &&
      notes.every((note) => note !== null && expected.includes(note))
    )
  }
  const normalized = normalizeChord(answer)
  return normalized !== null && normalized === normalizeChord(question.answer)
}

export function harmonyHint(question: HarmonyQuestion): string {
  if (question.exercise === 'functions')
    return 'Tonic feels like home; predominant prepares a departure; dominant pulls back toward home. Compare the chord’s root with the tonic.'
  if (question.exercise === 'key-chords' && question.recall === 'notes') {
    const intervals = question.target.intervals.slice(1).join(', ')
    return `Start with the root. The other tones are ${intervals} semitones above it. Spell successive chord tones with every other letter name.`
  }
  if (question.exercise === 'key-chords' && question.recall === 'numeral')
    return 'Find the chord root’s position relative to the tonic. I, IV, and V are major; ii, iii, and vi are minor; vii° is diminished. IV is four; vi is six.'
  const distances = [
    'the tonic itself',
    'a whole step above',
    'a major third above',
    'a perfect fourth above',
    'a perfect fifth above',
    'a minor third below',
    'a half step below',
  ]
  return `The root is ${distances[question.target.degree]}${question.target.degree === 0 ? '' : ' the tonic'}. Read the numeral’s case and symbols for the quality. IV is four; vi is six.`
}

// Choose compact upper voices with minimal movement. Bass roots are separate.
export function voiceChords(chords: HarmonyChord[]): number[][] {
  let previous: number[] | undefined
  return chords.map((chord) => {
    const rootPosition = chord.intervals.map(
      (interval) => 48 + chord.root + interval,
    )
    const candidates: number[][] = []
    for (let inversion = 0; inversion < rootPosition.length; inversion++) {
      const rotated = [
        ...rootPosition.slice(inversion),
        ...rootPosition.slice(0, inversion).map((note) => note + 12),
      ]
      for (const octave of [-12, 0, 12]) {
        const notes = rotated.map((note) => note + octave)
        if (notes[0] >= 48 && notes.at(-1)! <= 84) candidates.push(notes)
      }
    }
    const reference =
      previous ?? (chord.pitches.length === 3 ? [60, 64, 67] : [60, 64, 67, 71])
    const distance = (notes: number[]) =>
      notes.reduce(
        (sum, note, index) => sum + Math.abs(note - reference[index]),
        0,
      )
    candidates.sort((a, b) => distance(a) - distance(b))
    previous = candidates[0]
    return previous
  })
}

export type HarmonySound = { notes: number[]; seconds: number; step: number }
export function harmonySounds(
  question: HarmonyQuestion,
  resolved: boolean,
): HarmonySound[] {
  if (question.exercise === 'key-chords' && !resolved) {
    const notes = [...scaleSteps, 12].map(
      (step) => 60 + question.key.pitch + step,
    )
    return notes.map((note, step) => ({ notes: [note], seconds: 0.38, step }))
  }
  const tonic = chordsInKey(question.key, question.size)[0]
  const chords =
    question.exercise === 'progressions'
      ? question.progression
      : question.exercise === 'functions'
        ? [tonic, question.target]
        : [question.target]
  const voices = voiceChords(chords)
  return chords.map((chord, index) => ({
    // Leave a real beat of silence; never sound the hidden answer beforehand.
    notes:
      question.exercise === 'progressions' &&
      !resolved &&
      question.missing === index
        ? []
        : [36 + chord.root, ...voices[index]],
    seconds: 1.15,
    step: index,
  }))
}

export function progressionVoiceLeading(question: HarmonyQuestion) {
  if (question.exercise !== 'progressions') return null
  const from =
    question.missing === question.progression.length - 1
      ? question.missing - 1
      : question.missing
  const to = from + 1
  const voices = voiceChords(question.progression)
  const noteName = (chord: HarmonyChord, midi: number) =>
    chord.notes[chord.pitches.indexOf(midi % 12)]
  return {
    from: question.progression[from].name,
    to: question.progression[to].name,
    movements: voices[from].map((midi, voice) => ({
      from: noteName(question.progression[from], midi),
      to: noteName(question.progression[to], voices[to][voice]),
      semitones: voices[to][voice] - midi,
    })),
  }
}

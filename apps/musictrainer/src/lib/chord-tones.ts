import { chordShapes, type ChordShape } from './chord-shapes'

// Steps count letter names from the root; semitones determine the accidental.
// Keep enharmonic roles distinct: a sixth and a diminished seventh both sound
// nine semitones above the root, but have different functions and spellings.
export const chordRoles = {
  '1': { label: 'Root', steps: 0, semitones: 0 },
  '2': { label: 'Major second', steps: 1, semitones: 2 },
  '♭3': { label: 'Minor third', steps: 2, semitones: 3 },
  '3': { label: 'Major third', steps: 2, semitones: 4 },
  '4': { label: 'Perfect fourth', steps: 3, semitones: 5 },
  '♭5': { label: 'Diminished fifth', steps: 4, semitones: 6 },
  '5': { label: 'Perfect fifth', steps: 4, semitones: 7 },
  '♯5': { label: 'Augmented fifth', steps: 4, semitones: 8 },
  '6': { label: 'Major sixth', steps: 5, semitones: 9 },
  '♭♭7': { label: 'Diminished seventh', steps: 6, semitones: 9 },
  '♭7': { label: 'Minor seventh', steps: 6, semitones: 10 },
  '7': { label: 'Major seventh', steps: 6, semitones: 11 },
  '9': { label: 'Major ninth', steps: 8, semitones: 14 },
  '11': { label: 'Perfect eleventh', steps: 10, semitones: 17 },
} as const
export type ChordRole = keyof typeof chordRoles

export const chordFormulas: Record<
  ChordShape['quality'],
  readonly ChordRole[]
> = {
  major: ['1', '3', '5'],
  minor: ['1', '♭3', '5'],
  '7': ['1', '3', '5', '♭7'],
  maj7: ['1', '3', '5', '7'],
  m7: ['1', '♭3', '5', '♭7'],
  sus2: ['1', '2', '5'],
  sus4: ['1', '4', '5'],
  add9: ['1', '3', '5', '9'],
  madd9: ['1', '♭3', '5', '9'],
  add11: ['1', '3', '5', '11'],
  madd11: ['1', '♭3', '5', '11'],
  dim: ['1', '♭3', '♭5'],
  dim7: ['1', '♭3', '♭5', '♭♭7'],
  aug: ['1', '3', '♯5'],
  '6': ['1', '3', '5', '6'],
  m6: ['1', '♭3', '5', '6'],
  m7b5: ['1', '♭3', '♭5', '♭7'],
  '9': ['1', '3', '5', '♭7', '9'],
}

export function roleAtPitch(shape: ChordShape, pitch: number): ChordRole {
  const interval = (pitch - shape.root + 12) % 12
  const role = chordFormulas[shape.quality].find(
    (id) => chordRoles[id].semitones % 12 === interval,
  )
  if (!role) throw new Error(`Pitch ${pitch} is not a tone of ${shape.name}.`)
  return role
}

export function chordToneName(shape: ChordShape, role: ChordRole): string {
  const letters = 'CDEFGAB'
  const naturals = [0, 2, 4, 5, 7, 9, 11]
  const letter = (letters.indexOf(shape.name[0]) + chordRoles[role].steps) % 7
  const pitch = (shape.root + chordRoles[role].semitones) % 12
  const difference = ((pitch - naturals[letter] + 18) % 12) - 6
  return (
    letters[letter] + (difference < 0 ? '♭' : '♯').repeat(Math.abs(difference))
  )
}

export function explainChordRole(shape: ChordShape, role: ChordRole): string {
  const root = chordToneName(shape, '1')
  const note = chordToneName(shape, role)
  const { label, semitones } = chordRoles[role]
  if (role === '1')
    return `${root} is the root: the note that names this chord. Every ${root} in the shape is a root, even in another octave.`
  const distance =
    semitones < 12
      ? `${semitones} semitones above ${root} within an octave.`
      : `${semitones} semitones above ${root}, or ${semitones % 12} after removing an octave. The chord names it ${role} regardless of where it is voiced.`
  const seventh = ['♭7', '7', '♭♭7'].includes(role)
    ? ' A seventh is an interval name, not seven frets: ♭7 = 10 semitones, 7 = 11, and ♭♭7 = 9.'
    : ''
  return `${note} is the ${label.toLowerCase()} (${role}) of ${shape.name}: ${distance}${seventh}`
}

// These inversions are for chord-tone study; shape recognition keeps its catalog.
export const chordToneShapes: ChordShape[] = [
  ...chordShapes,
  {
    id: 'c-over-e',
    name: 'C/E',
    root: 0,
    quality: 'major',
    family: 'open',
    frets: [0, 3, 2, 0, 1, 0],
    tones: 'C · E · G',
  },
  {
    id: 'g-over-b',
    name: 'G/B',
    root: 7,
    quality: 'major',
    family: 'open',
    frets: [null, 2, 0, 0, 3, 3],
    tones: 'G · B · D',
  },
  {
    id: 'am-over-c',
    name: 'Am/C',
    root: 9,
    quality: 'minor',
    family: 'movable',
    frets: [null, 3, 2, 2, 1, null],
    tones: 'A · C · E',
  },
  {
    id: 'f-over-a',
    name: 'F/A',
    root: 5,
    quality: 'major',
    family: 'movable',
    frets: [null, null, 7, 5, 6, 5],
    tones: 'F · A · C',
    barre: { fret: 5, from: 3, to: 5 },
  },
]

export const foundationQualities: ChordShape['quality'][] = [
  'major',
  'minor',
  '7',
  'maj7',
  'm7',
]

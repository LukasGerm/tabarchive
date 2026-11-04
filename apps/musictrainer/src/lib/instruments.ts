export type Instrument = 'guitar' | 'bass'

// Diagram order: lowest string on the left. MIDI values are sounding pitches.
export const guitarStrings = [
  { name: 'E', number: 6, midi: 40 },
  { name: 'A', number: 5, midi: 45 },
  { name: 'D', number: 4, midi: 50 },
  { name: 'G', number: 3, midi: 55 },
  { name: 'B', number: 2, midi: 59 },
  { name: 'E', number: 1, midi: 64 },
] as const

export const bassStrings = [
  { name: 'E', number: 4, midi: 28 },
  { name: 'A', number: 3, midi: 33 },
  { name: 'D', number: 2, midi: 38 },
  { name: 'G', number: 1, midi: 43 },
] as const

export const instruments = {
  guitar: {
    label: 'Guitar',
    strings: guitarStrings,
    tuning: 'E A D G B E',
    highestString: 'High E',
    allStrings: 'All six strings',
  },
  bass: {
    label: 'Bass',
    strings: bassStrings,
    tuning: 'E A D G',
    highestString: 'G',
    allStrings: 'All four strings',
  },
} as const

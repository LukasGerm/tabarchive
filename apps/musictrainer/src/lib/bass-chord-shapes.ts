import type { ChordShape } from './chord-shapes'
import { chordFormulas, chordToneName } from './chord-tones'

// Four-string E–A–D–G patterns, relative to a root on the E string.
// Use these as voicings or play the notes separately as arpeggios.
const patterns: {
  quality: ChordShape['quality']
  suffix: string
  frets: readonly (number | null)[]
}[] = [
  { quality: 'major', suffix: ' major', frets: [0, 2, 2, 1] },
  { quality: 'minor', suffix: 'm', frets: [0, 2, 2, 0] },
  { quality: '7', suffix: '7', frets: [0, 2, 0, 1] },
  { quality: 'maj7', suffix: 'maj7', frets: [0, 2, 1, 1] },
  { quality: 'm7', suffix: 'm7', frets: [0, 2, 0, 0] },
  { quality: 'sus2', suffix: 'sus2', frets: [0, 2, 4, null] },
  { quality: 'sus4', suffix: 'sus4', frets: [0, 2, 2, 2] },
  { quality: 'dim', suffix: 'dim', frets: [0, 1, 2, 0] },
  { quality: 'dim7', suffix: 'dim7', frets: [0, 1, -1, 0] },
  { quality: 'm7b5', suffix: 'm7♭5', frets: [0, 1, 0, 0] },
  { quality: 'aug', suffix: 'aug', frets: [0, 3, 2, 1] },
  { quality: '6', suffix: '6', frets: [0, 2, -1, 1] },
  { quality: 'm6', suffix: 'm6', frets: [0, 2, -1, 0] },
  { quality: 'add9', suffix: 'add9', frets: [0, 2, 4, 1] },
  { quality: 'madd9', suffix: 'm(add9)', frets: [0, 2, 4, 0] },
]
const rootNames = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

export const bassChordShapes: ChordShape[] = patterns.flatMap((pattern) =>
  Array.from({ length: 13 }, (_, rootFret) => rootFret).flatMap((rootFret) => {
    const frets = pattern.frets.map((fret) =>
      fret === null ? null : fret + rootFret,
    )
    if (frets.some((fret) => fret !== null && fret < 0)) return []
    const root = (4 + rootFret) % 12
    const shape: ChordShape = {
      id: `bass-${pattern.quality}-${rootFret}`,
      name: `${rootNames[root]}${pattern.suffix}`,
      root,
      quality: pattern.quality,
      family: frets.includes(0) ? 'open' : 'movable',
      frets,
      tones: '',
    }
    shape.tones = chordFormulas[shape.quality]
      .map((role) => chordToneName(shape, role))
      .join(' · ')
    return [shape]
  }),
)

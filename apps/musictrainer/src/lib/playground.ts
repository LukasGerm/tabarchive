import { z } from 'zod'
import {
  majorKeys,
  majorScale,
  voiceChords,
  type HarmonyChord,
  type HarmonySound,
  type ChordSize,
} from './harmony'

export type KeyMode = 'major' | 'minor'
export type PlaybackStyle = 'chords' | 'arpeggio' | 'roots'
export const playgroundStorageKey = 'musictrainer:playground:v1'
export const progressionSchema = z.object({
  tonic: z.number().int().min(0).max(11),
  mode: z.enum(['major', 'minor']),
  steps: z
    .array(
      z.object({
        degree: z.number().int().min(0).max(6),
        size: z.enum(['triads', 'sevenths']),
        beats: z.number().int().min(1).max(8),
      }),
    )
    .max(16),
})
export type Progression = z.infer<typeof progressionSchema>
export type ProgressionStep = Progression['steps'][number]
export const playgroundSchema = z.object({
  draft: progressionSchema,
  tempo: z.number().int().min(40).max(200),
  style: z.enum(['chords', 'arpeggio', 'roots']),
  loop: z.boolean(),
  saved: z
    .array(
      z.object({
        id: z.string().max(80),
        name: z.string().min(1).max(60),
        progression: progressionSchema,
      }),
    )
    .max(20),
})
export type PlaygroundData = z.infer<typeof playgroundSchema>
export const defaultPlayground: PlaygroundData = {
  draft: {
    tonic: 0,
    mode: 'major',
    steps: [0, 5, 3, 4].map((degree) => ({ degree, size: 'triads', beats: 4 })),
  },
  tempo: 100,
  style: 'chords',
  loop: true,
  saved: [],
}

export function playgroundScale(tonic: number, mode: KeyMode) {
  const relativeMajor = mode === 'major' ? tonic : (tonic + 3) % 12
  const scale = majorScale(
    majorKeys.find((key) => key.pitch === relativeMajor)!,
  )
  return mode === 'major' ? scale : [...scale.slice(5), ...scale.slice(0, 5)]
}
export function playgroundKeyName(
  progression: Pick<Progression, 'tonic' | 'mode'>,
) {
  return `${playgroundScale(progression.tonic, progression.mode)[0].name} ${progression.mode === 'major' ? 'major' : 'natural minor'}`
}

export function playgroundChords(
  tonic: number,
  mode: KeyMode,
  size: ChordSize,
): HarmonyChord[] {
  const scale = playgroundScale(tonic, mode)
  const minor = mode === 'minor'
  const seventh = size === 'sevenths'
  const romans = minor
    ? ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']
    : ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
  return scale.map((root, degree) => {
    const tones = (seventh ? [0, 2, 4, 6] : [0, 2, 4]).map(
      (offset) => scale[(degree + offset) % 7],
    )
    const intervals = tones.map((tone) => (tone.pitch - root.pitch + 12) % 12)
    const diminished = intervals[2] === 6
    const isMinor = intervals[1] === 3
    const suffix = seventh
      ? diminished
        ? 'm7♭5'
        : isMinor
          ? 'm7'
          : intervals[3] === 11
            ? 'maj7'
            : '7'
      : diminished
        ? 'dim'
        : isMinor
          ? 'm'
          : ''
    const roman = seventh
      ? diminished
        ? romans[degree].replace('°', 'ø7')
        : `${romans[degree]}${intervals[3] === 11 ? 'maj7' : '7'}`
      : romans[degree]
    return {
      degree,
      root: root.pitch,
      name: root.name + suffix,
      roman,
      notes: tones.map((tone) => tone.name),
      pitches: tones.map((tone) => tone.pitch),
      intervals,
    }
  })
}

export function progressionChords(progression: Progression) {
  return progression.steps.map(
    (step) =>
      playgroundChords(progression.tonic, progression.mode, step.size)[
        step.degree
      ],
  )
}

export const playgroundPresets = [
  { name: 'Pop loop', major: [0, 4, 5, 3], minor: [0, 5, 2, 6] },
  { name: 'Coming home', major: [0, 3, 4, 0], minor: [0, 3, 4, 0] },
  { name: 'Turnaround', major: [0, 5, 1, 4], minor: [0, 5, 3, 4] },
] as const

export function progressionSounds(
  progression: Progression,
  tempo: number,
  style: PlaybackStyle,
): HarmonySound[] {
  const chords = progressionChords(progression)
  const voices = voiceChords(chords)
  return chords.flatMap((chord, step) => {
    const seconds = (progression.steps[step].beats * 60) / tempo
    if (style === 'arpeggio') {
      // Root order makes the chord formula audible, independently of inversions.
      return chord.intervals.map((interval) => ({
        notes: [48 + chord.root + interval],
        seconds: seconds / chord.intervals.length,
        step,
      }))
    }
    return [
      {
        notes:
          style === 'roots'
            ? [36 + chord.root]
            : [36 + chord.root, ...voices[step]],
        seconds,
        step,
      },
    ]
  })
}
export const toneRole = (interval: number) =>
  ({
    0: 'Root',
    3: 'Minor third',
    4: 'Major third',
    6: 'Diminished fifth',
    7: 'Perfect fifth',
    10: 'Minor seventh',
    11: 'Major seventh',
  })[interval]

export function changedTones(before: HarmonyChord, after: HarmonyChord) {
  return {
    kept: after.notes.filter((_, index) =>
      before.pitches.includes(after.pitches[index]),
    ),
    added: after.notes.filter(
      (_, index) => !before.pitches.includes(after.pitches[index]),
    ),
    removed: before.notes.filter(
      (_, index) => !after.pitches.includes(before.pitches[index]),
    ),
  }
}

import { describe, expect, it } from 'vitest'
import { chordsInKey, majorKeys, voiceChords } from '../src/lib/harmony'
import {
  changedTones,
  defaultPlayground,
  playgroundChords,
  playgroundKeyName,
  playgroundScale,
  playgroundSchema,
  progressionChords,
  progressionSounds,
  type Progression,
} from '../src/lib/playground'

describe('progression harmony', () => {
  it('agrees with the existing major-key model in every key and chord size', () => {
    for (const key of majorKeys)
      for (const size of ['triads', 'sevenths'] as const) {
        expect(playgroundChords(key.pitch, 'major', size)).toEqual(
          chordsInKey(key, size),
        )
      }
  })
  it('builds natural minor chords with key-aware spelling, including sharp leading letters', () => {
    expect(
      playgroundChords(9, 'minor', 'triads').map((chord) => chord.name),
    ).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'])
    expect(
      playgroundChords(9, 'minor', 'sevenths').map((chord) => chord.name),
    ).toEqual(['Am7', 'Bm7♭5', 'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7'])
    expect(playgroundScale(3, 'minor').map((note) => note.name)).toEqual([
      'D♯',
      'E♯',
      'F♯',
      'G♯',
      'A♯',
      'B',
      'C♯',
    ])
    expect(playgroundKeyName({ tonic: 3, mode: 'minor' })).toBe(
      'D♯ natural minor',
    )
    for (let tonic = 0; tonic < 12; tonic++) {
      const scale = playgroundScale(tonic, 'minor')
      expect(new Set(scale.map((note) => note.name[0])).size).toBe(7)
      expect(scale.map((note) => (note.pitch - tonic + 12) % 12)).toEqual([
        0, 2, 3, 5, 7, 8, 10,
      ])
      expect(
        playgroundChords(tonic, 'minor', 'triads').map(
          (chord) => chord.intervals,
        ),
      ).toEqual([
        [0, 3, 7],
        [0, 3, 6],
        [0, 4, 7],
        [0, 3, 7],
        [0, 3, 7],
        [0, 4, 7],
        [0, 4, 7],
      ])
    }
  })
  it('transposes degrees while preserving per-chord extensions and duration', () => {
    const draft = structuredClone(defaultPlayground.draft)
    draft.steps[1] = { degree: 5, size: 'sevenths', beats: 2 }
    expect(
      progressionChords({ ...draft, tonic: 7 }).map((chord) => chord.name),
    ).toEqual(['G', 'Em7', 'C', 'D'])
    expect(draft.tonic).toBe(0)
    expect(draft.steps[1].beats).toBe(2)
  })
  it('shows the added seventh and preserves common tones in a variation', () => {
    const triad = playgroundChords(0, 'major', 'triads')[0]
    const seventh = playgroundChords(0, 'major', 'sevenths')[0]
    expect(changedTones(triad, seventh)).toEqual({
      kept: ['C', 'E', 'G'],
      added: ['B'],
      removed: [],
    })
  })
  it('keeps common voices in place when moving from three to four voices', () => {
    const chords = [
      playgroundChords(0, 'major', 'triads')[0],
      playgroundChords(0, 'major', 'sevenths')[3],
    ]
    expect(voiceChords(chords)).toEqual([
      [60, 64, 67],
      [60, 64, 65, 69],
    ])
  })
})

it('honors beats and tempo in every playback style with only chord tones sounding', () => {
  const progression: Progression = {
    tonic: 9,
    mode: 'minor',
    steps: [
      { degree: 0, size: 'triads', beats: 4 },
      { degree: 4, size: 'sevenths', beats: 2 },
    ],
  }
  const chords = progressionChords(progression)
  for (const style of ['chords', 'roots', 'arpeggio'] as const) {
    const sounds = progressionSounds(progression, 120, style)
    expect(sounds.reduce((sum, sound) => sum + sound.seconds, 0)).toBeCloseTo(3)
    for (const sound of sounds) {
      expect(sound.seconds).toBeGreaterThan(0)
      expect(
        sound.notes.every(
          (note) =>
            Number.isFinite(note) &&
            chords[sound.step].pitches.includes(note % 12),
        ),
      ).toBe(true)
      if (style === 'roots')
        expect(sound.notes).toEqual([36 + chords[sound.step].root])
    }
  }
  expect(
    progressionSounds({ ...progression, steps: [] }, 120, 'chords'),
  ).toEqual([])
})

it('rejects invalid stored degrees, oversized drafts, and unsafe playback settings', () => {
  expect(playgroundSchema.safeParse(defaultPlayground).success).toBe(true)
  for (const invalid of [
    { ...defaultPlayground, tempo: 0 },
    { ...defaultPlayground, style: 'unknown' },
    {
      ...defaultPlayground,
      draft: {
        ...defaultPlayground.draft,
        steps: [{ degree: 7, size: 'triads', beats: 4 }],
      },
    },
    {
      ...defaultPlayground,
      draft: {
        ...defaultPlayground.draft,
        steps: Array(17).fill(defaultPlayground.draft.steps[0]),
      },
    },
  ])
    expect(playgroundSchema.safeParse(invalid).success).toBe(false)
})

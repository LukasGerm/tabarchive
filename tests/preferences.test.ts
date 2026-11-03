import { describe, expect, it } from 'vitest'
import { readerPreferencesSchema } from '../src/lib/reader-preferences'
import { trainerPreferencesSchema } from '../src/lib/trainer-preferences'

describe('stored preference validation', () => {
  it('rejects corrupt ranges and unknown keys before generating trainer questions', () => {
    expect(
      trainerPreferencesSchema.safeParse({ minFret: 12, maxFret: 5 }).success,
    ).toBe(false)
    expect(
      trainerPreferencesSchema.safeParse({ harmonyKey: 'H' }).success,
    ).toBe(false)
    expect(trainerPreferencesSchema.safeParse({ string: 6 }).success).toBe(
      false,
    )
    expect(trainerPreferencesSchema.parse({ notes: 'natural' })).toMatchObject({
      notes: 'natural',
      mode: 'name',
      minFret: 0,
      maxFret: 12,
    })
  })
  it('rejects reader values that could break rendering or scrolling', () => {
    for (const value of [
      { zoom: 0 },
      { zoom: 99 },
      { speed: -1 },
      { track: -1 },
      { speed: 'fast' },
    ])
      expect(readerPreferencesSchema.safeParse(value).success).toBe(false)
  })
})

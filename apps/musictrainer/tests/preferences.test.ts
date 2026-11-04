import { describe, expect, it } from 'vitest'
import { trainerPreferencesSchema } from '../src/lib/trainer-preferences'

describe('stored trainer preferences', () => {
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
})

import { describe, expect, it } from 'vitest'
import { readerPreferencesSchema } from '../src/lib/reader-preferences'

describe('stored preference validation', () => {
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

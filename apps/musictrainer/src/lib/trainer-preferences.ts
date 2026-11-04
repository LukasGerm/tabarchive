import { z } from 'zod'
import { majorKeys } from './harmony'
import { defaultTrainerSettings, normalizeTrainerSettings } from './trainer'

export const trainerPreferencesKey = 'musictrainer:settings'
export const trainerPreferencesSchema = z
  .object({
    instrument: z.enum(['guitar', 'bass']),
    mode: z.enum([
      'name',
      'find',
      'chords',
      'roots',
      'roles',
      'intervals',
      'harmony',
    ]),
    minFret: z.union([z.literal(0), z.literal(5), z.literal(12)]),
    maxFret: z.union([z.literal(5), z.literal(12), z.literal(24)]),
    string: z.union([z.literal('all'), z.number().int().min(0).max(5)]),
    notes: z.enum(['all', 'natural']),
    spelling: z.enum(['sharps', 'flats']),
    octaves: z.boolean(),
    chords: z.enum(['all', 'open', 'movable']),
    toneVocabulary: z.enum(['foundation', 'all']),
    harmonyExercise: z.enum(['key-chords', 'functions', 'progressions']),
    harmonyKey: z.enum(majorKeys.map((key) => key.name)),
    harmonyChords: z.enum(['triads', 'sevenths']),
    harmonyRecall: z.enum(['mixed', 'name', 'numeral', 'notes']),
    intervalExercise: z.enum(['notes', 'ear']),
    intervalDirection: z.enum(['ascending', 'descending', 'harmonic']),
    intervalVocabulary: z.enum(['foundation', 'all']),
  })
  .partial()
  .transform((value) =>
    normalizeTrainerSettings({ ...defaultTrainerSettings, ...value }),
  )
  .refine((value) =>
    [
      [0, 5],
      [0, 12],
      [5, 12],
      [12, 24],
    ].some(([min, max]) => value.minFret === min && value.maxFret === max),
  )

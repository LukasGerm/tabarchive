import { z } from 'zod'

export const readerPreferencesSchema = z.object({
  zoom: z.number().min(0.7).max(1.8).default(1),
  speed: z.number().int().min(5).max(80).default(24),
  track: z.number().int().min(0).default(0),
})
export const defaultReaderPreferences = readerPreferencesSchema.parse({})

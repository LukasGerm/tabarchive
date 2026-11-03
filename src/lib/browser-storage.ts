import type { z } from 'zod'

export function readStored<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const result = schema.safeParse(
      JSON.parse(localStorage.getItem(key) ?? 'null'),
    )
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeStored(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // The app remains usable when browser storage is unavailable.
  }
}

import { describe, expect, it } from 'vitest'
import { metadataSchema, type ArchivedTab } from '../src/lib/archive'
import { sortRepertoire } from '../src/lib/repertoire'

function piece(
  title: string,
  createdAt: string,
  lastPlayedAt: string | null = null,
): ArchivedTab {
  return {
    ...metadataSchema.parse({ title }),
    id: title,
    format: 'text',
    originalName: 'study.txt',
    createdAt,
    lastPlayedAt,
    trashedAt: null,
  }
}

const recent = piece('Recent practice', '2026-01-01', '2026-10-31')
const older = piece('Older practice', '2026-02-01', '2026-06-01')
const unplayed = piece('Unplayed study', '2026-03-01')
const newImport = piece('New import', '2026-11-01')
const collection = [recent, unplayed, older, newImport]

describe('repertoire sorting', () => {
  it('surfaces never-played pieces, then the longest time since practice', () => {
    expect(sortRepertoire(collection, 'least-recent')).toEqual([
      unplayed,
      newImport,
      older,
      recent,
    ])
  })

  it('keeps recent practice ahead of new imports without practice history', () => {
    expect(sortRepertoire(collection, 'most-recent')).toEqual([
      recent,
      older,
      newImport,
      unplayed,
    ])
  })

  it('supports import date and alphabetical order without changing the collection', () => {
    const original = [...collection]
    expect(sortRepertoire(collection, 'added')).toEqual([
      newImport,
      unplayed,
      older,
      recent,
    ])
    expect(sortRepertoire(collection, 'title')).toEqual([
      newImport,
      older,
      recent,
      unplayed,
    ])
    expect(collection).toEqual(original)
  })

  it('orders practice within the same day and resolves ties consistently', () => {
    const morning = piece(
      'Morning study',
      '2026-01-01',
      '2026-11-01T08:00:00.000Z',
    )
    const evening = piece(
      'Evening study',
      '2026-01-01',
      '2026-11-01T18:00:00.000Z',
    )
    const tied = piece('Another study', '2026-01-01', morning.lastPlayedAt)
    expect(sortRepertoire([evening, morning, tied], 'least-recent')).toEqual([
      tied,
      morning,
      evening,
    ])
    expect(sortRepertoire([morning, evening], 'most-recent')).toEqual([
      evening,
      morning,
    ])
  })

  it('handles an empty collection', () => {
    expect(sortRepertoire([], 'least-recent')).toEqual([])
  })
})

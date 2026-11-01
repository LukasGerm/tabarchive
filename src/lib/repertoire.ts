import type { ArchivedTab } from './archive'

export const repertoireSortLabels = {
  added: 'Recently added',
  'least-recent': 'Least recently played',
  'most-recent': 'Most recently played',
  title: 'Title A–Z',
} as const

export type RepertoireSort = keyof typeof repertoireSortLabels

export function isRepertoireSort(
  value: string | null,
): value is RepertoireSort {
  return value !== null && Object.hasOwn(repertoireSortLabels, value)
}

export function sortRepertoire(
  tabs: readonly ArchivedTab[],
  sort: RepertoireSort,
): ArchivedTab[] {
  return [...tabs].sort((a, b) => {
    const titleOrder = a.title.localeCompare(b.title, undefined, {
      sensitivity: 'base',
    })
    const addedOrder = b.createdAt.localeCompare(a.createdAt)
    let order: number
    switch (sort) {
      case 'least-recent':
        // Never-played pieces come first, oldest imports first among ties.
        order =
          (a.lastPlayedAt ?? '').localeCompare(b.lastPlayedAt ?? '') ||
          -addedOrder
        break
      case 'most-recent':
        // Never-played pieces follow recorded practice, newest imports first.
        order =
          (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? '') ||
          addedOrder
        break
      case 'title':
        order = titleOrder || addedOrder
        break
      default:
        order = addedOrder
    }
    return order || titleOrder || a.id.localeCompare(b.id)
  })
}

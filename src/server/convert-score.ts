import { importer } from '@coderline/alphatab'
import type { ArchivedTab } from '../lib/archive'
import { parseTextTab } from '../lib/text-tab'
import { exportScore, parseScore } from '../lib/score-model'
import type { ScoreDocument } from '../lib/score-document'

// ASCII spacing expresses alignment, not reliable musical time. This adapter
// transcribes visible string/fret onsets and explicit h/p links into a draft.
export function transcribeText(text: string, tab: ArchivedTab) {
  const blocks = parseTextTab(text)
  const systems = blocks.filter((block) => block.type === 'tab')
  if (!systems.length)
    throw new Error(
      'No complete six-string tab systems were found. Paste a transcription as alphaTex in the editor.',
    )
  if (tab.tuning.replace(/\s+/g, ' ').trim().toUpperCase() !== 'E A D G B E')
    throw new Error(
      'Automatic text transcription currently supports standard six-string tuning. Set the correct tuning in an alphaTex transcription.',
    )
  const bars: string[] = []
  let noteCount = 0
  let hasTechniques = false
  for (const system of systems) {
    const rows = system.rows.map((row) => row.slice(row.indexOf('|') + 1))
    const events = new Map<number, string[]>()
    rows.forEach((row, index) => {
      // Strip trailing comments after the final barline, never interpret their numbers.
      const body = row.includes('|')
        ? row.slice(0, row.lastIndexOf('|') + 1)
        : row
      const matches = [...body.matchAll(/\d+|[xX]/g)]
      const unhandled = [...body]
      for (const [offset, match] of matches.entries()) {
        if (/^\d+$/.test(match[0]) && Number(match[0]) > 36)
          throw new Error(
            'Some fret values could not be read safely. Use an alphaTex transcription and compare it with the original.',
          )
        const notes = events.get(match.index) ?? []
        const next = matches[offset + 1]
        const end = match.index + match[0].length
        const connector = next && body.slice(end, next.index)
        const technique = connector?.match(/^[\s|\-]*([hp])[\s|\-]*$/i)
        const from = Number(match[0])
        const to = Number(next?.[0])
        const linked =
          technique &&
          Number.isInteger(from) &&
          Number.isInteger(to) &&
          (technique[1].toLowerCase() === 'h' ? to > from : to < from)
        if (linked) unhandled[end + connector!.search(/[hp]/i)] = ' '
        notes.push(
          `${match[0].toLowerCase()}.${index + 1}${linked ? '{h}' : ''}`,
        )
        events.set(match.index, notes)
        noteCount++
      }
      if (/[^\d\s|\-xX]/.test(unhandled.join(''))) hasTechniques = true
    })
    const width = Math.max(...rows.map((row) => row.length))
    let beats: string[] = []
    for (let column = 0; column <= width; column++) {
      if (column === width || rows.every((row) => row[column] === '|')) {
        if (beats.length) bars.push(':8 ' + beats.join(' '))
        beats = []
      }
      const notes = events.get(column)
      if (notes)
        beats.push(notes.length > 1 ? `(${notes.join(' ')})` : notes[0])
    }
  }
  if (!noteCount)
    throw new Error(
      'No fret numbers were found. Paste an alphaTex transcription in the editor.',
    )
  const score = parseScore(`\\capo ${tab.capo}\n.\n${bars.join(' |\n')}`)
  score.title = tab.title
  score.artist = tab.artist
  const warnings = [
    'Text transcription draft: every onset uses an eighth-note placeholder. Timing, rests, meter, and repeated sections need review against the original.',
    'Only complete standard six-string tab systems were transcribed. Lyrics, chord charts, prose, and section instructions remain in the original. Notes are grouped by their starting column; check multi-digit chords.',
  ]
  if (hasTechniques)
    warnings.push(
      'Some technique or repeat symbols could not be transcribed. Explicit ascending h and descending p links were retained; check other symbols and repeats against the original.',
    )
  return { alphaTex: exportScore(score), warnings }
}

export function convertScore(
  tab: ArchivedTab,
  bytes: Uint8Array | null,
): ScoreDocument {
  const base = {
    schema: 'tabarchive/score-v1' as const,
    revision: 1,
    updatedAt: new Date().toISOString(),
  }
  try {
    if (!bytes || tab.format === 'pdf' || tab.format === 'link')
      throw new Error(
        'This source needs a musical transcription. Paste alphaTex in the editor, or start a score and enter the notes. The original remains available as a reference.',
      )
    if (tab.format === 'text')
      return {
        ...base,
        ...transcribeText(new TextDecoder().decode(bytes), tab),
        textConversionVersion: 2,
        status: 'draft',
      }
    if (tab.format === 'alphatex') {
      const alphaTex = new TextDecoder().decode(bytes)
      parseScore(alphaTex)
      return { ...base, alphaTex, status: 'ready', warnings: [] }
    }
    const score = importer.ScoreLoader.loadScoreFromBytes(bytes)
    return {
      ...base,
      alphaTex: exportScore(score),
      status: 'ready',
      warnings: [
        'Converted from the original score. Compare unusual techniques and layout with the original; format conversion may not retain every feature.',
      ],
    }
  } catch (error) {
    return {
      ...base,
      alphaTex: null,
      status: 'needs-transcription',
      warnings: [
        error instanceof Error &&
        ['text', 'alphatex', 'pdf', 'link'].includes(tab.format)
          ? error.message
          : 'This file could not be converted automatically. Paste an alphaTex transcription in the editor.',
      ],
    }
  }
}

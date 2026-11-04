import { importer, exporter, Settings, model } from '@coderline/alphatab'
import { durationOptions, type NotePosition } from './score-document'

export const maxScoreLength = 500000

// Share the exact parser between the advanced editor and the save endpoint.
// alphaTab can recover from some errors; recovered/incomplete scores must not
// replace the owner's last valid revision.
export function parseScore(source: string): model.Score {
  if (!source.trim() || source.length > maxScoreLength)
    throw new Error('Enter alphaTex notation (up to 500,000 characters).')
  const reader = new importer.AlphaTexImporter()
  reader.logErrors = false
  reader.initFromString(source, new Settings())
  const invalid = () => {
    const detail = [
      reader.lexerDiagnostics,
      reader.parserDiagnostics,
      reader.semanticDiagnostics,
    ].flatMap((bag) => bag.errors)[0]
    return new Error(
      detail
        ? `Invalid alphaTex${detail.start ? ` at line ${detail.start.line}, column ${detail.start.col}` : ''}: ${detail.message}`
        : 'Invalid alphaTex. Check note syntax, string numbers, and brackets before saving.',
    )
  }
  let score: model.Score
  try {
    score = reader.readScore()
  } catch {
    throw invalid()
  }
  const diagnostics = [
    reader.lexerDiagnostics,
    reader.parserDiagnostics,
    reader.semanticDiagnostics,
  ]
  if (diagnostics.some((bag) => bag.hasErrors)) throw invalid()
  if (
    !score.tracks.some((t) =>
      t.staves.some((s) =>
        s.bars.some((b) => b.voices.some((v) => v.beats.length)),
      ),
    )
  )
    throw new Error('The score must contain at least one note or rest.')
  return score
}

export function exportScore(score: model.Score) {
  const source = new exporter.AlphaTexExporter().exportToString(score)
  parseScore(source)
  return source
}

export function positionOf(note: model.Note): NotePosition {
  const beat = note.beat
  const bar = beat.voice.bar
  return {
    track: bar.staff.track.index,
    staff: bar.staff.index,
    bar: bar.index,
    voice: beat.voice.index,
    beat: beat.index,
    note: note.index,
  }
}

export function noteAt(score: model.Score, p: NotePosition) {
  return score.tracks[p.track]?.staves[p.staff]?.bars[p.bar]?.voices[p.voice]
    ?.beats[p.beat]?.notes[p.note]
}

export type NoteTechnique = 'none' | 'hammer-on' | 'pull-off'

export function noteTechnique(note: model.Note): NoteTechnique {
  if (!note.isHammerPullOrigin || !note.hammerPullDestination) return 'none'
  return note.hammerPullDestination.fret > note.fret ? 'hammer-on' : 'pull-off'
}

export function techniqueTarget(note: model.Note) {
  const next = model.Note.findHammerPullDestination(note)
  return next &&
    next.string === note.string &&
    !next.isDead &&
    !next.isTieDestination
    ? next
    : null
}

export function editNote(
  source: string,
  position: NotePosition,
  changes: {
    fret: number
    duration: number
    dots: number
    technique?: NoteTechnique
  },
) {
  if (!Number.isInteger(changes.fret) || changes.fret < 0 || changes.fret > 36)
    throw new Error('Use a fret between 0 and 36.')
  if (
    !durationOptions.some(([duration]) => duration === changes.duration) ||
    ![0, 1, 2].includes(changes.dots)
  )
    throw new Error('Choose a valid duration and number of dots.')
  const score = parseScore(source)
  const note = noteAt(score, position)
  if (!note || !note.isStringed || note.isTieDestination || note.isDead)
    throw new Error(
      'Select a fretted note. Edit tied notes from their starting note or use alphaTex.',
    )
  note.fret = changes.fret
  note.beat.duration = changes.duration
  note.beat.dots = changes.dots
  if (changes.technique !== undefined) {
    if (!['none', 'hammer-on', 'pull-off'].includes(changes.technique))
      throw new Error('Choose a valid technique.')
    if (changes.technique !== 'none') {
      const next = techniqueTarget(note)
      if (!next)
        throw new Error(
          'Add a following fretted note on this string before adding a hammer-on or pull-off.',
        )
      if (
        changes.technique === 'hammer-on'
          ? next.fret <= note.fret
          : next.fret >= note.fret
      )
        throw new Error(
          changes.technique === 'hammer-on'
            ? 'A hammer-on needs a higher next fret. Change the frets or choose pull-off.'
            : 'A pull-off needs a lower next fret. Change the frets or choose hammer-on.',
        )
    }
    note.isHammerPullOrigin = changes.technique !== 'none'
  }
  return exportScore(score)
}

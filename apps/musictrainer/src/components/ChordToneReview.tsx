import {
  chordFormulas,
  chordRoles,
  chordToneName,
  roleAtPitch,
} from '../lib/chord-tones'
import {
  chordPositions,
  midiAt,
  pitchAt,
  type ChordShape,
} from '../lib/trainer'

export function ChordToneReview({ shape }: { shape: ChordShape }) {
  const positions = chordPositions(shape)
  const roles = new Set(
    positions.map((position) => roleAtPitch(shape, pitchAt(position))),
  )
  const bass = positions.reduce((lowest, position) =>
    midiAt(position) < midiAt(lowest) ? position : lowest,
  )
  const rootName = chordToneName(shape, '1')
  const bassName = chordToneName(shape, roleAtPitch(shape, pitchAt(bass)))
  return (
    <section className="chord-tone-review" aria-label="Chord breakdown">
      <h3>
        {shape.name} <span>{chordFormulas[shape.quality].join(' · ')}</span>
      </h3>
      <p>
        {bassName === rootName
          ? `${rootName} is both the root and the lowest sounding note in this shape.`
          : `${rootName} is the root; ${bassName} is the lowest sounding note (the bass). This is an inversion. A slash chord names the bass after the slash.`}
      </p>
      <ul>
        {chordFormulas[shape.quality].map((role) => (
          <li key={role}>
            <strong>{chordToneName(shape, role)}</strong>
            <span>
              {chordRoles[role].label} · {role}
              {!roles.has(role) ? ' (omitted)' : ''}
            </span>
          </li>
        ))}
      </ul>
      <p>
        The diagram labels each sounding note by its role. 1 = root; ♭ =
        lowered; ♯ = raised.
      </p>
    </section>
  )
}

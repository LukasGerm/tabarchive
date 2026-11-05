import { FretboardNeck, StringHeadings } from './FretboardNeck'
import { instruments, type Instrument } from '../lib/instruments'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import {
  chordPositions,
  pitchAt,
  pitchName,
  positionKey,
  type ChordShape,
  type Position,
  type Spelling,
} from '../lib/trainer'

export function TrainerFretboard({
  instrument = 'guitar',
  minFret = 0,
  maxFret,
  activeString,
  marked,
  answerPitch,
  spelling,
  wrongPositions = [],
  foundRoots = [],
  toneLabels,
  onPick,
  shape,
  resolved = false,
}: {
  instrument?: Instrument
  minFret?: number
  maxFret: number
  activeString?: number
  marked?: Position
  answerPitch?: number
  spelling: Spelling
  wrongPositions?: string[]
  foundRoots?: string[]
  toneLabels?: Record<string, string>
  onPick?: (position: Position) => void
  shape?: ChordShape
  resolved?: boolean
}) {
  const tuning = instruments[instrument]
  const strings = tuning.strings
  const board = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<Position>(
    shape
      ? chordPositions(shape)[0]
      : {
          string: activeString ?? 0,
          fret: minFret,
        },
  )
  useEffect(() => {
    setFocus(
      shape
        ? chordPositions(shape)[0]
        : { string: activeString ?? 0, fret: minFret },
    )
  }, [activeString, minFret, maxFret, shape, instrument])
  const fretted =
    shape?.frets.filter((fret): fret is number => fret !== null && fret > 0) ??
    []
  const start = shape && Math.max(...fretted) > 5 ? Math.min(...fretted) : 1
  const frets = shape
    ? [0, ...Array.from({ length: 5 }, (_, index) => start + index)]
    : Array.from(
        { length: maxFret - minFret + 1 },
        (_, index) => minFret + index,
      )
  const firstFretted = frets.find((fret) => fret > 0) ?? 1
  const heights = frets.map((fret) => {
    if (fret === 0) return onPick ? 44 : 32
    const firstHeight = frets.length <= 6 ? 57 : 33
    return Math.max(
      onPick ? 44 : 28,
      Math.round(firstHeight * 2 ** (-(fret - firstFretted) / 12)),
    )
  })
  const description = shape
    ? `Chord shape, low E to ${tuning.highestString}: ${shape.frets.map((fret, index) => `string ${strings[index].number} ${fret === null ? 'muted' : fret === 0 ? 'open' : `fret ${fret}`}`).join(', ')}.${marked ? ` Marked position: string ${strings[marked.string].number}, ${marked.fret === 0 ? 'open' : `fret ${marked.fret}`}.` : ''}${
        toneLabels
          ? ` Roles: ${chordPositions(shape)
              .map(
                (position) =>
                  `string ${strings[position.string].number}: ${toneLabels[positionKey(position)]}`,
              )
              .join(', ')}.`
          : ''
      }`
    : marked
      ? `Marked position: string ${strings[marked.string].number} (${strings[marked.string].name}), ${marked.fret === 0 ? 'open' : `fret ${marked.fret}`}.`
      : `${tuning.label} fretboard. Low E is on the left; fret numbers increase downward.`

  function move(event: KeyboardEvent<HTMLButtonElement>, position: Position) {
    if (shape) {
      const positions = chordPositions(shape)
      const index = positions.findIndex(
        (item) => positionKey(item) === positionKey(position),
      )
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? positions.length - 1
            : ['ArrowLeft', 'ArrowUp'].includes(event.key)
              ? Math.max(0, index - 1)
              : ['ArrowRight', 'ArrowDown'].includes(event.key)
                ? Math.min(positions.length - 1, index + 1)
                : undefined
      if (next === undefined) return
      event.preventDefault()
      setFocus(positions[next])
      board.current
        ?.querySelector<HTMLButtonElement>(
          `button[data-position="${positionKey(positions[next])}"]`,
        )
        ?.focus()
      return
    }
    const next = { ...position }
    if (event.key === 'ArrowLeft') next.string = Math.max(0, next.string - 1)
    else if (event.key === 'ArrowRight')
      next.string = Math.min(strings.length - 1, next.string + 1)
    else if (event.key === 'ArrowUp')
      next.fret = Math.max(minFret, next.fret - 1)
    else if (event.key === 'ArrowDown')
      next.fret = Math.min(maxFret, next.fret + 1)
    else if (event.key === 'Home') next.fret = minFret
    else if (event.key === 'End') next.fret = maxFret
    else return
    event.preventDefault()
    setFocus(next)
    board.current
      ?.querySelector<HTMLButtonElement>(
        `button[data-position="${positionKey(next)}"]`,
      )
      ?.focus()
  }

  return (
    <figure
      className="trainer-fretboard"
      data-interactive={onPick ? true : undefined}
      style={{ '--string-count': strings.length } as CSSProperties}
    >
      <div
        ref={board}
        className="fretboard-grid"
        style={{
          gridTemplateRows: `var(--heading-height) ${heights.map((height) => height + 'px').join(' ')}`,
        }}
        role={onPick ? 'group' : 'img'}
        aria-label={
          onPick
            ? shape
              ? 'Find every root in the chord. Use arrow keys to move between chord notes.'
              : 'Find a note on the fretboard. Use arrow keys to move between frets.'
            : description
        }
      >
        <FretboardNeck
          instrument={instrument}
          frets={frets}
          heights={heights}
        />
        <StringHeadings
          instrument={instrument}
          highlighted={marked?.string ?? activeString}
        />
        {frets.map((fret) => (
          <div
            key={fret}
            data-fret={fret}
            className={`fretboard-row ${fret === 0 ? 'open-strings' : ''}`}
            aria-hidden={!onPick || undefined}
          >
            {strings.map((string, index) => {
              const position = { string: index, fret }
              const key = positionKey(position)
              const isMarked = marked?.string === index && marked.fret === fret
              const isAnswer =
                answerPitch !== undefined &&
                activeString === index &&
                pitchAt(position, instrument) === answerPitch
              const isWrong = wrongPositions.includes(key)
              const isChordTone = shape?.frets[index] === fret
              const foundRoot = foundRoots.includes(key)
              const toneLabel =
                toneLabels?.[key] ?? (foundRoot ? '1' : undefined)
              const isMuted = shape?.frets[index] === null && fret === 0
              const barre = shape?.barre
              const isBarre =
                barre?.fret === fret && index >= barre.from && index <= barre.to
              const classes = `fret-cell ${activeString === index ? 'active-string' : ''} ${isMarked ? 'marked-note' : ''} ${isAnswer || (isMarked && resolved) ? 'answer-note' : ''} ${isWrong && !isAnswer && !resolved ? 'wrong-note' : ''} ${isChordTone ? 'chord-tone' : ''} ${toneLabel ? 'labeled-tone' : ''} ${foundRoot ? 'found-root' : ''} ${isBarre ? `barre-cell ${index === barre.from ? 'barre-start' : ''} ${index === barre.to ? 'barre-end' : ''}` : ''}`
              const marker =
                toneLabel ??
                (isMuted
                  ? '×'
                  : isWrong && !resolved
                    ? '×'
                    : isChordTone
                      ? fret === 0
                        ? '○'
                        : '●'
                      : isAnswer || (isMarked && resolved)
                        ? pitchName(pitchAt(position, instrument), spelling)
                        : isMarked
                          ? '●'
                          : isWrong
                            ? '×'
                            : '')
              const content = <span className="fret-marker">{marker}</span>
              return onPick && (!shape || isChordTone) ? (
                <button
                  key={index}
                  type="button"
                  className={classes}
                  data-position={key}
                  tabIndex={
                    focus.string === index && focus.fret === fret ? 0 : -1
                  }
                  aria-label={`String ${string.number} (${string.name}), ${fret === 0 ? 'open' : `fret ${fret}`}${shape ? `, chord note${toneLabel ? `, role ${toneLabel}` : ''}` : ''}`}
                  aria-disabled={resolved || foundRoot || isWrong}
                  aria-pressed={shape ? foundRoot : undefined}
                  onFocus={() => setFocus(position)}
                  onKeyDown={(event) => move(event, position)}
                  onClick={() => {
                    if (!resolved && !foundRoot && !isWrong) onPick(position)
                  }}
                >
                  {content}
                </button>
              ) : (
                <span
                  key={index}
                  className={classes}
                  aria-hidden={onPick ? true : undefined}
                >
                  {content}
                </span>
              )
            })}
            <span
              className={`fret-number ${marked?.fret === fret ? 'marked-fret' : ''}`}
              aria-hidden="true"
            >
              <span>{fret === 0 ? 'Open' : fret}</span>
            </span>
          </div>
        ))}
      </div>
      <figcaption>
        {shape
          ? '× muted · ○ open · ● fretted · line = barre'
          : '↓ Toward the body'}
      </figcaption>
    </figure>
  )
}

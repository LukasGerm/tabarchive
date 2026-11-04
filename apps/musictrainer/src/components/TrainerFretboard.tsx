import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import {
  guitarStrings,
  chordPositions,
  pitchAt,
  pitchName,
  positionKey,
  type ChordShape,
  type Position,
  type Spelling,
} from '../lib/trainer'

export function TrainerFretboard({
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
  }, [activeString, minFret, maxFret, shape])
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
  const description = shape
    ? `Chord shape, low E to high E: ${shape.frets.map((fret, index) => `string ${6 - index} ${fret === null ? 'muted' : fret === 0 ? 'open' : `fret ${fret}`}`).join(', ')}.${marked ? ` Marked position: string ${6 - marked.string}, ${marked.fret === 0 ? 'open' : `fret ${marked.fret}`}.` : ''}${
        toneLabels
          ? ` Roles: ${chordPositions(shape)
              .map(
                (position) =>
                  `string ${6 - position.string}: ${toneLabels[positionKey(position)]}`,
              )
              .join(', ')}.`
          : ''
      }`
    : marked
      ? `Marked position: string ${6 - marked.string} (${guitarStrings[marked.string].name}), ${marked.fret === 0 ? 'open' : `fret ${marked.fret}`}.`
      : 'Guitar fretboard. Low E is on the left; fret numbers increase downward.'

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
      next.string = Math.min(5, next.string + 1)
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
      style={
        {
          '--fretboard-min-height': `${24 + frets.length * (onPick ? 44 : 28)}px`,
        } as CSSProperties
      }
    >
      <div className="fretboard-direction" aria-hidden="true">
        <span>Low E · thickest</span>
        <span>High E · thinnest</span>
      </div>
      <div
        ref={board}
        className={`fretboard-grid ${shape ? 'chord-fretboard' : ''}`}
        style={{
          gridTemplateRows: `24px ${frets.map((fret) => (fret === 0 ? `${onPick ? 44 : 28}px` : `minmax(${onPick ? 44 : 28}px, 1fr)`)).join(' ')}`,
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
        <div className="fretboard-row string-headings" aria-hidden="true">
          {guitarStrings.map((string, index) => (
            <span
              key={index}
              className={activeString === index ? 'focused-string' : ''}
            >
              <strong>{string.name}</strong>
              <small>{string.number}</small>
            </span>
          ))}
          <span />
        </div>
        {frets.map((fret) => (
          <div
            key={fret}
            data-fret={fret}
            className={`fretboard-row ${fret === 0 ? 'open-strings' : ''} ${fret === 1 ? 'at-nut' : ''}`}
            aria-hidden={!onPick || undefined}
          >
            {guitarStrings.map((string, index) => {
              const position = { string: index, fret }
              const key = positionKey(position)
              const isMarked = marked?.string === index && marked.fret === fret
              const isAnswer =
                answerPitch !== undefined &&
                activeString === index &&
                pitchAt(position) === answerPitch
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
                        ? pitchName(pitchAt(position), spelling)
                        : isMarked
                          ? '●'
                          : isWrong
                            ? '×'
                            : fret === 0 && !shape
                              ? '○'
                              : '')
              const style = {
                '--string-weight': `${2.5 - index * 0.3}px`,
              } as CSSProperties
              const content = (
                <>
                  <span className="fret-marker">{marker}</span>
                  {(([3, 5, 7, 9, 15, 17, 19, 21].includes(fret) &&
                    index === 2) ||
                    ([12, 24].includes(fret) &&
                      (index === 1 || index === 4))) && (
                    <span className="fret-inlay" aria-hidden="true">
                      •
                    </span>
                  )}
                </>
              )
              return onPick && (!shape || isChordTone) ? (
                <button
                  key={index}
                  type="button"
                  className={classes}
                  style={style}
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
                  style={style}
                  aria-hidden={onPick ? true : undefined}
                >
                  {content}
                </span>
              )
            })}
            <span
              className={`fret-number ${[0, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(fret) ? 'landmark' : ''}`}
              aria-hidden="true"
            >
              {fret}
            </span>
          </div>
        ))}
      </div>
      <figcaption>
        {shape
          ? '× muted · ○ open · ● fretted · line = barre'
          : '0 = open string · one fret = one semitone'}
      </figcaption>
    </figure>
  )
}

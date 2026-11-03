import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Eye, EyeOff, RotateCcw } from 'lucide-react'
import {
  guitarStrings,
  pitchAt,
  pitchName,
  positionKey,
  type Position,
  type Spelling,
} from '../lib/trainer'

const landmarks = [3, 5, 7, 9]
const frets = Array.from({ length: 13 }, (_, index) => index)
type Focus = 'landmarks' | 'all' | number

export function FretboardStudy({
  spelling: initialSpelling,
}: {
  spelling: Spelling
}) {
  const [spelling, setSpelling] = useState(initialSpelling)
  const [focus, setFocus] = useState<Focus>('landmarks')
  const [hidden, setHidden] = useState(false)
  const [revealed, setRevealed] = useState<string[]>([])
  const [cursor, setCursor] = useState('0:3')
  const board = useRef<HTMLDivElement>(null)
  const activeFrets =
    focus === 'all' ? frets : focus === 'landmarks' ? landmarks : [focus]

  function changeFocus(value: Focus) {
    setFocus(value)
    setRevealed([])
    setCursor(`0:${value === 'all' ? 0 : value === 'landmarks' ? 3 : value}`)
  }

  function move(event: KeyboardEvent<HTMLButtonElement>, position: Position) {
    let string = position.string
    let row = activeFrets.indexOf(position.fret)
    if (event.key === 'ArrowLeft') string = Math.max(0, string - 1)
    else if (event.key === 'ArrowRight') string = Math.min(5, string + 1)
    else if (event.key === 'ArrowUp') row = Math.max(0, row - 1)
    else if (event.key === 'ArrowDown')
      row = Math.min(activeFrets.length - 1, row + 1)
    else if (event.key === 'Home') string = 0
    else if (event.key === 'End') string = 5
    else return
    event.preventDefault()
    const key = positionKey({ string, fret: activeFrets[row] })
    setCursor(key)
    board.current
      ?.querySelector<HTMLButtonElement>(`[data-position="${key}"]`)
      ?.focus()
  }

  return (
    <section className="fretboard-study" aria-labelledby="study-title">
      <div className="trainer-question-heading">
        <div>
          <h2 id="study-title">Make the fretboard familiar.</h2>
          <p className="exercise-description">
            Start with frets 3, 5, 7 and 9. Read the notes, then recall them.
          </p>
        </div>
      </div>
      <div className="study-layout">
        <div className="study-controls">
          <fieldset className="study-focus">
            <legend>Focus frets</legend>
            <div>
              <button
                aria-pressed={focus === 'landmarks'}
                onClick={() => changeFocus('landmarks')}
              >
                3 · 5 · 7 · 9
              </button>
              {landmarks.map((fret) => (
                <button
                  key={fret}
                  aria-label={`Focus fret ${fret}`}
                  aria-pressed={focus === fret}
                  onClick={() => changeFocus(fret)}
                >
                  {fret}
                </button>
              ))}
              <button
                aria-pressed={focus === 'all'}
                onClick={() => changeFocus('all')}
              >
                All 0–12
              </button>
            </div>
          </fieldset>
          <label>
            Note names
            <select
              value={spelling}
              onChange={(event) => setSpelling(event.target.value as Spelling)}
            >
              <option value="sharps">Sharps (♯)</option>
              <option value="flats">Flats (♭)</option>
            </select>
          </label>
          <div className="study-recall-actions">
            <button
              className="trainer-primary"
              onClick={() => {
                setHidden(!hidden)
                setRevealed([])
              }}
            >
              {hidden ? <Eye size={17} /> : <EyeOff size={17} />}
              {hidden ? 'Show all notes' : 'Hide notes'}
            </button>
            {hidden && (
              <button
                className="trainer-reveal"
                disabled={!revealed.length}
                onClick={() => setRevealed([])}
              >
                <RotateCcw size={16} /> Hide again
              </button>
            )}
          </div>
          <p className="study-instruction" role="status">
            {hidden
              ? 'Say the note, then tap ? to check. Tap again to hide. Arrow keys move between notes.'
              : 'Read across a fret from low E to high E. Hide the notes when you’re ready to try from memory.'}
          </p>
        </div>
        <figure className="trainer-fretboard study-board">
          <div className="fretboard-direction" aria-hidden="true">
            <span>Low E · thickest</span>
            <span>High E · thinnest</span>
          </div>
          <div
            ref={board}
            role="table"
            aria-label="Notes on the fretboard"
            aria-describedby="study-board-caption"
          >
            <div className="fretboard-row string-headings" role="row">
              {guitarStrings.map((string) => (
                <span
                  key={string.number}
                  role="columnheader"
                  aria-label={`String ${string.number} (${string.name})`}
                >
                  <strong>{string.name}</strong>
                  <small>{string.number}</small>
                </span>
              ))}
              <span role="columnheader">Fret</span>
            </div>
            {frets.map((fret) => {
              const active = activeFrets.includes(fret)
              return (
                <div
                  key={fret}
                  role="row"
                  data-fret={fret}
                  className={`fretboard-row study-row ${active ? 'study-active-row' : ''} ${fret === 0 ? 'open-strings' : ''} ${fret === 1 ? 'at-nut' : ''}`}
                >
                  {guitarStrings.map((string, index) => {
                    const position = { string: index, fret }
                    const key = positionKey(position)
                    const name = pitchName(pitchAt(position), spelling)
                    const visible = !hidden || revealed.includes(key)
                    return (
                      <div
                        key={string.number}
                        role="cell"
                        className="fret-cell"
                        style={
                          {
                            '--string-weight': `${2.5 - index * 0.3}px`,
                          } as CSSProperties
                        }
                      >
                        {active ? (
                          hidden ? (
                            <button
                              className="study-note-button"
                              data-position={key}
                              tabIndex={cursor === key ? 0 : -1}
                              aria-label={`String ${string.number} (${string.name}), ${fret === 0 ? 'open' : `fret ${fret}`}: ${visible ? name : 'hidden note'}`}
                              aria-pressed={visible}
                              onFocus={() => setCursor(key)}
                              onKeyDown={(event) => move(event, position)}
                              onClick={() =>
                                setRevealed((current) =>
                                  current.includes(key)
                                    ? current.filter((item) => item !== key)
                                    : [...current, key],
                                )
                              }
                            >
                              <span
                                className={`fret-marker ${visible ? '' : 'study-hidden-note'}`}
                              >
                                {visible ? name : '?'}
                              </span>
                            </button>
                          ) : (
                            <span className="fret-marker">{name}</span>
                          )
                        ) : fret === 0 ? (
                          <span className="study-open-note">{string.name}</span>
                        ) : null}
                        {((landmarks.includes(fret) && index === 2) ||
                          (fret === 12 && (index === 1 || index === 4))) && (
                          <span className="fret-inlay" aria-hidden="true">
                            •
                          </span>
                        )}
                      </div>
                    )
                  })}
                  <span
                    className={`fret-number ${landmarks.includes(fret) || fret === 12 ? 'landmark' : ''}`}
                    role="rowheader"
                  >
                    {fret}
                  </span>
                </div>
              )
            })}
          </div>
          <figcaption id="study-board-caption">
            0 = open string · one fret = one semitone
            <br />
            Green rows show your focus frets.
          </figcaption>
        </figure>
        <div className="study-tip">
          <strong>Two strings, one pattern.</strong>
          <p>
            Both E strings have the same note names at every fret. At fret 12,
            all six strings repeat their open notes.
          </p>
          <p>
            Standard tuning · E A D G B E. Names use international B / B♭
            notation.
          </p>
        </div>
      </div>
    </section>
  )
}

import { useId } from 'react'
import { instruments, type Instrument } from '../lib/instruments'

export function StringHeadings({
  instrument,
  highlighted,
  study = false,
}: {
  instrument: Instrument
  highlighted?: number
  study?: boolean
}) {
  return (
    <div
      className="fretboard-row string-headings"
      role={study ? 'row' : undefined}
      aria-hidden={!study || undefined}
    >
      {instruments[instrument].strings.map((string, index) => (
        <span
          key={string.number}
          role={study ? 'columnheader' : undefined}
          aria-label={
            study ? `String ${string.number} (${string.name})` : undefined
          }
        >
          <strong
            className={highlighted === index ? 'focused-string' : undefined}
          >
            {index === 0
              ? 'Low E'
              : instrument === 'guitar' && string.number === 1
                ? 'High E'
                : string.name}
          </strong>
          {study && <small>{string.number}</small>}
        </span>
      ))}
      <span role={study ? 'columnheader' : undefined}>Fret</span>
    </div>
  )
}

// The artwork sits behind the HTML cells. Both use the same row heights and string centers.
export function FretboardNeck({
  instrument,
  frets,
  heights,
}: {
  instrument: Instrument
  frets: readonly number[]
  heights: readonly number[]
}) {
  const id = useId()
  const paint = (name: string) => `url(#${id}-${name})`
  const width = 240
  const height = heights.reduce((sum, row) => sum + row, 0)
  const openHeight = frets[0] === 0 ? heights[0] : 0
  const hasNut = frets.includes(1)
  const offset = (y: number) => (7 * (height - y)) / (height - openHeight)
  const strings = instruments[instrument].strings
  const board = `M7 ${openHeight} H233 L240 ${height} H0 Z`
  let rowEnd = 0

  return (
    <svg
      className="fretboard-art"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-wood`}>
          <stop stopColor="#4b3328" />
          <stop offset=".17" stopColor="#6a4935" />
          <stop offset=".5" stopColor="#78543f" />
          <stop offset=".85" stopColor="#60412f" />
          <stop offset="1" stopColor="#4d352a" />
        </linearGradient>
        <pattern
          id={`${id}-grain`}
          width="25"
          height="200"
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke="#33241e" strokeWidth=".65" opacity=".35">
            <path d="M2 0C3 44 0 62 2 100S4 162 2 200M6 0Q10 55 7 90T6 200M10 0Q8 60 13 114T10 200M20 0Q15 62 19 101T20 200M23 0Q26 70 23 106T23 200" />
          </g>
          <path
            d="M5 0Q4 70 6 103T5 200M17 0Q14 47 16 103T17 200"
            fill="none"
            stroke="#cc9e75"
            strokeWidth=".8"
            opacity=".28"
          />
        </pattern>
        <linearGradient id={`${id}-wire`} x2="0" y2="1">
          <stop stopColor="#9c9588" />
          <stop offset=".3" stopColor="#f3eddb" />
          <stop offset="1" stopColor="#887d6d" />
        </linearGradient>
        <linearGradient id={`${id}-nut`} x2="0" y2="1">
          <stop stopColor="#ad9e82" />
          <stop offset=".35" stopColor="#fff4de" />
          <stop offset=".8" stopColor="#e4d6bc" />
          <stop offset="1" stopColor="#a69780" />
        </linearGradient>
      </defs>
      {hasNut && openHeight > 0 && (
        <path
          d={`M0 0 H240 Q233 ${openHeight / 2} 233 ${openHeight} H7 Q7 ${openHeight / 2} 0 0`}
          fill="#c5a17b"
        />
      )}
      <path d={board} fill={paint('wood')} />
      <path d={board} fill={paint('grain')} />
      {frets.map((fret, index) => {
        rowEnd += heights[index]
        if (fret === 0) return null
        const inset = offset(rowEnd)
        const inlays =
          fret % 12 === 0
            ? [0.3, 0.7]
            : [3, 5, 7, 9].includes(fret % 12)
              ? [0.5]
              : []
        return (
          <g key={fret}>
            {inlays.map((x) => (
              <circle
                key={x}
                cx={width * x}
                cy={rowEnd - heights[index] / 2}
                r="4.4"
                fill="#d8d1b9"
              />
            ))}
            <rect
              x={inset}
              y={rowEnd - 3.2}
              width={width - 2 * inset}
              height="3.2"
              fill={paint('wire')}
            />
          </g>
        )
      })}
      {hasNut && (
        <rect
          x="6"
          y={Math.max(0, openHeight - 3)}
          width="228"
          height="6"
          rx="1"
          fill={paint('nut')}
        />
      )}
      {strings.map((string, i) => {
        const x = (width * (i + 0.5)) / strings.length
        const gauge = instrument === 'bass' ? 4.8 - i * 0.8 : 3.6 - i * 0.52
        const wound = instrument === 'bass' || string.number >= 4
        return (
          <g key={string.number}>
            <line
              x1={x + 0.8}
              x2={x + 0.8}
              y1={hasNut ? 0 : openHeight}
              y2={height}
              stroke="#30251d"
              strokeWidth={gauge + 1}
            />
            <line
              x1={x}
              x2={x}
              y1={hasNut ? 0 : openHeight}
              y2={height}
              stroke={wound ? '#d1b692' : '#e0ded3'}
              strokeWidth={gauge}
            />
            {wound && (
              <line
                x1={x}
                x2={x}
                y1={hasNut ? 0 : openHeight}
                y2={height}
                stroke="#85735e"
                strokeWidth={gauge * 0.8}
                strokeDasharray=".6 1.65"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

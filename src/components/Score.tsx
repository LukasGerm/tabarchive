import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AlphaTabApi, model } from '@coderline/alphatab'
import type { TabFormat } from '../lib/archive'

export function Score({
  bytes,
  format,
  zoom,
  onPrintReady,
  onReady,
  onNoteSelect,
  selectedNote,
  onTrackChange,
  selectionLocked = false,
  initialTrack = 0,
  onTrackSelected,
}: {
  bytes: Uint8Array
  format: TabFormat
  zoom: number
  onPrintReady: (print: (() => void) | null) => void
  onReady: () => void
  onNoteSelect?: (note: model.Note) => void
  selectedNote?: string
  onTrackChange?: () => void
  selectionLocked?: boolean
  initialTrack?: number
  onTrackSelected?: (index: number) => void
}) {
  const element = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const selectedTarget = useRef<HTMLButtonElement>(null)
  const api = useRef<AlphaTabApi | null>(null)
  const [error, setError] = useState('')
  const [tracks, setTracks] = useState<{ index: number; name: string }[]>([])
  const [track, setTrack] = useState(initialTrack)
  const trackRef = useRef(initialTrack)
  const handlers = useRef({ onNoteSelect })
  handlers.current = { onNoteSelect }
  const [targets, setTargets] = useState<
    {
      note: model.Note
      key: string
      x: number
      y: number
      width: number
      height: number
    }[]
  >([])
  const currentZoom = useRef(zoom)
  currentZoom.current = zoom

  useLayoutEffect(() => {
    selectedTarget.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }, [selectedNote, targets])

  useEffect(() => {
    let cancelled = false
    setError('')
    setTargets([])
    void import('@coderline/alphatab')
      .then((alphaTab) => {
        if (cancelled || !element.current) return
        const instance = new alphaTab.AlphaTabApi(element.current, {
          core: {
            fontDirectory: '/font/',
            engine: 'svg',
            includeNoteBounds: Boolean(handlers.current.onNoteSelect),
          },
          display: {
            scale: currentZoom.current,
            staveProfile: alphaTab.StaveProfile.Tab,
            padding: [12, 8, 12, 8],
          },
          notation: { rhythmMode: alphaTab.TabRhythmMode.ShowWithBars },
          player: {
            enablePlayer: false,
            enableSeekToClick: false,
            enablePlaybackRangeSelection: false,
          },
        })
        api.current = instance
        instance.error.on(() => {
          onReady()
          if (!cancelled)
            setError(
              'This file could not be rendered. You can still download the original. Check that the format and contents are valid.',
            )
        })
        instance.scoreLoaded.on((score) => {
          if (!cancelled) {
            setTracks(
              score.tracks.map((item) => ({
                index: item.index,
                name: item.name || `Track ${item.index + 1}`,
              })),
            )
            const nextTrack = Math.min(
              trackRef.current,
              score.tracks.length - 1,
            )
            setTrack(nextTrack)
          }
        })
        instance.postRenderFinished.on(() => {
          if (!cancelled) {
            onReady()
            onPrintReady(() => instance.print())
            if (
              handlers.current.onNoteSelect &&
              stage.current &&
              element.current
            ) {
              const surface = element.current
                .querySelector('.at-surface')
                ?.getBoundingClientRect()
              const origin = stage.current.getBoundingClientRect()
              if (surface) {
                const buttons: typeof targets = []
                for (const item of instance.tracks ?? [])
                  for (const staff of item.staves)
                    for (const bar of staff.bars)
                      for (const voice of bar.voices)
                        for (const beat of voice.beats) {
                          for (const bounds of instance.boundsLookup?.findBeat(
                            beat,
                          )?.notes ?? []) {
                            const n = bounds.note
                            const r = bounds.noteHeadBounds
                            buttons.push({
                              note: n,
                              key: `${item.index}:${staff.index}:${bar.index}:${voice.index}:${beat.index}:${n.index}`,
                              x: surface.left - origin.left + r.x,
                              y: surface.top - origin.top + r.y,
                              width: r.w,
                              height: r.h,
                            })
                          }
                        }
                setTargets(buttons)
              }
            }
          }
        })
        try {
          const score =
            format === 'alphatex'
              ? alphaTab.importer.ScoreLoader.loadAlphaTex(
                  new TextDecoder().decode(bytes),
                  instance.settings,
                )
              : alphaTab.importer.ScoreLoader.loadScoreFromBytes(
                  bytes,
                  instance.settings,
                )
          trackRef.current = Math.max(
            0,
            Math.min(trackRef.current, score.tracks.length - 1),
          )
          instance.renderScore(score, [trackRef.current])
        } catch {
          onReady()
          setError(
            'This file could not be rendered. Check that it contains a supported score.',
          )
        }
      })
      .catch(() => {
        onReady()
        if (!cancelled)
          setError(
            'The notation reader could not load. Refresh the page to try again.',
          )
      })
    return () => {
      cancelled = true
      onPrintReady(null)
      api.current?.destroy()
      api.current = null
    }
  }, [bytes, format, onPrintReady, onReady])

  useEffect(() => {
    if (api.current) {
      api.current.settings.display.scale = zoom
      api.current.updateSettings()
      api.current.render()
    }
  }, [zoom])

  return (
    <>
      {tracks.length > 1 && (
        <label className="track-picker">
          Instrument
          <select
            value={track}
            disabled={selectionLocked}
            onChange={(event) => {
              const index = Number(event.target.value)
              setTrack(index)
              trackRef.current = index
              onTrackChange?.()
              onTrackSelected?.(index)
              setTargets([])
              const selected = api.current?.score?.tracks[index]
              if (selected) api.current?.renderTracks([selected])
            }}
          >
            {tracks.map((item) => (
              <option key={item.index} value={item.index}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div ref={stage} className="notation-stage">
        <div
          ref={element}
          className="notation"
          aria-label="Rendered guitar tablature"
        />
        {onNoteSelect &&
          targets.map((target) => (
            <button
              key={target.key}
              ref={selectedNote === target.key ? selectedTarget : undefined}
              type="button"
              className="note-target"
              aria-label={`Bar ${target.note.beat.voice.bar.index + 1}, beat ${target.note.beat.index + 1}, string ${target.note.beat.voice.bar.staff.tuning.length - target.note.string + 1}, fret ${target.note.fret}`}
              aria-pressed={selectedNote === target.key}
              style={{
                left: target.x - 4,
                top: target.y - 2,
                width: Math.max(22, target.width + 8),
                height: target.height + 4,
              }}
              onClick={() => onNoteSelect(target.note)}
            />
          ))}
      </div>
    </>
  )
}

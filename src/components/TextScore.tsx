import { useEffect, useMemo, useRef, useState } from 'react'
import { parseTextTab, wrapTabSystem } from '../lib/text-tab'

export function TextScore({ text, zoom }: { text: string; zoom: number }) {
  const container = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(80)
  const [wrap, setWrap] = useState(true)
  const blocks = useMemo(() => parseTextTab(text), [text])
  useEffect(() => {
    const element = container.current!
    const measure = () => {
      const style = getComputedStyle(element)
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      context.font = `${16 * zoom}px ${style.fontFamily}`
      setColumns(
        Math.max(
          12,
          Math.floor(
            (element.clientWidth - 24) / context.measureText('0').width,
          ),
        ),
      )
    }
    measure()
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [zoom])
  return (
    <>
      <div className="text-reader-options">
        <span>Text tablature</span>
        <button
          className="text-button"
          aria-pressed={wrap}
          onClick={() => setWrap((value) => !value)}
        >
          {wrap ? 'Show original layout' : 'Wrap to screen'}
        </button>
      </div>
      <div
        ref={container}
        className="text-score"
        style={{ fontSize: `${16 * zoom}px` }}
      >
        {!wrap ? (
          <pre className="text-tab">{text}</pre>
        ) : (
          blocks.map((block, index) =>
            block.type === 'text' ? (
              block.text.trim() ? (
                <pre className="tab-prose" key={index}>
                  {block.text}
                </pre>
              ) : null
            ) : (
              <div className="tab-system" key={index}>
                {wrapTabSystem(block.rows, columns).map((rows, part) => (
                  <pre
                    className="text-tab wrapped"
                    key={part}
                    data-continuation={part > 0 || undefined}
                  >
                    {rows.join('\n')}
                  </pre>
                ))}
              </div>
            ),
          )
        )}
      </div>
    </>
  )
}

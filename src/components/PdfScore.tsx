import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export function PdfScore({
  bytes,
  zoom,
  onReady,
}: {
  bytes: Uint8Array
  zoom: number
  onReady: () => void
}) {
  const element = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    let document: PDFDocumentProxy | undefined
    let task: { destroy: () => Promise<void> } | undefined
    let observer: ResizeObserver | undefined
    let timer: ReturnType<typeof setTimeout>
    let generation = 0
    const container = element.current!
    setError('')
    void import('pdfjs-dist')
      .then(async (pdf) => {
        if (cancelled) return
        pdf.GlobalWorkerOptions.workerSrc = workerUrl
        const loading = pdf.getDocument({ data: bytes.slice() })
        task = loading
        document = await loading.promise
        if (cancelled) return
        if (document.numPages > 100)
          throw new Error(
            'This PDF is too long for the reader. Download the original to open it.',
          )
        async function render() {
          const version = ++generation
          container.replaceChildren()
          for (
            let pageNumber = 1;
            pageNumber <= document!.numPages;
            pageNumber++
          ) {
            if (cancelled || version !== generation) return
            const page = await document!.getPage(pageNumber)
            if (cancelled || version !== generation) return
            const base = page.getViewport({ scale: 1 })
            const scale =
              (Math.min(container.clientWidth, 1100) / base.width) * zoom
            const viewport = page.getViewport({ scale })
            const ratio = Math.min(window.devicePixelRatio || 1, 2)
            const canvas = window.document.createElement('canvas')
            canvas.width = Math.ceil(viewport.width * ratio)
            canvas.height = Math.ceil(viewport.height * ratio)
            canvas.style.width = `${viewport.width}px`
            canvas.style.height = `${viewport.height}px`
            canvas.setAttribute('role', 'img')
            canvas.setAttribute(
              'aria-label',
              `Page ${pageNumber} of ${document!.numPages}`,
            )
            container.appendChild(canvas)
            await page.render({
              canvas,
              viewport,
              transform: [ratio, 0, 0, ratio, 0, 0],
            }).promise
            if (pageNumber === 1 && !cancelled) onReady()
          }
        }
        const draw = () =>
          void render().catch((err) => {
            if (!cancelled)
              setError(
                err instanceof Error
                  ? err.message
                  : 'Could not render this PDF.',
              )
          })
        let width = container.clientWidth
        observer = new ResizeObserver(() => {
          if (width === container.clientWidth) return
          width = container.clientWidth
          clearTimeout(timer)
          timer = setTimeout(draw, 200)
        })
        observer.observe(container)
        draw()
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Could not open this PDF.',
          )
      })
    return () => {
      cancelled = true
      generation++
      clearTimeout(timer)
      observer?.disconnect()
      void task?.destroy()
    }
  }, [bytes, zoom, onReady])
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="pdf-pages" ref={element} />
    </>
  )
}

import { useEffect, useState } from 'react'

export function useAutoScroll(speed: number) {
  const [running, setRunning] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (!running) {
      setCountdown(0)
      return
    }
    setCountdown(3)
    let frame = 0
    let lastTime = 0
    let position = window.scrollY
    let wakeLock: WakeLockSentinel | undefined
    let cancelled = false
    const start = performance.now() + 3000
    function tick(now: number) {
      if (now < start) {
        setCountdown(Math.ceil((start - now) / 1000))
        frame = requestAnimationFrame(tick)
        return
      }
      setCountdown(0)
      if (!lastTime) {
        lastTime = now
        position = window.scrollY
      }
      position += (Math.min(now - lastTime, 100) / 1000) * speed
      lastTime = now
      const end = document.documentElement.scrollHeight - window.innerHeight
      if (position >= end - 1) {
        window.scrollTo(0, end)
        setRunning(false)
        return
      }
      window.scrollTo({ top: position, behavior: 'instant' })
      frame = requestAnimationFrame(tick)
    }
    const pause = () => setRunning(false)
    const visibility = () => {
      if (document.hidden) pause()
    }
    const key = (event: KeyboardEvent) => {
      if (
        [
          ' ',
          'Escape',
          'ArrowUp',
          'ArrowDown',
          'PageDown',
          'PageUp',
          'Home',
          'End',
        ].includes(event.key)
      )
        pause()
    }
    const pointer = (event: PointerEvent) => {
      if (!(event.target as Element).closest('.transport')) pause()
    }
    window.addEventListener('wheel', pause, { passive: true })
    window.addEventListener('pointerdown', pointer, { passive: true })
    window.addEventListener('keydown', key)
    document.addEventListener('visibilitychange', visibility)
    if ('wakeLock' in navigator)
      void navigator.wakeLock
        .request('screen')
        .then((lock) => {
          if (cancelled) void lock.release()
          else wakeLock = lock
        })
        .catch(() => {})
    frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      void wakeLock?.release()
      window.removeEventListener('wheel', pause)
      window.removeEventListener('pointerdown', pointer)
      window.removeEventListener('keydown', key)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [running, speed])

  return {
    running,
    countdown,
    toggle: () => setRunning((value) => !value),
    pause: () => setRunning(false),
  }
}

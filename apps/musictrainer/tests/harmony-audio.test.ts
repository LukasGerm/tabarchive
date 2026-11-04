import { afterEach, expect, it, vi } from 'vitest'
import { HarmonyPlayer } from '../src/lib/harmony-audio'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function delayedAudio(onCreate = () => {}) {
  const contexts: DelayedAudioContext[] = []
  class DelayedAudioContext {
    state = 'suspended'
    currentTime = 0
    finishResume!: () => void
    close = vi.fn(async () => {
      this.state = 'closed'
    })
    resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          this.finishResume = () => {
            if (this.state !== 'closed') this.state = 'running'
            resolve()
          }
        }),
    )
    constructor() {
      onCreate()
      contexts.push(this)
    }
  }
  vi.stubGlobal('AudioContext', DelayedAudioContext)
  return contexts
}

it('requests music playback before opening audio so iOS does not use its muted ambient mode', async () => {
  vi.useFakeTimers()
  const session = { type: 'auto' }
  vi.stubGlobal('navigator', { audioSession: session })
  let typeAtCreation = ''
  const contexts = delayedAudio(() => {
    typeAtCreation = session.type
  })
  const player = new HarmonyPlayer()
  expect(session.type).toBe('auto')
  const end = vi.fn()
  const pending = player.play(
    [{ notes: [], seconds: 1, step: 0 }],
    vi.fn(),
    end,
  )
  contexts[0].finishResume()
  await pending
  await vi.runAllTimersAsync()
  expect(typeAtCreation).toBe('playback')
  expect(end).toHaveBeenCalledOnce()
  expect(contexts[0].state).toBe('closed')
})

it.each(['unavailable', 'rejected'])(
  'still plays when the optional audio session API is %s',
  async (support) => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'navigator',
      support === 'unavailable'
        ? {}
        : {
            audioSession: {
              get type() {
                return 'auto'
              },
              set type(_value: string) {
                throw new Error('Audio session changes are not allowed')
              },
            },
          },
    )
    const contexts = delayedAudio()
    const player = new HarmonyPlayer()
    const step = vi.fn()
    const end = vi.fn()
    const pending = player.play([{ notes: [], seconds: 1, step: 0 }], step, end)
    contexts[0].finishResume()
    await pending
    await vi.runAllTimersAsync()
    expect(step).toHaveBeenCalledExactlyOnceWith(0)
    expect(end).toHaveBeenCalledOnce()
    expect(contexts[0].state).toBe('closed')
  },
)

it('cannot restart playback when a pending resume completes after Stop or unmount', async () => {
  vi.useFakeTimers()
  const contexts = delayedAudio()
  const player = new HarmonyPlayer()
  const step = vi.fn()
  const end = vi.fn()
  const pending = player.play([{ notes: [], seconds: 1, step: 0 }], step, end)
  player.stop()
  contexts[0].finishResume()
  await pending
  await vi.runAllTimersAsync()
  expect(contexts[0].close).toHaveBeenCalledOnce()
  expect(step).not.toHaveBeenCalled()
  expect(end).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it('only the newest play request can publish steps or completion', async () => {
  vi.useFakeTimers()
  const contexts = delayedAudio()
  const player = new HarmonyPlayer()
  const oldStep = vi.fn(),
    oldEnd = vi.fn(),
    newStep = vi.fn(),
    newEnd = vi.fn()
  const first = player.play(
    [{ notes: [], seconds: 1, step: 1 }],
    oldStep,
    oldEnd,
  )
  const second = player.play(
    [{ notes: [], seconds: 1, step: 2 }],
    newStep,
    newEnd,
  )
  contexts[1].finishResume()
  await second
  contexts[0].finishResume()
  await first
  await vi.runAllTimersAsync()
  expect(oldStep).not.toHaveBeenCalled()
  expect(oldEnd).not.toHaveBeenCalled()
  expect(newStep).toHaveBeenCalledExactlyOnceWith(2)
  expect(newEnd).toHaveBeenCalledOnce()
  expect(contexts.every((context) => context.state === 'closed')).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

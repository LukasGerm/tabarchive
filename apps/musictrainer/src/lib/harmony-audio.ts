import type { HarmonySound } from './harmony'

export const midiFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

function requestPlaybackSession() {
  try {
    const session = (
      navigator as Navigator & { audioSession?: { type: string } }
    ).audioSession
    // iOS treats Web Audio's default session as ambient and mutes it in Silent
    // Mode. An explicit Play action should use the same category as music.
    // https://bugs.webkit.org/show_bug.cgi?id=252746
    if (session) session.type = 'playback'
  } catch {
    // This optional API must not prevent playback where it is restricted.
  }
}

// Also accepts OfflineAudioContext for waveform verification.
export function scheduleHarmonySound(
  context: BaseAudioContext,
  sound: HarmonySound,
  when: number,
) {
  for (const midi of sound.notes) {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const peak = 0.12 / Math.sqrt(sound.notes.length)
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(midiFrequency(midi), when)
    envelope.gain.setValueAtTime(0, when)
    envelope.gain.linearRampToValueAtTime(peak, when + 0.015)
    envelope.gain.exponentialRampToValueAtTime(
      peak * 0.35,
      when + Math.min(0.16, sound.seconds * 0.4),
    )
    envelope.gain.setValueAtTime(peak * 0.35, when + sound.seconds * 0.75)
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      when + sound.seconds - 0.025,
    )
    envelope.gain.linearRampToValueAtTime(0, when + sound.seconds)
    oscillator.connect(envelope)
    envelope.connect(context.destination)
    oscillator.onended = () => {
      oscillator.disconnect()
      envelope.disconnect()
    }
    oscillator.start(when)
    oscillator.stop(when + sound.seconds)
  }
}

export class HarmonyPlayer {
  private context: AudioContext | null = null
  private timers = new Set<ReturnType<typeof setTimeout>>()

  // Only called by a Play button, so creating/resuming audio stays in a gesture.
  async play(
    sounds: HarmonySound[],
    onStep: (step: number) => void,
    onEnd: () => void,
    options: { loop?: boolean } = {},
  ) {
    this.stop()
    requestPlaybackSession()
    const context = new AudioContext()
    this.context = context
    try {
      await context.resume()
      // Stop, navigation, or a newer play request may happen while resume waits.
      if (this.context !== context) return
      if (context.state !== 'running') throw new Error('Audio did not start.')
      const later = (callback: () => void, seconds: number) => {
        const timer = setTimeout(
          () => {
            this.timers.delete(timer)
            if (this.context === context) callback()
          },
          Math.max(0, seconds) * 1000,
        )
        this.timers.add(timer)
      }
      const duration = sounds.reduce((sum, sound) => sum + sound.seconds, 0)
      const schedule = (start: number) => {
        let offset = 0
        for (const sound of sounds) {
          scheduleHarmonySound(context, sound, start + offset)
          later(() => onStep(sound.step), start + offset - context.currentTime)
          offset += sound.seconds
        }
        if (options.loop && duration > 0) {
          // Queue the next cycle before its boundary; use the audio clock to
          // avoid accumulating timer drift or adding a pause between loops.
          later(
            () =>
              schedule(Math.max(start + duration, context.currentTime + 0.01)),
            start + duration - context.currentTime - 0.1,
          )
        } else {
          later(
            () => {
              this.stop()
              onEnd()
            },
            start + duration - context.currentTime,
          )
        }
      }
      schedule(context.currentTime + 0.04)
    } catch (error) {
      if (this.context !== context) return
      this.stop()
      throw error
    }
  }

  stop() {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed')
      void context.close().catch(() => {})
  }
}

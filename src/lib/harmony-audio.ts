import type { HarmonySound } from './harmony'

export const midiFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

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
    envelope.gain.exponentialRampToValueAtTime(peak * 0.35, when + 0.16)
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
  private timers: ReturnType<typeof setTimeout>[] = []

  // Only called by a Play button, so creating/resuming audio stays in a gesture.
  async play(
    sounds: HarmonySound[],
    onStep: (step: number) => void,
    onEnd: () => void,
  ) {
    this.stop()
    const context = new AudioContext()
    this.context = context
    try {
      await context.resume()
      // Stop, navigation, or a newer play request may happen while resume waits.
      if (this.context !== context) return
      if (context.state !== 'running') throw new Error('Audio did not start.')
      let offset = 0.04
      const start = context.currentTime
      for (const sound of sounds) {
        scheduleHarmonySound(context, sound, start + offset)
        this.timers.push(
          setTimeout(() => {
            if (this.context === context) onStep(sound.step)
          }, offset * 1000),
        )
        offset += sound.seconds
      }
      this.timers.push(
        setTimeout(() => {
          if (this.context !== context) return
          this.stop()
          onEnd()
        }, offset * 1000),
      )
    } catch (error) {
      if (this.context !== context) return
      this.stop()
      throw error
    }
  }

  stop() {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers = []
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed')
      void context.close().catch(() => {})
  }
}

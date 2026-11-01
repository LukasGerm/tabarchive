export type ScoreDocument = {
  schema: 'tabarchive/score-v1'
  revision: number
  alphaTex: string | null
  status: 'ready' | 'draft' | 'needs-transcription'
  warnings: string[]
  updatedAt: string
  textConversionVersion?: number
}

export type NotePosition = {
  track: number
  staff: number
  bar: number
  voice: number
  beat: number
  note: number
}

export const durationOptions = [
  [1, 'Whole'],
  [2, 'Half'],
  [4, 'Quarter'],
  [8, 'Eighth'],
  [16, 'Sixteenth'],
  [32, 'Thirty-second'],
  [64, 'Sixty-fourth'],
] as const

export function downloadAlphaTex(source: string, title: string) {
  const url = URL.createObjectURL(
    new Blob([source], { type: 'text/plain;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 100) || 'arrangement'}.alphatex`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

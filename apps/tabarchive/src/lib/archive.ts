import { z } from 'zod'

export const formats = [
  'alphatex',
  'guitar-pro',
  'musicxml',
  'text',
  'pdf',
  'link',
] as const
export type TabFormat = (typeof formats)[number]
export const statusLabels = {
  learning: 'Learning',
  familiar: 'Getting there',
  solid: 'In the fingers',
} as const
export type PracticeStatus = keyof typeof statusLabels

export const metadataSchema = z.object({
  title: z.string().trim().min(1, 'Give this arrangement a title.').max(160),
  artist: z.string().trim().max(160).default(''),
  sourceUrl: z
    .union([
      z.literal(''),
      z
        .url()
        .refine(
          (value) => /^https?:\/\//i.test(value),
          'Use an http or https link.',
        ),
    ])
    .default(''),
  attribution: z.string().trim().max(300).default(''),
  tuning: z.string().trim().max(100).default('E A D G B E'),
  capo: z.coerce.number().int().min(0).max(12).default(0),
  notes: z.string().max(10000).default(''),
  status: z.enum(['learning', 'familiar', 'solid']).default('learning'),
})

export type TabMetadata = z.infer<typeof metadataSchema>
export type ArchivedTab = TabMetadata & {
  id: string
  format: TabFormat
  originalName: string | null
  createdAt: string
  lastPlayedAt: string | null
  trashedAt: string | null
}

export function detectFormat(
  filename: string,
): Exclude<TabFormat, 'link'> | null {
  const extension = filename.toLowerCase().split('.').pop()
  if (['gp', 'gp3', 'gp4', 'gp5', 'gpx'].includes(extension ?? ''))
    return 'guitar-pro'
  if (['xml', 'musicxml', 'mxl'].includes(extension ?? '')) return 'musicxml'
  if (['alphatex', 'atex'].includes(extension ?? '')) return 'alphatex'
  if (extension === 'txt') return 'text'
  if (extension === 'pdf') return 'pdf'
  return null
}

export const formatLabels: Record<TabFormat, string> = {
  alphatex: 'alphaTex',
  'guitar-pro': 'Guitar Pro',
  musicxml: 'MusicXML',
  text: 'Text tab',
  pdf: 'PDF',
  link: 'Source link',
}

// Original exercise written for this project, not a transcription of a song.
export const demoTex = String.raw`\title "A little room to play"
\subtitle "An original fingerpicking study"
\artist "Tab Archive"
\tempo 84
.
\ts 4 4
:8 0.6 2.4 0.3 0.2 0.1 0.2 0.3 2.4 |
3.6 0.4 0.3 0.2 3.1 0.2 0.3 0.4 |
3.5 2.4 0.3 1.2 0.1 1.2 0.3 2.4 |
0.5 2.4 2.3 1.2 0.1 1.2 2.3 2.4 |
0.6 2.4 0.3 0.2 3.1 0.2 0.3 2.4 |
3.6 0.4 0.3 0.2 2.1 0.2 0.3 0.4 |
3.5 2.4 0.3 1.2 0.1 1.2 0.3 2.4 |
:4 (0.1 0.2 0.3 2.4 2.5 0.6) r :2 r |
:8 0.6 2.4 0.3 0.2 0.1 0.2 0.3 2.4 |
3.6 0.4 0.3 0.2 3.1 0.2 0.3 0.4 |
3.5 2.4 0.3 1.2 0.1 1.2 0.3 2.4 |
0.5 2.4 2.3 1.2 0.1 1.2 2.3 2.4 |
0.6 2.4 0.3 0.2 3.1 0.2 0.3 2.4 |
3.6 0.4 0.3 0.2 2.1 0.2 0.3 0.4 |
3.5 2.4 0.3 1.2 0.1 1.2 0.3 2.4 |
:1 (0.1 0.2 0.3 2.4 2.5 0.6)`

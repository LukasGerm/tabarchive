import { z } from 'zod'
import { metadataSchema } from './archive'

export const importDocumentSchema = metadataSchema.extend({
  schema: z.literal('tabarchive/v1'),
  format: z.enum(['text', 'alphatex']),
  content: z.string().min(1).max(500000),
})
export type ImportDocument = z.infer<typeof importDocumentSchema>

export function cleanTabText(content: string) {
  // Formatting markers are presentation only. Keep every space and note column.
  return content.replace(/\[\/?(?:tab|ch)\]/gi, '').replace(/\r\n?/g, '\n')
}

export function parsePastedDocument(input: string): ImportDocument | null {
  const stripped = input
    .trim()
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```$/, '')
  if (!stripped.startsWith('{')) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error(
      'This looks like JSON, but it isn’t valid. Paste the complete import document or choose plain text.',
    )
  }
  const result = importDocumentSchema.safeParse(parsed)
  if (!result.success)
    throw new Error(
      `Invalid import document: ${result.error.issues[0]?.message}`,
    )
  return {
    ...result.data,
    content:
      result.data.format === 'text'
        ? cleanTabText(result.data.content)
        : result.data.content,
  }
}

export const aiImportPrompt = `Prepare a tabarchive/v1 JSON import document from the tablature I supply below, or from a public page you are allowed to access. If you cannot access the content, ask me to paste it. Never invent notes, lyrics, rhythms, attribution, or missing sections. Do not turn ASCII tabs into alphaTex: they often lack timing information. Preserve spacing, line breaks, and every note exactly. Remove only Ultimate Guitar [tab] and [ch] formatting markers, retaining their contents. Return JSON (properly escaping newlines and backslashes) with these fields:
{"schema":"tabarchive/v1","title":"Piece title","artist":"Artist","sourceUrl":"https://original-source.example/tab","attribution":"Arranger or source credit if known","tuning":"E A D G B E","capo":0,"format":"text","content":"The complete tab text I supplied"}
Only include material I provide or that you are permitted to reproduce. If any field is unknown, leave strings empty (except title) and do not guess tuning or capo; ask me to confirm them. Preserve any copyright notices in content.

Source / content:
`

export const aiTranscriptionPrompt = `Transcribe the authorized music I supply into alphaTex for alphaTab 1.9. Return raw alphaTex, not JSON or Markdown fences. Preserve every supplied note, string, fret, technique, bar, tuning, capo, repeat, and source credit that can be established. Never invent missing sections. If the source is a public URL you cannot read, ask me to paste its content or supply the file.
ASCII spacing alone does not establish rhythm. If timing or another musical detail is missing, say so in alphaTex // comments and ask me for clarification. If I request a draft, use clearly documented placeholder durations and mark it as unverified in comments. Do not claim that a draft is accurate. Preserve source attribution in comments. I will paste the result in the archive's advanced alphaTex editor, preview it, compare it with the original, and correct it before marking it reviewed.

Source / content:
`

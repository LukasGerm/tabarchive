import { z } from 'zod'
import { importDocumentSchema } from './import-document'

export const importDraftKey = 'tabarchive:import-draft'
export const importDraftSchema = z.object({
  mode: z.enum(['url', 'file', 'text', 'link']),
  source: z.string().max(5000),
  pasted: z.string().max(500000),
  textFormat: z.enum(['text', 'alphatex']),
  preview: importDocumentSchema.nullable(),
  fileName: z.string().max(1000),
  fields: z.object({
    title: z.string().max(160),
    artist: z.string().max(160),
    sourceUrl: z.string().max(5000),
    tuning: z.string().max(100),
    capo: z.string().max(3),
    attribution: z.string().max(300),
    notes: z.string().max(10000),
  }),
})
export type ImportDraft = z.infer<typeof importDraftSchema>
export const emptyImportDraft: ImportDraft = {
  mode: 'url',
  source: '',
  pasted: '',
  textFormat: 'text',
  preview: null,
  fileName: '',
  fields: {
    title: '',
    artist: '',
    sourceUrl: '',
    tuning: 'E A D G B E',
    capo: '0',
    attribution: '',
    notes: '',
  },
}
export const hasImportDraft = (draft: ImportDraft) =>
  Boolean(
    draft.source ||
    draft.pasted ||
    draft.fileName ||
    Object.entries(draft.fields).some(
      ([key, value]) =>
        value !== emptyImportDraft.fields[key as keyof ImportDraft['fields']],
    ),
  )

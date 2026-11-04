import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  rename,
  rm,
} from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { detectFormat, metadataSchema, type ArchivedTab } from '../lib/archive'
import { HttpError } from './http'
import { convertScore } from './convert-score'
import { maxScoreLength, parseScore } from '../lib/score-model'
import type { ScoreDocument } from '../lib/score-document'

export const maxFileSize = 10 * 1024 * 1024
const idSchema = z.uuid()
const root = () => path.resolve(process.env.ARCHIVE_DATA_DIR ?? '.data')
const location = (id: string) => path.join(root(), idSchema.parse(id))

export async function listTabs(
  view: 'active' | 'bin' = 'active',
): Promise<ArchivedTab[]> {
  await mkdir(root(), { recursive: true, mode: 0o700 })
  const entries = await readdir(root(), { withFileTypes: true })
  const tabs = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() && idSchema.safeParse(entry.name).success,
      )
      .map((entry) => getTab(entry.name)),
  )
  return tabs
    .filter((tab) => (view === 'bin' ? Boolean(tab.trashedAt) : !tab.trashedAt))
    .sort((a, b) =>
      (b.trashedAt ?? b.createdAt).localeCompare(a.trashedAt ?? a.createdAt),
    )
}

export async function getTab(id: string): Promise<ArchivedTab> {
  try {
    const tab = JSON.parse(
      await readFile(path.join(location(id), 'metadata.json'), 'utf8'),
    )
    return { ...tab, trashedAt: tab.trashedAt ?? null }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new HttpError(404, 'This arrangement could not be found.')
    throw error
  }
}

export async function getFile(id: string) {
  const tab = await getTab(id)
  if (tab.format === 'link')
    throw new HttpError(404, 'This entry is a source link.')
  return { tab, bytes: await readFile(path.join(location(id), 'original')) }
}

export async function createTab(form: FormData): Promise<ArchivedTab> {
  const metadata = metadataSchema.parse(Object.fromEntries(form.entries()))
  const file = form.get('file')
  const hasFile = file instanceof File && file.size > 0
  const format = hasFile ? detectFormat(file.name) : 'link'
  if (!format)
    throw new HttpError(
      400,
      'Choose a Guitar Pro, MusicXML, alphaTex, TXT, or PDF file.',
    )
  if (!hasFile && !metadata.sourceUrl)
    throw new HttpError(400, 'Add a file or a source link.')
  if (hasFile && file.size > maxFileSize)
    throw new HttpError(413, 'Files must be 10 MB or smaller.')
  if (hasFile && form.get('permission') !== 'confirmed')
    throw new HttpError(
      400,
      'Please confirm that you are allowed to store this file.',
    )
  const id = randomUUID()
  const tab: ArchivedTab = {
    ...metadata,
    id,
    format,
    originalName: hasFile
      ? path
          .basename(file.name)
          .replace(/[\r\n]/g, '')
          .slice(0, 200)
      : null,
    createdAt: new Date().toISOString(),
    lastPlayedAt: null,
    trashedAt: null,
  }
  await mkdir(root(), { recursive: true, mode: 0o700 })
  // Publish the directory only after both files exist; partial imports stay invisible.
  const staging = path.join(root(), `.import-${id}`)
  await mkdir(staging, { mode: 0o700 })
  try {
    const bytes = hasFile ? new Uint8Array(await file.arrayBuffer()) : null
    if (hasFile)
      await writeFile(path.join(staging, 'original'), bytes!, { mode: 0o600 })
    await writeFile(
      path.join(staging, 'metadata.json'),
      JSON.stringify(tab, null, 2),
      { mode: 0o600 },
    )
    await writeFile(
      path.join(staging, 'score.json'),
      JSON.stringify(convertScore(tab, bytes)),
      { mode: 0o600 },
    )
    await rename(staging, location(id))
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
  return tab
}

// Serialize updates/deletes to an entry in this single-process deployment.
const pending = new Map<string, Promise<unknown>>()
async function exclusive<T>(id: string, work: () => Promise<T>): Promise<T> {
  const previous = pending.get(id) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(work)
  pending.set(id, next)
  try {
    return await next
  } finally {
    if (pending.get(id) === next) pending.delete(id)
  }
}

// Patch fields must not inherit creation defaults: an omitted field stays unchanged.
const updateSchema = z
  .object({
    title: metadataSchema.shape.title.optional(),
    artist: metadataSchema.shape.artist.removeDefault().optional(),
    sourceUrl: metadataSchema.shape.sourceUrl.removeDefault().optional(),
    attribution: metadataSchema.shape.attribution.removeDefault().optional(),
    tuning: metadataSchema.shape.tuning.removeDefault().optional(),
    capo: metadataSchema.shape.capo.removeDefault().optional(),
    notes: metadataSchema.shape.notes.removeDefault().optional(),
    notesBase: z.string().max(10000).optional(),
    status: metadataSchema.shape.status.removeDefault().optional(),
    markPlayed: z.boolean().optional(),
    trashed: z.boolean().optional(),
  })
  .strict()
export function updateTab(id: string, input: unknown) {
  return exclusive(id, async () => {
    const { markPlayed, trashed, notesBase, ...metadata } =
      updateSchema.parse(input)
    const current = await getTab(id)
    if (
      metadata.notes !== undefined &&
      notesBase !== undefined &&
      notesBase !== current.notes
    )
      throw new HttpError(
        409,
        'Notes changed in another window. Your draft has been kept.',
      )
    const tab = {
      ...current,
      ...metadata,
      trashedAt:
        trashed === undefined
          ? current.trashedAt
          : trashed
            ? (current.trashedAt ?? new Date().toISOString())
            : null,
      lastPlayedAt: markPlayed
        ? new Date().toISOString()
        : current.lastPlayedAt,
    }
    if (tab.format === 'link' && !tab.sourceUrl)
      throw new HttpError(400, 'A source link is required for this entry.')
    const temporary = path.join(location(id), `metadata-${randomUUID()}.tmp`)
    await writeFile(temporary, JSON.stringify(tab, null, 2), { mode: 0o600 })
    await rename(temporary, path.join(location(id), 'metadata.json'))
    return tab
  })
}

export function trashTab(id: string) {
  return updateTab(id, { trashed: true })
}

async function readScoreDocument(id: string): Promise<ScoreDocument> {
  const tab = await getTab(id)
  let current: ScoreDocument
  try {
    current = JSON.parse(
      await readFile(path.join(location(id), 'score.json'), 'utf8'),
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    // Existing archives migrate lazily without changing their original files.
    const bytes = tab.format === 'link' ? null : (await getFile(id)).bytes
    const document = convertScore(tab, bytes)
    await writeScoreDocument(id, document)
    return document
  }
  // Only untouched drafts can be rebuilt automatically. Keep the old draft as
  // a revision, and never overwrite a score the owner has edited or reviewed.
  if (
    tab.format === 'text' &&
    current.revision === 1 &&
    current.status === 'draft' &&
    !current.textConversionVersion
  ) {
    const converted = convertScore(tab, (await getFile(id)).bytes)
    if (converted.alphaTex) {
      const upgraded = { ...converted, revision: current.revision + 1 }
      await preserveRevision(id, current)
      await writeScoreDocument(id, upgraded)
      return upgraded
    }
  }
  return current
}

async function preserveRevision(id: string, document: ScoreDocument) {
  const history = path.join(location(id), 'revisions')
  await mkdir(history, { recursive: true, mode: 0o700 })
  await writeFile(
    path.join(history, `${document.revision}.json`),
    JSON.stringify(document),
    { mode: 0o600 },
  )
}

async function writeScoreDocument(id: string, document: ScoreDocument) {
  const temporary = path.join(location(id), `score-${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, JSON.stringify(document, null, 2), {
      mode: 0o600,
    })
    await rename(temporary, path.join(location(id), 'score.json'))
  } finally {
    await rm(temporary, { force: true })
  }
}

export function getScoreDocument(id: string) {
  return exclusive(id, () => readScoreDocument(id))
}

const scoreUpdateSchema = z
  .object({
    revision: z.number().int().positive(),
    alphaTex: z.string().min(1).max(maxScoreLength),
    reviewed: z.boolean(),
  })
  .strict()

export function saveScoreDocument(id: string, input: unknown) {
  return exclusive(id, async () => {
    const update = scoreUpdateSchema.parse(input)
    const current = await readScoreDocument(id)
    if (current.revision !== update.revision)
      throw new HttpError(
        409,
        'A newer version has been saved in another tab. Download your edits, then reopen the editor to compare them with the latest version.',
      )
    try {
      parseScore(update.alphaTex)
    } catch (error) {
      throw new HttpError(422, (error as Error).message)
    }
    const document: ScoreDocument = {
      ...current,
      alphaTex: update.alphaTex,
      revision: current.revision + 1,
      status: update.reviewed ? 'ready' : 'draft',
      updatedAt: new Date().toISOString(),
    }
    // Keep prior revisions private. Publishing the new current revision is atomic.
    await preserveRevision(id, current)
    await writeScoreDocument(id, document)
    return document
  })
}

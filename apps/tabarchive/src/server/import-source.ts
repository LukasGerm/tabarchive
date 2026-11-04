import { decodeHTML } from 'entities'
import { z } from 'zod'
import {
  cleanTabText,
  importDocumentSchema,
  type ImportDocument,
} from '../lib/import-document'
import { HttpError, readBody } from './http'

export function validateSourceUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new HttpError(400, 'Enter a valid Ultimate Guitar tab link.')
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'tabs.ultimate-guitar.com' ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/tab\/[a-z0-9-]+\/[a-z0-9-]+-\d+\/?$/i.test(url.pathname)
  ) {
    throw new HttpError(
      400,
      'Direct import currently supports public tabs.ultimate-guitar.com/tab/ links. For other sources, upload a file or paste the tab text.',
    )
  }
  url.search = ''
  url.hash = ''
  return url
}

const sourceSchema = z.object({
  store: z.object({
    page: z.object({
      data: z.object({
        tab: z.object({
          song_name: z.string(),
          artist_name: z.string(),
          type: z.string(),
          version: z.number().optional(),
        }),
        tab_view: z.object({
          blocked: z.unknown().optional(),
          wiki_tab: z
            .object({ content: z.string(), username: z.string().optional() })
            .optional(),
          meta: z
            .object({
              tuning: z.object({ value: z.string() }).optional(),
              capo: z.union([z.number(), z.string()]).optional(),
            })
            .optional(),
        }),
      }),
    }),
  }),
})

export function parseUltimateGuitarPage(
  html: string,
  sourceUrl: string,
): ImportDocument {
  const tag = html.match(
    /<div\b[^>]*\bclass\s*=\s*["'][^"']*\bjs-store\b[^"']*["'][^>]*>/i,
  )?.[0]
  const attribute = tag?.match(/\bdata-content\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  const raw = attribute?.[1] ?? attribute?.[2]
  if (!raw)
    throw new HttpError(
      422,
      'The page did not expose a readable tab. Open it in your browser and use Paste text instead.',
    )
  let data: z.infer<typeof sourceSchema>
  try {
    data = sourceSchema.parse(JSON.parse(decodeHTML(raw)))
  } catch {
    throw new HttpError(
      422,
      'The source page format has changed. Use Paste text to import this arrangement.',
    )
  }
  const { tab, tab_view: view } = data.store.page.data
  if (
    view.blocked ||
    !['Tabs', 'Chords'].includes(tab.type) ||
    !view.wiki_tab?.content.trim()
  ) {
    throw new HttpError(
      422,
      'This page does not offer an accessible text tab. For Guitar Pro files, use an authorized download and upload it here. Protected or unavailable content cannot be fetched.',
    )
  }
  return importDocumentSchema.parse({
    schema: 'tabarchive/v1',
    title: tab.song_name,
    artist: tab.artist_name,
    sourceUrl,
    attribution: [
      view.wiki_tab.username,
      'Ultimate Guitar',
      tab.version ? `version ${tab.version}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    tuning: view.meta?.tuning?.value ?? '',
    capo: Number(view.meta?.capo ?? 0),
    format: 'text',
    content: cleanTabText(view.wiki_tab.content),
  })
}

export async function importSource(sourceUrl: string): Promise<ImportDocument> {
  const url = validateSourceUrl(sourceUrl)
  let response: Response
  try {
    response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept: 'text/html',
        'User-Agent': 'TabArchive/0.1 (owner-initiated personal import)',
      },
    })
  } catch {
    throw new HttpError(
      502,
      'The source could not be reached. Open the page yourself and use Paste text, or try again later.',
    )
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new HttpError(
      422,
      `The source returned HTTP ${response.status}. Open the page in your browser and use Paste text instead. Sign-in pages, redirects, and access checks are not bypassed.`,
    )
  }
  if (!response.headers.get('content-type')?.includes('text/html')) {
    await response.body?.cancel()
    throw new HttpError(
      422,
      'The source did not return a tab page. Try a file upload instead.',
    )
  }
  // Reuse the bounded stream reader, never load arbitrary-size remote pages.
  const body = new Request(url, {
    method: 'POST',
    body: response.body,
    duplex: 'half',
  } as RequestInit)
  const bytes = await readBody(body, 2 * 1024 * 1024)
  return parseUltimateGuitarPage(
    new TextDecoder().decode(bytes),
    url.toString(),
  )
}

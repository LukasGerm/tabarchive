import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createTab,
  trashTab,
  getFile,
  getTab,
  listTabs,
  updateTab,
  getScoreDocument,
  saveScoreDocument,
} from '../src/server/storage'
import {
  isAuthenticated,
  login,
  requireOwner,
  requireSameOrigin,
} from '../src/server/auth'
import { cleanTabText, parsePastedDocument } from '../src/lib/import-document'
import {
  parseUltimateGuitarPage,
  validateSourceUrl,
} from '../src/server/import-source'
import { readBody } from '../src/server/http'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'tabarchive-test-'))
  vi.stubEnv('ARCHIVE_DATA_DIR', directory)
  vi.stubEnv('ARCHIVE_PASSWORD', 'only-for-automated-tests')
  vi.stubEnv(
    'SESSION_SECRET',
    'test-secret-with-at-least-thirty-two-characters',
  )
  vi.stubEnv('APP_ORIGIN', 'https://archive.example')
})
afterEach(async () => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  await rm(directory, { recursive: true, force: true })
})

function request(
  options: { method?: string; cookie?: string; origin?: string } = {},
) {
  return new Request('https://archive.example/api/tabs', {
    method: options.method ?? 'GET',
    headers: {
      origin: options.origin ?? 'https://archive.example',
      cookie: options.cookie ?? '',
    },
  })
}
function form() {
  const data = new FormData()
  data.set('title', 'Original test exercise')
  data.set('artist', 'Test composer')
  data.set('notes', 'Keep the thumb relaxed')
  data.set('status', 'solid')
  data.set('file', new File(['e|--0--2--|\nB|--1--3--|'], 'exercise.txt'))
  data.set('permission', 'confirmed')
  return data
}

describe('private archive storage', () => {
  it('round-trips the original file and metadata without using public paths', async () => {
    const tab = await createTab(form())
    expect((await getFile(tab.id)).bytes.toString()).toBe(
      'e|--0--2--|\nB|--1--3--|',
    )
    expect((await listTabs())[0].title).toBe('Original test exercise')
    expect(await readdir(directory)).toEqual([tab.id])
    await trashTab(tab.id)
    expect(await listTabs()).toEqual([])
    expect((await listTabs('bin'))[0].id).toBe(tab.id)
    expect((await getFile(tab.id)).bytes.toString()).toBe(
      'e|--0--2--|\nB|--1--3--|',
    )
  })
  it('restores all content and revisions, preserves concurrent updates, and supports old metadata', async () => {
    const tab = await createTab(form())
    const legacy = { ...tab, trashedAt: undefined }
    await writeFile(
      path.join(directory, tab.id, 'metadata.json'),
      JSON.stringify(legacy),
    )
    expect((await listTabs())[0].trashedAt).toBeNull()
    const initial = await getScoreDocument(tab.id)
    const saved = await saveScoreDocument(tab.id, {
      revision: 1,
      alphaTex: '. :8 3.2{h} 5.2',
      reviewed: false,
    })
    await Promise.all([
      trashTab(tab.id),
      updateTab(tab.id, { notes: 'Keep this note', markPlayed: true }),
    ])
    const trashed = await getTab(tab.id)
    expect(trashed.trashedAt).toBeTruthy()
    await trashTab(tab.id)
    expect((await getTab(tab.id)).trashedAt).toBe(trashed.trashedAt)
    expect(await listTabs()).toEqual([])
    await updateTab(tab.id, { trashed: false })
    expect(await listTabs('bin')).toEqual([])
    expect(await getTab(tab.id)).toMatchObject({ ...trashed, trashedAt: null })
    expect(await getScoreDocument(tab.id)).toEqual(saved)
    expect(
      JSON.parse(
        await readFile(
          path.join(directory, tab.id, 'revisions/1.json'),
          'utf8',
        ),
      ),
    ).toEqual(initial)
  })
  it('retains unrelated fields when marking played or editing notes', async () => {
    const tab = await createTab(form())
    await updateTab(tab.id, { markPlayed: true })
    await updateTab(tab.id, { notes: 'New note' })
    const updated = await getTab(tab.id)
    expect(updated.status).toBe('solid')
    expect(updated.artist).toBe('Test composer')
    expect(updated.notes).toBe('New note')
    expect(updated.lastPlayedAt).not.toBeNull()
  })
  it('serializes simultaneous updates without losing changes', async () => {
    const tab = await createTab(form())
    await Promise.all([
      updateTab(tab.id, { notes: 'Updated' }),
      updateTab(tab.id, { status: 'familiar' }),
    ])
    expect(await getTab(tab.id)).toMatchObject({
      notes: 'Updated',
      status: 'familiar',
    })
  })
  it('rejects traversal, unsupported files, and incomplete imports', async () => {
    await expect(getFile('../secret')).rejects.toThrow()
    const data = form()
    data.set('file', new File(['<script>'], 'evil.html'))
    await expect(createTab(data)).rejects.toMatchObject({ status: 400 })
    data.delete('file')
    await expect(createTab(data)).rejects.toMatchObject({ status: 400 })
    expect(await readdir(directory)).toEqual([])
  })
})

describe('owner authentication', () => {
  it('requires authentication, validates the password, and issues a hardened cookie', () => {
    expect(() => requireOwner(request())).toThrow('Sign in')
    expect(() => login(request(), 'wrong')).toThrow('wasn’t right')
    const cookie = login(request(), 'only-for-automated-tests')
    expect(cookie).toContain('HttpOnly; SameSite=Strict')
    expect(cookie).toContain('; Secure')
    expect(isAuthenticated(request({ cookie }))).toBe(true)
    expect(
      isAuthenticated(
        request({ cookie: cookie.replace(/session=./, 'session=x') }),
      ),
    ).toBe(false)
  })
  it('rejects cross-origin writes and invalidates sessions after credential rotation', () => {
    const cookie = login(request(), 'only-for-automated-tests')
    expect(() =>
      requireOwner(
        request({ method: 'POST', origin: 'https://evil.example', cookie }),
      ),
    ).toThrow('did not come')
    expect(() =>
      requireSameOrigin(
        new Request('https://archive.example', { method: 'POST' }),
      ),
    ).toThrow()
    vi.stubEnv('ARCHIVE_PASSWORD', 'a-new-owner-password')
    expect(isAuthenticated(request({ cookie }))).toBe(false)
  })
  it('expires sessions and fails closed when secrets are not configured', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'))
    const cookie = login(request(), 'only-for-automated-tests')
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000)
    expect(isAuthenticated(request({ cookie }))).toBe(false)
    vi.stubEnv('SESSION_SECRET', '')
    expect(() => isAuthenticated(request())).toThrow('configure')
  })
})

describe('source imports', () => {
  const url =
    'https://tabs.ultimate-guitar.com/tab/example/original-study-tabs-123'
  function page(blocked = false) {
    const store = {
      store: {
        page: {
          data: {
            tab: {
              song_name: 'Original study',
              artist_name: 'Test composer',
              type: 'Tabs',
              version: 1,
            },
            tab_view: {
              blocked,
              wiki_tab: {
                content: '[tab]e|--0---2--|\r\nB|--1---3--|[/tab]\n[ch]Am[/ch]',
                username: 'Test arranger',
              },
              meta: { tuning: { value: 'E A D G B E' } },
            },
          },
        },
      },
    }
    return `<div data-content="${JSON.stringify(store).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" class="js-store"></div>`
  }
  it('extracts source metadata and preserves tab columns', () => {
    const result = parseUltimateGuitarPage(page(), url)
    expect(result).toMatchObject({
      title: 'Original study',
      sourceUrl: url,
      format: 'text',
    })
    expect(result.attribution).toContain('Test arranger')
    expect(result.content).toBe('e|--0---2--|\nB|--1---3--|\nAm')
  })
  it('rejects private network URLs, alternate ports, credentials, and lookalike hosts', () => {
    for (const source of [
      'http://127.0.0.1/private',
      'https://tabs.ultimate-guitar.com.evil.example/tab/a/b-1',
      'https://tabs.ultimate-guitar.com:444/tab/a/b-1',
      'https://user@tabs.ultimate-guitar.com/tab/a/b-1',
      'file:///etc/passwd',
    ])
      expect(() => validateSourceUrl(source)).toThrow()
    expect(validateSourceUrl(`${url}?tracking=1#section`).toString()).toBe(url)
  })
  it('offers a manual fallback for changed or blocked pages', () => {
    expect(() => parseUltimateGuitarPage('<html>Sign in</html>', url)).toThrow(
      'Paste text',
    )
    expect(() => parseUltimateGuitarPage(page(true), url)).toThrow(
      'accessible text tab',
    )
  })
  it('accepts AI-prepared JSON and removes only source formatting markers', () => {
    const document = {
      schema: 'tabarchive/v1',
      title: 'Original',
      format: 'text',
      content: '[tab]e|--0--|[/tab]\n[ch]C[/ch]',
    }
    expect(
      parsePastedDocument('```json\n' + JSON.stringify(document) + '\n```')
        ?.content,
    ).toBe('e|--0--|\nC')
    expect(parsePastedDocument('e|--0--|')).toBeNull()
    expect(() => parsePastedDocument('{invalid')).toThrow('valid')
    expect(cleanTabText('  e|--0--|\n  B|-----|')).toBe(
      '  e|--0--|\n  B|-----|',
    )
  })
  it('limits streaming request bodies even without Content-Length', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(100))
        controller.close()
      },
    })
    const input = new Request('http://localhost', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit)
    await expect(readBody(input, 10)).rejects.toMatchObject({ status: 413 })
  })
})

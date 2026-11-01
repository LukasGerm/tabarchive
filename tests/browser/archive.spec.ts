import { expect, test } from '@playwright/test'
import { noteTechnique, parseScore } from '../../src/lib/score-model'

test.use({ hasTouch: true })

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page
    .getByLabel('Your password')
    .fill('disposable-browser-test-password')
  await page.getByRole('button', { name: 'Open my archive' }).click()
  await expect(
    page.getByRole('button', { name: 'Add arrangement', exact: true }),
  ).toBeVisible()
}

test('practice sorting remembers the choice, respects filters, and updates after playing', async ({
  page,
}) => {
  await signIn(page)
  const headers = { Origin: 'http://127.0.0.1:3100' }
  async function add(title: string, status = 'learning') {
    const response = await page.request.post('/api/tabs', {
      headers,
      multipart: {
        title,
        artist: 'Rotation studies',
        status,
        permission: 'confirmed',
        file: {
          name: 'study.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('An original practice reminder.'),
        },
      },
    })
    expect(response.ok()).toBe(true)
    return response.json()
  }
  const recent = await add('Cedar study')
  const older = await add('Birch study', 'familiar')
  const unplayed = await add('Aspen study')
  const newImport = await add('Willow study', 'familiar')
  for (const tab of [older, recent]) {
    const response = await page.request.patch(`/api/tabs/${tab.id}`, {
      headers,
      data: { markPlayed: true },
    })
    expect(response.ok()).toBe(true)
  }

  await page.reload()
  const search = page.getByRole('textbox', { name: 'Search arrangements' })
  await search.fill('Rotation studies')
  const titles = page.locator('.piece-row .piece-name strong')
  const sort = page.getByRole('combobox', { name: 'Sort by' })
  await expect(sort).toHaveValue('added')
  await expect(titles).toHaveText([
    newImport.title,
    unplayed.title,
    older.title,
    recent.title,
  ])
  await expect(page.locator('.continue-card')).toContainText(recent.title)

  await sort.selectOption('least-recent')
  await expect(titles).toHaveText([
    unplayed.title,
    newImport.title,
    older.title,
    recent.title,
  ])
  await expect(page.locator('.piece-row').first()).toContainText('Never played')
  await expect(
    page.locator('.piece-row').nth(2).locator('time'),
  ).toHaveAttribute('datetime', /T/)
  await page.getByRole('button', { name: 'Getting there', exact: true }).click()
  await expect(titles).toHaveText([newImport.title, older.title])
  await page.getByRole('button', { name: 'All pieces', exact: true }).click()
  await search.fill('Birch')
  await expect(titles).toHaveText([older.title])
  await search.fill('Rotation studies')
  await sort.selectOption('most-recent')
  await expect(titles).toHaveText([
    recent.title,
    older.title,
    newImport.title,
    unplayed.title,
  ])
  await sort.selectOption('title')
  await expect(titles).toHaveText([
    unplayed.title,
    older.title,
    recent.title,
    newImport.title,
  ])
  await sort.selectOption('least-recent')
  await page.reload()
  await expect(sort).toHaveValue('least-recent')
  await search.fill('Rotation studies')
  await expect(titles).toHaveText([
    unplayed.title,
    newImport.title,
    older.title,
    recent.title,
  ])

  await page.locator('.piece-row').first().click()
  await page.getByRole('button', { name: 'Played today', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(
    'Today’s practice is recorded.',
  )
  await page.getByRole('link', { name: 'Your repertoire', exact: true }).click()
  await expect(sort).toHaveValue('least-recent')
  await expect(titles).toHaveText([
    newImport.title,
    older.title,
    recent.title,
    unplayed.title,
  ])
  await expect(page.locator('.piece-row').last()).toContainText('Last played')
  await expect(page.locator('.continue-card')).toContainText(unplayed.title)

  await page.locator('.arrangements').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: test.info().outputPath('practice-sort-mobile.png'),
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.locator('.arrangements').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: test.info().outputPath('practice-sort-desktop.png'),
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('mobile note controls add, save, reload, and remove hammer-ons and pull-offs', async ({
  page,
}) => {
  await signIn(page)
  const original = '. :8 3.2 5.2 3.2 r r r r r'
  const response = await page.request.post('/api/tabs', {
    headers: { Origin: 'http://127.0.0.1:3100' },
    multipart: {
      title: 'Legato study',
      permission: 'confirmed',
      file: {
        name: 'study.alphatex',
        mimeType: 'text/plain',
        buffer: Buffer.from(original),
      },
    },
  })
  const tab = await response.json()
  await page.goto(`/?tab=${tab.id}`)
  await page.getByRole('button', { name: 'Edit score', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Legato study' })
  await editor
    .getByRole('button', {
      name: 'Bar 1, beat 1, string 2, fret 3',
      exact: true,
    })
    .tap()
  await editor.getByLabel('Technique to next note').selectOption('hammer-on')
  await editor.getByRole('button', { name: 'Apply note', exact: true }).click()
  await editor
    .getByRole('button', {
      name: 'Bar 1, beat 2, string 2, fret 5',
      exact: true,
    })
    .tap()
  await editor.getByLabel('Technique to next note').selectOption('pull-off')
  await editor.getByRole('button', { name: 'Apply note', exact: true }).click()
  await editor.getByRole('button', { name: 'Save score', exact: true }).click()
  await expect(editor.getByRole('status')).toContainText('Saved revision 2')
  const saved = await (
    await page.request.get(`/api/tabs/${tab.id}/score`)
  ).json()
  const notes = parseScore(
    saved.alphaTex,
  ).tracks[0].staves[0].bars[0].voices[0].beats.flatMap((beat) => beat.notes)
  expect(notes.map(noteTechnique)).toEqual(['hammer-on', 'pull-off', 'none'])
  expect(
    await (await page.request.get(`/api/tabs/${tab.id}/file`)).text(),
  ).toBe(original)
  await expect(editor.locator('.notation svg').first()).toBeVisible()
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await page.screenshot({
    path: test.info().outputPath('techniques-mobile.png'),
  })
  const applyBounds = await editor
    .getByRole('button', { name: 'Apply note', exact: true })
    .boundingBox()
  expect(applyBounds!.y + applyBounds!.height).toBeLessThanOrEqual(844)
  await editor.getByRole('button', { name: 'Close editor' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Edit score', exact: true }).click()
  await editor
    .getByRole('button', {
      name: 'Bar 1, beat 2, string 2, fret 5',
      exact: true,
    })
    .tap()
  await expect(editor.getByLabel('Technique to next note')).toHaveValue(
    'pull-off',
  )
  await editor.getByLabel('Technique to next note').selectOption('none')
  await editor.getByRole('button', { name: 'Apply note', exact: true }).click()
  await editor.getByRole('button', { name: 'Save score', exact: true }).click()
  await expect(editor.getByRole('status')).toContainText('Saved revision 3')
  const removed = await (
    await page.request.get(`/api/tabs/${tab.id}/score`)
  ).json()
  expect(
    parseScore(removed.alphaTex)
      .tracks[0].staves[0].bars[0].voices[0].beats.flatMap((beat) => beat.notes)
      .map(noteTechnique),
  ).toEqual(['hammer-on', 'none', 'none'])
})

test('Bin hides an arrangement from repertoire and restores its score, original, and notes', async ({
  page,
}) => {
  await signIn(page)
  const headers = { Origin: 'http://127.0.0.1:3100' }
  const original = '. :8 3.2{h} 5.2'
  const tab = await (
    await page.request.post('/api/tabs', {
      headers,
      multipart: {
        title: 'A study to keep',
        artist: 'Test composer',
        notes: 'Keep the thumb relaxed',
        status: 'familiar',
        permission: 'confirmed',
        file: {
          name: 'study.alphatex',
          mimeType: 'text/plain',
          buffer: Buffer.from(original),
        },
      },
    })
  ).json()
  const saved = await (
    await page.request.put(`/api/tabs/${tab.id}/score`, {
      headers,
      data: { revision: 1, alphaTex: '. :8 5.2{h} 3.2', reviewed: true },
    })
  ).json()
  await page.goto(`/?tab=${tab.id}`)
  await page.getByRole('button', { name: 'Move to Bin', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('moved to the Bin')
  await expect(
    page.locator('.piece-row').filter({ hasText: 'A study to keep' }),
  ).toHaveCount(0)
  await page.getByRole('link', { name: 'Bin', exact: true }).click()
  const item = page.getByRole('article', { name: 'A study to keep' })
  await expect(item).toBeVisible()
  await page.reload()
  await expect(item).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('bin-mobile.png') })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await item.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(item).toHaveCount(0)
  await page
    .getByRole('link', { name: 'Open arrangement', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'A study to keep' }),
  ).toBeVisible()
  await expect(page.getByLabel('Practice notes')).toHaveValue(
    'Keep the thumb relaxed',
  )
  await expect(page.getByLabel('Familiarity')).toHaveValue('familiar')
  expect(
    await (await page.request.get(`/api/tabs/${tab.id}/score`)).json(),
  ).toEqual(saved)
  expect(
    await (await page.request.get(`/api/tabs/${tab.id}/file`)).text(),
  ).toBe(original)
  const bin = await (await page.request.get('/api/tabs?view=bin')).json()
  expect(bin.some((entry: { id: string }) => entry.id === tab.id)).toBe(false)
})

test('mobile owner flow: JSON import, reading, practice updates, and logout', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByLabel('Your password')
    .fill('disposable-browser-test-password')
  await page.getByRole('button', { name: 'Open my archive' }).click()
  await page
    .getByRole('button', { name: 'Add arrangement', exact: true })
    .click()
  await page.getByRole('button', { name: 'Paste text', exact: true }).click()
  const rows = ['e', 'B', 'G', 'D', 'A', 'E']
    .map(
      (string) =>
        `${string}|----0-----12h14-----0-----|-----2-----0-----2-----|`,
    )
    .join('\n')
  await page.getByLabel('Your tab', { exact: true }).fill(
    JSON.stringify({
      schema: 'tabarchive/v1',
      title: 'Original integration study',
      artist: 'Test composer',
      format: 'text',
      content: Array(10).fill(rows).join('\n\n'),
    }),
  )
  await page.getByRole('button', { name: 'Apply import document' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Original integration study',
  )
  await page.getByRole('checkbox').check()
  await page
    .getByRole('button', { name: 'Add to archive', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Original integration study' }),
  ).toBeVisible()
  await expect(
    page.getByText('Transcription draft · needs review'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Show original', exact: true }).click()
  await expect(page.locator('.wrapped').first()).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator('.wrapped')
        .evaluateAll((elements) =>
          elements.every(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        ),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Start autoscroll' }).click()
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 })
    .toBeGreaterThan(15)
  await page.mouse.wheel(0, 100)
  await expect(
    page.getByRole('button', { name: 'Start autoscroll' }),
  ).toBeVisible()
  await page.getByLabel('Practice notes').fill('Remember the transition')
  await page.getByRole('button', { name: 'Save notes', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Notes saved')
  await page.getByLabel('Familiarity').selectOption('solid')
  await expect(page.getByRole('status')).toContainText('Familiarity updated')
  await page.reload()
  await expect(page.getByLabel('Practice notes')).toHaveValue(
    'Remember the transition',
  )
  await expect(page.getByLabel('Familiarity')).toHaveValue('solid')
  const id = new URL(page.url()).searchParams.get('tab')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
  expect((await page.request.get(`/api/tabs/${id}/file`)).status()).toBe(401)
})

test('structured notation prints, supports touch editing, validates and saves with conflict protection', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByLabel('Your password')
    .fill('disposable-browser-test-password')
  await page.getByRole('button', { name: 'Open my archive' }).click()
  await page
    .getByRole('button', { name: 'Add arrangement', exact: true })
    .click()
  await page.getByRole('button', { name: 'Upload a file', exact: true }).click()
  await page.getByLabel('Tab file').setInputFiles({
    name: 'original-study.alphatex',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      '\\title "Original notation test"\n.\n:4 0.6 2.5 2.4 0.3 | 0.6 2.5 2.4 0.3',
    ),
  })
  await page.getByLabel('Title', { exact: true }).fill('Original notation test')
  await page.getByRole('checkbox').check()
  await page
    .getByRole('button', { name: 'Add to archive', exact: true })
    .click()
  await expect(page.locator('.notation svg').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print / PDF' })).toBeEnabled()
  const id = new URL(page.url()).searchParams.get('tab')
  const originalResponse = await page.request.get(`/api/tabs/${id}/file`)
  const original = await originalResponse.text()
  await page.getByRole('button', { name: 'Edit score', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Original notation test' })
  const firstNote = editor.getByRole('button', {
    name: 'Bar 1, beat 1, string 6, fret 0',
    exact: true,
  })
  await expect(firstNote).toBeVisible()
  await firstNote.tap()
  await editor.getByLabel('Fret', { exact: true }).fill('7')
  await editor
    .getByRole('combobox', { name: 'Duration', exact: true })
    .selectOption('8')
  await editor.getByRole('button', { name: 'Apply note', exact: true }).click()
  await expect(
    editor.getByRole('button', {
      name: 'Bar 1, beat 1, string 6, fret 7',
      exact: true,
    }),
  ).toBeVisible()
  await editor.getByRole('button', { name: 'Save score', exact: true }).click()
  await expect(editor.getByRole('status')).toContainText('Saved revision 2')
  const bounds = await editor.boundingBox()
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845)
  const noteButton = await editor
    .getByRole('button', { name: 'Apply note', exact: true })
    .boundingBox()
  expect(noteButton!.y + noteButton!.height).toBeLessThanOrEqual(845)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await page.screenshot({
    path: test.info().outputPath('editor-mobile.png'),
    animations: 'disabled',
  })
  expect(await (await page.request.get(`/api/tabs/${id}/file`)).text()).toBe(
    original,
  )
  const saved = await (await page.request.get(`/api/tabs/${id}/score`)).json()
  expect(saved.alphaTex).toContain('7.6.8')

  await editor.getByText('Advanced: alphaTex', { exact: true }).click()
  await editor.getByLabel('alphaTex source').fill('. invalid !!!')
  await editor
    .getByRole('button', { name: 'Apply alphaTex', exact: true })
    .click()
  await expect(editor.getByRole('alert')).toContainText('Invalid alphaTex')
  await expect(
    editor.getByRole('button', { name: 'Save score', exact: true }),
  ).toBeDisabled()
  await editor.getByRole('button', { name: 'Reset source changes' }).click()

  // Simulate another browser saving while this editor still has revision 2.
  const concurrent = await page.request.put(`/api/tabs/${id}/score`, {
    headers: { Origin: 'http://127.0.0.1:3100' },
    data: { revision: saved.revision, alphaTex: '. :4 9.6', reviewed: true },
  })
  expect(concurrent.ok()).toBe(true)
  await editor.getByLabel('alphaTex source').fill('. :4 5.6')
  await editor
    .getByRole('button', { name: 'Apply alphaTex', exact: true })
    .click()
  await editor.getByRole('button', { name: 'Save score', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('newer version')
  await editor
    .getByRole('button', { name: 'Close editor', exact: true })
    .click()
  await expect(editor.getByText('You have unsaved edits.')).toBeVisible()
  await editor
    .getByRole('button', { name: 'Discard edits', exact: true })
    .click()
  await page.reload()
  await page.getByRole('button', { name: 'Edit score', exact: true }).click()
  await expect(
    editor.getByRole('button', {
      name: 'Bar 1, beat 1, string 6, fret 9',
      exact: true,
    }),
  ).toBeVisible()
  await editor
    .getByRole('button', { name: 'Close editor', exact: true })
    .click()
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Print / PDF' }).click()
  const popup = await popupPromise
  await expect(popup.locator('svg').first()).toBeAttached()
  await popup.close()
})

test('a source awaiting transcription accepts alphaTex and keeps review status across reloads', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByLabel('Your password')
    .fill('disposable-browser-test-password')
  await page.getByRole('button', { name: 'Open my archive' }).click()
  const response = await page.request.post('/api/tabs', {
    headers: { Origin: 'http://127.0.0.1:3100' },
    multipart: {
      title: 'Manual transcription study',
      sourceUrl: 'https://example.com/my-original-study',
    },
  })
  const tab = await response.json()
  await page.goto(`/?tab=${tab.id}`)
  await expect(
    page.getByText('Transcription needed', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Edit score', exact: true }).click()
  const editor = page.getByRole('dialog', {
    name: 'Manual transcription study',
  })
  await editor
    .getByLabel('alphaTex source', { exact: true })
    .fill('. :4 0.6 2.5 3.4 0.3')
  await editor
    .getByRole('button', { name: 'Apply alphaTex', exact: true })
    .click()
  await expect(editor.locator('.note-target').first()).toBeVisible()
  await editor.getByRole('button', { name: 'Save score', exact: true }).click()
  await expect(editor.getByRole('status')).toContainText(
    'Saved revision 2 as a draft',
  )
  await editor.getByRole('button', { name: 'Close editor' }).click()
  await page.reload()
  await expect(
    page.getByText('Transcription draft · needs review'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Edit score', exact: true }).click()
  await editor.getByRole('checkbox').check()
  await editor.getByRole('button', { name: 'Save score', exact: true }).click()
  await expect(editor.getByRole('status')).toContainText('Saved revision 3')
  await editor.getByRole('button', { name: 'Close editor' }).click()
  await page.reload()
  await expect(page.getByText('Editable score', { exact: true })).toBeVisible()
})

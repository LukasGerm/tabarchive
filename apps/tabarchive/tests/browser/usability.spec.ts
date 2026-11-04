import { expect, test, type Page } from '@playwright/test'
import { demoTex } from '../../src/lib/archive'

async function signIn(page: Page) {
  await page.goto('/')
  await page
    .getByLabel('Your password')
    .fill('disposable-browser-test-password')
  await page.getByRole('button', { name: 'Open my archive' }).click()
  await expect(
    page.getByRole('button', { name: 'Add arrangement', exact: true }),
  ).toBeVisible()
}
async function add(page: Page, title: string, content = demoTex) {
  const response = await page.request.post('/api/tabs', {
    headers: { Origin: 'http://127.0.0.1:3100' },
    multipart: {
      title,
      permission: 'confirmed',
      file: {
        name: 'study.alphatex',
        mimeType: 'text/plain',
        buffer: Buffer.from(content),
      },
    },
  })
  expect(response.ok()).toBe(true)
  return response.json()
}
async function openNotes(page: Page) {
  await page.getByRole('button', { name: /Notes & practice/ }).click()
}

test('reader puts the score in view and remembers per-arrangement reading preferences', async ({
  page,
}) => {
  await signIn(page)
  const first = await add(page, 'A little room to play')
  await add(page, 'Another study')
  await page.goto(`/?tab=${first.id}`)
  await page.locator('.notation svg').first().waitFor()
  await expect(
    page.getByRole('textbox', { name: 'Practice notes', exact: true }),
  ).not.toBeVisible()
  expect((await page.locator('.sheet').boundingBox())!.y).toBeLessThan(500)
  await page.getByRole('button', { name: 'Larger notation' }).click()
  await page.getByRole('slider', { name: 'Scroll speed' }).fill('38')
  await page.getByRole('link', { name: 'Your repertoire', exact: true }).click()
  await page.locator('.piece-row').filter({ hasText: 'Another study' }).click()
  await expect(page.getByRole('slider', { name: 'Scroll speed' })).toHaveValue(
    '24',
  )
  await page.goto(`/?tab=${first.id}`)
  await expect(page.getByRole('slider', { name: 'Scroll speed' })).toHaveValue(
    '38',
  )
  await expect(page.locator('.zoom-control')).toContainText('110%')
  await page.reload()
  await expect(page.getByRole('slider', { name: 'Scroll speed' })).toHaveValue(
    '38',
  )
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    await page.locator('.notation svg').first().waitFor()
    await expect(
      page.getByRole('button', { name: 'Start autoscroll' }),
    ).toBeEnabled()
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: test.info().outputPath(`reader-${width}.png`),
    })
  }
})

test('notes survive leaving before autosave, recover after refresh, and retry a failed save', async ({
  page,
}) => {
  await signIn(page)
  const tab = await add(page, 'Draft recovery study')
  await page.goto(`/?tab=${tab.id}`)
  await openNotes(page)
  await page
    .getByRole('textbox', { name: 'Practice notes', exact: true })
    .fill('Keep the thumb relaxed')
  await page.getByRole('link', { name: 'Your repertoire', exact: true }).click()
  await page.route(`**/api/tabs/${tab.id}`, (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Temporarily unavailable' }),
        })
      : route.continue(),
  )
  await page
    .locator('.piece-row')
    .filter({ hasText: 'Draft recovery study' })
    .click()
  await openNotes(page)
  await expect(
    page.getByRole('textbox', { name: 'Practice notes', exact: true }),
  ).toHaveValue('Keep the thumb relaxed')
  await expect(page.getByRole('alert')).toContainText('Temporarily unavailable')
  await page.reload()
  await openNotes(page)
  await expect(
    page.getByRole('textbox', { name: 'Practice notes', exact: true }),
  ).toHaveValue('Keep the thumb relaxed')
  await expect(
    page.getByRole('button', { name: 'Retry saving notes' }),
  ).toBeVisible()
  await page.unroute(`**/api/tabs/${tab.id}`)
  await page.getByRole('button', { name: 'Retry saving notes' }).click()
  await expect(page.locator('#reader-feedback')).toHaveText('Notes saved.')
  expect(
    (await (await page.request.get(`/api/tabs/${tab.id}`)).json()).notes,
  ).toBe('Keep the thumb relaxed')
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`tabarchive:notes-draft:${id}`),
      tab.id,
    ),
  ).toBeNull()
})

test('typing during a save keeps the newer draft and saves it next', async ({
  page,
}) => {
  await signIn(page)
  const tab = await add(page, 'In-flight notes')
  await page.goto(`/?tab=${tab.id}`)
  await openNotes(page)
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let first = true
  await page.route(`**/api/tabs/${tab.id}`, async (route) => {
    if (route.request().method() === 'PATCH' && first) {
      first = false
      await held
    }
    await route.continue()
  })
  await page
    .getByRole('textbox', { name: 'Practice notes', exact: true })
    .fill('First thought')
  await expect(page.locator('#reader-feedback')).toHaveText('Saving notes…')
  await page
    .getByRole('textbox', { name: 'Practice notes', exact: true })
    .fill('First thought, with the important detail')
  release()
  await expect(page.locator('#reader-feedback')).toHaveText('Notes saved.')
  await expect(
    page.getByRole('textbox', { name: 'Practice notes', exact: true }),
  ).toHaveValue('First thought, with the important detail')
  expect(
    (await (await page.request.get(`/api/tabs/${tab.id}`)).json()).notes,
  ).toBe('First thought, with the important detail')
})

test('import drafts preserve details, pasted content, and selected files across method changes and closing', async ({
  page,
}) => {
  await signIn(page)
  await page
    .getByRole('button', { name: 'Add arrangement', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Add an arrangement' })
  await dialog.getByRole('button', { name: 'Upload a file' }).click()
  await dialog.getByLabel('Tab file').setInputFiles({
    name: 'study.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('My practice reminder.'),
  })
  await dialog.getByLabel('Title', { exact: true }).fill('An import to finish')
  await dialog.getByLabel('Artist / composer').fill('Test composer')
  await dialog.getByRole('button', { name: 'Paste text', exact: true }).click()
  await dialog
    .getByRole('textbox', { name: 'Your tab', exact: true })
    .fill('Keep this text too.')
  await dialog.getByRole('button', { name: 'Upload a file' }).click()
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(
    'An import to finish',
  )
  await dialog.getByRole('button', { name: 'Close import' }).click()
  await page
    .getByRole('button', { name: 'Add arrangement', exact: true })
    .click()
  await expect(dialog.locator('.upload-zone strong')).toHaveText('study.txt')
  // A refresh cannot retain a File; restore metadata and clearly ask for it again.
  page.once('dialog', (prompt) => prompt.accept())
  await page.reload()
  await page
    .getByRole('button', { name: 'Add arrangement', exact: true })
    .click()
  await expect(dialog.locator('.upload-zone strong')).toHaveText(
    'Choose study.txt again',
  )
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(
    'An import to finish',
  )
  await dialog.getByRole('button', { name: 'Paste text', exact: true }).click()
  await expect(
    dialog.getByRole('textbox', { name: 'Your tab', exact: true }),
  ).toHaveValue('Keep this text too.')
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Add to archive' }).click()
  await expect(
    page.getByRole('heading', { name: 'An import to finish' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('tabarchive:import-draft')),
  ).toBeNull()
})

test('reader restores the selected instrument after reopening', async ({
  page,
}) => {
  await signIn(page)
  const tab = await add(
    page,
    'Two instruments',
    '\\track "Guitar" . :4 0.6 2.5 | 3.4 0.3 \\track "Bass" \\tuning E2 A1 D1 G0 . :4 3.1 2.2 | 0.3 0.4',
  )
  await page.goto(`/?tab=${tab.id}`)
  await expect(page.locator('.score-status')).toContainText('Editable score')
  const instrument = page.getByRole('combobox', { name: 'Instrument' })
  await instrument.selectOption('1')
  await page.getByRole('link', { name: 'Your repertoire', exact: true }).click()
  await page
    .locator('.piece-row')
    .filter({ hasText: 'Two instruments' })
    .click()
  await expect(instrument).toHaveValue('1')
  await page.reload()
  await expect(instrument).toHaveValue('1')
})

test('notes warn before navigation when browser draft storage is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (this === window.localStorage)
        throw new DOMException('Storage unavailable', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await signIn(page)
  const tab = await add(page, 'Storage unavailable')
  await page.goto(`/?tab=${tab.id}`)
  await openNotes(page)
  await page.route(`**/api/tabs/${tab.id}`, (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Offline' }),
        })
      : route.continue(),
  )
  await page
    .getByRole('textbox', { name: 'Practice notes', exact: true })
    .fill('Keep this unsaved note')
  await expect(page.locator('#reader-feedback')).toContainText(
    'Save before leaving',
  )
  const dialog = page.waitForEvent('dialog')
  const navigation = page
    .getByRole('link', { name: 'Your repertoire', exact: true })
    .click()
  await (await dialog).dismiss()
  await navigation
  await expect(page).toHaveURL(new RegExp(tab.id))
  await expect(
    page.getByRole('textbox', { name: 'Practice notes', exact: true }),
  ).toHaveValue('Keep this unsaved note')
})

test('a recovered draft never silently overwrites newer saved notes', async ({
  page,
}) => {
  await signIn(page)
  const tab = await add(page, 'Notes conflict')
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        `tabarchive:notes-draft:${id}`,
        JSON.stringify({ text: 'My unsaved draft', base: '' }),
      ),
    tab.id,
  )
  await page.request.patch(`/api/tabs/${tab.id}`, {
    headers: { Origin: 'http://127.0.0.1:3100' },
    data: { notes: 'Saved in another window' },
  })
  await page.goto(`/?tab=${tab.id}`)
  await openNotes(page)
  await expect(page.locator('#reader-feedback')).toContainText(
    'Saved notes changed elsewhere',
  )
  await expect(
    page.getByRole('textbox', { name: 'Practice notes', exact: true }),
  ).toHaveValue('My unsaved draft')
  await expect(
    page.getByRole('button', { name: 'Save notes', exact: true }),
  ).toHaveCount(0)
  expect(
    (await (await page.request.get(`/api/tabs/${tab.id}`)).json()).notes,
  ).toBe('Saved in another window')
  await page.getByRole('button', { name: 'Use saved notes' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Practice notes', exact: true }),
  ).toHaveValue('Saved in another window')
})

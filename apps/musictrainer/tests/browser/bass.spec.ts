import { expect, test, type Page } from '@playwright/test'
import { bassChordShapes } from '../../src/lib/bass-chord-shapes'
import { chordRoles, roleAtPitch } from '../../src/lib/chord-tones'

const tuning = [28, 33, 38, 43]
const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const selector = (page: Page) =>
  page.getByRole('combobox', { name: 'Instrument', exact: true })

test('switching to bass repairs a guitar-only string, grades sounding pitches, and persists', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Practice settings' }).click()
  await page.getByLabel('Focus string').selectOption('5')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()
  await selector(page).selectOption('bass')
  await expect(page.locator('.string-headings strong')).toHaveText([
    'E',
    'A',
    'D',
    'G',
  ])
  await page.getByRole('button', { name: 'Practice settings' }).click()
  await expect(page.getByLabel('Focus string')).toHaveValue('all')
  await expect(page.getByLabel('Focus string').locator('option')).toHaveText([
    'All four strings',
    '4 · E (low)',
    '3 · A',
    '2 · D',
    '1 · G (high)',
  ])
  await expect(
    page.getByLabel('Octave labels').locator('option').first(),
  ).toHaveText('Note + octave (E1)')
  await page.getByRole('button', { name: 'Close settings' }).click()
  const description = (await page
    .getByRole('img', { name: /^Marked position:/ })
    .getAttribute('aria-label'))!
  const string = 4 - Number(description.match(/string (\d)/)![1])
  const fret = Number(description.match(/fret (\d+)/)?.[1] ?? 0)
  const midi = tuning[string] + fret
  const answer = names[midi % 12] + (Math.floor(midi / 12) - 1)
  await page.getByRole('button', { name: answer, exact: true }).click()
  await expect(page.getByRole('status')).toContainText(`Correct — ${answer}`)
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
  await selector(page).selectOption('guitar')
  await expect(page.locator('.string-headings strong')).toHaveCount(6)
  await expect(page.getByTestId('trainer-completed')).toHaveText('1')
  await selector(page).selectOption('bass')
  await page.reload()
  await expect(selector(page)).toHaveValue('bass')
  await expect(page.locator('.string-headings strong')).toHaveCount(4)
  await expect(page.getByTestId('trainer-completed')).toHaveText('0')
})

test('bass Learn view uses four columns and keyboard navigation stays on the instrument', async ({
  page,
}) => {
  await page.goto('/')
  await selector(page).selectOption('bass')
  await page.getByRole('button', { name: 'Learn fretboard' }).click()
  const board = page.getByRole('table', { name: 'Notes on the fretboard' })
  await expect(board.locator('[data-fret="3"] .fret-marker')).toHaveText([
    'G',
    'C',
    'F',
    'A♯',
  ])
  await expect(board.getByRole('columnheader')).toHaveCount(5)
  await page.getByRole('button', { name: 'Hide notes', exact: true }).click()
  await expect(board.getByRole('button')).toHaveCount(16)
  await board.locator('[data-position="0:3"]').focus()
  await page.keyboard.press('End')
  await expect(board.locator('[data-position="3:3"]')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(board.locator('[data-position="3:3"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    board.getByRole('button', {
      name: 'String 1 (G), fret 3: A♯',
      exact: true,
    }),
  ).toBeFocused()
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    const headings = await board
      .locator('.string-headings strong')
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().x),
      )
    expect(
      headings.every((x, index) => index === 0 || x > headings[index - 1]),
    ).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await page.screenshot({
    path: test.info().outputPath('bass-learn.png'),
    fullPage: true,
  })
  await selector(page).selectOption('guitar')
  await expect(board.getByRole('columnheader')).toHaveCount(7)
  await expect(board.locator('[data-fret="3"] .fret-marker')).toHaveText([
    'G',
    'C',
    'F',
    'A♯',
    'D',
    'G',
  ])
})

test('bass find-a-note grades frets and keeps touch and keyboard targets within four strings', async ({
  page,
}) => {
  await page.goto('/')
  await selector(page).selectOption('bass')
  await page.getByRole('button', { name: 'Find a note', exact: true }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()
  const board = page.getByRole('group', {
    name: /^Find a note on the fretboard/,
  })
  await expect(board.getByRole('button')).toHaveCount(52)
  const description = await page.locator('.exercise-description').innerText()
  const string = 4 - Number(description.match(/String (\d)/)![1])
  const target = await page.locator('.target-note').innerText()
  const fret = (names.indexOf(target) - (tuning[string] % 12) + 12) % 12
  await board.locator('[data-position="3:0"]').focus()
  await page.keyboard.press('ArrowRight')
  await expect(board.locator('[data-position="3:0"]')).toBeFocused()
  await board.locator(`[data-position="${string}:${fret}"]`).click()
  await expect(page.getByRole('status')).toContainText(`Correct — ${target}`)
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
  await page.setViewportSize({ width: 320, height: 568 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  const sizes = await board.getByRole('button').evaluateAll((elements) =>
    elements.map((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })),
  )
  expect(sizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(
    true,
  )
})

test('bass chord recognition, roots, and note roles use complete four-string shapes', async ({
  page,
}) => {
  await page.goto('/')
  await selector(page).selectOption('bass')
  await page.getByRole('button', { name: 'Chord shapes', exact: true }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()
  const description = (await page
    .getByRole('img', { name: /^Chord shape/ })
    .getAttribute('aria-label'))!
  const frets = [
    ...description.matchAll(/string (\d) (muted|open|fret (\d+))/g),
  ].map((match) => (match[2] === 'muted' ? null : Number(match[3] ?? 0)))
  expect(frets).toHaveLength(4)
  const shape = bassChordShapes.find(
    (shape) => JSON.stringify(shape.frets) === JSON.stringify(frets),
  )!
  await page.getByRole('button', { name: shape.name, exact: true }).click()
  await expect(page.getByRole('status')).toContainText(
    `Correct — ${shape.name}`,
  )
  await page.screenshot({
    path: test.info().outputPath('bass-chords.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Chord tones', exact: true }).click()
  const rootBoard = page.getByRole('group', {
    name: /^Find every root in the chord/,
  })
  const shapeName = (
    await page.locator('.exercise-description').innerText()
  ).split(' · ')[0]
  const root = bassChordShapes.find((shape) => shape.name === shapeName)!.root
  for (const button of await rootBoard.getByRole('button').all()) {
    const [string, fret] = (await button.getAttribute('data-position'))!
      .split(':')
      .map(Number)
    if ((tuning[string] + fret) % 12 === root) await button.click()
  }
  await expect(page.getByRole('status')).toContainText('Correct')
  await expect(
    page.getByRole('region', { name: 'Chord breakdown' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Note roles', exact: true }).click()
  const rolesDescription = (await page
    .getByRole('img', { name: /^Chord shape/ })
    .getAttribute('aria-label'))!
  const marked = rolesDescription.match(
    /Marked position: string (\d), (open|fret (\d+))/,
  )!
  const pitch = (tuning[4 - Number(marked[1])] + Number(marked[3] ?? 0)) % 12
  const roleShapeName = (
    await page.locator('.exercise-description').innerText()
  ).split(' · ')[0]
  const roleShape = bassChordShapes.find(
    (shape) => shape.name === roleShapeName,
  )!
  const role = roleAtPitch(roleShape, pitch)
  await page
    .getByRole('button', {
      name: `${chordRoles[role].label} · ${role}`,
      exact: true,
    })
    .click()
  await expect(page.getByRole('status')).toContainText('Correct')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('3/3')
  await selector(page).selectOption('guitar')
  await expect(page.locator('.string-headings strong')).toHaveCount(6)
  await expect(page.getByRole('img', { name: /^Chord shape/ })).toBeVisible()
})

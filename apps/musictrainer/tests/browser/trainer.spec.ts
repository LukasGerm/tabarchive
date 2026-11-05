import { expect, test, type Page } from '@playwright/test'
import { chordShapes } from '../../src/lib/chord-shapes'
import {
  chordRoles,
  chordToneShapes,
  foundationQualities,
  roleAtPitch,
  type ChordRole,
} from '../../src/lib/chord-tones'
import { chordPositions, pitchAt } from '../../src/lib/trainer'

test.use({ hasTouch: true })

const tuning = [4, 9, 2, 7, 11, 4]
const noteNames = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
]
const flatNames = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

async function openTrainer(page: Page) {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiRequests.push(request.url())
  })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Music Trainer' }),
  ).toBeVisible()
  await expect(page.getByLabel('Your password')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Name a note', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(apiRequests).toEqual([])
  expect(await page.context().cookies()).toEqual([])
}

async function capture(page: Page, name: string) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await page.screenshot({
    path: test.info().outputPath(name),
    fullPage: true,
    animations: 'disabled',
  })
}

test('learning shows landmark notes and spelling on mobile and desktop', async ({
  page,
}) => {
  await openTrainer(page)
  await page.getByRole('button', { name: 'Learn fretboard' }).click()
  const board = page.getByRole('table', { name: 'Notes on the fretboard' })
  const expected = [
    [3, ['G', 'C', 'F', 'A♯', 'D', 'G']],
    [5, ['A', 'D', 'G', 'C', 'E', 'A']],
    [7, ['B', 'E', 'A', 'D', 'F♯', 'B']],
    [9, ['C♯', 'F♯', 'B', 'E', 'G♯', 'C♯']],
  ] as const
  await expect(board.locator('.study-active-row')).toHaveCount(4)
  for (const [fret, names] of expected) {
    await expect(
      board.locator(`[data-fret="${fret}"] .fret-marker`),
    ).toHaveText([...names])
  }
  await expect(board.locator('[data-fret="4"] .fret-marker')).toHaveCount(0)
  await expect(page.getByLabel('Session progress')).toHaveCount(0)
  await page
    .locator('.study-controls')
    .getByRole('combobox', { name: 'Note names', exact: true })
    .selectOption('flats')
  await expect(board.locator('[data-fret="3"] .fret-marker')).toHaveText([
    'G',
    'C',
    'F',
    'B♭',
    'D',
    'G',
  ])
  await expect(board.locator('[data-fret="9"] .fret-marker')).toHaveText([
    'D♭',
    'G♭',
    'B',
    'E',
    'A♭',
    'D♭',
  ])
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await capture(page, `trainer-learn-${viewport.width}.png`)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    for (const row of await board.locator('.study-active-row').all()) {
      expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
  }
  await page.getByRole('button', { name: 'Focus fret 7', exact: true }).click()
  await expect(board.locator('.study-active-row')).toHaveCount(1)
  await expect(board.locator('[data-fret="7"] .fret-marker')).toHaveText([
    'B',
    'E',
    'A',
    'D',
    'G♭',
    'B',
  ])
  await page.getByRole('button', { name: 'All 0–12' }).click()
  await expect(board.locator('.fret-marker')).toHaveCount(78)
  for (const fret of [0, 12]) {
    await expect(
      board.locator(`[data-fret="${fret}"] .fret-marker`),
    ).toHaveText(['E', 'A', 'D', 'G', 'B', 'E'])
  }
  await page.setViewportSize({ width: 320, height: 568 })
  await capture(page, 'trainer-learn-all-mobile.png')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('learning plays each pressed note in its instrument and string octave', async ({
  page,
}) => {
  await openTrainer(page)
  const oscillators = await page.evaluateHandle(() => {
    const notes: OscillatorNode[] = []
    const createOscillator = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      const oscillator = createOscillator.call(this)
      notes.push(oscillator)
      return oscillator
    }
    return notes
  })
  const playedNotes = () =>
    oscillators.evaluate((notes) =>
      notes.map((note) =>
        Math.round(69 + 12 * Math.log2(note.frequency.value / 440)),
      ),
    )

  await page.getByRole('button', { name: 'Learn fretboard' }).click()
  const board = page.getByRole('table', { name: 'Notes on the fretboard' })
  const lowG = board.getByRole('button', {
    name: 'String 6 (E), fret 3: G',
    exact: true,
  })
  await lowG.focus()
  expect(await playedNotes()).toEqual([])
  await lowG.tap()
  await expect.poll(playedNotes).toEqual([43])
  await lowG.press('End')
  await page.keyboard.press('Enter')
  await expect.poll(playedNotes).toEqual([43, 67])

  await page.getByRole('combobox', { name: 'Instrument' }).selectOption('bass')
  await page.getByRole('button', { name: 'All 0–12' }).click()
  await page.getByRole('button', { name: 'Hide notes', exact: true }).click()
  await board
    .getByRole('button', { name: 'String 4 (E), open: hidden note' })
    .tap()
  await expect.poll(playedNotes).toEqual([43, 67, 28])
  await expect(
    board.getByRole('button', { name: 'String 4 (E), open: E' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('learning supports recall by touch and keyboard without changing quiz progress', async ({
  page,
}) => {
  await openTrainer(page)
  await page.getByRole('button', { name: 'Start practice' }).click()
  await page.getByRole('button', { name: 'Show answer', exact: true }).click()
  await page.getByRole('button', { name: 'Next question' }).click()
  const question = await page
    .getByRole('img', { name: /^Marked position:/ })
    .getAttribute('aria-label')
  await page.getByRole('button', { name: 'Learn fretboard' }).click()
  await page.getByRole('button', { name: 'Hide notes', exact: true }).click()
  const board = page.getByRole('table', { name: 'Notes on the fretboard' })
  await expect(board.getByRole('button')).toHaveCount(24)
  await expect(board.locator('.fret-marker')).toHaveText(Array(24).fill('?'))
  const first = board.getByRole('button', {
    name: 'String 6 (E), fret 3: hidden note',
    exact: true,
  })
  await first.tap()
  await expect(
    board.getByRole('button', { name: 'String 6 (E), fret 3: G', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await board.locator('[data-position="0:3"]').focus()
  await page.keyboard.press('ArrowDown')
  await expect(board.locator('[data-position="0:5"]')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(
    board.getByRole('button', { name: 'String 5 (A), fret 5: D', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Space')
  await expect(
    board.getByRole('button', {
      name: 'String 5 (A), fret 5: hidden note',
      exact: true,
    }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Hide again' }).click()
  await expect(board.locator('.fret-marker')).toHaveText(Array(24).fill('?'))
  await page.getByRole('button', { name: 'Focus fret 9', exact: true }).click()
  await expect(board.getByRole('button')).toHaveCount(6)
  await expect(board.locator('button[tabindex="0"]')).toHaveAttribute(
    'data-position',
    '0:9',
  )
  await page.getByRole('button', { name: 'Show all notes' }).click()
  await expect(board.locator('[data-fret="9"] .fret-marker')).toHaveText([
    'C♯',
    'F♯',
    'B',
    'E',
    'G♯',
    'C♯',
  ])
  await page.getByRole('button', { name: 'Name a note', exact: true }).click()
  await expect(
    page.getByRole('img', { name: /^Marked position:/ }),
  ).toHaveAttribute('aria-label', question!)
  await expect(page.getByTestId('trainer-completed')).toHaveText('1')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/1')
  await expect(
    page.getByRole('button', { name: 'Show answer', exact: true }),
  ).toBeVisible()
})

test('short phone screens keep frets readable and answers clear of the response', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 680 })
  await openTrainer(page)
  await page.getByRole('button', { name: 'Start practice' }).click()
  for (const viewport of [
    { width: 402, height: 680 },
    { width: 360, height: 640 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    for (const range of ['Frets 0 to 12', 'Frets 12 to 24']) {
      await page.getByRole('button', { name: range, exact: true }).click()
      await capture(page, `trainer-short-${viewport.width}-${range}.png`)
      const response = (await page.locator('.trainer-response').boundingBox())!
      const choices = page.getByRole('group', { name: 'Answer choices' })
      for (const button of await choices.getByRole('button').all()) {
        const bounds = (await button.boundingBox())!
        expect(bounds.height).toBeGreaterThanOrEqual(44)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(response.y)
      }
      const rows = await page
        .locator('[data-fret]')
        .evaluateAll((frets) =>
          frets.map((fret) => fret.getBoundingClientRect().height),
        )
      expect(Math.min(...rows)).toBeGreaterThanOrEqual(28)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await page.getByRole('button', { name: 'Show answer' }).click()
      const feedback = (await page.getByRole('status').boundingBox())!
      const lastChoice = (await choices
        .getByRole('button')
        .last()
        .boundingBox())!
      expect(lastChoice.y + lastChoice.height).toBeLessThanOrEqual(feedback.y)
      await page.getByRole('button', { name: 'Next question' }).click()
      await expect(page.locator('#trainer-prompt')).toBeInViewport({ ratio: 1 })
    }
  }
})

test('full-neck note naming puts five answers below the board on phones and reaches fret 24', async ({
  page,
}) => {
  await openTrainer(page)
  await expect(
    page.getByRole('button', { name: 'Frets 0 to 12', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Start practice' }).click()
  const choices = page.getByRole('group', { name: 'Answer choices' })
  await expect(choices.getByRole('button')).toHaveCount(5)
  await expect(page.locator('[data-fret="12"]')).toBeVisible()
  await expect(page.locator('.marked-note')).toHaveCount(1)
  async function answer() {
    const description = (await page
      .getByRole('img', { name: /^Marked position:/ })
      .getAttribute('aria-label'))!
    const string = 6 - Number(description.match(/string (\d)/)![1])
    const fret = Number(description.match(/fret (\d+)/)?.[1] ?? 0)
    const midi = [40, 45, 50, 55, 59, 64][string] + fret
    return noteNames[midi % 12] + (Math.floor(midi / 12) - 1)
  }
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport)
    const board = (await page.locator('.trainer-fretboard').boundingBox())!
    const options = (await choices.boundingBox())!
    expect(options.y).toBeGreaterThanOrEqual(board.y + board.height)
    for (const button of await choices.getByRole('button').all()) {
      const bounds = (await button.boundingBox())!
      expect(bounds.y).toBe(options.y)
      expect(bounds.width).toBeGreaterThanOrEqual(44)
      expect(bounds.height).toBeGreaterThanOrEqual(48)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    if (viewport.height < 844)
      await choices.evaluate((row) => row.scrollIntoView({ block: 'center' }))
    await expect(choices).toBeInViewport({ ratio: 1 })
    await capture(page, `trainer-name-${viewport.width}.png`)
  }
  await choices.getByRole('button', { name: await answer(), exact: true }).tap()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
  await page
    .getByRole('button', { name: 'Frets 12 to 24', exact: true })
    .click()
  await expect(page.locator('[data-fret="24"]')).toBeVisible()
  await expect(page.locator('[data-fret="0"]')).toHaveCount(0)
  await expect(page.locator('.exercise-description')).toContainText(
    /fret (1[2-9]|2[0-4])/,
  )
  const correct = await answer()
  const wrong = (await choices.getByRole('button').allTextContents()).find(
    (label) => label !== correct,
  )!
  await choices.getByRole('button', { name: wrong, exact: true }).tap()
  await expect(page.getByRole('status')).toContainText('Not quite')
  await choices.getByRole('button', { name: correct, exact: true }).tap()
  await expect(page.getByRole('status')).toContainText(
    `Correct — ${correct}`.replace('Correct', 'You found it'),
  )
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/2')
  await page.getByRole('button', { name: 'Next question' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(page, 'trainer-upper-frets.png')
  await page.getByRole('button', { name: 'Practice settings' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Practice settings' }),
  ).toBeVisible()
  await capture(page, 'trainer-settings-mobile.png')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Practice settings' }),
  ).toBeFocused()
})

test('mobile note practice supports touch, keyboard, retries, remembered settings, and session-only progress', async ({
  page,
}) => {
  await openTrainer(page)
  const trainerRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      trainerRequests.push(request.url())
  })
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }))
  await page
    .getByRole('button', { name: 'Practice settings', exact: true })
    .click()
  await page.getByLabel('Focus string').selectOption('0')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.getByRole('button', { name: 'Find a note', exact: true }).click()
  await page.getByRole('button', { name: 'Frets 0 to 5', exact: true }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()
  const target = await page.locator('.target-note').innerText()
  const correctFret = (noteNames.indexOf(target) - 4 + 12) % 12
  expect(correctFret).toBeLessThanOrEqual(5)
  await page.locator('[data-position="0:0"]').focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[data-position="0:1"]')).toBeFocused()
  await page.locator(`[data-position="0:${correctFret}"]`).tap()
  await expect(page.getByRole('status')).toContainText(`Correct — ${target}`)
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
  await expect(page.getByTestId('trainer-streak')).toHaveText('1')
  await capture(page, 'trainer-mobile.png')
  await page.getByRole('button', { name: 'Next question' }).click()
  await expect(page.locator('#trainer-prompt')).toBeInViewport({ ratio: 1 })
  await page.locator('[data-position="1:0"]').tap()
  await expect(page.getByRole('status')).toContainText('Use string 6')
  await page.getByRole('button', { name: 'Show answer' }).click()
  await expect(page.getByTestId('trainer-completed')).toHaveText('2')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/2')
  await expect(page.getByTestId('trainer-streak')).toHaveText('0')

  await page.getByRole('button', { name: 'Name a note', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice settings', exact: true })
    .click()
  await page.getByLabel('Octave labels').selectOption('false')
  await page.getByLabel('Note set').selectOption('all')
  await page.getByLabel('Note names').selectOption('flats')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.getByRole('button', { name: 'Frets 0 to 12', exact: true }).click()
  const position = (await page
    .getByRole('img', { name: /^Marked position:/ })
    .getAttribute('aria-label'))!
  const fret = Number(position.match(/fret (\d+)/)?.[1] ?? 0)
  const answer = flatNames[(4 + fret) % 12]
  await page
    .getByRole('group', { name: 'Answer choices' })
    .getByRole('button', { name: answer, exact: true })
    .tap()
  await expect(page.getByRole('status')).toContainText(`Correct — ${answer}`)
  await expect(page.getByTestId('trainer-first-try')).toHaveText('2/3')
  expect(trainerRequests).toEqual([])
  const after = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }))
  const preferences = JSON.parse(after.local['musictrainer:settings'])
  expect(preferences).toMatchObject({
    string: 0,
    spelling: 'flats',
    octaves: false,
  })
  delete after.local['musictrainer:settings']
  delete storage.local['musictrainer:settings']
  expect(after).toEqual(storage)

  await page.reload()
  await expect(page.getByTestId('trainer-completed')).toHaveText('0')
  await expect(
    page.getByRole('button', { name: 'Start practice' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Start practice' }).click()
  await page.getByRole('button', { name: 'Show answer' }).click()
  await page.getByRole('button', { name: 'Reset session' }).click()
  await expect(page.getByTestId('trainer-completed')).toHaveText('0')
  await expect(
    page.getByRole('button', { name: 'Start practice' }),
  ).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('trainer-completed')).toHaveText('0')
})

test('diminished and added-tone shapes can be practiced, revealed, and answered', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await openTrainer(page)
  await page.getByRole('button', { name: 'Chord shapes', exact: true }).click()
  await expect(
    page
      .getByRole('group', { name: 'Chord collection' })
      .getByRole('button', { name: 'All', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  for (const id of [
    'ddim-open',
    'cdim7-movable',
    'cadd9-open',
    'cadd11-open',
    'amadd11-open',
  ]) {
    const index = chordShapes.findIndex((shape) => shape.id === id)
    const shape = chordShapes[index]
    // A fresh session has no previous question to exclude from this pool.
    await page.evaluate(
      (value) => {
        Math.random = () => value
      },
      (index + 0.5) / chordShapes.length,
    )
    await page.getByRole('button', { name: 'Start practice' }).click()
    const diagram = page.getByRole('img', { name: /^Chord shape,/ })
    for (const [string, fret] of shape.frets.entries()) {
      await expect(diagram).toHaveAttribute(
        'aria-label',
        new RegExp(
          `string ${6 - string} ${fret === null ? 'muted' : fret === 0 ? 'open' : `fret ${fret}`}`,
        ),
      )
    }
    const choices = page.getByRole('group', { name: 'Answer choices' })
    await expect(choices.getByRole('button')).toHaveCount(4)
    if (shape.quality === 'dim7') {
      await page.getByRole('button', { name: 'Show answer' }).click()
      await expect(page.getByTestId('trainer-first-try')).toHaveText('0/1')
    } else {
      await choices.getByRole('button', { name: shape.name, exact: true }).tap()
      await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
    }
    await expect(page.getByRole('status')).toContainText(shape.name)
    await expect(page.getByRole('status')).toContainText(
      `Chord tones: ${shape.tones}.`,
    )
    for (const button of await choices.getByRole('button').all()) {
      const bounds = (await button.boundingBox())!
      for (const content of await button.locator('span, svg').all()) {
        const contentBounds = (await content.boundingBox())!
        expect(contentBounds.x).toBeGreaterThanOrEqual(bounds.x)
        expect(contentBounds.x + contentBounds.width).toBeLessThanOrEqual(
          bounds.x + bounds.width,
        )
      }
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await capture(page, `trainer-${id}.png`)
    await page.getByRole('button', { name: 'Reset session' }).click()
  }
})

test('root practice finds every root, teaches inversions, and supports touch and keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await openTrainer(page)
  await page.getByRole('button', { name: 'Chord tones', exact: true }).click()
  const pool = chordToneShapes.filter((shape) =>
    foundationQualities.includes(shape.quality),
  )
  await page.evaluate(
    (value) => {
      Math.random = () => value
    },
    (pool.findIndex((shape) => shape.id === 'c-over-e') + 0.5) / pool.length,
  )
  await page.getByRole('button', { name: 'Start practice' }).click()
  await expect(page.locator('.exercise-description')).toContainText('C/E')
  await expect(
    page.getByRole('region', { name: 'Chord breakdown' }),
  ).toHaveCount(0)
  await expect(page.locator('.labeled-tone')).toHaveCount(0)
  await expect(page.locator('button.fret-cell')).toHaveCount(6)
  await capture(page, 'trainer-roots-question-320.png')
  await page.locator('[data-position="0:0"]').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-position="1:3"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('1 of 2 found')
  await expect(page.getByTestId('trainer-completed')).toHaveText('0')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('1 of 2 found')
  await page.locator('[data-position="0:0"]').tap()
  await expect(page.getByRole('status')).toContainText('E is the major third')
  await page.locator('[data-position="4:1"]').tap()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/1')
  await expect(page.locator('.labeled-tone')).toHaveCount(6)
  await expect(
    page.getByRole('region', { name: 'Chord breakdown' }),
  ).toContainText('C is the root; E is the lowest sounding note')
  const sizes = await page.locator('button.fret-cell').evaluateAll((cells) =>
    cells.map((cell) => ({
      width: cell.getBoundingClientRect().width,
      height: cell.getBoundingClientRect().height,
    })),
  )
  expect(sizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(
    true,
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await capture(page, 'trainer-roots-inversion-320.png')
  await page.getByRole('button', { name: 'Next question' }).click()
  await expect(page.locator('.labeled-tone')).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Chord breakdown' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Show answer' }).click()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/2')
  await expect(
    page.getByRole('region', { name: 'Chord breakdown' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Note roles', exact: true }).click()
  await expect(
    page.getByRole('group', { name: 'Answer choices' }).getByRole('button'),
  ).toHaveCount(4)
  await expect(page.locator('.labeled-tone')).toHaveCount(0)
  await page.getByRole('button', { name: 'Name a note', exact: true }).click()
  await expect(
    page.getByRole('group', { name: 'Chord tone exercise' }),
  ).toHaveCount(0)
})

async function selectRoleQuestion(
  page: Page,
  shapeId: string,
  role: ChordRole,
  fullVocabulary = false,
) {
  const shapes = chordToneShapes.filter(
    (shape) => fullVocabulary || foundationQualities.includes(shape.quality),
  )
  const candidates = shapes.flatMap((shape) =>
    [
      ...new Set(
        chordPositions(shape).map((position) =>
          roleAtPitch(shape, pitchAt(position)),
        ),
      ),
    ].map((role) => ({ shape, role })),
  )
  const index = candidates.findIndex(
    (candidate) => candidate.shape.id === shapeId && candidate.role === role,
  )
  expect(index).toBeGreaterThanOrEqual(0)
  await page.evaluate(
    (value) => {
      Math.random = () => value
    },
    (index + 0.5) / candidates.length,
  )
  await page.getByRole('button', { name: 'Start practice' }).click()
}

test('note roles distinguish sevenths, explain semitones, and reveal every chord tone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await openTrainer(page)
  await page.getByRole('button', { name: 'Chord tones', exact: true }).click()
  await page.getByRole('button', { name: 'Note roles', exact: true }).click()
  for (const [id, role, distance] of [
    ['c7-open', '♭7', 10],
    ['cmaj7-open', '7', 11],
  ] as const) {
    await selectRoleQuestion(page, id, role)
    await expect(page.locator('.marked-note')).toHaveCount(1)
    await expect(page.locator('.marked-note .fret-marker')).toHaveCSS(
      'background-color',
      'rgb(182, 95, 71)',
    )
    await expect(page.locator('.labeled-tone')).toHaveCount(0)
    await capture(page, `trainer-role-question-${id}-320.png`)
    await expect(
      page.getByRole('img', { name: /^Chord shape,/ }),
    ).not.toHaveAttribute('aria-label', /Roles:/)
    const choices = page.getByRole('group', { name: 'Answer choices' })
    await choices
      .getByRole('button', {
        name: role === '♭7' ? 'Major seventh · 7' : 'Minor seventh · ♭7',
        exact: true,
      })
      .tap()
    await expect(page.getByRole('status')).toContainText('Not quite')
    await choices
      .getByRole('button', {
        name: `${chordRoles[role].label} · ${role}`,
        exact: true,
      })
      .tap()
    await expect(page.getByRole('status')).toContainText(
      `${distance} semitones`,
    )
    await expect(page.getByRole('status')).toContainText('not seven frets')
    await expect(
      page.getByRole('region', { name: 'Chord breakdown' }),
    ).toContainText(role === '♭7' ? 'B♭' : 'B')
    if (role === '♭7')
      await expect(
        page.getByRole('region', { name: 'Chord breakdown' }),
      ).toContainText('omitted')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await capture(page, `trainer-role-${id}-320.png`)
    await page.getByRole('button', { name: 'Reset session' }).click()
  }
  await page
    .getByRole('button', { name: 'Practice settings', exact: true })
    .click()
  await page.getByLabel('Chord vocabulary').selectOption('all')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await selectRoleQuestion(page, 'cdim7-movable', '♭♭7', true)
  await expect(page.locator('.exercise-description')).toContainText(
    'Full vocabulary',
  )
  await page.getByRole('button', { name: 'Show answer' }).click()
  await expect(page.getByRole('status')).toContainText(
    'B♭♭ is the diminished seventh',
  )
  await expect(
    page.getByRole('region', { name: 'Chord breakdown' }),
  ).toContainText('Diminished seventh · ♭♭7')
  await capture(page, 'trainer-diminished-role-320.png')
  await page.setViewportSize({ width: 1280, height: 900 })
  await capture(page, 'trainer-roles-desktop.png')
})

test('chord diagrams are answerable without leaking the name and fit mobile and desktop', async ({
  page,
}) => {
  await openTrainer(page)
  await page.getByRole('button', { name: 'Chord shapes', exact: true }).click()
  await page
    .getByRole('group', { name: 'Chord collection' })
    .getByRole('button', { name: 'Movable', exact: true })
    .click()
  await page.getByRole('button', { name: 'Start practice' }).click()
  const description = (await page
    .getByRole('img', { name: /^Chord shape,/ })
    .getAttribute('aria-label'))!
  expect(description).not.toMatch(/major|minor|dim|aug|add|sus/)
  const pitches = [
    ...new Set(
      [...description.matchAll(/string (\d) (muted|open|fret (\d+))/g)].flatMap(
        ([, string, kind, fret]) =>
          kind === 'muted'
            ? []
            : [(tuning[6 - Number(string)] + Number(fret ?? 0)) % 12],
      ),
    ),
  ]
  const harmonies = chordShapes
    .filter((shape) => {
      const expected = [
        ...new Set(
          shape.frets.flatMap((fret, string) =>
            fret === null ? [] : [(tuning[string] + fret) % 12],
          ),
        ),
      ]
      return (
        pitches.length === expected.length &&
        expected.every((pitch) => pitches.includes(pitch))
      )
    })
    .map((shape) => shape.name)
  const choices = page.getByRole('group', { name: 'Answer choices' })
  const answers = (await choices.getByRole('button').allTextContents()).filter(
    (name) => harmonies.includes(name),
  )
  expect(answers).toHaveLength(1)
  await expect(choices.locator('.correct-choice')).toHaveCount(0)
  await choices.getByRole('button', { name: answers[0], exact: true }).tap()
  await expect(page.getByRole('status')).toContainText('Chord tones:')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
  await capture(page, 'trainer-chord-mobile.png')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await capture(page, 'trainer-desktop.png')
  await page.setViewportSize({ width: 320, height: 740 })
  await page.getByRole('button', { name: 'Find a note', exact: true }).click()
  const cells = await page.locator('button.fret-cell').evaluateAll((buttons) =>
    buttons.map((button) => ({
      width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height,
    })),
  )
  expect(cells.length).toBeGreaterThan(0)
  expect(cells.every(({ width, height }) => width >= 44 && height >= 44)).toBe(
    true,
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await capture(page, 'trainer-narrow.png')
})

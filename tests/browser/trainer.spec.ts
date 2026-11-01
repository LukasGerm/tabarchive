import { expect, test, type Page } from '@playwright/test'

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

async function signIn(page: Page) {
  await page.goto('/?view=trainer')
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Fretboard trainer' }),
  ).toHaveCount(0)
  await page
    .getByLabel('Your password')
    .fill('disposable-browser-test-password')
  await page.getByRole('button', { name: 'Open my archive' }).click()
  await expect(
    page.getByRole('heading', { name: 'Fretboard trainer' }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Back to repertoire', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.site-header')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Name a note', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
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

test('short phone screens keep frets readable and answers clear of the response', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 680 })
  await signIn(page)
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

test('full-neck note naming keeps five answers alongside the board and reaches fret 24', async ({
  page,
}) => {
  await signIn(page)
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
    expect(options.x).toBeGreaterThanOrEqual(board.x + board.width)
    expect(board.y + board.height).toBeLessThanOrEqual(viewport.height)
    expect(options.y + options.height).toBeLessThanOrEqual(viewport.height)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    if (viewport.height >= 844) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= window.innerHeight,
        ),
      ).toBe(true)
    }
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

test('mobile note practice supports touch, keyboard, retries, and session-only progress', async ({
  page,
}) => {
  await signIn(page)
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
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    })),
  ).toEqual(storage)

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
  await page
    .getByRole('link', { name: 'Back to repertoire', exact: true })
    .click()
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }),
  ).toBeVisible()
  await expect(page.locator('.site-header')).toBeVisible()
  await page.getByRole('link', { name: 'Trainer', exact: true }).click()
  await expect(page.getByTestId('trainer-completed')).toHaveText('0')
})

test('chord diagrams are answerable without leaking the name and fit mobile and desktop', async ({
  page,
}) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Chord shapes', exact: true }).click()
  await page
    .getByRole('group', { name: 'Chord collection' })
    .getByRole('button', { name: 'Barre', exact: true })
    .click()
  await page.getByRole('button', { name: 'Start practice' }).click()
  const description = (await page
    .getByRole('img', { name: /^Chord shape,/ })
    .getAttribute('aria-label'))!
  expect(description).not.toMatch(/major|minor/)
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
  const harmonies = ['major', 'minor'].flatMap((quality) =>
    Array.from({ length: 12 }, (_, root) => root).flatMap((root) => {
      const expected = [
        root,
        (root + (quality === 'minor' ? 3 : 4)) % 12,
        (root + 7) % 12,
      ]
      return pitches.length === 3 &&
        expected.every((pitch) => pitches.includes(pitch))
        ? [`${root === 10 ? 'B♭' : noteNames[root]} ${quality}`]
        : []
    }),
  )
  expect(harmonies).toHaveLength(1)
  const choices = page.getByRole('group', { name: 'Answer choices' })
  await expect(choices.locator('.correct-choice')).toHaveCount(0)
  await choices.getByRole('button', { name: harmonies[0], exact: true }).tap()
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

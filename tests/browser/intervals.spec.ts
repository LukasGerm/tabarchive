import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    intervalAudioTrace: {
      contexts: AudioContext[]
      tones: { frequency: number; time: number }[]
    }
  }
}

async function startIntervals(page: Page) {
  await page.addInitScript(() => {
    window.intervalAudioTrace = { contexts: [], tones: [] }
    const NativeAudioContext = window.AudioContext
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        window.intervalAudioTrace.contexts.push(this)
      }
      createOscillator() {
        const oscillator = super.createOscillator()
        const setFrequency = oscillator.frequency.setValueAtTime.bind(
          oscillator.frequency,
        )
        oscillator.frequency.setValueAtTime = (
          frequency: number,
          time: number,
        ) => {
          window.intervalAudioTrace.tones.push({ frequency, time })
          return setFrequency(frequency, time)
        }
        return oscillator
      }
    }
    Math.random = () => 0
  })
  await page.goto('/?view=trainer')
  await page
    .getByLabel('Your password')
    .fill('disposable-browser-test-password')
  await page.getByRole('button', { name: 'Open my archive' }).click()
  await page.getByRole('button', { name: 'Intervals', exact: true }).click()
}

async function expectAudioStopped(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.intervalAudioTrace.contexts.every(
          (context) => context.state === 'closed',
        ),
      ),
    )
    .toBe(true)
}

test('note reading supports retries, reveals, keyboard answers, settings, and mobile layouts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await startIntervals(page)
  await expect(page.getByRole('group', { name: 'Fret range' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Start practice' }).click()
  await expect(
    page.getByRole('group', { name: 'Interval notes', exact: true }),
  ).toContainText('C3')
  await expect(
    page.getByRole('group', { name: 'Interval notes', exact: true }),
  ).toContainText('E♭3')
  await expect(
    page.getByRole('region', { name: 'Interval explanation' }),
  ).toHaveCount(0)
  const choices = page.getByRole('group', { name: 'Answer choices' })
  await choices
    .getByRole('button', { name: 'Major third', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Not quite')
  await expect(page.getByTestId('trainer-completed')).toHaveText('0')
  await choices
    .getByRole('button', { name: 'Minor third', exact: true })
    .click()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/1')
  await expect(
    page.getByRole('region', { name: 'Interval explanation' }),
  ).toContainText('3 frets apart')
  await page.getByRole('button', { name: 'Next question' }).click()
  await choices
    .getByRole('button', { name: 'Minor third', exact: true })
    .focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/2')
  await expect(page.getByTestId('trainer-streak')).toHaveText('1')
  await page
    .getByRole('combobox', { name: 'Intervals', exact: true })
    .selectOption('all')
  await expect(choices.getByRole('button')).toHaveCount(13)
  await page.getByRole('button', { name: 'Show answer', exact: true }).click()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/3')
  await expect(page.getByTestId('trainer-streak')).toHaveText('0')
  await expect(
    page.getByRole('region', { name: 'Interval explanation' }),
  ).toContainText('Perfect unison')
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    for (const button of await choices.getByRole('button').all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({
      path: test.info().outputPath(`intervals-review-${width}.png`),
      fullPage: true,
    })
  }
  await page.getByRole('button', { name: 'Practice settings' }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'Intervals · learn the distance',
  )
  await expect(
    page.getByRole('combobox', { name: 'Focus string' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to practice' }).click()
  await page.getByRole('button', { name: 'Harmony', exact: true }).click()
  await expect(page.getByTestId('trainer-completed')).toHaveText('3')
  await page.getByRole('button', { name: 'Intervals', exact: true }).click()
  await expect(choices.getByRole('button')).toHaveCount(13)
  await page.getByRole('button', { name: 'Reset session' }).click()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/0')
  await expect(
    page.getByRole('button', { name: 'Start practice' }),
  ).toBeVisible()
})

test('ear training hides notes, plays the quiz pitches in every direction, and closes audio on transitions', async ({
  page,
}) => {
  await startIntervals(page)
  await page.getByRole('button', { name: 'By ear', exact: true }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()
  const hiddenNotes = page.getByRole('group', {
    name: 'Hidden notes — identify by ear',
  })
  await expect(hiddenNotes).not.toContainText('C3')
  await expect(hiddenNotes).not.toContainText('E♭3')
  expect(
    await page.evaluate(() => window.intervalAudioTrace.contexts.length),
  ).toBe(0)
  for (const direction of ['ascending', 'descending', 'harmonic']) {
    if (direction !== 'ascending')
      await page
        .getByRole('combobox', { name: 'Playback', exact: true })
        .selectOption(direction)
    await page.evaluate(() => {
      window.intervalAudioTrace.tones = []
    })
    await page
      .getByRole('button', { name: 'Play interval', exact: true })
      .click()
    await expect
      .poll(() => page.evaluate(() => window.intervalAudioTrace.tones.length))
      .toBe(2)
    const tones = await page.evaluate(() => window.intervalAudioTrace.tones)
    const midi = tones.map(({ frequency }) =>
      Math.round(69 + 12 * Math.log2(frequency / 440)),
    )
    expect(midi[1] - midi[0]).toBe(direction === 'descending' ? -3 : 3)
    expect(tones[1].time - tones[0].time).toBeCloseTo(
      direction === 'harmonic' ? 0 : 0.8,
    )
    await expect(
      page.getByRole('button', { name: 'Stop playback' }),
    ).toBeVisible()
    if (direction === 'ascending') {
      await page.getByRole('button', { name: 'Stop playback' }).click()
      await expectAudioStopped(page)
      await page.getByRole('button', { name: 'Play interval' }).click()
    }
  }
  await page.getByRole('button', { name: 'Minor third', exact: true }).click()
  await expectAudioStopped(page)
  await expect(
    page.getByRole('group', { name: 'Interval notes', exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
  await page.getByRole('button', { name: 'Play interval' }).click()
  await page.getByRole('button', { name: 'Next question' }).click()
  await expectAudioStopped(page)
  await expect(hiddenNotes).toBeVisible()
  await page.getByRole('button', { name: 'Play interval' }).click()
  await page.getByRole('button', { name: 'Reset session' }).click()
  await expectAudioStopped(page)
  await page.getByRole('button', { name: 'Start practice' }).click()
  await page.getByRole('button', { name: 'Play interval' }).click()
  await page.getByRole('button', { name: 'Show answer' }).click()
  await expectAudioStopped(page)
  await page.getByRole('button', { name: 'Play interval' }).click()
  await page.getByRole('button', { name: 'Name a note', exact: true }).click()
  await expectAudioStopped(page)
  await page.getByRole('button', { name: 'Intervals', exact: true }).click()
  await page.getByRole('button', { name: 'Play interval' }).click()
  await page.getByRole('link', { name: 'Back to repertoire' }).click()
  await expectAudioStopped(page)
})

test('unavailable audio gives a useful recovery path to visual practice', async ({
  page,
}) => {
  await startIntervals(page)
  await page.evaluate(() => {
    window.AudioContext = class {
      constructor() {
        throw new Error('Audio unavailable')
      }
    } as unknown as typeof AudioContext
  })
  await page.getByRole('button', { name: 'By ear', exact: true }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()
  await page.getByRole('button', { name: 'Play interval' }).click()
  await expect(page.getByRole('alert')).toContainText('choose Read notes')
  await page.getByRole('button', { name: 'Read notes', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(
    page.getByRole('group', { name: 'Interval notes', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Minor third', exact: true }).click()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
})

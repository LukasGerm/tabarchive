import { expect, test, type Page } from '@playwright/test'

type AudioTrace = {
  contexts: AudioContext[]
  analysers: AnalyserNode[]
  tones: { frequency: number; time: number }[]
}
declare global {
  interface Window {
    harmonyAudioTrace: AudioTrace
  }
}

test.use({ hasTouch: true })

async function startHarmony(page: Page) {
  await page.addInitScript(() => {
    window.harmonyAudioTrace = { contexts: [], analysers: [], tones: [] }
    const NativeAudioContext = window.AudioContext
    window.AudioContext = class extends NativeAudioContext {
      private analyser: AnalyserNode
      constructor(options?: AudioContextOptions) {
        super(options)
        this.analyser = super.createAnalyser()
        window.harmonyAudioTrace.contexts.push(this)
        window.harmonyAudioTrace.analysers.push(this.analyser)
      }
      createGain() {
        const gain = super.createGain()
        // Observe the real-time signal without changing the speaker connection.
        gain.connect(this.analyser)
        return gain
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
          window.harmonyAudioTrace.tones.push({ frequency, time })
          return setFrequency(frequency, time)
        }
        return oscillator
      }
    }
  })
  await page.goto('/?view=trainer')
  await page
    .getByLabel('Your password')
    .fill('disposable-browser-test-password')
  await page.getByRole('button', { name: 'Open my archive' }).click()
  await page.getByRole('button', { name: 'Harmony', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Major key', exact: true }),
  ).toHaveValue('C')
  await expect(
    page.getByRole('combobox', { name: 'Chord type', exact: true }),
  ).toHaveValue('triads')
  await expect(
    page.getByRole('combobox', { name: 'Recall', exact: true }),
  ).toHaveValue('mixed')
  await page
    .getByRole('combobox', { name: 'Recall', exact: true })
    .selectOption('name')
}

async function capture(page: Page, name: string) {
  await expect
    .poll(() => page.evaluate(() => document.fonts.status))
    .toBe('loaded')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: test.info().outputPath(name),
    fullPage: true,
    animations: 'disabled',
  })
}

test('key chords teach scale stacking, play on demand, and retain scores across exercises', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await startHarmony(page)
  await page.evaluate(() => {
    Math.random = () => 0.2
  })
  await page.getByRole('button', { name: 'Start practice' }).click()
  await expect(
    page.getByRole('heading', { name: 'Which chord is ii in C major?' }),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Harmony explanation' }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(() => window.harmonyAudioTrace.contexts.length),
  ).toBe(0)
  await capture(page, 'harmony-key-question-320.png')
  await page
    .getByRole('button', { name: 'Play major scale', exact: true })
    .tap()
  await expect
    .poll(() => page.evaluate(() => window.harmonyAudioTrace.tones.length))
    .toBe(8)
  expect(
    await page.evaluate(() => window.harmonyAudioTrace.contexts[0].state),
  ).toBe('running')
  const sessionType = await page.evaluate(
    () =>
      (navigator as Navigator & { audioSession?: { type: string } })
        .audioSession?.type,
  )
  // WebKit exposes the native iOS session API; Chromium may not implement it.
  if (sessionType !== undefined) expect(sessionType).toBe('playback')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const analyser = window.harmonyAudioTrace.analysers[0]
        const samples = new Float32Array(analyser.fftSize)
        analyser.getFloatTimeDomainData(samples)
        return Math.sqrt(
          samples.reduce((sum, sample) => sum + sample * sample, 0) /
            samples.length,
        )
      }),
    )
    .toBeGreaterThan(0.005)
  const notes = await page.evaluate(() =>
    window.harmonyAudioTrace.tones.map(({ frequency }) =>
      Math.round(69 + 12 * Math.log2(frequency / 440)),
    ),
  )
  expect(notes).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
  await page.getByRole('button', { name: 'Stop playback', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => window.harmonyAudioTrace.contexts[0].state))
    .toBe('closed')
  await page.getByLabel('Chord name', { exact: true }).fill('Dm')
  await page.getByRole('button', { name: 'Check answer', exact: true }).tap()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
  await expect(
    page.getByRole('region', { name: 'Harmony explanation' }),
  ).toContainText('D · F · A')
  await expect(
    page
      .getByRole('list', { name: 'Chords in this key' })
      .getByRole('listitem'),
  ).toHaveCount(7)
  await page
    .getByRole('button', { name: 'Play answer chord', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Stop playback', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Major key', exact: true })
    .selectOption('F♯')
  await expect(
    page.getByRole('heading', { name: 'Which chord is ii in F♯ major?' }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.harmonyAudioTrace.contexts.map((context) => context.state),
      ),
    )
    .toEqual(['closed', 'closed'])
  await expect(page.getByRole('list', { name: 'F♯ major scale' })).toHaveCount(
    0,
  )
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
  await page.getByRole('button', { name: 'Show answer', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('G♯m')
  await expect(
    page.getByRole('list', { name: 'F♯ major scale' }),
  ).toContainText('E♯')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/2')
  await capture(page, 'harmony-key-answer-320.png')
  await page.getByRole('button', { name: 'Name a note', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Fret range' })).toBeVisible()
  await expect(page.getByTestId('trainer-completed')).toHaveText('2')
})

test('functions compare the tonic and target, explain retries, and stop audio on navigation', async ({
  page,
}) => {
  await startHarmony(page)
  await page
    .getByRole('button', { name: 'Chord functions', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Chord type', exact: true })
    .selectOption('sevenths')
  await page.evaluate(() => {
    Math.random = () => 0.65
  })
  await page.getByRole('button', { name: 'Start practice' }).click()
  await expect(
    page.getByRole('heading', { name: 'What is G7’s function in C major?' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Play tonic → chord', exact: true })
    .tap()
  await expect
    .poll(() => page.evaluate(() => window.harmonyAudioTrace.tones.length))
    .toBe(10)
  const choices = page.getByRole('group', { name: 'Answer choices' })
  await expect(choices.getByRole('button')).toHaveCount(3)
  await choices.getByRole('button', { name: 'Predominant', exact: true }).tap()
  await expect(page.getByRole('status')).toContainText('Not quite')
  await choices.getByRole('button', { name: 'Dominant', exact: true }).tap()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/1')
  await expect(
    page.getByRole('region', { name: 'Harmony explanation' }),
  ).toContainText('G7 (V7) has dominant function')
  await expect
    .poll(() => page.evaluate(() => window.harmonyAudioTrace.contexts[0].state))
    .toBe('closed')
  await capture(page, 'harmony-functions-mobile.png')
  await page
    .getByRole('button', { name: 'Play tonic → chord', exact: true })
    .tap()
  await page.getByRole('button', { name: 'Chord tones', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.harmonyAudioTrace.contexts.every(
          (context) => context.state === 'closed',
        ),
      ),
    )
    .toBe(true)
  await expect(
    page.getByRole('group', { name: 'Chord tone exercise' }),
  ).toBeVisible()
})

test('recall hides the scale and choices, counts hints, and returns an unaided review after two questions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await startHarmony(page)
  await page.evaluate(() => {
    Math.random = () => 0
  })
  await page.getByRole('button', { name: 'Start practice' }).click()
  await expect(
    page.getByRole('heading', { name: 'Which chord is I in C major?' }),
  ).toBeVisible()
  await expect(page.getByRole('list', { name: 'C major scale' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Answer choices' })).toHaveCount(
    0,
  )
  await expect(
    page.getByRole('list', { name: 'Chords in this key' }),
  ).toHaveCount(0)
  await expect(page.getByLabel('Chord name', { exact: true })).toHaveValue('')
  await expect(
    page.getByRole('button', { name: 'Check answer' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Give me a hint' }).click()
  await expect(
    page.getByRole('complementary', { name: 'Practice hint' }),
  ).toContainText('assisted practice')
  await expect(page.getByRole('list', { name: 'C major scale' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show scale', exact: true }).click()
  await expect(page.getByRole('list', { name: 'C major scale' })).toBeVisible()
  await page.getByLabel('Chord name', { exact: true }).fill('C')
  await page.getByLabel('Chord name', { exact: true }).press('Enter')
  await expect(page.getByRole('status')).toContainText('With help')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/1')
  await expect(page.getByTestId('trainer-streak')).toHaveText('0')
  await expect(page.locator('.harmony-review-count')).toContainText(
    '1 recall check',
  )
  for (const answer of ['Dm', 'Em']) {
    await page.getByRole('button', { name: 'Next question' }).click()
    await expect(page.getByRole('list', { name: 'C major scale' })).toHaveCount(
      0,
    )
    await expect(
      page.getByRole('complementary', { name: 'Practice hint' }),
    ).toHaveCount(0)
    await expect(page.getByLabel('Chord name', { exact: true })).toHaveValue('')
    await page.getByLabel('Chord name', { exact: true }).fill(answer)
    await page.getByLabel('Chord name', { exact: true }).press('Enter')
    await expect(page.getByRole('status')).toContainText(`Correct — ${answer}`)
  }
  await page.getByRole('button', { name: 'Next question' }).click()
  await expect(
    page.getByRole('heading', { name: 'Which chord is I in C major?' }),
  ).toBeVisible()
  await expect(page.locator('.exercise-description')).toContainText(
    'Recall check',
  )
  await expect(page.getByRole('list', { name: 'C major scale' })).toHaveCount(0)
  await capture(page, 'harmony-recall-check-320.png')
  await page.getByLabel('Chord name', { exact: true }).fill('C major')
  await page.getByLabel('Chord name', { exact: true }).press('Enter')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('3/4')
  await expect(page.locator('.harmony-review-count')).toHaveCount(0)
  await page.getByRole('button', { name: 'Reset session' }).click()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/0')
  await expect(
    page.getByRole('button', { name: 'Start practice' }),
  ).toBeVisible()
})

test('reverse recall distinguishes IV from vi and chord spelling requires every tone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await startHarmony(page)
  await page
    .getByRole('combobox', { name: 'Recall', exact: true })
    .selectOption('numeral')
  await page.evaluate(() => {
    Math.random = () => 0.8
  })
  await page.getByRole('button', { name: 'Start practice' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Which Roman numeral is Am in C major?',
    }),
  ).toBeVisible()
  await expect(page.locator('.harmony-target')).not.toContainText('vi')
  await page.getByLabel('Roman numeral', { exact: true }).fill('iv')
  await page.getByLabel('Roman numeral', { exact: true }).press('Enter')
  await expect(page.getByRole('status')).toContainText(
    'iv is minor four; vi is minor six',
  )
  await page.getByLabel('Roman numeral', { exact: true }).fill('vi')
  await page.getByLabel('Roman numeral', { exact: true }).press('Enter')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/1')
  await page
    .getByRole('combobox', { name: 'Recall', exact: true })
    .selectOption('notes')
  await expect(
    page.getByRole('heading', { name: 'What notes make Am in C major?' }),
  ).toBeVisible()
  await expect(page.getByRole('list', { name: 'C major scale' })).toHaveCount(0)
  await page.getByLabel('Chord notes', { exact: true }).fill('A C')
  await page.getByLabel('Chord notes', { exact: true }).press('Enter')
  await expect(page.getByRole('status')).toContainText('Check every chord tone')
  await page.getByLabel('Chord notes', { exact: true }).fill('e, c, a')
  await page.getByLabel('Chord notes', { exact: true }).press('Enter')
  await expect(
    page.getByRole('region', { name: 'Harmony explanation' }),
  ).toContainText('C is a minor third (3 semitones)')
  await expect(page.getByTestId('trainer-first-try')).toHaveText('0/2')
  await capture(page, 'harmony-spelling-review-320.png')
  await page.setViewportSize({ width: 1280, height: 900 })
  await capture(page, 'harmony-spelling-review-desktop.png')
})

test('guided progressions keep the missing chord silent and explain the completed voice leading', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await startHarmony(page)
  await page
    .getByRole('button', { name: 'Complete a progression', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Chord type', exact: true })
    .selectOption('sevenths')
  await page.evaluate(() => {
    Math.random = () => 0.1
  })
  await page.getByRole('button', { name: 'Start practice' }).click()
  await expect(
    page.getByRole('heading', { name: 'Complete the ii7–V7–Imaj7 pattern.' }),
  ).toBeVisible()
  const progression = page.getByRole('list', {
    name: 'Progression',
    exact: true,
  })
  await expect(progression).toContainText('Dm7')
  await expect(progression).toContainText('G7')
  await expect(progression).toContainText('?')
  await expect(progression).not.toContainText('Cmaj7')
  await capture(page, 'harmony-progression-gap-320.png')
  await page
    .getByRole('button', { name: 'Play with the gap', exact: true })
    .tap()
  await expect
    .poll(() => page.evaluate(() => window.harmonyAudioTrace.tones.length))
    .toBe(10)
  const timings = await page.evaluate(() => [
    ...new Set(window.harmonyAudioTrace.tones.map((tone) => tone.time)),
  ])
  expect(timings).toHaveLength(2)
  expect(timings[1] - timings[0]).toBeCloseTo(1.15, 3)
  await expect(
    page.getByRole('button', { name: 'Stop playback', exact: true }),
  ).toBeHidden({ timeout: 6000 })
  await expect
    .poll(() => page.evaluate(() => window.harmonyAudioTrace.contexts[0].state))
    .toBe('closed')
  await page.getByLabel('Chord name', { exact: true }).fill('Cmaj7')
  await page.getByRole('button', { name: 'Check answer', exact: true }).tap()
  await expect(progression).toContainText('Cmaj7')
  await expect(
    page.getByRole('region', { name: 'Harmony explanation' }),
  ).toContainText('F → E')
  await expect(
    page.getByRole('region', { name: 'Harmony explanation' }),
  ).toContainText('B → B')
  await page
    .getByRole('button', { name: 'Play complete progression', exact: true })
    .tap()
  await expect
    .poll(() => page.evaluate(() => window.harmonyAudioTrace.tones.length))
    .toBe(25)
  await page.getByRole('button', { name: 'Stop playback', exact: true }).click()
  await capture(page, 'harmony-progression-answer-320.png')
  await page.setViewportSize({ width: 1280, height: 900 })
  await capture(page, 'harmony-progression-desktop.png')
  await page.getByRole('button', { name: 'Reset session', exact: true }).click()
  await expect(page.getByTestId('trainer-completed')).toHaveText('0')
  await expect(
    page.getByRole('button', { name: 'Start practice' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 320, height: 740 })
  await page
    .getByRole('combobox', { name: 'Major key', exact: true })
    .selectOption('F♯')
  await page.evaluate(() => {
    Math.random = () => 0.3
  })
  await page.getByRole('button', { name: 'Start practice' }).click()
  await page.getByRole('button', { name: 'Show answer' }).click()
  await expect(progression.getByRole('listitem')).toHaveCount(4)
  for (const card of await progression.getByRole('listitem').all()) {
    const bounds = (await card.boundingBox())!
    const text = await card.locator('strong').evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return [...range.getClientRects()].map((rect) => ({
        left: rect.left,
        right: rect.right,
      }))
    })
    expect(
      text.every(
        (rect) =>
          rect.left >= bounds.x && rect.right <= bounds.x + bounds.width,
      ),
    ).toBe(true)
  }
  await capture(page, 'harmony-four-chords-320.png')
  await page.reload()
  await page.getByRole('button', { name: 'Harmony', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Chord type', exact: true }),
  ).toHaveValue('triads')
  await expect(
    page.getByRole('combobox', { name: 'Recall', exact: true }),
  ).toHaveValue('mixed')
  await page
    .getByRole('combobox', { name: 'Recall', exact: true })
    .selectOption('name')
})

test('the audio renderer produces sound, silence for gaps, and no clipped samples', async ({
  page,
}) => {
  await startHarmony(page)
  const measurements = await page.evaluate(async () => {
    const modulePath = '/src/lib/harmony-audio.ts'
    const { scheduleHarmonySound } = await import(modulePath)
    const rate = 24000
    const context = new OfflineAudioContext(1, rate * 4, rate)
    scheduleHarmonySound(
      context,
      { notes: [48, 60, 64, 67], seconds: 1.15, step: 0 },
      0,
    )
    scheduleHarmonySound(context, { notes: [], seconds: 1.15, step: 1 }, 1.15)
    scheduleHarmonySound(
      context,
      { notes: [43, 59, 62, 65, 67], seconds: 1.15, step: 2 },
      2.3,
    )
    const buffer = (await context.startRendering()).getChannelData(0)
    const rms = (start: number, end: number) => {
      const segment = buffer.slice(
        Math.floor(start * rate),
        Math.floor(end * rate),
      )
      return Math.sqrt(
        segment.reduce((sum, value) => sum + value * value, 0) / segment.length,
      )
    }
    return {
      first: rms(0.1, 0.5),
      gap: rms(1.2, 2.2),
      last: rms(2.4, 2.8),
      tail: rms(3.5, 3.9),
      peak: buffer.reduce(
        (maximum, value) => Math.max(maximum, Math.abs(value)),
        0,
      ),
    }
  })
  expect(measurements.first).toBeGreaterThan(0.005)
  expect(measurements.last).toBeGreaterThan(0.005)
  expect(measurements.gap).toBe(0)
  expect(measurements.tail).toBe(0)
  expect(measurements.peak).toBeLessThan(1)
})

test('audio failure leaves the visual quiz usable', async ({ page }) => {
  await startHarmony(page)
  await page.evaluate(() => {
    Math.random = () => 0
    Object.defineProperty(window, 'AudioContext', {
      value: undefined,
      configurable: true,
    })
  })
  await page.getByRole('button', { name: 'Start practice' }).click()
  await page
    .getByRole('button', { name: 'Play major scale', exact: true })
    .tap()
  await expect(page.getByRole('alert')).toContainText('Audio could not start')
  await page.getByLabel('Chord name', { exact: true }).fill('C')
  await page.getByRole('button', { name: 'Check answer', exact: true }).tap()
  await expect(page.getByTestId('trainer-first-try')).toHaveText('1/1')
})

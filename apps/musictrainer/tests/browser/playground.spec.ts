import { expect, test, type Page } from '@playwright/test'

async function openPlayground(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Playground', exact: true }).click()
}
const sequence = (page: Page) =>
  page.getByRole('list', { name: 'Your progression', exact: true })

test('builds, edits, transposes, compares, and saves ideas on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await openPlayground(page)
  await expect(sequence(page).getByRole('listitem')).toHaveCount(4)
  await page
    .getByRole('combobox', { name: 'Key', exact: true })
    .selectOption('7')
  await expect(sequence(page)).toContainText('Em')
  await expect(sequence(page).getByRole('button').first()).toHaveAccessibleName(
    'Chord 1: G, I',
  )
  await page
    .getByRole('button', { name: 'Keep as version A', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Chord type', exact: true })
    .selectOption('sevenths')
  await page
    .getByRole('combobox', { name: 'Beats', exact: true })
    .selectOption('2')
  await expect(sequence(page).getByRole('button').first()).toContainText(
    'Gmaj7',
  )
  await expect(
    page.getByRole('region', { name: 'Compare variations' }),
  ).toContainText('Added: F♯')
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await expect(sequence(page).getByRole('listitem')).toHaveCount(5)
  await page
    .getByRole('button', { name: 'Move chord later', exact: true })
    .click()
  await expect(sequence(page).getByRole('button').nth(2)).toHaveAccessibleName(
    'Chord 3: Gmaj7, Imaj7',
  )
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(sequence(page).getByRole('listitem')).toHaveCount(4)
  await page
    .getByRole('combobox', { name: 'Replace chord', exact: true })
    .selectOption('1')
  await expect(sequence(page).getByRole('button').nth(2)).toContainText('Am')
  await page
    .getByLabel('Progression name', { exact: true })
    .fill('A little idea')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Saved “A little idea”')
  await page.reload()
  await page.getByRole('button', { name: 'Playground', exact: true }).click()
  await expect(sequence(page).getByRole('button').first()).toContainText(
    'Gmaj7',
  )
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Play progression', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: /A little idea G major/ }).click()
  await expect(sequence(page).getByRole('listitem')).toHaveCount(4)
  await page
    .getByRole('combobox', { name: 'Scale', exact: true })
    .selectOption('minor')
  await page
    .getByRole('combobox', { name: 'Key', exact: true })
    .selectOption('9')
  await expect(sequence(page).getByRole('button').first()).toContainText('Am7')
  await page
    .getByRole('combobox', { name: 'Instrument', exact: true })
    .selectOption('bass')
  await expect(
    page.getByRole('region', { name: 'Explore selected chord' }),
  ).toContainText('G · thinnest')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('playground-mobile.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({
    path: test.info().outputPath('playground-desktop.png'),
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Delete A little idea', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: /A little idea G major/ }),
  ).toHaveCount(0)
})

test('turns the selected chord into four linked perspectives without leaking the hidden sequence', async ({
  page,
}) => {
  await openPlayground(page)
  await sequence(page)
    .getByRole('button', { name: 'Chord 2: Am, vi', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Practice my progression', exact: true })
    .click()
  const lesson = page.getByRole('region', { name: 'Practice my progression' })
  await expect(page.getByRole('region', { name: 'Chord palette' })).toHaveCount(
    0,
  )
  await expect(lesson.getByRole('heading')).toHaveText(
    'Which chord is vi in C major?',
  )
  await lesson.getByRole('button', { name: 'C', exact: true }).click()
  await expect(lesson.getByRole('status')).toContainText('Not quite')
  await lesson.getByRole('button', { name: 'Am', exact: true }).click()
  await lesson
    .getByRole('button', { name: 'Next perspective', exact: true })
    .click()
  await expect(lesson.getByRole('heading')).toHaveText(
    'Find A: the root of Am.',
  )
  await lesson
    .getByRole('button', { name: 'String 5 (A), open', exact: true })
    .click()
  await lesson
    .getByRole('button', { name: 'Next perspective', exact: true })
    .click()
  await expect(lesson.getByRole('heading')).toHaveText('A → C: which interval?')
  await lesson.getByRole('button', { name: 'Minor third', exact: true }).click()
  await lesson
    .getByRole('button', { name: 'Next perspective', exact: true })
    .click()
  await expect(
    lesson.getByRole('list', { name: 'Progression with a gap' }),
  ).not.toContainText('Am')
  await lesson.getByRole('button', { name: 'Am', exact: true }).click()
  await expect(
    lesson.getByRole('list', { name: 'Progression with a gap' }),
  ).toContainText('Am')
  await lesson
    .getByRole('button', { name: 'Finish practice', exact: true })
    .click()
  await expect(lesson).toContainText('3 of 4 recalled without help')
  await lesson
    .getByRole('button', { name: 'Back to playing', exact: true })
    .click()
  await expect(sequence(page).getByRole('listitem')).toHaveCount(4)
})

test('plays and loops real audio, stops on edits and navigation, and handles unavailable audio', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.AudioContext
    const trace: { contexts: AudioContext[]; tones: number[] } = {
      contexts: [],
      tones: [],
    }
    ;(window as unknown as { playgroundAudio: typeof trace }).playgroundAudio =
      trace
    window.AudioContext = class extends original {
      constructor() {
        super()
        trace.contexts.push(this)
      }
      createOscillator() {
        const oscillator = super.createOscillator()
        const set = oscillator.frequency.setValueAtTime.bind(
          oscillator.frequency,
        )
        oscillator.frequency.setValueAtTime = (frequency, time) => {
          trace.tones.push(frequency)
          return set(frequency, time)
        }
        return oscillator
      }
    }
  })
  await openPlayground(page)
  const audio = () =>
    page.evaluate(() => {
      const trace = (
        window as unknown as {
          playgroundAudio: { contexts: AudioContext[]; tones: number[] }
        }
      ).playgroundAudio
      return {
        states: trace.contexts.map((context) => context.state),
        tones: trace.tones.length,
      }
    })
  expect((await audio()).states).toEqual([])
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByRole('button', { name: 'Add C (I)', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Beats', exact: true })
    .selectOption('1')
  await page
    .getByRole('combobox', { name: 'Tempo', exact: true })
    .selectOption('200')
  await page
    .getByRole('combobox', { name: 'Sound', exact: true })
    .selectOption('roots')
  await page
    .getByRole('button', { name: 'Play progression', exact: true })
    .click()
  await expect.poll(async () => (await audio()).tones).toBeGreaterThanOrEqual(3)
  expect((await audio()).states).toEqual(['running'])
  await page
    .getByRole('combobox', { name: 'Key', exact: true })
    .selectOption('7')
  await expect.poll(async () => (await audio()).states).toEqual(['closed'])
  await page.getByRole('button', { name: 'Hear chord', exact: true }).click()
  await expect.poll(async () => (await audio()).states.at(-1)).toBe('running')
  await page.getByRole('button', { name: 'Name a note', exact: true }).click()
  await expect
    .poll(async () =>
      (await audio()).states.every((state) => state === 'closed'),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Playground', exact: true }).click()
  await page.evaluate(() =>
    Object.defineProperty(window, 'AudioContext', {
      value: undefined,
      configurable: true,
    }),
  )
  await page
    .getByRole('button', { name: 'Play progression', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('Audio could not start')
  await page.getByRole('button', { name: 'Add Am (ii)', exact: true }).click()
  await expect(sequence(page).getByRole('listitem')).toHaveCount(2)
})

test('survives malformed or unavailable storage and bounds the composition size', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('musictrainer:playground:v1', '{bad json')
  })
  await openPlayground(page)
  await expect(sequence(page).getByRole('listitem')).toHaveCount(4)
  for (let index = 0; index < 12; index++)
    await page.getByRole('button', { name: 'Add C (I)', exact: true }).click()
  await expect(sequence(page).getByRole('listitem')).toHaveCount(16)
  await expect(
    page.getByRole('button', { name: 'Add C (I)', exact: true }),
  ).toBeDisabled()
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Unavailable')
    }
  })
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Browser storage is unavailable',
  )
  await expect(sequence(page).getByRole('listitem')).toHaveCount(15)
})

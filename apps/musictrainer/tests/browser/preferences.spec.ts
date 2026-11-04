import { expect, test } from '@playwright/test'

test('trainer remembers settings across visits and refreshes without preserving session scores', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Practice settings' }).click()
  await page
    .getByRole('combobox', { name: 'Note set', exact: true })
    .selectOption('natural')
  await page
    .getByRole('combobox', { name: 'Note names', exact: true })
    .selectOption('flats')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.getByRole('button', { name: 'Frets 0 to 5', exact: true }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()
  await page.getByRole('button', { name: 'Show answer', exact: true }).click()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Frets 0 to 5', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('trainer-completed')).toHaveText('0')
  await page.reload()
  await page.getByRole('button', { name: 'Practice settings' }).click()
  await expect(
    page.getByRole('combobox', { name: 'Note set', exact: true }),
  ).toHaveValue('natural')
  await expect(
    page.getByRole('combobox', { name: 'Note names', exact: true }),
  ).toHaveValue('flats')
})

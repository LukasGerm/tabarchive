import { expect, test } from '@playwright/test'

test('old trainer bookmarks redirect to the standalone public app', async ({
  request,
}) => {
  const response = await request.get('/?view=trainer', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe(
    'https://musictrainer.lukasgermerott.de',
  )
})

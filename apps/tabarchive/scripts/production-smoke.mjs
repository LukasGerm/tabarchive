import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const directory = await mkdtemp(
  path.join(os.tmpdir(), 'tabarchive-production-'),
)
const base = 'http://127.0.0.1:3101'
const origin = 'https://archive.example'
const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: '3101',
    APP_ORIGIN: origin,
    ARCHIVE_DATA_DIR: directory,
    ARCHIVE_PASSWORD: 'disposable-production-test-password',
    SESSION_SECRET: 'disposable-production-test-secret-more-than-32-characters',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
})
let stderr = ''
server.stderr.on('data', (chunk) => {
  stderr += chunk.toString()
})
try {
  let ready = false
  for (let count = 0; count < 50; count++) {
    if (server.exitCode !== null)
      throw new Error(`Production server exited: ${stderr}`)
    try {
      if ((await fetch(base)).ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert(ready, 'Production server did not become ready')
  assert.equal((await fetch(base + '/api/tabs')).status, 401)
  const login = await fetch(base + '/api/session', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'disposable-production-test-password' }),
  })
  assert.equal(login.status, 200)
  const setCookie = login.headers.get('set-cookie')
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /SameSite=Strict/)
  assert.match(setCookie, /Secure/)
  const headers = { Cookie: setCookie.split(';')[0], Origin: origin }
  const form = new FormData()
  form.set('title', 'Original production exercise')
  form.set('permission', 'confirmed')
  form.set('file', new File(['e|--0--|'], 'exercise.txt'))
  const saved = await fetch(base + '/api/tabs', {
    method: 'POST',
    headers,
    body: form,
  })
  assert.equal(saved.status, 201)
  const tab = await saved.json()
  const file = '/api/tabs/' + tab.id + '/file'
  assert.equal((await fetch(base + file)).status, 401)
  assert.equal((await fetch(base + '/api/tabs/' + tab.id)).status, 401)
  assert.equal(
    (await fetch(base + '/api/import', { method: 'POST' })).status,
    401,
  )
  const response = await fetch(base + file, { headers })
  assert.equal(await response.text(), 'e|--0--|')
  assert.match(response.headers.get('cache-control'), /no-store/)
  const scoreUrl = base + '/api/tabs/' + tab.id + '/score'
  assert.equal((await fetch(scoreUrl)).status, 401)
  assert.equal((await fetch(scoreUrl, { method: 'PUT' })).status, 401)
  const document = await (await fetch(scoreUrl, { headers })).json()
  assert.equal(document.status, 'needs-transcription')
  const edit = {
    revision: document.revision,
    alphaTex: '. :4 0.6 2.5 3.4 4.3',
    reviewed: true,
  }
  const saveScore = (payload, originOverride = origin) =>
    fetch(scoreUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        Origin: originOverride,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  assert.equal((await saveScore(edit, 'https://evil.example')).status, 403)
  assert.equal(
    (await saveScore({ ...edit, alphaTex: '. invalid !!!' })).status,
    422,
  )
  assert.equal((await saveScore(edit)).status, 200)
  assert.equal((await saveScore(edit)).status, 409)
  assert.equal((await (await fetch(scoreUrl, { headers })).json()).revision, 2)
  assert.equal(await (await fetch(base + file, { headers })).text(), 'e|--0--|')
  assert.equal(
    (
      await fetch(base + '/api/tabs/' + tab.id, {
        method: 'DELETE',
        headers: { ...headers, Origin: 'https://evil.example' },
      })
    ).status,
    403,
  )
  assert.equal(
    (await fetch(base + '/api/tabs/' + tab.id, { method: 'DELETE', headers }))
      .status,
    200,
  )
  assert.equal((await fetch(base + file, { headers })).status, 200)
  assert.equal(
    (await (await fetch(base + '/api/tabs', { headers })).json()).length,
    0,
  )
  assert.equal(
    (await (await fetch(base + '/api/tabs?view=bin', { headers })).json())[0]
      .id,
    tab.id,
  )
  assert.equal(
    (
      await fetch(base + '/api/tabs/' + tab.id, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: false }),
      })
    ).status,
    200,
  )
  assert.equal(
    (await (await fetch(base + '/api/tabs', { headers })).json())[0].id,
    tab.id,
  )
  assert.equal(
    (await fetch(base + '/.data/' + tab.id + '/original')).status,
    404,
  )
  assert.equal((await fetch(base + '/.env')).status, 404)
  console.log(
    'Production smoke passed: login, private upload/download, validated score saves, revision conflicts, cache controls, origin checks, Bin and restore, and hidden runtime files.',
  )
} finally {
  server.kill('SIGTERM')
  if (server.exitCode === null)
    await new Promise((resolve) => server.once('exit', resolve))
  await rm(directory, { recursive: true, force: true })
}

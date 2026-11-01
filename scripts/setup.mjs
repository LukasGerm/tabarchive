import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const password = randomBytes(24).toString('base64url')
try {
  await writeFile(
    '.env',
    `ARCHIVE_PASSWORD=${password}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\nAPP_ORIGIN=http://127.0.0.1:3000\nARCHIVE_DATA_DIR=.data\n`,
    { flag: 'wx', mode: 0o600 },
  )
  console.log(
    'Created .env with unique owner credentials. Keep this file private. Set APP_ORIGIN to your HTTPS URL before deploying.',
  )
  if (!process.argv.includes('--quiet'))
    console.log(`Owner password: ${password}`)
} catch (error) {
  if (error.code === 'EEXIST')
    console.log(
      '.env already exists; left it unchanged. Your owner password is in ARCHIVE_PASSWORD.',
    )
  else throw error
}

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { S3Client } from '@aws-sdk/client-s3'
import {
  backupConfiguration,
  createSnapshot,
  uploadAndVerify,
  verifySnapshot,
} from '../scripts/backup'

let directory: string
const id = '12345678-1234-4123-8123-123456789012'
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'tabarchive-backup-test-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

it('backs up trashed arrangements, originals, scores and stable history, excluding unfinished writes', async () => {
  const source = path.join(directory, 'source')
  const target = path.join(directory, 'snapshot')
  await mkdir(path.join(source, id, 'revisions'), { recursive: true })
  await mkdir(path.join(source, '.import-unfinished'))
  await writeFile(
    path.join(source, id, 'metadata.json'),
    JSON.stringify({ id, format: 'text', trashedAt: '2026-11-01' }),
  )
  await writeFile(path.join(source, id, 'original'), 'original exercise')
  await writeFile(
    path.join(source, id, 'score.json'),
    JSON.stringify({ revision: 2, alphaTex: '. 3.2' }),
  )
  await writeFile(path.join(source, id, 'score-in-progress.tmp'), '{')
  await writeFile(
    path.join(source, id, 'revisions', '1.json'),
    JSON.stringify({ revision: 1, alphaTex: '. 2.2' }),
  )
  await writeFile(path.join(source, id, 'revisions', '2.json'), '{') // Concurrent save; must not enter this snapshot.
  const manifest = await createSnapshot(source, target)
  expect(manifest.arrangements).toBe(1)
  expect(Object.keys(manifest.files).sort()).toEqual([
    `${id}/metadata.json`,
    `${id}/original`,
    `${id}/revisions/1.json`,
    `${id}/score.json`,
  ])
  expect(await verifySnapshot(target)).toEqual(manifest)
  expect(await readdir(target)).toHaveLength(2)
  expect(await readFile(path.join(target, id, 'original'), 'utf8')).toBe(
    'original exercise',
  )
  await writeFile(path.join(target, id, 'original'), 'damaged')
  await expect(verifySnapshot(target)).rejects.toThrow('Checksum mismatch')
})

it('fails on missing storage, corrupt committed JSON or symlinked source files', async () => {
  const source = path.join(directory, 'source')
  await expect(
    createSnapshot(source, path.join(directory, 'missing')),
  ).rejects.toThrow()
  await mkdir(path.join(source, id), { recursive: true })
  await writeFile(path.join(source, id, 'metadata.json'), '{')
  await expect(
    createSnapshot(source, path.join(directory, 'corrupt')),
  ).rejects.toThrow()
  await rm(path.join(source, id, 'metadata.json'))
  await writeFile(path.join(directory, 'elsewhere'), '{}')
  await symlink(
    path.join(directory, 'elsewhere'),
    path.join(source, id, 'metadata.json'),
  )
  await expect(
    createSnapshot(source, path.join(directory, 'symlink')),
  ).rejects.toThrow('Not a regular file')
})

it('only reports upload success after downloading and verifying the stored bytes', async () => {
  const file = path.join(directory, 'archive.tar.gz')
  await writeFile(file, 'backup bytes')
  let stored: Buffer
  let corrupt = false
  const send = vi.fn(async (command) => {
    if (command.constructor.name === 'PutObjectCommand') {
      const chunks: Buffer[] = []
      for await (const chunk of command.input.Body) chunks.push(chunk)
      stored = Buffer.concat(chunks)
      expect(command.input.Bucket).toBe('tabarchive')
      expect(command.input.Key).toBe('backups/test.tar.gz')
      return {}
    }
    return { Body: Readable.from([corrupt ? Buffer.from('damaged') : stored]) }
  })
  const client = { send } as unknown as S3Client
  expect(
    (await uploadAndVerify(client, 'tabarchive', 'backups/test.tar.gz', file))
      .bytes,
  ).toBe(12)
  corrupt = true
  await expect(
    uploadAndVerify(client, 'tabarchive', 'backups/test.tar.gz', file),
  ).rejects.toThrow('checksum does not match')
  send.mockRejectedValueOnce(new Error('AccessDenied'))
  await expect(
    uploadAndVerify(client, 'tabarchive', 'backups/test.tar.gz', file),
  ).rejects.toThrow('AccessDenied')
})

it('requires an explicit data directory and HTTPS backup endpoint', () => {
  expect(() => backupConfiguration({})).toThrow('Missing BACKUP_S3_ENDPOINT')
  expect(() =>
    backupConfiguration({ BACKUP_S3_ENDPOINT: 'http://example.com' }),
  ).toThrow('HTTPS')
  expect(() =>
    backupConfiguration({ BACKUP_S3_ENDPOINT: 'https://example.com' }),
  ).toThrow('Missing ARCHIVE_DATA_DIR')
})

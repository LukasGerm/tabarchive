import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const exec = promisify(execFile)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const digest = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex')

export async function createSnapshot(source: string, destination: string) {
  // Missing storage is an error, not a successful empty backup.
  const entries = await readdir(source, { withFileTypes: true })
  await mkdir(destination, { recursive: true, mode: 0o700 })
  const files: Record<string, string> = {}
  let arrangements = 0
  async function copy(relative: string, json = false) {
    const from = path.join(source, relative)
    if (!(await lstat(from)).isFile())
      throw new Error(`Not a regular file: ${relative}`)
    const bytes = await readFile(from)
    const parsed = json ? JSON.parse(bytes.toString()) : undefined
    const target = path.join(destination, relative)
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
    await writeFile(target, bytes, { mode: 0o600, flag: 'wx' })
    files[relative] = digest(bytes)
    return parsed
  }
  for (const entry of entries) {
    if (!uuid.test(entry.name)) continue // Ignore unfinished imports and temporary files.
    if (!entry.isDirectory())
      throw new Error(`Not an archive directory: ${entry.name}`)
    const id = entry.name
    const metadata = await copy(`${id}/metadata.json`, true)
    if (metadata.id !== id) throw new Error(`Invalid metadata: ${id}`)
    if (metadata.format !== 'link') await copy(`${id}/original`)
    let score
    try {
      // score.json is atomically replaced. Capture it before copying its history.
      score = await copy(`${id}/score.json`, true)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (score) {
      if (!Number.isInteger(score.revision) || score.revision < 1)
        throw new Error(`Invalid score: ${id}`)
      let revisions: string[] = []
      try {
        revisions = await readdir(path.join(source, id, 'revisions'))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      // Older revisions are immutable. A concurrently saved newer revision belongs
      // to the next backup; never copy the revision currently being written.
      for (const revision of revisions) {
        if (
          /^[1-9][0-9]*\.json$/.test(revision) &&
          Number(revision.slice(0, -5)) < score.revision
        ) {
          await copy(`${id}/revisions/${revision}`, true)
        }
      }
    }
    arrangements++
  }
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    arrangements,
    files,
  }
  await writeFile(
    path.join(destination, 'BACKUP_MANIFEST.json'),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 },
  )
  return manifest
}

export async function verifySnapshot(directory: string) {
  const manifest = JSON.parse(
    await readFile(path.join(directory, 'BACKUP_MANIFEST.json'), 'utf8'),
  )
  if (
    manifest.version !== 1 ||
    !manifest.files ||
    typeof manifest.files !== 'object'
  )
    throw new Error('Invalid backup manifest')
  for (const [relative, expected] of Object.entries(manifest.files)) {
    if (path.isAbsolute(relative) || relative.split('/').includes('..'))
      throw new Error('Unsafe backup path')
    const file = path.join(directory, relative)
    if (
      !(await lstat(file)).isFile() ||
      digest(await readFile(file)) !== expected
    )
      throw new Error(`Checksum mismatch: ${relative}`)
  }
  return manifest
}

export function backupConfiguration(env: NodeJS.ProcessEnv) {
  const required = (key: string) => {
    const value = env[key]?.trim()
    if (!value) throw new Error(`Missing ${key}`)
    return value
  }
  const endpoint = new URL(required('BACKUP_S3_ENDPOINT'))
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error('BACKUP_S3_ENDPOINT must be an HTTPS endpoint')
  return {
    source: path.resolve(required('ARCHIVE_DATA_DIR')),
    bucket: required('BACKUP_S3_BUCKET'),
    endpoint: endpoint.href,
    region: required('BACKUP_S3_REGION'),
    credentials: {
      accessKeyId: required('BACKUP_S3_ACCESS_KEY_ID'),
      secretAccessKey: required('BACKUP_S3_SECRET_ACCESS_KEY'),
    },
  }
}

export async function uploadAndVerify(
  client: S3Client,
  bucket: string,
  key: string,
  file: string,
) {
  const { size } = await stat(file)
  if (size > 5_000_000_000)
    throw new Error(
      'Backup exceeds the single-upload limit; configure multipart backups before continuing',
    )
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  const sha256 = hash.digest('hex')
  const abortSignal = AbortSignal.timeout(15 * 60 * 1000)
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(file),
      ContentLength: size,
      ContentType: 'application/gzip',
      Metadata: { sha256 },
    }),
    { abortSignal },
  )
  const downloaded = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { abortSignal },
  )
  if (!downloaded.Body) throw new Error('Backup verification returned no data')
  const remoteHash = createHash('sha256')
  for await (const chunk of downloaded.Body as AsyncIterable<Uint8Array>)
    remoteHash.update(chunk)
  if (remoteHash.digest('hex') !== sha256)
    throw new Error('Uploaded backup checksum does not match')
  return { bytes: size, sha256 }
}

export async function runBackup(env = process.env) {
  const config = backupConfiguration(env)
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: config.credentials,
    forcePathStyle: true,
    maxAttempts: 3,
    requestChecksumCalculation: 'WHEN_REQUIRED',
  })
  const temporary = await mkdtemp(path.join(tmpdir(), 'tabarchive-backup-'))
  try {
    const snapshot = path.join(temporary, 'snapshot')
    const manifest = await createSnapshot(config.source, snapshot)
    await verifySnapshot(snapshot)
    const archive = path.join(temporary, 'archive.tar.gz')
    await exec('tar', ['-czf', archive, '-C', snapshot, '.'], {
      timeout: 5 * 60 * 1000,
    })
    const key = `backups/${manifest.createdAt.replace(/[:.]/g, '-')}-${randomUUID()}.tar.gz`
    const result = await uploadAndVerify(client, config.bucket, key, archive)
    return {
      bucket: config.bucket,
      key,
      arrangements: manifest.arrangements,
      ...result,
    }
  } finally {
    client.destroy()
    await rm(temporary, { recursive: true, force: true })
  }
}

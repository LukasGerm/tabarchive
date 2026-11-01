import { runBackup, verifySnapshot } from './backup'

try {
  const result =
    process.argv[2] === 'verify' && process.argv[3]
      ? await verifySnapshot(process.argv[3])
      : await runBackup()
  console.log(JSON.stringify({ status: 'verified', ...result }))
} catch (error) {
  console.error(
    `Backup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
  )
  process.exitCode = 1
}

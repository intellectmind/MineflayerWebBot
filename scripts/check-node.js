const major = Number(process.versions.node.split('.')[0])
if (!Number.isInteger(major) || major < 22) {
  console.error(`\n[ERROR] Current Node.js is ${process.version}. Mineflayer Web Bot requires Node.js 22+.`)
  console.error('[REASON] Current mineflayer / minecraft-protocol releases require Node.js >=22.')
  console.error('[FIX] On Windows, use Windows one-click launcher. On BT panel, choose Node 22 LTS or newer.\n')
  process.exit(1)
}

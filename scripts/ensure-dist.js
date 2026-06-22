const fs = require('node:fs')
const path = require('node:path')
const indexFile = path.resolve(__dirname, '..', 'client', 'dist', 'index.html')
if (!fs.existsSync(indexFile)) {
  console.error('[ERROR] client/dist/index.html is missing. Please use the official release zip again.')
  process.exit(1)
}
console.log('[OK] Prebuilt web UI exists. No local Vite/Semi build is required.')

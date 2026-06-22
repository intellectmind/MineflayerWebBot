const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const appPath = path.resolve(__dirname, '..', 'config', 'app.json')
const examplePath = path.resolve(__dirname, '..', 'config', 'app.example.json')

if (!fs.existsSync(appPath)) {
  const config = JSON.parse(fs.readFileSync(examplePath, 'utf8'))
  config.web.adminPassword = crypto.randomBytes(18).toString('base64url')
  config.web.sessionSecret = crypto.randomBytes(32).toString('base64url')
  delete config.web.apiToken
  fs.writeFileSync(appPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  console.log(`[OK] Created config/app.json. Admin password: ${config.web.adminPassword}`)
} else {
  console.log('[OK] config/app.json already exists. Skipped init.')
}

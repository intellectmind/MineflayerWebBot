const fs = require('node:fs')
const path = require('node:path')
const configPath = path.resolve(__dirname, '..', 'config', 'app.json')
const cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : null
const port = Number(process.env.PORT || cfg?.web?.port || 15666)
console.log(`http://127.0.0.1:${port}/`)
if (cfg?.web?.adminPassword) console.log(`Admin password: ${cfg.web.adminPassword}`)
console.log('For LAN/server access, replace 127.0.0.1 with your server IP or domain.')

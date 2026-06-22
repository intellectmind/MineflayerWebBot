const fs = require('node:fs')
const path = require('node:path')
const configPath = path.resolve(__dirname, '..', 'config', 'app.json')
const cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {}
const port = Number(process.env.PORT || cfg?.web?.port || 15666)
console.log(`http://127.0.0.1:${port}/`)

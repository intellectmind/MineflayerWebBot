const fs = require('node:fs')
const path = require('node:path')

const configPath = path.resolve(__dirname, '..', 'config', 'app.json')
const examplePath = path.resolve(__dirname, '..', 'config', 'app.example.json')

const AUTH_MODES = new Set(['offline', 'microsoft'])
const DEFAULT_WEB_PORT = 15666
const DEFAULT_VIEWER_BASE_PORT = 3001
const DEFAULT_INVENTORY_BASE_PORT = 3101

const DEFAULT_BOT = {
  auth: 'offline',
  authmeAutoLogin: true,
  authmeCommand: '/login {password}',
  authmeRegisterCommand: '/reg {password} {email}',
  authmeEmail: '',
  authmeAutoRegister: false,
  authmeDelayMs: 1500,
  joinCommands: [],
  joinCommandDelayMs: 2500,
  viewDistance: 6,
  firstPersonViewer: false,
  canDig: true,
  allow1by1towers: true,
  autoReconnect: true,
  reconnectDelayMs: 5000,
  autoEat: false,
  autoEatThreshold: 14,
  autoRespawn: true,
  enableWebInventory: true,
  enablePvpPlugin: true,
  enableAutoEatPlugin: true,
  enableArmorManager: true,
  enableCollectBlock: true,
  enableToolPlugin: true
}

function readConfig () {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing config/app.json. Copy ${examplePath} to ${configPath} and edit it first.`)
  }

  const raw = fs.readFileSync(configPath, 'utf8')
  const config = JSON.parse(raw)
  normalizeConfig(config)
  validateConfig(config)
  return config
}

function writeConfig (config) {
  normalizeConfig(config)
  validateConfig(config)
  const dir = path.dirname(configPath)
  const tmp = path.join(dir, `app.${process.pid}.${Date.now()}.tmp.json`)
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', 'utf8')
  fs.renameSync(tmp, configPath)
}

function normalizeConfig (config) {
  if (!config || typeof config !== 'object') return config
  if (!config.release) config.release = { name: 'Mineflayer Web Bot', version: '1.0.0', profile: 'production' }
  if (!config.web) config.web = {}
  if (!config.defaults) config.defaults = {}
  if (!config.defaults.server) config.defaults.server = {}
  if (!config.defaults.bot) config.defaults.bot = {}
  if (!Array.isArray(config.bots)) config.bots = []

  config.web.host = String(config.web.host || '0.0.0.0')
  config.web.port = normalizePort(config.web.port, DEFAULT_WEB_PORT)
  config.web.adminPassword = config.web.adminPassword ? String(config.web.adminPassword) : (config.web.apiToken ? String(config.web.apiToken) : '')
  config.web.sessionSecret = config.web.sessionSecret ? String(config.web.sessionSecret) : ''
  config.web.viewerBasePort = normalizePort(config.web.viewerBasePort, DEFAULT_VIEWER_BASE_PORT)
  config.web.inventoryBasePort = normalizePort(config.web.inventoryBasePort, DEFAULT_INVENTORY_BASE_PORT)

  config.defaults.server.host = String(config.defaults.server.host || '127.0.0.1').trim()
  config.defaults.server.port = normalizePort(config.defaults.server.port, 25565)
  config.defaults.server.version = normalizeVersion(config.defaults.server.version)
  config.defaults.bot = normalizeBotDefaults(config.defaults.bot)

  config.bots = config.bots.map((bot, index) => normalizeAccount(bot, config, index))
  return config
}

function normalizeBotDefaults (raw = {}) {
  const merged = { ...DEFAULT_BOT, ...raw }
  merged.auth = merged.auth || 'offline'
  merged.authmeCommand = merged.authmeCommand ? String(merged.authmeCommand).trim() : '/login {password}'
  merged.authmeRegisterCommand = merged.authmeRegisterCommand ? String(merged.authmeRegisterCommand).trim() : '/reg {password} {email}'
  merged.authmeEmail = merged.authmeEmail ? String(merged.authmeEmail).trim() : ''
  merged.authmeAutoLogin = merged.authmeAutoLogin !== false
  merged.authmeAutoRegister = Boolean(merged.authmeAutoRegister)
  merged.authmeDelayMs = clampInt(merged.authmeDelayMs, 0, 30000, 1500)
  merged.joinCommands = normalizeStringList(merged.joinCommands)
  merged.joinCommandDelayMs = clampInt(merged.joinCommandDelayMs, 0, 120000, 2500)
  merged.viewDistance = clampInt(merged.viewDistance, 2, 16, 6)
  merged.firstPersonViewer = Boolean(merged.firstPersonViewer)
  merged.canDig = Boolean(merged.canDig)
  merged.allow1by1towers = Boolean(merged.allow1by1towers)
  merged.autoReconnect = Boolean(merged.autoReconnect)
  merged.reconnectDelayMs = clampInt(merged.reconnectDelayMs, 1000, 60000, 5000)
  merged.autoEat = false
  merged.autoEatThreshold = clampInt(merged.autoEatThreshold, 4, 20, 14)
  merged.autoRespawn = merged.autoRespawn !== false
  merged.enableWebInventory = merged.enableWebInventory !== false
  merged.enableAutoEatPlugin = merged.enableAutoEatPlugin !== false
  merged.enablePvpPlugin = merged.enablePvpPlugin !== false
  merged.enableArmorManager = merged.enableArmorManager !== false
  merged.enableCollectBlock = merged.enableCollectBlock !== false
  merged.enableToolPlugin = merged.enableToolPlugin !== false
  return stripUndefined(merged)
}

function normalizeAccount (raw = {}, rootConfig = null, index = 0, options = {}) {
  const defaults = rootConfig?.defaults?.bot || DEFAULT_BOT
  const serverDefaults = rootConfig?.defaults?.server || { host: '127.0.0.1', port: 25565, version: false }
  const webDefaults = rootConfig?.web || { viewerBasePort: DEFAULT_VIEWER_BASE_PORT, inventoryBasePort: DEFAULT_INVENTORY_BASE_PORT }
  const account = { ...defaults, ...raw }

  account.id = String(account.id || '').trim()
  account.username = String(account.username || '').trim()
  account.auth = account.auth || defaults.auth || 'offline'
  if (account.auth === 'mojang') account.auth = 'microsoft'

  account.host = String(account.host || serverDefaults.host || '').trim()
  account.port = normalizePort(account.port, serverDefaults.port || 25565)
  account.version = normalizeVersion(account.version === undefined ? serverDefaults.version : account.version)

  // Microsoft device-code auth does not use account passwords. Offline mode also does not need one.
  delete account.password
  account.authmePassword = account.authmePassword ? String(account.authmePassword) : undefined
  account.authmeCommand = account.authmeCommand ? String(account.authmeCommand).trim() : '/login {password}'
  account.authmeRegisterCommand = account.authmeRegisterCommand ? String(account.authmeRegisterCommand).trim() : '/reg {password} {email}'
  account.authmeEmail = account.authmeEmail ? String(account.authmeEmail).trim() : ''
  account.authmeAutoLogin = account.authmeAutoLogin !== false
  account.authmeAutoRegister = Boolean(account.authmeAutoRegister)
  account.authmeDelayMs = clampInt(account.authmeDelayMs, 0, 30000, 1500)
  account.joinCommands = normalizeStringList(account.joinCommands)
  account.joinCommandDelayMs = clampInt(account.joinCommandDelayMs, 0, 120000, 2500)

  account.viewerPort = normalizePort(account.viewerPort, Number(webDefaults.viewerBasePort || DEFAULT_VIEWER_BASE_PORT) + index)
  account.viewDistance = clampInt(account.viewDistance, 2, 16, 6)
  account.firstPersonViewer = Boolean(account.firstPersonViewer)
  account.webInventoryPort = normalizePort(account.webInventoryPort, Number(webDefaults.inventoryBasePort || DEFAULT_INVENTORY_BASE_PORT) + index)
  account.enableWebInventory = account.enableWebInventory !== false

  account.canDig = Boolean(account.canDig)
  account.allow1by1towers = Boolean(account.allow1by1towers)
  account.autoReconnect = Boolean(account.autoReconnect)
  account.reconnectDelayMs = clampInt(account.reconnectDelayMs, 1000, 60000, 5000)
  account.autoEat = false
  account.autoEatThreshold = clampInt(account.autoEatThreshold, 4, 20, 14)
  account.autoRespawn = account.autoRespawn !== false

  account.enableAutoEatPlugin = account.enableAutoEatPlugin !== false
  account.enablePvpPlugin = account.enablePvpPlugin !== false
  account.enableArmorManager = account.enableArmorManager !== false
  account.enableCollectBlock = account.enableCollectBlock !== false
  account.enableToolPlugin = account.enableToolPlugin !== false

  if (options.stripIdentity) {
    delete account.id
    delete account.username
  }
  if (options.skipRequired) return stripUndefined(account)
  return stripUndefined(account)
}

function normalizeVersion (value) {
  if (value === '' || value === 'false' || value === false || value == null) return false
  return String(value).trim()
}

function validateConfig (config) {
  if (!config || typeof config !== 'object') throw new Error('config must be an object')
  if (!config.web) throw new Error('config.web is required')
  if (!config.defaults?.server) throw new Error('config.defaults.server is required')
  if (!config.defaults.server.host) throw new Error('config.defaults.server.host is required')
  assertPort(config.defaults.server.port, 'config.defaults.server.port')
  assertPort(config.web.port, 'config.web.port')
  assertPort(config.web.viewerBasePort, 'config.web.viewerBasePort')
  assertPort(config.web.inventoryBasePort, 'config.web.inventoryBasePort')
  if (!Array.isArray(config.bots)) throw new Error('config.bots must be an array')

  const ids = new Set()
  const viewerPorts = new Map()
  const inventoryPorts = new Map()
  for (const account of config.bots) {
    validateAccount(account, ids, config.defaults.server)
    ids.add(account.id)
    trackUniquePort(viewerPorts, account.viewerPort, account.id, 'viewerPort')
    trackUniquePort(inventoryPorts, account.webInventoryPort, account.id, 'webInventoryPort')
  }
}

function trackUniquePort (map, port, id, label) {
  if (!port) return
  const n = Number(port)
  if (map.has(n)) throw new Error(`Duplicate ${label} ${port}: ${map.get(n)} and ${id}`)
  map.set(n, id)
}

function validateAccount (account, ids = new Set(), defaultServer = {}) {
  if (!account || typeof account !== 'object') throw new Error('bot must be an object')
  if (!account.id) throw new Error('Every bot needs an id')
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(account.id)) throw new Error('Bot id only supports 1-32 chars: letters, numbers, underscore and hyphen')
  if (ids.has(account.id)) throw new Error(`Duplicate bot id: ${account.id}`)
  if (!account.username) throw new Error(`Bot ${account.id} needs username`)
  if (account.auth === 'mojang') account.auth = 'microsoft'
  if (account.auth && !AUTH_MODES.has(account.auth)) throw new Error(`Unsupported auth for ${account.id}: ${account.auth}`)
  const host = account.host || defaultServer.host
  if (!host) throw new Error(`Bot ${account.id} needs target server host`)
  assertPort(account.port, `Bot ${account.id} port`)
  if (account.viewerPort != null) assertPort(account.viewerPort, `Bot ${account.id} viewerPort`)
  if (account.webInventoryPort != null) assertPort(account.webInventoryPort, `Bot ${account.id} webInventoryPort`)
  if (account.viewDistance != null) assertIntRange(account.viewDistance, 2, 16, `Bot ${account.id} viewDistance`)
  if (account.authmeDelayMs != null) assertIntRange(account.authmeDelayMs, 0, 30000, `Bot ${account.id} authmeDelayMs`)
  if (account.reconnectDelayMs != null) assertIntRange(account.reconnectDelayMs, 1000, 60000, `Bot ${account.id} reconnectDelayMs`)
  if (account.autoEatThreshold != null) assertIntRange(account.autoEatThreshold, 4, 20, `Bot ${account.id} autoEatThreshold`)
  if (account.joinCommandDelayMs != null) assertIntRange(account.joinCommandDelayMs, 0, 120000, `Bot ${account.id} joinCommandDelayMs`)
  if (account.authmeCommand && !String(account.authmeCommand).includes('{password}')) throw new Error(`Bot ${account.id} authmeCommand must include {password}`)
  if (account.authmeRegisterCommand && !String(account.authmeRegisterCommand).includes('{password}')) throw new Error(`Bot ${account.id} authmeRegisterCommand must include {password}`)
}

function publicAccount (account) {
  return {
    id: account.id,
    username: account.username,
    auth: account.auth || 'offline',
    host: account.host || '',
    port: account.port || 25565,
    version: account.version || false,
    hasAuthmePassword: Boolean(account.authmePassword),
    authmeAutoLogin: account.authmeAutoLogin !== false,
    authmeCommand: account.authmeCommand || '/login {password}',
    authmeRegisterCommand: account.authmeRegisterCommand || '/reg {password} {email}',
    authmeEmail: account.authmeEmail || '',
    authmeAutoRegister: Boolean(account.authmeAutoRegister),
    authmeDelayMs: account.authmeDelayMs ?? 1500,
    joinCommands: Array.isArray(account.joinCommands) ? account.joinCommands : [],
    joinCommandDelayMs: account.joinCommandDelayMs ?? 2500,
    viewerPort: account.viewerPort || null,
    viewDistance: account.viewDistance || 6,
    firstPersonViewer: Boolean(account.firstPersonViewer),
    webInventoryPort: account.webInventoryPort || null,
    enableWebInventory: account.enableWebInventory !== false,
    canDig: Boolean(account.canDig),
    allow1by1towers: Boolean(account.allow1by1towers),
    autoReconnect: Boolean(account.autoReconnect),
    reconnectDelayMs: account.reconnectDelayMs ?? 5000,
    autoEat: false,
    autoEatThreshold: account.autoEatThreshold ?? 14,
    autoRespawn: account.autoRespawn !== false,
    enableAutoEatPlugin: account.enableAutoEatPlugin !== false,
    enablePvpPlugin: account.enablePvpPlugin !== false,
    enableArmorManager: account.enableArmorManager !== false,
    enableCollectBlock: account.enableCollectBlock !== false,
    enableToolPlugin: account.enableToolPlugin !== false
  }
}

function mergeAccountPatch (current, patch = {}, rootConfig = null, index = 0) {
  const next = { ...current, ...patch }
  if (Object.prototype.hasOwnProperty.call(patch, 'authmePassword') && patch.authmePassword === '') next.authmePassword = current.authmePassword
  delete next.password
  if (patch.authmePassword === null) delete next.authmePassword
  return normalizeAccount(next, rootConfig, index)
}


function normalizeStringList (value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean).slice(0, 50)
  if (typeof value === 'string') return value.split(/\r?\n/).map(v => v.trim()).filter(Boolean).slice(0, 50)
  return []
}

function normalizePort (value, fallback) {
  if (value === '' || value == null) return fallback
  const n = Number(value)
  return Number.isInteger(n) ? n : value
}

function assertPort (value, label = 'port') {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${label} must be 1-65535`)
}

function assertIntRange (value, min, max, label) {
  const v = Number(value)
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${label} must be ${min}-${max}`)
}

function clampInt (value, min, max, fallback) {
  if (value === '' || value == null) return fallback
  const n = Number(value)
  if (!Number.isInteger(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function stripUndefined (obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

module.exports = {
  configPath,
  examplePath,
  DEFAULT_WEB_PORT,
  DEFAULT_VIEWER_BASE_PORT,
  DEFAULT_INVENTORY_BASE_PORT,
  readConfig,
  writeConfig,
  normalizeConfig,
  normalizeAccount,
  mergeAccountPatch,
  publicAccount,
  validateAccount,
  validateConfig
}

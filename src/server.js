const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const crypto = require('node:crypto')
const { spawn, execFile } = require('node:child_process')
const httpProxy = require('http-proxy')
const express = require('express')
const helmet = require('helmet')
const morgan = require('morgan')
const { Server } = require('socket.io')
const { readConfig, writeConfig, normalizeAccount, DEFAULT_WEB_PORT } = require('./config')
const { BotManager } = require('./bot-manager')

const packageJson = require('../package.json')
const proxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true })
let updateJob = { running: false, logs: [], startedAt: null, finishedAt: null, exitCode: null, error: null }
const config = readConfig()
const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
const manager = new BotManager(config)
const OPTIONAL_PLUGINS = [
  { name: 'mineflayer-web-inventory', label: 'Web Inventory', feature: '在线背包网页视图' },
  { name: 'mineflayer-pvp', label: 'PVP', feature: 'PVP/PVE 攻击增强' },
  { name: 'mineflayer-auto-eat', label: 'Auto Eat Plugin', feature: '插件版自动进食增强' },
  { name: 'mineflayer-armor-manager', label: 'Armor Manager', feature: '自动护甲管理' },
  { name: 'mineflayer-collectblock', label: 'Collect Block', feature: '高级采集方块' },
  { name: 'mineflayer-tool', label: 'Tool', feature: '自动选择工具/武器' }
]
const webConfig = config.web || {}
const adminPassword = process.env.ADMIN_PASSWORD || webConfig.adminPassword || webConfig.apiToken || ''
const sessionSecret = process.env.SESSION_SECRET || webConfig.sessionSecret || crypto.randomBytes(32).toString('base64url')
const sessions = new Map()

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
app.use(morgan('dev'))
app.use(express.json({ limit: '2mb' }))

const builtClientDir = path.resolve(__dirname, '..', 'client', 'dist')
const staticDir = builtClientDir
app.use(express.static(staticDir))

function parseCookies (cookieHeader = '') {
  return Object.fromEntries(String(cookieHeader).split(';').map(part => {
    const i = part.indexOf('=')
    if (i < 0) return ['', '']
    return [decodeURIComponent(part.slice(0, i).trim()), decodeURIComponent(part.slice(i + 1).trim())]
  }).filter(([k]) => k))
}

function sessionIdFromReq (req) {
  return parseCookies(req.headers.cookie || '').mfb_session || ''
}

function createSession (req) {
  const sid = crypto.randomBytes(32).toString('base64url')
  sessions.set(sid, { createdAt: Date.now(), lastSeen: Date.now(), ip: req.ip, ua: req.headers['user-agent'] || '' })
  return sid
}

function isAuthorizedReq (req) {
  if (!adminPassword || adminPassword === 'change-me') return true
  const sid = sessionIdFromReq(req)
  const session = sessions.get(sid)
  if (!session) return false
  session.lastSeen = Date.now()
  return true
}

function setSessionCookie (res, sid) {
  const secure = String(webConfig.secureCookie || '').toLowerCase() === 'true'
  res.setHeader('Set-Cookie', `mfb_session=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? '; Secure' : ''}`)
}

function clearSessionCookie (res) {
  res.setHeader('Set-Cookie', 'mfb_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
}

function requireAuth (req, res, next) {
  if (isAuthorizedReq(req)) return next()
  res.status(401).json({ ok: false, error: 'Unauthorized: please log in first' })
}

function asyncRoute (fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch(err => {
      res.status(400).json({ ok: false, error: err.message || String(err) })
    })
  }
}

function managed (req) { return manager.get(req.params.id) }
function okBot (res, bot) { res.json({ ok: true, bot }) }

function nextBotIdentity () {
  const used = new Set((manager.config.bots || []).map(b => b.id))
  let n = 1
  while (used.has(`bot${n}`)) n++
  return { id: `bot${n}`, username: `WebBot_${n}` }
}

function withAutoIdentity (body = {}) {
  const identity = nextBotIdentity()
  return {
    ...body,
    id: String(body.id || '').trim() || identity.id,
    username: String(body.username || '').trim() || identity.username,
    auth: body.auth === 'mojang' ? 'microsoft' : (body.auth || manager.config.defaults?.bot?.auth || 'offline')
  }
}


app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }))

app.get('/api/auth/me', (req, res) => {
  res.json({ ok: true, authenticated: isAuthorizedReq(req), authRequired: Boolean(adminPassword && adminPassword !== 'change-me') })
})

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  if (!adminPassword || adminPassword === 'change-me') {
    const sid = createSession(req)
    setSessionCookie(res, sid)
    return res.json({ ok: true, authenticated: true, authRequired: false })
  }
  const password = String(req.body?.password || '')
  const a = Buffer.from(password)
  const b = Buffer.from(String(adminPassword))
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b)
  if (!valid) return res.status(401).json({ ok: false, error: 'Invalid password' })
  const sid = createSession(req)
  setSessionCookie(res, sid)
  res.json({ ok: true, authenticated: true, authRequired: true })
}))

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const sid = sessionIdFromReq(req)
  if (sid) sessions.delete(sid)
  clearSessionCookie(res)
  res.json({ ok: true })
})

app.get('/api/system', requireAuth, (_req, res) => {
  res.json({
    ok: true,
    system: {
      name: packageJson.name,
      version: packageJson.version,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.round(process.uptime()),
      webPort: Number(webConfig.port || process.env.PORT || DEFAULT_WEB_PORT),
      authMode: (adminPassword && adminPassword !== 'change-me') ? 'session-password' : 'disabled',
      sessionLogin: true,
      release: config.release || {},
      configFile: 'config/app.json',
      botCount: manager.list().length,
      dependencies: packageJson.dependencies || {},
      optionalDependencies: packageJson.optionalDependencies || {},
      engines: packageJson.engines || {},
      update: { running: updateJob.running, lastExitCode: updateJob.exitCode, lastError: updateJob.error },
      runtimeDependencies: runtimeDependencyStatus(),
      plugins: getPluginStatus()
    }
  })
})

app.get('/api/config', requireAuth, (_req, res) => res.json({ ok: true, config: { release: config.release, web: { ...config.web, adminPassword: config.web?.adminPassword ? '***' : '', apiToken: undefined, sessionSecret: config.web?.sessionSecret ? '***' : '' }, defaults: config.defaults } }))
app.get('/api/plugins', requireAuth, (_req, res) => res.json({ ok: true, plugins: getPluginStatus(), update: updateJob }))

app.post('/api/plugins/install', requireAuth, asyncRoute(async (req, res) => {
  const name = assertKnownPlugin(req.body?.name)
  const registry = normalizeRegistry(req.body?.registry)
  startNpmJob(`install plugin ${name}`, ['install', `${name}@latest`, '--save-optional', '--omit=dev', '--legacy-peer-deps', '--no-audit', '--no-fund', '--registry', registry])
  res.json({ ok: true, plugin: name, job: updateJob, message: '安装完成后，请重启对应 Bot；如仍不可用，重启 Web 服务。' })
}))

app.post('/api/plugins/update', requireAuth, asyncRoute(async (req, res) => {
  const name = assertKnownPlugin(req.body?.name)
  const registry = normalizeRegistry(req.body?.registry)
  startNpmJob(`update plugin ${name}`, ['install', `${name}@latest`, '--save-optional', '--omit=dev', '--legacy-peer-deps', '--no-audit', '--no-fund', '--registry', registry])
  res.json({ ok: true, plugin: name, job: updateJob, message: '更新完成后，请重启对应 Bot；如仍不可用，重启 Web 服务。' })
}))

app.post('/api/plugins/remove', requireAuth, asyncRoute(async (req, res) => {
  const name = assertKnownPlugin(req.body?.name)
  startNpmJob(`remove plugin ${name}`, ['uninstall', name, '--save-optional', '--omit=dev', '--legacy-peer-deps', '--no-audit', '--no-fund'])
  res.json({ ok: true, plugin: name, job: updateJob, message: '卸载完成后，请重启 Web 服务。' })
}))

app.get('/api/bots', requireAuth, (_req, res) => res.json({ ok: true, bots: manager.list() }))
app.get('/api/bots/:id', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).snapshot())))

app.post('/api/bots', requireAuth, asyncRoute(async (req, res) => {
  const account = normalizeAccount(withAutoIdentity(req.body || {}), manager.config, manager.config.bots.length)
  const bot = manager.addRuntimeBot(account)
  writeConfig(manager.config)
  res.status(201).json({ ok: true, bot, bots: manager.list() })
}))

app.put('/api/bots/:id', requireAuth, asyncRoute(async (req, res) => {
  const bot = manager.updateRuntimeBot(req.params.id, req.body || {})
  writeConfig(manager.config)
  res.json({ ok: true, bot, bots: manager.list() })
}))

app.delete('/api/bots/:id', requireAuth, asyncRoute(async (req, res) => {
  manager.removeRuntimeBot(req.params.id)
  writeConfig(manager.config)
  res.json({ ok: true, bots: manager.list() })
}))

app.post('/api/bots/start-all', requireAuth, asyncRoute(async (_req, res) => res.json({ ok: true, results: manager.startAll(), bots: manager.list() })))
app.post('/api/bots/stop-all', requireAuth, asyncRoute(async (_req, res) => res.json({ ok: true, results: manager.stopAll(), bots: manager.list() })))
app.post('/api/bots/:id/start', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).start())))
app.post('/api/bots/:id/stop', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).stop())))
app.post('/api/bots/:id/stop-task', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).stopTask())))

app.post('/api/bots/:id/goto', requireAuth, asyncRoute(async (req, res) => {
  const { x, y, z, range } = req.body
  okBot(res, await managed(req).goto(Number(x), Number(y), Number(z), Number(range ?? 1)))
}))
app.post('/api/bots/:id/follow', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).follow(req.body.username, req.body.range))))
app.post('/api/bots/:id/chat', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).chat(req.body.message))))
app.post('/api/bots/:id/authme', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).sendAuthMe(req.body.mode || 'login'))))

app.post('/api/bots/:id/viewer-perspective', requireAuth, asyncRoute(async (req, res) => {
  const firstPerson = Boolean(req.body?.firstPerson)
  const bot = manager.setViewerPerspective(req.params.id, firstPerson)
  writeConfig(manager.config)
  okBot(res, bot)
}))
app.post('/api/bots/:id/control', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).setControl(req.body.control, req.body.state))))
app.post('/api/bots/:id/look', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).look(req.body.yaw, req.body.pitch))))
app.post('/api/bots/:id/look-relative', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).lookRelative(req.body.dx, req.body.dy, req.body.sensitivity))))
app.post('/api/bots/:id/hotbar', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).setQuickBarSlot(req.body.slot))))
app.post('/api/bots/:id/look-at-player', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).lookAtPlayer(req.body.username))))
app.post('/api/bots/:id/attack', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).attack(req.body || {}))))
app.post('/api/bots/:id/left-click', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).leftClick())))
app.post('/api/bots/:id/right-click', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).rightClick())))
app.post('/api/bots/:id/left-hold', requireAuth, asyncRoute(async (req, res) => okBot(res, req.body?.state === false ? managed(req).stopLeftHold() : managed(req).startLeftHold(req.body || {}))))
app.post('/api/bots/:id/right-hold', requireAuth, asyncRoute(async (req, res) => okBot(res, req.body?.state === false ? managed(req).stopRightHold() : managed(req).startRightHold(req.body || {}))))
app.post('/api/bots/:id/auto-jump', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).setAutoJump(Boolean(req.body?.state), req.body || {}))))
app.post('/api/bots/:id/equip', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).equipItem(req.body || {}))))
app.post('/api/bots/:id/drop', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).dropItem(req.body || {}))))

app.post('/api/bots/:id/dig-cursor', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).digCursorBlock())))
app.post('/api/bots/:id/dig-block', requireAuth, asyncRoute(async (req, res) => {
  const { x, y, z, range } = req.body
  okBot(res, await managed(req).digBlockAt(Number(x), Number(y), Number(z), Number(range ?? 1)))
}))
app.post('/api/bots/:id/dig-nearest', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).digNearestBlock(req.body || {}))))
app.post('/api/bots/:id/collect-block', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).collectBlock(req.body || {}))))
app.post('/api/bots/:id/auto-mine', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).autoMine(req.body || {}))))
app.post('/api/bots/:id/cut-trees', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).cutTrees(req.body || {}))))

app.post('/api/bots/:id/mount', requireAuth, asyncRoute(async (req, res) => okBot(res, await managed(req).mountNearestVehicle(req.body || {}))))
app.post('/api/bots/:id/dismount', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).dismount())))

app.post('/api/bots/:id/guard/start', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).startGuard(req.body || {}))))
app.post('/api/bots/:id/guard/stop', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).stopGuard())))

app.get('/api/bots/:id/inventory', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, inventory: managed(req).getInventory() })))
app.get('/api/bots/:id/players', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, players: managed(req).getPlayers() })))
app.get('/api/bots/:id/plugins', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, plugins: managed(req).snapshot().pluginStatus || {} })))

app.get('/api/bots/:id/secret/authme-password', requireAuth, asyncRoute(async (req, res) => {
  const bot = managed(req)
  const password = bot.account?.authmePassword || ''
  res.json({ ok: true, hasPassword: Boolean(password), password })
}))

app.post('/api/bots/:id/window/open', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, window: await managed(req).openBlockWindow(req.body || {}) })))
app.get('/api/bots/:id/window', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, window: managed(req).getOpenWindow() })))
app.post('/api/bots/:id/window/close', requireAuth, asyncRoute(async (req, res) => okBot(res, managed(req).closeWindow())))
app.post('/api/bots/:id/window/withdraw', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, window: await managed(req).chestWithdraw(req.body || {}) })))
app.post('/api/bots/:id/window/deposit', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, window: await managed(req).chestDeposit(req.body || {}) })))
app.post('/api/bots/:id/window/click-slot', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, window: await managed(req).clickWindowSlot(req.body || {}) })))

app.post('/api/bots/:id/furnace/put-input', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, window: await managed(req).furnacePutInput(req.body || {}) })))
app.post('/api/bots/:id/furnace/put-fuel', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, window: await managed(req).furnacePutFuel(req.body || {}) })))
app.post('/api/bots/:id/furnace/take-output', requireAuth, asyncRoute(async (req, res) => res.json({ ok: true, window: await managed(req).furnaceTakeOutput() })))

app.get('/api/update/status', requireAuth, (_req, res) => res.json({ ok: true, job: updateJob }))

app.post('/api/update/check', requireAuth, asyncRoute(async (req, res) => {
  const mode = req.body?.mode || 'core'
  const registry = normalizeRegistry(req.body?.registry)
  const packages = getUpdatePackages(mode)
  const results = []
  for (const pkg of packages) {
    const currentPkg = rootPackageJson()
    const current = currentPkg.dependencies?.[pkg.name] || currentPkg.optionalDependencies?.[pkg.name] || currentPkg.devDependencies?.[pkg.name] || installedPackageVersion(pkg.name) || null
    if (pkg.pinnedLatest) {
      results.push({ name: pkg.name, viewName: pkg.viewName || pkg.name, current, latest: pkg.pinnedLatest, installSpec: pkg.installSpec || `${pkg.name}@latest`, note: pkg.note || 'Pinned by release.' })
      continue
    }
    try {
      const latest = await npmViewVersion(pkg.viewName || pkg.name, registry)
      results.push({ name: pkg.name, viewName: pkg.viewName || pkg.name, current, latest, installSpec: pkg.installSpec || `${pkg.name}@latest` })
    } catch (err) {
      results.push({ name: pkg.name, viewName: pkg.viewName || pkg.name, current, latest: null, installSpec: pkg.installSpec || `${pkg.name}@latest`, error: err.message })
    }
  }
  res.json({ ok: true, mode, registry, packages: results, job: updateJob })
}))

app.post('/api/update/run', requireAuth, asyncRoute(async (req, res) => {
  if (updateJob.running) throw new Error('已有更新任务正在运行')
  const mode = req.body?.mode || 'core'
  const registry = normalizeRegistry(req.body?.registry)
  const packages = getUpdatePackages(mode)
  const build = false
  if (!packages.length) {
    res.json({ ok: true, mode, registry, packages: [], job: updateJob, message: 'This release uses a prebuilt UI, so there are no UI packages to update.' })
    return
  }
  const installArgs = ['install', ...packages.map(pkg => pkg.installSpec || `${pkg.name}@latest`), '--omit=dev', '--legacy-peer-deps', '--no-audit', '--no-fund', '--registry', registry]
  if (mode === 'optional') installArgs.push('--save-optional')
  else installArgs.push('--save')
  const npm = npmCommand()
  const sequence = [{ label: 'npm install', cmd: npm.cmd, args: [...npm.argsPrefix, ...installArgs], display: npm.display }]
  if (build) sequence.push({ label: 'npm run build', cmd: npm.cmd, args: [...npm.argsPrefix, 'run', 'build'], display: npm.display })
  runUpdateSequence(sequence)
  const currentPkg = rootPackageJson()
  res.json({ ok: true, mode, registry, packages: packages.map(pkg => ({ name: pkg.name, current: currentPkg.dependencies?.[pkg.name] || currentPkg.optionalDependencies?.[pkg.name] || currentPkg.devDependencies?.[pkg.name] || installedPackageVersion(pkg.name) || null, latest: 'updating', installSpec: pkg.installSpec || `${pkg.name}@latest` })), job: updateJob })
}))

app.use('/viewer/:id', requireAuth, (req, res) => proxyToBotService(req, res, 'viewer'))
app.use('/inventory/:id', requireAuth, (req, res) => proxyToBotService(req, res, 'inventory'))

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next()
  const indexFile = path.join(staticDir, 'index.html')
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile)
  return res.status(503).send('<!doctype html><meta charset="utf-8"><title>Mineflayer Web Bot</title><body style="font-family:system-ui;padding:40px;background:#0b1020;color:#e5e7eb"><h1>Mineflayer Web Bot 未构建前端</h1><p>发行版前端文件缺失。请重新解压官方 release zip，然后重新启动。</p></body>')
})



function rootPackageJson () {
  try { return JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')) } catch { return packageJson }
}

function installedPackageVersion (name) {
  try {
    const pkgPath = require.resolve(`${name}/package.json`, { paths: [path.resolve(__dirname, '..')] })
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || null
  } catch { return null }
}


function runtimeDependencyStatus () {
  const names = ['mineflayer', 'minecraft-protocol', 'mineflayer-pathfinder', 'prismarine-viewer', 'canvas', 'express', 'socket.io', 'vec3']
  return names.map(name => ({ name, installed: Boolean(installedPackageVersion(name)), version: installedPackageVersion(name) }))
}

function getPluginStatus () {
  const pkg = rootPackageJson()
  return OPTIONAL_PLUGINS.map(plugin => {
    const installedVersion = installedPackageVersion(plugin.name)
    const declared = pkg.optionalDependencies?.[plugin.name] || pkg.dependencies?.[plugin.name] || null
    return { ...plugin, installed: Boolean(installedVersion), installedVersion, declared }
  })
}

function assertKnownPlugin (name) {
  const key = String(name || '').trim()
  if (!OPTIONAL_PLUGINS.some(p => p.name === key)) throw new Error(`Unsupported plugin: ${key}`)
  return key
}

function startNpmJob (label, args) {
  if (updateJob.running) throw new Error('已有安装/更新任务正在运行')
  const npm = npmCommand()
  runUpdateSequence([{ label, cmd: npm.cmd, args: [...npm.argsPrefix, ...args], display: npm.display }])
}

function normalizeRegistry (value) {
  const registry = String(value || 'https://registry.npmmirror.com').trim()
  if (!/^https:\/\/(registry\.npmmirror\.com|registry\.npmjs\.org)\/?$/.test(registry)) throw new Error('只允许使用 npm 官方源或 npmmirror 中国镜像源')
  return registry.replace(/\/$/, '')
}

function npmCommand () {
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (fs.existsSync(npmCli)) return { cmd: process.execPath, argsPrefix: [npmCli], display: 'npm' }
  return { cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm', argsPrefix: [], display: 'npm' }
}

function packageSpec (name) {
  if (name === 'canvas') return { name: 'canvas', viewName: '@napi-rs/canvas', installSpec: 'canvas@npm:@napi-rs/canvas@1.0.0', pinnedLatest: '1.0.0 pinned', note: 'Pinned to avoid unavailable @napi-rs/canvas ranges on mirrors.' }
  if (name === 'vec3') return { name: 'vec3', installSpec: 'vec3@0.1.10', pinnedLatest: '0.1.10 pinned', note: 'Pinned because vec3 0.1.11 is not available on npm mirrors used by this release.' }
  return { name }
}

function getUpdatePackages (mode) {
  const core = ['mineflayer', 'minecraft-protocol', 'mineflayer-pathfinder', 'prismarine-viewer', 'canvas', 'vec3'].map(packageSpec)
  const optional = OPTIONAL_PLUGINS.map(p => p.name).map(packageSpec)
  if (mode === 'core') return core
  if (mode === 'ui') return []
  if (mode === 'optional') return optional
  if (mode === 'all') {
    const root = rootPackageJson()
    return [...new Set([...Object.keys(root.dependencies || {}), ...Object.keys(root.optionalDependencies || {})])].map(packageSpec)
  }
  throw new Error(`未知更新范围：${mode}`)
}

function npmViewVersion (name, registry) {
  return new Promise((resolve, reject) => {
    const npm = npmCommand()
    execFile(npm.cmd, [...npm.argsPrefix, 'view', name, 'version', '--registry', registry], { cwd: path.resolve(__dirname, '..'), timeout: 45000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || stdout || err.message).trim()))
      resolve(String(stdout || '').trim().split(/\s+/).pop())
    })
  })
}

function updateLog (line) {
  const text = String(line || '').trimEnd()
  if (!text) return
  updateJob.logs.push(text)
  if (updateJob.logs.length > 500) updateJob.logs.shift()
  io.emit('update-log', { time: new Date().toISOString(), line: text })
}

async function runUpdateSequence (sequence) {
  updateJob = { running: true, logs: [], startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, error: null }
  io.emit('update-status', updateJob)
  try {
    for (const step of sequence) {
      updateLog(`[RUN] ${step.label}: ${step.display || step.cmd} ${step.args.filter(a => !String(a).includes('npm-cli.js')).join(' ')}`)
      await spawnStep(step.cmd, step.args)
    }
    updateJob.exitCode = 0
    updateLog('[OK] 更新完成。请重启服务后生效。')
  } catch (err) {
    updateJob.exitCode = 1
    updateJob.error = err.message
    updateLog(`[ERROR] ${err.message}`)
  } finally {
    updateJob.running = false
    updateJob.finishedAt = new Date().toISOString()
    io.emit('update-status', updateJob)
  }
}

function spawnStep (cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: path.resolve(__dirname, '..'), shell: false, windowsHide: true, env: { ...process.env, npm_config_fund: 'false', npm_config_audit: 'false' } })
    child.stdout.on('data', chunk => String(chunk).split(/\r?\n/).forEach(updateLog))
    child.stderr.on('data', chunk => String(chunk).split(/\r?\n/).forEach(updateLog))
    child.on('error', err => reject(new Error(`${cmd} spawn failed: ${err.message}`)))
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`)))
  })
}

function proxyToBotService (req, res, kind) {
  try {
    const item = manager.get(req.params.id).snapshot()
    const port = kind === 'inventory' ? item.webInventoryPort : item.viewerPort
    const started = kind === 'inventory' ? item.webInventoryStarted : item.viewerStarted
    if (!port || !started) return res.status(404).send(`${kind} for ${req.params.id} is not started`)
    proxy.web(req, res, { target: `http://127.0.0.1:${port}` })
  } catch (err) {
    res.status(404).send(err.message)
  }
}

proxy.on('error', (err, _req, res) => {
  if (res && !res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
  try { res.end(`Proxy error: ${err.message}`) } catch {}
})

io.use((socket, next) => {
  if (!adminPassword || adminPassword === 'change-me') return next()
  const cookies = parseCookies(socket.request.headers.cookie || '')
  const session = sessions.get(cookies.mfb_session || '')
  if (session) {
    session.lastSeen = Date.now()
    return next()
  }
  next(new Error('Unauthorized'))
})

io.on('connection', socket => socket.emit('bots', manager.list()))
manager.on('log', entry => io.emit('log', entry))
manager.on('status', status => io.emit('status', status))
manager.on('list', list => io.emit('bots', list))


server.on('upgrade', (req, socket, head) => {
  const match = req.url.match(/^\/(viewer|inventory)\/([^/?#]+)(\/.*|$)/)
  if (!match) return
  if (!isAuthorizedReq(req)) return socket.destroy()
  try {
    const kind = match[1]
    const id = decodeURIComponent(match[2])
    const item = manager.get(id).snapshot()
    const port = kind === 'inventory' ? item.webInventoryPort : item.viewerPort
    const started = kind === 'inventory' ? item.webInventoryStarted : item.viewerStarted
    if (!port || !started) throw new Error(`${kind} for ${id} is not started`)
    req.url = match[3] || '/'
    proxy.ws(req, socket, head, { target: `http://127.0.0.1:${port}` })
  } catch (err) {
    socket.destroy()
  }
})

const host = process.env.HOST || webConfig.host || '0.0.0.0'
const port = Number(process.env.PORT || webConfig.port || DEFAULT_WEB_PORT)
server.listen(port, host, () => {
  console.log(`Mineflayer web panel: http://${host}:${port}`)
  console.log(`Serving web UI from: ${staticDir}`)
  if (!adminPassword || adminPassword === 'change-me') console.warn('WARNING: web.adminPassword is not set or still change-me. Do not expose this panel to the public internet.')
})

process.on('uncaughtException', err => {
  console.error('[UNCAUGHT]', err)
})
process.on('unhandledRejection', err => {
  console.error('[UNHANDLED]', err)
})

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function shutdown () {
  console.log('Shutting down bots...')
  for (const snapshot of manager.list()) {
    try { manager.get(snapshot.id).stop() } catch {}
  }
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}

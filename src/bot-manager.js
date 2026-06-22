const EventEmitter = require('node:events')
const fs = require('node:fs')
const path = require('node:path')
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
let cachedMineflayerViewer = null
let cachedViewerLoadError = null

function getMineflayerViewer () {
  if (cachedMineflayerViewer) return cachedMineflayerViewer
  if (cachedViewerLoadError) return null
  try {
    cachedMineflayerViewer = require('prismarine-viewer').mineflayer
    return cachedMineflayerViewer
  } catch (err) {
    cachedViewerLoadError = err
    return null
  }
}

const Vec3 = require('vec3').Vec3
const { isProbablyFood } = require('./foods')
const { mergeAccountPatch, normalizeAccount, publicAccount, validateConfig } = require('./config')

const { GoalNear, GoalFollow } = goals
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const HOSTILE_MOBS = new Set([
  'zombie', 'zombie_villager', 'skeleton', 'stray', 'wither_skeleton', 'spider', 'cave_spider',
  'creeper', 'enderman', 'witch', 'slime', 'magma_cube', 'drowned', 'husk', 'phantom', 'pillager',
  'vindicator', 'evoker', 'ravager', 'guardian', 'elder_guardian', 'blaze', 'ghast', 'hoglin',
  'zoglin', 'piglin_brute', 'warden', 'silverfish', 'endermite', 'shulker', 'wither'
])

function optionalRequire (name) {
  try { return require(name) } catch { return null }
}

function colorizeLog (level, line) {
  const colors = {
    chat: '\x1b[32m',
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    debug: '\x1b[90m',
    system: '\x1b[35m'
  }
  return `${colors[level] || ''}${line}\x1b[0m`
}

class ManagedBot extends EventEmitter {
  constructor (account, serverConfig) {
    super()
    this.account = normalizeAccount(account)
    this.serverConfig = serverConfig
    this.bot = null
    this.status = 'offline'
    this.lastError = null
    this.viewerStarted = false
    this.webInventoryStarted = false
    this.logs = []
    this.manualStop = false
    this.reconnectTimer = null
    this.autoEatLock = false
    this.defaultMovements = null
    this.currentContainer = null
    this.currentFurnace = null
    this.currentWindowLabel = null
    this.guard = { enabled: false, timer: null, center: null, radius: 16, mode: 'hostile', returnHome: true }
    this.pluginStatus = {}
    this.authmeRegisterSent = false
    this.joinCommandsStarted = false
    this.microsoftLogin = null
    this.pathRecoveryTimer = null
    this.activePathTask = null
  }

  safeFileName (value) {
    return String(value || 'bot').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'bot'
  }

  log (level, message, extra = undefined) {
    const entry = { time: new Date().toISOString(), id: this.account.id, level, message, extra }
    this.logs.push(entry)
    if (this.logs.length > 500) this.logs.shift()
    const extraText = extra == null ? '' : ` ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`
    console.log(colorizeLog(level, `[${entry.time}] [${this.account.id}] [${level}] ${message}${extraText}`))
    this.emit('log', entry)
  }

  ensureOnline () {
    if (!this.bot) throw new Error(`${this.account.id} is not online`)
    return this.bot
  }

  start () {
    if (this.bot) return this.snapshot()
    this.clearReconnectTimer()
    this.manualStop = false
    this.status = 'connecting'
    this.lastError = null
    this.viewerStarted = false
    this.webInventoryStarted = false
    this.currentContainer = null
    this.currentFurnace = null
    this.currentWindowLabel = null
    this.pluginStatus = {}
    this.authmeRegisterSent = false
    this.joinCommandsStarted = false
    this.microsoftLogin = null
    this.stopPathRecovery()
    this.log('info', `connecting to ${this.targetHost()}:${this.targetPort()}`)

    const options = {
      host: this.targetHost(),
      port: this.targetPort(),
      username: this.account.username,
      auth: this.account.auth || 'offline',
      hideErrors: true
    }

    const version = this.account.version ?? this.serverConfig.version
    if (version) options.version = version
    if (options.auth === 'microsoft') {
      const profileDir = path.resolve(__dirname, '..', 'data', 'microsoft-auth', this.safeFileName(this.account.id || this.account.username))
      fs.mkdirSync(profileDir, { recursive: true })
      options.profilesFolder = profileDir
      options.onMsaCode = (data) => {
        const userCode = data?.user_code || data?.userCode || ''
        const verificationUri = data?.verification_uri || data?.verificationUri || data?.verification_url || 'https://www.microsoft.com/link'
        const complete = data?.verification_uri_complete || data?.verificationUriComplete || (userCode ? `${verificationUri}?otc=${encodeURIComponent(userCode)}` : verificationUri)
        this.microsoftLogin = { userCode, verificationUri, complete, message: data?.message || '', expiresAt: data?.expires_in ? Date.now() + Number(data.expires_in) * 1000 : null }
        this.log('system', `Microsoft login required${userCode ? `, code: ${userCode}` : ''}`)
        this.emit('status', this.snapshot())
      }
    }

    let bot
    try {
      bot = mineflayer.createBot(options)
    } catch (err) {
      this.status = 'error'
      this.lastError = err?.message || String(err)
      this.log('error', this.lastError)
      this.emit('status', this.snapshot())
      this.scheduleReconnectIfNeeded()
      return this.snapshot()
    }
    this.bot = bot

    const handleBotError = (err) => {
      this.status = 'error'
      this.lastError = err?.message || String(err)
      this.log('error', this.lastError)
      this.emit('status', this.snapshot())
    }
    bot.on('error', handleBotError)

    try {
      bot.loadPlugin(pathfinder)
    } catch (err) {
      handleBotError(err)
    }
    this.pluginStatus.pathfinder = { enabled: true, loaded: true, core: true }
    this.loadOptionalPlugins(bot)

    bot.once('spawn', () => {
      this.status = 'online'
      this.log('info', `spawned as ${bot.username} on ${bot.version}`)
      this.configureMovements()
      this.startViewer()
      this.startWebInventoryViewer()
      this.autoAuthMeLogin()
      this.configureAutoEatPlugin()
      this.runJoinCommandsAfterDelay()
      this.emit('status', this.snapshot())
    })

    bot.on('login', () => {
      this.log('info', 'login ok')
      this.emit('status', this.snapshot())
    })

    bot.on('kicked', (reason) => {
      this.log('warn', 'kicked', reason)
      this.lastError = typeof reason === 'string' ? reason : JSON.stringify(reason)
      this.emit('status', this.snapshot())
    })

    bot.on('messagestr', (message) => {
      this.log('chat', message)
      this.handleAuthMeChat(message)
    })
    bot.on('health', () => {
      this.emit('status', this.snapshot())
    })
    bot.on('move', () => this.emit('status', this.snapshot()))
    bot.on('windowOpen', window => {
      this.currentWindowLabel = `window:${window?.type || 'unknown'}`
      this.log('info', `window opened ${window?.type || ''}`)
      this.emit('status', this.snapshot())
    })
    bot.on('windowClose', () => {
      this.currentWindowLabel = null
      this.log('info', 'window closed')
      this.emit('status', this.snapshot())
    })

    bot.on('death', () => {
      this.log('warn', 'bot died')
      if (this.account.autoRespawn !== false) {
        setTimeout(() => {
          try {
            if (this.bot && typeof this.bot.respawn === 'function') {
              this.bot.respawn()
              this.log('info', 'respawn requested')
            }
          } catch (err) {
            this.log('error', `respawn failed: ${err.message}`)
          }
        }, 1000).unref?.()
      }
    })

    bot.on('goal_reached', () => {
      this.log('info', 'pathfinder goal reached')
      if (!this.activePathTask?.dynamic) this.stopPathRecovery()
      this.emit('status', this.snapshot())
    })

    bot.on('path_update', (result) => {
      if (result?.status && result.status !== 'partial') this.log('debug', `path ${result.status}`)
      if (['noPath', 'timeout'].includes(result?.status) && this.activePathTask) {
        this.log('warn', `pathfinder ${result.status}, waiting for recovery/replan`)
      }
    })

    bot.on('end', (reason) => {
      this.log('info', `ended${reason ? `: ${reason}` : ''}`)
      this.cleanupBot()
      this.emit('status', this.snapshot())
      this.scheduleReconnectIfNeeded()
    })

    return this.snapshot()
  }

  loadOptionalPlugins (bot) {
    const optional = [
      ['mineflayer-auto-eat', 'autoEatPlugin', this.account.enableAutoEatPlugin, mod => mod.plugin || mod],
      ['mineflayer-pvp', 'pvp', this.account.enablePvpPlugin, mod => mod.plugin || mod],
      ['mineflayer-armor-manager', 'armorManager', this.account.enableArmorManager, mod => mod],
      ['mineflayer-collectblock', 'collectBlock', this.account.enableCollectBlock, mod => mod.plugin || mod],
      ['mineflayer-tool', 'tool', this.account.enableToolPlugin, mod => mod.plugin || mod]
    ]
    for (const [pkg, key, enabled, pick] of optional) {
      if (!enabled) {
        this.pluginStatus[key] = { enabled: false, loaded: false, package: pkg }
        continue
      }
      try {
        const mod = optionalRequire(pkg)
        if (!mod) throw new Error('not installed')
        bot.loadPlugin(pick(mod))
        this.pluginStatus[key] = { enabled: true, loaded: true, package: pkg }
        this.log('info', `optional plugin loaded: ${pkg}`)
      } catch (err) {
        this.pluginStatus[key] = { enabled: true, loaded: false, package: pkg, error: err.message }
        this.log('warn', `optional plugin skipped: ${pkg}: ${err.message}`)
      }
    }
  }

  targetHost () { return this.account.host || this.serverConfig.host }
  targetPort () { return Number(this.account.port || this.serverConfig.port || 25565) }

  cleanupBot () {
    this.stopGuard({ silent: true })
    if (this.bot) {
      try { this.bot.pathfinder?.stop?.() } catch {}
      try { this.bot.viewer?.close?.() } catch {}
      try { this.bot.removeAllListeners() } catch {}
    }
    this.bot = null
    this.status = 'offline'
    this.viewerStarted = false
    this.webInventoryStarted = false
    this.autoEatLock = false
    this.currentContainer = null
    this.currentFurnace = null
    this.currentWindowLabel = null
  }

  stop () {
    this.manualStop = true
    this.clearReconnectTimer()
    const bot = this.bot
    if (!bot) return this.snapshot()
    this.log('info', 'disconnect requested')
    try {
      bot.pathfinder?.stop?.()
      bot.viewer?.close?.()
      bot.quit('Web panel disconnect')
    } catch (err) {
      this.log('error', err.message)
    } finally {
      this.cleanupBot()
    }
    return this.snapshot()
  }

  clearReconnectTimer () {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  scheduleReconnectIfNeeded () {
    if (this.manualStop || !this.account.autoReconnect) return
    const delay = Number(this.account.reconnectDelayMs || 5000)
    this.status = 'reconnecting'
    this.log('info', `auto reconnect in ${delay}ms`)
    this.emit('status', this.snapshot())
    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      try { this.start() } catch (err) { this.log('error', `reconnect failed: ${err.message}`) }
    }, delay)
    this.reconnectTimer.unref?.()
  }

  updateAccount (nextAccount) {
    const wasOnline = Boolean(this.bot)
    if (wasOnline) this.stop()
    const oldId = this.account.id
    this.account = normalizeAccount(nextAccount)
    this.log('info', oldId === this.account.id ? 'bot config updated' : `bot config updated, id ${oldId} -> ${this.account.id}`)
    return this.snapshot()
  }

  configureMovements () {
    const bot = this.ensureOnline()
    const move = new Movements(bot)
    move.canDig = this.account.canDig !== false
    move.allow1by1towers = this.account.allow1by1towers !== false
    move.canOpenDoors = true
    move.allowSprinting = true
    move.maxDropDown = Number(this.account.maxDropDown || 3)
    move.liquidCost = Number(this.account.liquidCost || 100)
    move.entityCost = Number(this.account.entityCost || 1)

    // Extra flags exposed by recent mineflayer-pathfinder versions. These are assigned defensively so
    // older versions can still run. They improve jumping, scaffold placement and obstacle handling.
    if ('allowParkour' in move) move.allowParkour = true
    if ('allowFreeMotion' in move) move.allowFreeMotion = true
    if ('canPlaceBlocks' in move) move.canPlaceBlocks = true
    if ('placeCost' in move) move.placeCost = Number(this.account.placeCost || 2)
    if ('digCost' in move) move.digCost = Number(this.account.digCost || 5)

    const registry = bot.registry?.blocksByName || {}
    const addId = (set, id) => { try { if (set && id != null && typeof set.add === 'function') set.add(id) } catch {} }
    const scaffoldNames = ['dirt', 'cobblestone', 'stone', 'netherrack', 'oak_planks', 'spruce_planks', 'birch_planks', 'sandstone']
    const scaffoldIds = scaffoldNames.map(name => registry[name]?.id).filter(id => id != null)
    if (scaffoldIds.length) move.scafoldingBlocks = scaffoldIds

    const avoidRe = /(fence|fence_gate|wall|pane|bars|cactus|campfire|fire|lava|magma|sweet_berry|powder_snow)/
    const neverBreakRe = /(bedrock|barrier|command_block|structure_block|jigsaw|end_portal|nether_portal|chest|ender_chest|shulker_box|fence|fence_gate|wall|pane|bars)/
    for (const block of Object.values(registry)) {
      if (!block?.name) continue
      if (avoidRe.test(block.name)) addId(move.blocksToAvoid, block.id)
      if (neverBreakRe.test(block.name)) addId(move.blocksCantBreak, block.id)
    }
    const avoidFn = block => (block?.name && avoidRe.test(block.name)) ? 100 : 0
    const cantBreakFn = block => (block?.name && neverBreakRe.test(block.name)) ? 100 : 0
    if (Array.isArray(move.exclusionAreasStep)) move.exclusionAreasStep.push(avoidFn)
    if (Array.isArray(move.exclusionAreasPlace)) move.exclusionAreasPlace.push(avoidFn)
    if (Array.isArray(move.exclusionAreasBreak)) move.exclusionAreasBreak.push(cantBreakFn)

    bot.pathfinder.thinkTimeout = Number(this.account.pathThinkTimeout || 8000)
    bot.pathfinder.searchRadius = Number(this.account.pathSearchRadius || 120)
    bot.pathfinder.setMovements(move)
    this.defaultMovements = move
  }

  stopPathRecovery () {
    if (this.pathRecoveryTimer) clearInterval(this.pathRecoveryTimer)
    this.pathRecoveryTimer = null
    this.activePathTask = null
  }

  startPathRecovery (label, getGoal, dynamic = false) {
    this.stopPathRecovery()
    const bot = this.bot
    if (!bot?.entity || typeof getGoal !== 'function') return
    let lastPos = bot.entity.position.clone()
    let stuckTicks = 0
    this.activePathTask = { label, dynamic }
    this.pathRecoveryTimer = setInterval(() => {
      try {
        if (!this.bot?.entity || this.status !== 'online') return this.stopPathRecovery()
        const pos = this.bot.entity.position
        const moved = pos.distanceTo(lastPos)
        lastPos = pos.clone()
        if (moved < 0.08) stuckTicks += 1
        else stuckTicks = 0
        if (stuckTicks < 2) return
        stuckTicks = 0
        this.log('warn', `${label} seems stuck, recalculating path`)
        this.bot.setControlState('jump', true)
        setTimeout(() => { try { this.bot?.setControlState('jump', false) } catch {} }, 350).unref?.()
        const goal = getGoal()
        if (goal) {
          if (this.defaultMovements) this.bot.pathfinder.setMovements(this.defaultMovements)
          this.bot.pathfinder.setGoal(null)
          setTimeout(() => {
            try { if (this.bot) this.bot.pathfinder.setGoal(goal, dynamic) } catch (err) { this.log('debug', `path recalculation skipped: ${err.message}`) }
          }, 150).unref?.()
        }
      } catch (err) {
        this.log('debug', `path recovery skipped: ${err.message}`)
      }
    }, 2500)
    this.pathRecoveryTimer.unref?.()
  }

  startViewer () {
    const bot = this.ensureOnline()
    if (!this.account.viewerPort || this.viewerStarted) return
    try {
      const mineflayerViewer = getMineflayerViewer()
      if (!mineflayerViewer) {
        const reason = cachedViewerLoadError?.message || 'prismarine-viewer is not available'
        this.pluginStatus.viewer = { enabled: true, loaded: false, package: 'prismarine-viewer', error: reason }
        throw new Error(`${reason}. Run npm install canvas@npm:@napi-rs/canvas prismarine-viewer --save, or reinstall this release package.`)
      }
      mineflayerViewer(bot, {
        host: '127.0.0.1',
        port: this.account.viewerPort,
        firstPerson: Boolean(this.account.firstPersonViewer),
        viewDistance: this.account.viewDistance || 6
      })
      this.pluginStatus.viewer = { enabled: true, loaded: true, package: 'prismarine-viewer' }
      this.viewerStarted = true
      this.log('info', `viewer started on port ${this.account.viewerPort}`)
    } catch (err) {
      this.lastError = `viewer failed: ${err.message}`
      this.log('error', this.lastError)
    }
  }

  setViewerPerspective (firstPerson) {
    const next = Boolean(firstPerson)
    this.account.firstPersonViewer = next
    if (this.bot) {
      if (this.viewerStarted) {
        try { this.bot.viewer?.close?.() } catch {}
        this.viewerStarted = false
      }
      this.log('info', `viewer perspective set to ${next ? 'first person' : 'third person'}`)
      this.startViewer()
    }
    return this.snapshot()
  }

  startWebInventoryViewer () {
    const bot = this.ensureOnline()
    if (!this.account.enableWebInventory || !this.account.webInventoryPort || this.webInventoryStarted) return
    try {
      const inventoryViewer = optionalRequire('mineflayer-web-inventory')
      if (!inventoryViewer) throw new Error('mineflayer-web-inventory is not installed')
      inventoryViewer(bot, { host: '127.0.0.1', port: Number(this.account.webInventoryPort) })
      this.webInventoryStarted = true
      this.log('info', `web inventory started on port ${this.account.webInventoryPort}`)
    } catch (err) {
      this.log('warn', `web inventory skipped: ${err.message}`)
      this.pluginStatus.webInventory = { enabled: true, loaded: false, package: 'mineflayer-web-inventory', error: err.message }
      return
    }
    this.pluginStatus.webInventory = { enabled: true, loaded: true, package: 'mineflayer-web-inventory' }
  }

  async autoAuthMeLogin () {
    if (!this.account.authmePassword || this.account.authmeAutoLogin === false) return
    await sleep(Number(this.account.authmeDelayMs ?? 1500))
    if (!this.bot) return
    this.sendAuthMe('login')
  }

  sendAuthMe (mode = 'login') {
    const bot = this.ensureOnline()
    if (!this.account.authmePassword) throw new Error('AuthMe password is not configured')
    const template = mode === 'register'
      ? (this.account.authmeRegisterCommand || '/reg {password} {email}')
      : (this.account.authmeCommand || '/login {password}')
    const command = this.renderCommandTemplate(template)
    bot.chat(command)
    if (mode === 'register') this.authmeRegisterSent = true
    this.log('info', `AuthMe ${mode} command sent`)
    return this.snapshot()
  }

  renderCommandTemplate (template) {
    return String(template || '')
      .split('{password}').join(this.account.authmePassword || '')
      .split('{email}').join(this.account.authmeEmail || '')
      .split('{username}').join(this.account.username || '')
      .trim()
  }

  handleAuthMeChat (message) {
    const text = String(message || '').toLowerCase()
    const looksUnregistered = text.includes('未注册') || text.includes('/reg') || text.includes('/register') || text.includes('not registered') || text.includes('please register')
    if (!looksUnregistered || !this.account.authmeAutoRegister || this.authmeRegisterSent || !this.account.authmePassword) return
    setTimeout(() => {
      try { if (this.bot) this.sendAuthMe('register') } catch (err) { this.log('warn', `AuthMe auto register skipped: ${err.message}`) }
    }, 700).unref?.()
  }

  async runJoinCommandsAfterDelay () {
    const commands = Array.isArray(this.account.joinCommands) ? this.account.joinCommands.filter(Boolean) : []
    if (!commands.length || this.joinCommandsStarted) return
    this.joinCommandsStarted = true
    const delay = Number(this.account.authmeDelayMs || 0) + Number(this.account.joinCommandDelayMs || 2500)
    await sleep(delay)
    for (const raw of commands) {
      if (!this.bot) return
      const command = this.renderCommandTemplate(raw)
      if (!command) continue
      this.bot.chat(command)
      this.log('info', `join command sent: ${command.replace(this.account.authmePassword || '__never__', '***')}`)
      await sleep(850)
    }
  }

  configureAutoEatPlugin () {
    const bot = this.bot
    if (!bot || !bot.autoEat || !this.pluginStatus.autoEatPlugin?.loaded || this.account.enableAutoEatPlugin === false) return
    try {
      bot.autoEat.options = bot.autoEat.options || {}
      bot.autoEat.options.startAt = Number(this.account.autoEatThreshold || 14)
      bot.autoEat.options.priority = 'foodPoints'
      if (typeof bot.autoEat.enableAuto === 'function') bot.autoEat.enableAuto()
      this.log('info', 'auto-eat plugin enabled')
    } catch (err) {
      this.log('warn', `auto-eat plugin config skipped: ${err.message}`)
    }
  }

  async goto (x, y, z, range = 1) {
    const bot = this.ensureOnline()
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw new Error('x/y/z must be numbers')
    const goal = new GoalNear(x, y, z, Math.max(0.5, Number(range) || 1))
    if (this.defaultMovements) bot.pathfinder.setMovements(this.defaultMovements)
    bot.pathfinder.setGoal(goal)
    this.startPathRecovery('goto', () => new GoalNear(x, y, z, Math.max(0.5, Number(range) || 1)), false)
    this.log('info', `goto ${x} ${y} ${z} range=${range}`)
    return this.snapshot()
  }

  async follow (username, range = 2) {
    const bot = this.ensureOnline()
    if (!username) throw new Error('username is required')
    const target = bot.players[username]?.entity
    if (!target) throw new Error(`Player not found or not visible: ${username}`)
    if (!GoalFollow) throw new Error('GoalFollow is not available in current mineflayer-pathfinder version')
    if (this.defaultMovements) bot.pathfinder.setMovements(this.defaultMovements)
    const followRange = Math.max(1, Number(range) || 2)
    bot.pathfinder.setGoal(new GoalFollow(target, followRange), true)
    this.startPathRecovery('follow', () => {
      const entity = bot.players[username]?.entity
      return entity ? new GoalFollow(entity, followRange) : null
    }, true)
    this.log('info', `follow ${username} range=${range}`)
    return this.snapshot()
  }

  stopTask () {
    const bot = this.ensureOnline()
    this.stopPathRecovery()
    bot.pathfinder?.stop?.()
    if (bot.pvp?.stop) bot.pvp.stop()
    for (const control of ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak']) bot.setControlState(control, false)
    bot.deactivateItem?.()
    this.stopGuard({ silent: true })
    this.log('info', 'current task stopped')
    return this.snapshot()
  }

  chat (message) {
    const bot = this.ensureOnline()
    if (!message || typeof message !== 'string') throw new Error('message is required')
    bot.chat(message)
    this.log('chat', `<${bot.username}> ${message}`)
    return this.snapshot()
  }

  setControl (control, state) {
    const bot = this.ensureOnline()
    const allowed = new Set(['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'])
    if (!allowed.has(control)) throw new Error(`Unsupported control: ${control}`)
    if (Boolean(state)) {
      this.stopPathRecovery()
      try { bot.pathfinder?.stop?.() } catch {}
    }
    bot.setControlState(control, Boolean(state))
    this.log('debug', `${control}=${Boolean(state)}`)
    return this.snapshot()
  }

  async look (yaw, pitch) {
    const bot = this.ensureOnline()
    await bot.look(Number(yaw), Number(pitch), true)
    this.log('info', `look yaw=${yaw} pitch=${pitch}`)
    return this.snapshot()
  }

  async lookRelative (dx = 0, dy = 0, sensitivity = 0.003) {
    const bot = this.ensureOnline()
    const yaw = Number(bot.entity?.yaw || 0) - Number(dx || 0) * Number(sensitivity || 0.003)
    const limit = Math.PI / 2 - 0.01
    const pitch = Math.max(-limit, Math.min(limit, Number(bot.entity?.pitch || 0) + Number(dy || 0) * Number(sensitivity || 0.003)))
    await bot.look(yaw, pitch, true)
    this.emit('status', this.snapshot())
    return this.snapshot()
  }

  setQuickBarSlot (slot) {
    const bot = this.ensureOnline()
    const n = Math.max(0, Math.min(8, Number(slot) || 0))
    if (typeof bot.setQuickBarSlot === 'function') bot.setQuickBarSlot(n)
    else {
      bot.quickBarSlot = n
      try { bot._client?.write?.('held_item_slot', { slotId: n }) } catch {}
    }
    this.log('debug', `hotbar slot=${n + 1}`)
    this.emit('status', this.snapshot())
    return this.snapshot()
  }

  async lookAtPlayer (username) {
    const bot = this.ensureOnline()
    if (!username) throw new Error('username is required')
    const entity = bot.players[username]?.entity
    if (!entity) throw new Error(`Player not found or not visible: ${username}`)
    await bot.lookAt(entity.position.offset(0, entity.height || 1, 0), true)
    this.log('info', `look at ${username}`)
    return this.snapshot()
  }

  async attack ({ mode = 'nearest', username, maxDistance = 4, hostileOnly = false } = {}) {
    const bot = this.ensureOnline()
    let entity = null
    const maxDist = Number(maxDistance) || 4
    if (username) {
      entity = bot.players[username]?.entity
    } else if (mode === 'cursor' && typeof bot.entityAtCursor === 'function') {
      entity = bot.entityAtCursor(maxDist)
    } else {
      entity = bot.nearestEntity(e => this.isAttackable(e, maxDist, hostileOnly))
    }
    if (!entity) throw new Error('No target entity found')
    await this.attackEntity(entity)
    return this.snapshot()
  }

  isAttackable (entity, maxDist = 6, hostileOnly = false) {
    const bot = this.bot
    if (!bot || !entity || entity === bot.entity) return false
    if (entity.position.distanceTo(bot.entity.position) > maxDist) return false
    if (hostileOnly) return HOSTILE_MOBS.has(entity.name)
    return entity.type === 'mob' || entity.type === 'player' || HOSTILE_MOBS.has(entity.name)
  }

  async attackEntity (entity) {
    const bot = this.ensureOnline()
    await bot.lookAt(entity.position.offset(0, entity.height || 1, 0), true)
    if (bot.pvp?.attack) bot.pvp.attack(entity)
    else bot.attack(entity)
    this.log('info', `attack ${entity.username || entity.name || entity.type}`)
  }

  async leftClick () {
    const bot = this.ensureOnline()
    const entity = typeof bot.entityAtCursor === 'function' ? bot.entityAtCursor(4.5) : null
    if (entity) {
      await this.attackEntity(entity)
      return this.snapshot()
    }
    bot.swingArm('right')
    this.log('info', 'left click swing')
    return this.snapshot()
  }

  async rightClick () {
    const bot = this.ensureOnline()
    const entity = typeof bot.entityAtCursor === 'function' ? bot.entityAtCursor(4.5) : null
    if (entity) {
      await bot.lookAt(entity.position.offset(0, entity.height || 1, 0), true)
      await bot.activateEntity(entity)
      this.log('info', `right click entity ${entity.username || entity.name || entity.type}`)
      return this.snapshot()
    }
    const block = typeof bot.blockAtCursor === 'function' ? bot.blockAtCursor(5) : null
    if (block) {
      await bot.activateBlock(block)
      this.log('info', `right click block ${block.name}`)
      return this.snapshot()
    }
    bot.activateItem()
    await sleep(100)
    bot.deactivateItem?.()
    this.log('info', 'right click item')
    return this.snapshot()
  }

  async digCursorBlock () {
    const bot = this.ensureOnline()
    const block = typeof bot.blockAtCursor === 'function' ? bot.blockAtCursor(5) : null
    if (!block) throw new Error('No block at cursor')
    await this.digBlockObject(block)
    return this.snapshot()
  }

  async digBlockAt (x, y, z, range = 1) {
    const bot = this.ensureOnline()
    const block = bot.blockAt(new Vec3(Number(x), Number(y), Number(z)))
    if (!block || block.name === 'air') throw new Error('No diggable block at target coordinate')
    const dist = bot.entity.position.distanceTo(block.position)
    if (dist > 4.5) await this.goto(block.position.x, block.position.y, block.position.z, Math.max(1, Number(range) || 1))
    await sleep(300)
    await this.digBlockObject(block)
    return this.snapshot()
  }

  async digNearestBlock ({ name, maxDistance = 32, count = 1 } = {}) {
    const bot = this.ensureOnline()
    if (!name) throw new Error('block name is required')
    const blocks = bot.findBlocks({ matching: b => b && b.name === name, maxDistance: Number(maxDistance) || 32, count: Math.max(1, Number(count) || 1) })
    if (!blocks.length) throw new Error(`No nearby block found: ${name}`)
    let done = 0
    for (const pos of blocks) {
      const block = bot.blockAt(pos)
      if (!block || block.name === 'air') continue
      try {
        await this.digBlockAt(block.position.x, block.position.y, block.position.z, 1)
        done++
      } catch (err) {
        this.log('warn', `dig skipped ${block.name}: ${err.message}`)
      }
    }
    this.log('info', `dig nearest ${name}: ${done}/${blocks.length}`)
    return this.snapshot()
  }

  async collectBlock ({ name, maxDistance = 32, count = 1 } = {}) {
    const bot = this.ensureOnline()
    if (!name) throw new Error('block name is required')
    const blocks = bot.findBlocks({ matching: b => b && b.name === name, maxDistance: Number(maxDistance) || 32, count: Math.max(1, Number(count) || 1) })
    if (!blocks.length) throw new Error(`No nearby block found: ${name}`)
    const blockObjects = blocks.map(pos => bot.blockAt(pos)).filter(Boolean)
    if (bot.collectBlock?.collect) {
      await new Promise((resolve, reject) => bot.collectBlock.collect(blockObjects, err => err ? reject(err) : resolve()))
      this.log('info', `collectBlock plugin collected ${blockObjects.length} ${name}`)
    } else {
      for (const block of blockObjects) await this.digBlockAt(block.position.x, block.position.y, block.position.z, 1)
      this.log('info', `fallback collected ${blockObjects.length} ${name}`)
    }
    return this.snapshot()
  }

  normalizeBlockNames (input, preset = '') {
    const presets = {
      ore: ['coal_ore','deepslate_coal_ore','iron_ore','deepslate_iron_ore','copper_ore','deepslate_copper_ore','gold_ore','deepslate_gold_ore','redstone_ore','deepslate_redstone_ore','lapis_ore','deepslate_lapis_ore','diamond_ore','deepslate_diamond_ore','emerald_ore','deepslate_emerald_ore','nether_gold_ore','nether_quartz_ore'],
      tree: ['oak_log','spruce_log','birch_log','jungle_log','acacia_log','dark_oak_log','mangrove_log','cherry_log','crimson_stem','warped_stem']
    }
    if (preset && presets[preset]) return presets[preset]
    const raw = Array.isArray(input) ? input : String(input || '').split(/[\s,，]+/)
    return raw.map(v => String(v || '').trim()).filter(Boolean)
  }

  findBlocksByNames (names, maxDistance = 48, count = 16) {
    const bot = this.ensureOnline()
    const set = new Set(names)
    if (!set.size) throw new Error('block name is required')
    const limit = Math.max(1, Number(count) || 1)
    const max = Number(maxDistance) || 48
    if (typeof bot.findBlockSync === 'function') {
      try {
        const blocks = bot.findBlockSync({ point: bot.entity.position, matching: block => block && set.has(block.name), maxDistance: max, count: limit }) || []
        if (Array.isArray(blocks) && blocks.length && blocks[0]?.position) return blocks
      } catch (err) { this.log('debug', `blockfinder skipped: ${err.message}`) }
    }
    const positions = bot.findBlocks({ matching: b => b && set.has(b.name), maxDistance: max, count: limit })
    return positions.map(pos => bot.blockAt(pos)).filter(Boolean)
  }

  async collectBlocksByNames ({ names, preset = '', maxDistance = 48, count = 16, label = 'blocks' } = {}) {
    const bot = this.ensureOnline()
    const blockNames = this.normalizeBlockNames(names, preset)
    if (!blockNames.length) throw new Error('block name is required')
    const blocks = this.findBlocksByNames(blockNames, maxDistance, count).filter(b => b && b.name !== 'air')
    if (!blocks.length) throw new Error(`No nearby ${label} found`)
    if (bot.collectBlock?.collect) {
      await new Promise((resolve, reject) => bot.collectBlock.collect(blocks, err => err ? reject(err) : resolve()))
      this.log('info', `collectBlock plugin collected ${blocks.length} ${label}`)
    } else {
      for (const block of blocks) await this.digBlockAt(block.position.x, block.position.y, block.position.z, 1)
      this.log('info', `fallback collected ${blocks.length} ${label}`)
    }
    return this.snapshot()
  }

  async autoMine ({ names, name, maxDistance = 48, count = 16 } = {}) {
    return this.collectBlocksByNames({ names: names || name, preset: names || name ? '' : 'ore', maxDistance, count, label: 'ore/block' })
  }

  async cutTrees ({ names, name, maxDistance = 48, count = 32 } = {}) {
    return this.collectBlocksByNames({ names: names || name, preset: names || name ? '' : 'tree', maxDistance, count, label: 'logs' })
  }

  async digBlockObject (block) {
    const bot = this.ensureOnline()
    if (!block || block.name === 'air') throw new Error('No block to dig')
    if (bot.tool?.equipForBlock) {
      try { await bot.tool.equipForBlock(block, {}) } catch (err) { this.log('debug', `tool plugin skipped: ${err.message}`) }
    } else {
      await this.equipBestToolForBlock(block).catch(err => this.log('debug', `auto tool skipped: ${err.message}`))
    }
    if (!bot.canDigBlock(block)) throw new Error(`Cannot dig block ${block.name}`)
    await bot.dig(block)
    this.log('info', `dig block ${block.name} at ${block.position.x} ${block.position.y} ${block.position.z}`)
  }

  async equipBestToolForBlock (block) {
    const bot = this.ensureOnline()
    const harvest = bot.pathfinder?.movements?.getBlockInfo ? null : null
    const preferred = toolHints(block.name)
    if (!preferred.length) return
    const item = bot.inventory.items().find(i => preferred.some(key => i.name.includes(key)))
    if (item) await bot.equip(item, 'hand')
    void harvest
  }

  async eat ({ silentIfNoFood = false } = {}) {
    const bot = this.ensureOnline()
    const food = bot.inventory.items().find(isProbablyFood)
    if (!food) {
      if (silentIfNoFood) throw new Error('No food found')
      throw new Error('No food found in inventory')
    }
    await bot.equip(food, 'hand')
    if (typeof bot.consume === 'function') await bot.consume()
    else {
      bot.activateItem()
      await sleep(1800)
      bot.deactivateItem?.()
    }
    this.log('info', `ate ${food.name}`)
    return this.snapshot()
  }

  async equipItem ({ slot, name } = {}) {
    const bot = this.ensureOnline()
    let item = null
    if (slot != null && slot !== '') item = bot.inventory.items().find(i => Number(i.slot) === Number(slot))
    if (!item && name) item = bot.inventory.items().find(i => i.name === name || i.displayName === name)
    if (!item) throw new Error('Item not found in inventory')
    await bot.equip(item, 'hand')
    this.log('info', `equipped ${item.name}`)
    return this.snapshot()
  }

  async dropItem ({ slot, name, count } = {}) {
    const bot = this.ensureOnline()
    let item = null
    if (slot != null && slot !== '') item = bot.inventory.items().find(i => Number(i.slot) === Number(slot))
    if (!item && name) item = bot.inventory.items().find(i => i.name === name || i.displayName === name)
    if (!item) throw new Error('Item not found in inventory')
    if (count) await bot.toss(item.type, item.metadata, Math.min(Number(count), item.count))
    else await bot.tossStack(item)
    this.log('info', `dropped ${item.name}`)
    return this.snapshot()
  }

  getInventory () {
    const bot = this.ensureOnline()
    const slots = bot.inventory.slots.map((item, slot) => item ? serializeItem(item, slot) : { slot, empty: true })
    const items = bot.inventory.items().map(item => serializeItem(item, item.slot))
    const equipment = {}
    for (const [name, slot] of Object.entries({ hand: bot.getEquipmentDestSlot?.('hand'), head: bot.getEquipmentDestSlot?.('head'), torso: bot.getEquipmentDestSlot?.('torso'), legs: bot.getEquipmentDestSlot?.('legs'), feet: bot.getEquipmentDestSlot?.('feet'), offhand: bot.getEquipmentDestSlot?.('off-hand') })) {
      if (slot != null && bot.inventory.slots[slot]) equipment[name] = serializeItem(bot.inventory.slots[slot], slot)
    }
    return { slots, items, equipment, hotbar: quickBar(bot), selectedSlot: bot.quickBarSlot, heldItem: bot.heldItem ? serializeItem(bot.heldItem, bot.heldItem.slot) : null }
  }

  getPlayers () {
    const bot = this.ensureOnline()
    return Object.values(bot.players).map(player => ({
      username: player.username,
      ping: player.ping,
      gamemode: player.gamemode,
      entityId: player.entity?.id,
      position: player.entity?.position ? vec(player.entity.position) : null
    }))
  }

  blockFromInput ({ x, y, z, cursor = false } = {}) {
    const bot = this.ensureOnline()
    if (cursor) {
      const block = typeof bot.blockAtCursor === 'function' ? bot.blockAtCursor(5) : null
      if (!block) throw new Error('No block at cursor')
      return block
    }
    if (![x, y, z].every(v => Number.isFinite(Number(v)))) throw new Error('x/y/z are required')
    const block = bot.blockAt(new Vec3(Number(x), Number(y), Number(z)))
    if (!block) throw new Error('Block not loaded at coordinate')
    return block
  }

  async openBlockWindow (input = {}) {
    const bot = this.ensureOnline()
    const block = this.blockFromInput(input)
    await bot.lookAt(block.position.offset(0.5, 0.5, 0.5), true)
    if (block.name.includes('chest') || block.name.includes('barrel') || block.name.includes('shulker_box')) {
      this.currentContainer = typeof bot.openContainer === 'function' ? await bot.openContainer(block) : await bot.openChest(block)
      this.currentWindowLabel = `container:${block.name}`
      this.log('info', `opened container ${block.name}`)
      return this.getOpenWindow()
    }
    if (block.name.includes('furnace') || block.name.includes('blast_furnace') || block.name.includes('smoker')) {
      this.currentFurnace = await bot.openFurnace(block)
      this.currentWindowLabel = `furnace:${block.name}`
      this.log('info', `opened furnace ${block.name}`)
      return this.getOpenWindow()
    }
    await bot.activateBlock(block)
    await sleep(300)
    this.currentWindowLabel = `window:${block.name}`
    this.log('info', `activated block window ${block.name}`)
    return this.getOpenWindow()
  }

  getOpenWindow () {
    const bot = this.ensureOnline()
    const window = this.currentContainer?.window || this.currentFurnace?.window || bot.currentWindow
    if (!window) return { open: false, label: null, slots: [] }
    return {
      open: true,
      label: this.currentWindowLabel,
      id: window.id,
      type: window.type,
      title: String(window.title || ''),
      slots: window.slots.map((item, slot) => item ? serializeItem(item, slot) : { slot, empty: true })
    }
  }

  closeWindow () {
    const bot = this.ensureOnline()
    try { this.currentContainer?.close?.() } catch {}
    try { this.currentFurnace?.close?.() } catch {}
    try { bot.closeWindow?.(bot.currentWindow) } catch {}
    this.currentContainer = null
    this.currentFurnace = null
    this.currentWindowLabel = null
    this.log('info', 'closed current window/container')
    return this.snapshot()
  }

  async chestWithdraw ({ itemType, name, count = 1 } = {}) {
    const chest = this.currentContainer
    if (!chest?.withdraw) throw new Error('No chest/barrel container is open')
    const type = Number(itemType) || this.itemTypeByName(name)
    if (!type) throw new Error('itemType or item name is required')
    await chest.withdraw(type, null, Number(count) || 1)
    this.log('info', `withdrew ${name || type} x${count}`)
    return this.getOpenWindow()
  }

  async chestDeposit ({ itemType, name, count = 1 } = {}) {
    const chest = this.currentContainer
    if (!chest?.deposit) throw new Error('No chest/barrel container is open')
    const type = Number(itemType) || this.itemTypeByName(name)
    if (!type) throw new Error('itemType or item name is required')
    await chest.deposit(type, null, Number(count) || 1)
    this.log('info', `deposited ${name || type} x${count}`)
    return this.getOpenWindow()
  }

  async clickWindowSlot ({ slot, mouseButton = 0, mode = 0 } = {}) {
    const bot = this.ensureOnline()
    if (slot == null) throw new Error('slot is required')
    await bot.clickWindow(Number(slot), Number(mouseButton) || 0, Number(mode) || 0)
    this.log('info', `clicked window slot ${slot}`)
    return this.getOpenWindow()
  }

  itemTypeByName (name) {
    const bot = this.ensureOnline()
    if (!name) return null
    const matches = item => item && (item.name === name || item.displayName === name)
    const inventoryItem = bot.inventory.items().find(matches)
    if (inventoryItem) return inventoryItem.type
    const containerItem = this.currentContainer?.containerItems?.().find(matches)
    if (containerItem) return containerItem.type
    const window = this.currentContainer?.window || this.currentFurnace?.window || bot.currentWindow
    const windowItem = window?.slots?.find(matches)
    return windowItem?.type || null
  }

  async furnacePutInput ({ slot, name, count = 1 } = {}) {
    if (!this.currentFurnace?.putInput) throw new Error('No furnace is open')
    const item = this.findInventoryItem({ slot, name })
    await this.currentFurnace.putInput(item.type, null, Number(count) || 1)
    this.log('info', `furnace input ${item.name} x${count}`)
    return this.getOpenWindow()
  }

  async furnacePutFuel ({ slot, name, count = 1 } = {}) {
    if (!this.currentFurnace?.putFuel) throw new Error('No furnace is open')
    const item = this.findInventoryItem({ slot, name })
    await this.currentFurnace.putFuel(item.type, null, Number(count) || 1)
    this.log('info', `furnace fuel ${item.name} x${count}`)
    return this.getOpenWindow()
  }

  async furnaceTakeOutput () {
    if (!this.currentFurnace?.takeOutput) throw new Error('No furnace is open')
    const item = await this.currentFurnace.takeOutput()
    this.log('info', `furnace output taken${item ? ` ${item.name} x${item.count}` : ''}`)
    return this.getOpenWindow()
  }

  findInventoryItem ({ slot, name } = {}) {
    const bot = this.ensureOnline()
    let item = null
    if (slot != null && slot !== '') item = bot.inventory.items().find(i => Number(i.slot) === Number(slot))
    if (!item && name) item = bot.inventory.items().find(i => i.name === name || i.displayName === name)
    if (!item) throw new Error('Inventory item not found')
    return item
  }

  async mountNearestVehicle ({ maxDistance = 6 } = {}) {
    const bot = this.ensureOnline()
    const entity = bot.nearestEntity(e => {
      if (!e || e === bot.entity) return false
      if (e.position.distanceTo(bot.entity.position) > Number(maxDistance || 6)) return false
      const name = String(e.name || e.displayName || e.type || '').toLowerCase()
      return ['boat', 'minecart', 'horse', 'donkey', 'mule', 'pig', 'strider', 'camel'].some(key => name.includes(key))
    })
    if (!entity) throw new Error('No nearby vehicle/mount found')
    await bot.mount(entity)
    this.log('info', `mounted ${entity.name || entity.type}`)
    return this.snapshot()
  }

  dismount () {
    const bot = this.ensureOnline()
    bot.dismount()
    this.log('info', 'dismounted')
    return this.snapshot()
  }

  startGuard ({ x, y, z, radius = 16, mode = 'hostile', returnHome = true, intervalMs = 1000 } = {}) {
    const bot = this.ensureOnline()
    const center = [x, y, z].every(v => Number.isFinite(Number(v)))
      ? new Vec3(Number(x), Number(y), Number(z))
      : bot.entity.position.clone()
    this.stopGuard({ silent: true })
    this.guard = { enabled: true, timer: null, center, radius: Number(radius) || 16, mode, returnHome: returnHome !== false }
    this.guard.timer = setInterval(() => this.guardTick().catch(err => this.log('warn', `guard tick skipped: ${err.message}`)), Math.max(500, Number(intervalMs) || 1000))
    this.guard.timer.unref?.()
    this.log('info', `guard started at ${center.x.toFixed(1)} ${center.y.toFixed(1)} ${center.z.toFixed(1)} radius=${this.guard.radius} mode=${mode}`)
    return this.snapshot()
  }

  async guardTick () {
    const bot = this.bot
    if (!bot || !this.guard.enabled || !bot.entity) return
    const center = this.guard.center
    const radius = Number(this.guard.radius) || 16
    const target = bot.nearestEntity(e => {
      if (!e || e === bot.entity) return false
      if (e.position.distanceTo(center) > radius) return false
      if (e.position.distanceTo(bot.entity.position) > Math.max(24, radius + 4)) return false
      if (this.guard.mode === 'all') return e.type === 'mob' || e.type === 'player'
      if (this.guard.mode === 'players') return e.type === 'player'
      return HOSTILE_MOBS.has(e.name)
    })
    if (target) {
      if (target.position.distanceTo(bot.entity.position) > 4) await this.goto(target.position.x, target.position.y, target.position.z, 2)
      await this.attackEntity(target)
      return
    }
    if (this.guard.returnHome && bot.entity.position.distanceTo(center) > 3) {
      bot.pathfinder.setGoal(new GoalNear(center.x, center.y, center.z, 2))
    }
  }

  stopGuard ({ silent = false } = {}) {
    if (this.guard?.timer) clearInterval(this.guard.timer)
    this.guard = { enabled: false, timer: null, center: this.guard?.center || null, radius: this.guard?.radius || 16, mode: this.guard?.mode || 'hostile', returnHome: this.guard?.returnHome !== false }
    if (!silent) this.log('info', 'guard stopped')
    return this.snapshot()
  }

  snapshot () {
    const bot = this.bot
    const position = bot?.entity?.position ? vec(bot.entity.position) : null
    const cfg = publicAccount(this.account)
    return {
      id: this.account.id,
      username: this.account.username,
      status: this.status,
      connected: Boolean(bot),
      spawned: Boolean(bot?.entity),
      minecraftVersion: bot?.version || null,
      health: bot?.health ?? null,
      food: bot?.food ?? null,
      hotbar: bot ? quickBar(bot) : [],
      oxygenLevel: bot?.oxygenLevel ?? null,
      game: bot?.game ? { dimension: bot.game.dimension, gameMode: bot.game.gameMode, difficulty: bot.game.difficulty } : null,
      position,
      yaw: bot?.entity?.yaw ?? null,
      pitch: bot?.entity?.pitch ?? null,
      target: { host: cfg.host, port: cfg.port, version: cfg.version },
      auth: cfg.auth,
      viewerPort: cfg.viewerPort,
      viewDistance: cfg.viewDistance,
      firstPersonViewer: cfg.firstPersonViewer,
      viewerStarted: this.viewerStarted,
      viewerUrl: this.viewerStarted && cfg.viewerPort ? `/viewer/${encodeURIComponent(this.account.id)}/` : null,
      webInventoryPort: cfg.webInventoryPort,
      webInventoryStarted: this.webInventoryStarted,
      webInventoryUrl: this.webInventoryStarted && cfg.webInventoryPort ? `/inventory/${encodeURIComponent(this.account.id)}/` : null,
      guard: { enabled: this.guard.enabled, center: this.guard.center ? vec(this.guard.center) : null, radius: this.guard.radius, mode: this.guard.mode, returnHome: this.guard.returnHome },
      openWindow: this.currentWindowLabel ? this.getOpenWindowSafe() : null,
      pluginStatus: this.pluginStatus,
      microsoftLogin: this.microsoftLogin,
      account: cfg,
      lastError: this.lastError,
      logs: this.logs.slice(-80)
    }
  }

  getOpenWindowSafe () {
    try { return this.getOpenWindow() } catch { return null }
  }
}

class BotManager extends EventEmitter {
  constructor (config) {
    super()
    this.config = config
    this.bots = new Map()
    for (const account of config.bots) this.addRuntimeBot(account, { skipConfig: true })
  }

  bindRuntimeBot (managed) {
    managed.on('log', entry => this.emit('log', entry))
    managed.on('status', status => this.emit('status', status))
  }

  addRuntimeBot (account, { skipConfig = false } = {}) {
    account = normalizeAccount(account, this.config, this.config.bots.length)
    if (this.bots.has(account.id)) throw new Error(`Bot id already exists: ${account.id}`)
    if (!skipConfig) {
      const next = structuredCloneSafe(this.config)
      next.bots.push(account)
      validateConfig(next)
      this.config.bots.push(account)
    }
    const managed = new ManagedBot(account, this.config.defaults.server)
    this.bindRuntimeBot(managed)
    this.bots.set(account.id, managed)
    this.emit('list', this.list())
    return managed.snapshot()
  }

  updateRuntimeBot (id, patch) {
    const managed = this.get(id)
    const currentIndex = this.config.bots.findIndex(account => account.id === id)
    if (currentIndex < 0) throw new Error(`Config missing bot id: ${id}`)
    const nextAccount = mergeAccountPatch(this.config.bots[currentIndex], patch, this.config, currentIndex)
    const nextConfig = structuredCloneSafe(this.config)
    nextConfig.bots[currentIndex] = nextAccount
    validateConfig(nextConfig)
    this.config.bots[currentIndex] = nextAccount
    if (nextAccount.id !== id) {
      this.bots.delete(id)
      managed.updateAccount(nextAccount)
      this.bots.set(nextAccount.id, managed)
    } else {
      managed.updateAccount(nextAccount)
    }
    this.emit('list', this.list())
    this.emit('status', managed.snapshot())
    return managed.snapshot()
  }

  removeRuntimeBot (id, { stop = true } = {}) {
    const managed = this.get(id)
    if (stop) managed.stop()
    managed.removeAllListeners()
    this.bots.delete(id)
    this.config.bots = this.config.bots.filter(account => account.id !== id)
    this.emit('list', this.list())
    return this.list()
  }

  startAll () {
    const result = []
    for (const managed of this.bots.values()) {
      try { result.push({ id: managed.account.id, ok: true, bot: managed.start() }) } catch (err) { result.push({ id: managed.account.id, ok: false, error: err.message }) }
    }
    this.emit('list', this.list())
    return result
  }

  stopAll () {
    const result = []
    for (const managed of this.bots.values()) {
      try { result.push({ id: managed.account.id, ok: true, bot: managed.stop() }) } catch (err) { result.push({ id: managed.account.id, ok: false, error: err.message }) }
    }
    this.emit('list', this.list())
    return result
  }

  setViewerPerspective (id, firstPerson) {
    const managed = this.get(id)
    const currentIndex = this.config.bots.findIndex(account => account.id === id)
    if (currentIndex < 0) throw new Error(`Config missing bot id: ${id}`)
    this.config.bots[currentIndex].firstPersonViewer = Boolean(firstPerson)
    const bot = managed.setViewerPerspective(Boolean(firstPerson))
    this.emit('status', bot)
    return bot
  }

  list () { return Array.from(this.bots.values()).map(bot => bot.snapshot()) }
  get (id) {
    const bot = this.bots.get(id)
    if (!bot) throw new Error(`Unknown bot id: ${id}`)
    return bot
  }
}


function quickBar (bot) {
  const selected = Number(bot.quickBarSlot || 0)
  return Array.from({ length: 9 }, (_, i) => {
    const slot = 36 + i
    const item = bot.inventory?.slots?.[slot]
    return item ? { ...serializeItem(item, slot), index: i, selected: i === selected } : { slot, index: i, selected: i === selected, empty: true }
  })
}

function serializeItem (item, slotOverride) {
  return {
    name: item.name,
    displayName: item.displayName,
    count: item.count,
    slot: slotOverride ?? item.slot,
    type: item.type,
    metadata: item.metadata,
    nbt: item.nbt ? true : false,
    food: isProbablyFood(item),
    empty: false
  }
}

function vec (v) {
  return { x: Number(v.x.toFixed(2)), y: Number(v.y.toFixed(2)), z: Number(v.z.toFixed(2)) }
}

function structuredCloneSafe (value) { return JSON.parse(JSON.stringify(value)) }

function toolHints (blockName) {
  const name = String(blockName || '')
  if (name.includes('log') || name.includes('wood') || name.includes('planks') || name.includes('stem')) return ['axe']
  if (name.includes('stone') || name.includes('ore') || name.includes('deepslate') || name.includes('netherrack') || name.includes('obsidian')) return ['pickaxe']
  if (name.includes('dirt') || name.includes('grass') || name.includes('sand') || name.includes('gravel') || name.includes('clay')) return ['shovel']
  if (name.includes('leaves') || name.includes('wool') || name.includes('vine')) return ['shears', 'sword']
  return []
}

module.exports = { BotManager }

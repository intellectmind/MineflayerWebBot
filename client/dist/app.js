(() => {
  const state = {
    authenticated: false, authRequired: true,
    bots: [], selectedId: '', tab: 'bots', logs: [], system: null, inventory: null, players: [], plugins: [], win: null, updateLogs: [], updateCheck: [], theme: localStorage.getItem('theme') || 'dark', lang: localStorage.getItem('lang') || 'zh', floatViewer: JSON.parse(localStorage.getItem('floatViewer') || '{"open":false,"x":24,"y":88,"w":560,"h":360}'), mapInline: localStorage.getItem('mapInline') !== 'off', viewerQuality: localStorage.getItem('viewerQuality') || 'balanced', viewerReloadToken: Date.now(), renderPending: false, keyboardCapture: false, mouseSensitivity: Number(localStorage.getItem('mouseSensitivity') || 0.003)
  }
  const mcVersions = ['', '1.21.11', '1.21.10', '1.21.8', '1.21.4', '1.21.1', '1.20.6', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9']
  const keyControlMap = { KeyW:'forward', ArrowUp:'forward', w:'forward', W:'forward', KeyS:'back', ArrowDown:'back', s:'back', S:'back', KeyA:'left', ArrowLeft:'left', a:'left', A:'left', KeyD:'right', ArrowRight:'right', d:'right', D:'right', Space:'jump', ' ':'jump', ShiftLeft:'sneak', ShiftRight:'sneak', Shift:'sneak', ControlLeft:'sprint', ControlRight:'sprint', Control:'sprint' }
  const activeKeyControls = new Set()
  const nav = [['bots','Bots'],['control','Operations'],['inventory','Inventory'],['chat','Chat'],['map','Viewer'],['logs','Logs'],['system','System / Update'],['about','About']]
  const zh = {
    'Overview':'总览','Bots':'机器人','Operations':'操作','Move / Fight':'移动 / 战斗','Blocks / GUI':'方块 / 容器','Inventory':'背包','Chat':'聊天','Map':'视角','Guard':'守卫','Plugins':'插件管理','Logs':'日志','System / Update':'系统 / 更新','About':'关于','Dashboard':'控制台',
    'Admin login':'管理员登录','Password':'密码','Login':'登录','Logout':'退出登录','Auth mode':'认证模式','Language':'语言','中文':'中文','English':'English','Light mode':'浅色模式','Dark mode':'深色模式',
    'Start all':'全部上线','Stop all':'全部下线','Refresh':'刷新','Total bots':'机器人总数','Online':'在线','Errors':'错误','Web port':'Web 端口','Bot list':'机器人列表','New':'新增','Search bot':'搜索机器人','No bots yet.':'暂无机器人。','Start':'上线','Stop':'下线','Stop task':'停止任务','Select a bot first':'请先选择一个机器人',
    'Selected bot':'当前机器人','none':'无','ID':'ID','Username':'用户名','Target':'目标服务器','Version':'版本','Position':'坐标','Health':'生命值','Food':'饥饿值','Map proxy':'地图代理','Last error':'最近错误','auto':'自动',
    'Edit bot':'编辑机器人','Create bot':'创建机器人','Save':'保存','Delete':'删除','Delete this bot?':'确定删除这个机器人？','Bot ID':'机器人 ID','Login mode':'登录方式','Microsoft login':'微软登录','Open Microsoft login':'打开微软登录','Microsoft login code':'微软登录码','Start this Microsoft bot first. The login code will appear here.':'先启动这个微软模式机器人，登录码会显示在这里。','Microsoft tokens are cached after the first successful login.':'首次授权成功后会缓存登录状态，下次不用再次登录。','Server host':'服务器地址','Server port':'服务器端口','MC version':'MC 版本','View distance':'视距','AuthMe password':'AuthMe 密码','Show password':'显示密码','AuthMe login command':'AuthMe 登录命令','AuthMe register command':'AuthMe 注册命令','AuthMe email':'AuthMe 邮箱','AuthMe auto register':'AuthMe 自动注册','AuthMe delay ms':'AuthMe 延迟毫秒','Join commands':'进服后指令','Join command delay ms':'进服指令延迟毫秒','Map internal port':'地图内部端口','Inventory internal port':'背包内部端口','Reconnect delay ms':'重连延迟毫秒','Auto eat threshold':'自动进食阈值','AuthMe auto login':'AuthMe 自动登录','First person map':'第一人称地图','Camera view':'视角模式','First person view':'第一人称','Third person view':'第三人称','Viewer quality':'视角清晰度','Smooth':'流畅','Balanced':'均衡','Sharp':'清晰','Switch to first person':'切换第一人称','Switch to third person':'切换第三人称','Viewer mode updated':'视角已切换','Enable web-inventory plugin':'启用 web-inventory 插件','Pathfinder can dig':'寻路可挖方块','Allow 1x1 towers':'允许搭 1x1 柱','Auto reconnect':'自动重连','Auto eat':'自动进食（内置）','Auto respawn':'自动重生','PVP plugin':'PVP 插件','Auto-eat plugin':'Auto-eat 插件增强','Armor Manager':'护甲管理','CollectBlock plugin':'CollectBlock 插件','Tool plugin':'工具插件',
    'Movement and combat':'移动和战斗','X':'X','Y':'Y','Z':'Z','Range':'范围','Go to coordinate':'前往坐标','Left click':'左键','Right click':'右键','Eat':'吃食物','forward':'前进','back':'后退','left':'左移','right':'右移','jump':'跳跃','sprint':'疾跑','sneak':'潜行','Release all':'释放全部按键','Keyboard capture':'键盘控制','Start keyboard capture':'开启键盘控制','Stop keyboard capture':'关闭键盘控制','Keyboard capture active':'键盘控制中','Keyboard capture help':'开启后进入全屏采集层：W/A/S/D 移动，空格跳跃，Shift 潜行，Ctrl 疾跑，鼠标移动转向，左右键点击，数字 1-9/滚轮切换快捷栏，Esc 退出。','Player':'玩家','Follow range':'跟随范围','Yaw':'Yaw','Pitch':'Pitch','Follow':'跟随','Look at player':'看向玩家','Look yaw/pitch':'看向角度','Attack nearest':'攻击最近实体','Attack player':'攻击玩家','AuthMe login':'AuthMe 登录','AuthMe register':'AuthMe 注册','Mount nearest vehicle':'骑乘最近载具','Dismount':'下车','Chat / command':'聊天 / 指令','Send chat':'发送聊天','Online chat':'在线聊天','Message':'消息','Send':'发送','Chat history':'聊天记录',
    'Blocks and windows':'方块和窗口','Block name':'方块名','Dig cursor block':'挖准星方块','Dig coordinate':'挖指定坐标','Dig nearest named block':'挖最近指定方块','Collect block':'采集方块','Open block GUI':'打开方块 GUI','Refresh window':'刷新窗口','Close window':'关闭窗口','Item name':'物品名','Count':'数量','Slot':'槽位','Mouse button':'鼠标按钮','Withdraw':'取出','Deposit':'存入','Click slot':'点击槽位','Furnace input':'熔炉输入','Furnace fuel':'熔炉燃料','Take output':'取出产物','No window open.':'未打开窗口。',
    'Viewer':'视角','Online inventory':'在线背包','Refresh inventory':'刷新背包','Refresh players':'刷新玩家','Web inventory view':'Web 背包视图','Built-in inventory':'内置背包','Equipment':'装备栏','Quick bar':'快捷栏','Use in hand':'拿到手上','Drop item':'丢弃物品','Open web-inventory proxy':'打开 web-inventory 代理','Players':'玩家','Click refresh inventory.':'点击刷新背包。','Click refresh players.':'点击刷新玩家。','Attack':'攻击','Empty':'空',
    'Integrated map':'视角','Open new window':'新窗口打开','Start a bot first. The viewer is proxied through the main web port.':'请先启动机器人。视角已通过主 Web 端口代理。',
    'Guard area':'区域守卫','guarding':'守卫中','stopped':'已停止','Center X':'中心 X','Center Y':'中心 Y','Center Z':'中心 Z','Radius':'半径','Mode':'模式','hostile mobs':'敌对生物','players':'玩家','all mobs/players':'全部生物/玩家','Interval ms':'间隔毫秒','Return home':'返回守卫点','Start guard':'开始守卫','Stop guard':'停止守卫',
    'Clear':'清空','No logs yet.':'暂无日志。','System and online update':'系统和在线更新','Node':'Node','Platform':'平台','Auth mode':'认证模式','yes':'是','no':'否','Update mode':'更新模式','core mineflayer deps':'核心 Mineflayer 依赖','all runtime deps':'全部运行时依赖','optional plugins':'可选插件','Registry':'镜像源','China mirror':'中国镜像','npm official':'npm 官方源','Check latest':'检查最新版本','Install update':'安装更新','No update logs.':'暂无更新日志。','Plugin manager':'插件管理','Installed':'已安装','Not installed':'未安装','Install':'安装','Update':'更新','Remove':'卸载','Feature':'功能','Floating controls':'悬浮视角','Open plugin manager':'打开插件管理','Install viewer dependency':'安装地图依赖','Floating viewer':'悬浮视角','Open floating viewer':'打开悬浮视角','Close floating viewer':'关闭悬浮视角','Reset floating viewer':'重置悬浮视角','Drag the title bar to move. Drag the corner to resize.':'拖动标题栏移动，拖动右下角调整大小。','Viewer is not ready yet.':'视角还未准备好。','Show inline viewer':'显示页面内视角','Hide inline viewer':'关闭页面内视角','Inline viewer paused to reduce lag. The floating viewer is still available.':'页面内视角已关闭以减少卡顿，仍可使用悬浮视角。','Viewer performance tip':'画面卡顿建议','Lower view distance to 3 or 4, then restart the bot.':'将视距调低到 3 或 4 后重启 Bot。','Enter admin password to continue.':'请输入管理员密码后继续。','Sign in to your Mineflayer control panel.':'登录 Mineflayer 控制面板。','Your local web console is protected by the administrator password generated at first launch.':'请输入首次启动时生成的管理员密码。','Remember to keep this window private on shared computers.':'请不要在公共或共享电脑上保存密码。','Admin password':'管理员密码','Sign in':'登录','Mineflayer Web Bot':'Mineflayer Web Bot','Multi bot management':'多 Bot 管理','Integrated viewer':'集成视角','Viewer':'视角','Online inventory':'在线背包','Project information':'项目信息','Official repository':'项目仓库','Open GitHub':'打开 GitHub','Project description':'基于 Mineflayer 的网页机器人管理面板，支持多 Bot 管理、视角、背包、聊天、默认插件增强和在线更新。','Release version':'发行版本','Runtime requirement':'运行要求','Node.js 22 or newer':'Node.js 22 或更高版本','Main features':'主要功能','Multi bot management, Microsoft login, AuthMe, integrated viewer proxy, online inventory, default plugin bundle, online dependency update.':'多 Bot 管理、Microsoft 登录、AuthMe、集成视角代理、在线背包、默认插件增强、在线依赖更新。','Stop goto':'停止前往坐标','Mouse sensitivity':'鼠标灵敏度','Auto mining':'自动挖矿','Mine blocks':'开始挖矿','Cut trees':'砍树','Block names hint':'留空默认挖矿物；可填多个方块名，用空格或逗号分隔。','Mouse capture active':'鼠标控制已启用','Hotbar':'快捷栏'
  }
  const t = (s) => state.lang === 'zh' ? (zh[String(s)] || String(s)) : String(s)
  function applyLanguage () {
    if (state.lang !== 'zh') return
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    nodes.forEach(node => {
      const raw = node.nodeValue
      const trimmed = raw.trim()
      if (!trimmed) return
      let out = zh[trimmed]
      if (!out && /^current\s+/.test(trimmed)) out = trimmed.replace(/^current /, '当前 ').replace(/ · latest /, ' · 最新 ')
      if (!out && /^slot\s+/.test(trimmed)) out = trimmed.replace(/^slot /, '槽位 ')
      if (!out && /^ping\s+/.test(trimmed)) out = trimmed.replace(/^ping /, '延迟 ')
      if (out) node.nodeValue = raw.replace(trimmed, out)
    })
    document.querySelectorAll('input[placeholder]').forEach(el => { if (zh[el.placeholder]) el.placeholder = zh[el.placeholder] })
  }
  const $ = (id) => document.getElementById(id)
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const selected = () => state.selectedId === '__new__' ? null : (state.bots.find(b => b.id === state.selectedId) || state.bots[0] || null)
  const botId = () => selected()?.id || ''
  const pos = (p) => p ? `${num(p.x)} ${num(p.y)} ${num(p.z)}` : '-'
  const num = (v) => Number.isFinite(Number(v)) ? Number(v).toFixed(1) : '-'
  function isEditing () {
    const el = document.activeElement
    const textSelected = (() => {
      try { const sel = window.getSelection && window.getSelection(); return Boolean(sel && !sel.isCollapsed) } catch { return false }
    })()
    return Boolean(textSelected || (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)))
  }
  function selectedViewerUrl () { return selected()?.viewerUrl || '' }
  function viewerFrameSrc (b = selected()) {
    const raw = b?.viewerUrl || ''
    if (!raw) return ''
    const mode = b.firstPersonViewer ? 'first' : 'third'
    const join = raw.includes('?') ? '&' : '?'
    return `${raw}${join}camera=${mode}&v=${state.viewerReloadToken || 0}`
  }
  function qualityClass () { return `quality-${state.viewerQuality || 'balanced'}` }
  function setViewerQuality (value) {
    state.viewerQuality = value || 'balanced'
    localStorage.setItem('viewerQuality', state.viewerQuality)
    document.querySelectorAll('.viewerWrap,.floatViewer').forEach(el => {
      el.classList.remove('quality-smooth','quality-balanced','quality-sharp')
      el.classList.add(qualityClass())
    })
  }
  function isTextInput () {
    const el = document.activeElement
    return Boolean(el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
  }
  function safeRender () {
    if (isEditing()) { state.renderPending = true; return }
    render()
  }
  function liveRender (opts = {}) {
    if (!state.authenticated) return
    if (isEditing()) { state.renderPending = true; return }
    try { if ($('metrics')) renderMetrics() } catch {}
    try { if ($('left')) { renderLeft(); bindCommon() } } catch {}
    try { if (state.tab === 'overview' && $('page-overview')) renderOverview() } catch {}
    try { if (state.tab === 'map' && opts.viewerChanged && $('page-map')) renderMap() } catch {}
    applyLanguage()
  }
  document.addEventListener('focusout', () => {
    if (!state.renderPending) return
    state.renderPending = false
    setTimeout(() => { if (!isEditing()) liveRender() }, 80)
  })

  function toast (msg) {
    const box = $('toast')
    const el = document.createElement('div')
    el.textContent = msg
    box.appendChild(el)
    setTimeout(() => el.remove(), 4500)
  }

  async function api (path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    const res = await fetch(path, { ...options, headers, credentials: 'same-origin' })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) {
      state.authenticated = false
      renderLogin(data.error)
      throw new Error(data.error || 'Unauthorized')
    }
    if (!res.ok || data.ok === false) throw new Error(data.error || `${res.status} ${res.statusText}`)
    return data
  }

  async function checkAuth () {
    try {
      const data = await api('/api/auth/me')
      state.authenticated = Boolean(data.authenticated)
      state.authRequired = Boolean(data.authRequired)
      return state.authenticated
    } catch { return false }
  }

  async function doLogin () {
    const password = $('loginPassword')?.value || ''
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) })
      state.authenticated = true
      shell()
      await refresh()
      connectSocket()
    } catch (err) { toast(`${t('Login')} failed: ${err.message}`) }
  }

  async function doLogout () {
    try { await post('/api/auth/logout') } catch {}
    state.authenticated = false
    renderLogin()
  }

  async function run (label, fn) {
    try { const data = await fn(); toast(`${t(label)} OK`); await refresh(); return data } catch (err) { toast(`${t(label)} failed: ${err.message}`); throw err }
  }
  const post = (path, body = {}) => api(path, { method: 'POST', body: JSON.stringify(body) })
  const put = (path, body = {}) => api(path, { method: 'PUT', body: JSON.stringify(body) })
  const del = (path) => api(path, { method: 'DELETE' })

  async function refresh () {
    try {
      const [bots, system] = await Promise.all([api('/api/bots'), api('/api/system')])
      state.bots = bots.bots || []
      state.system = system.system || null
      if (!state.selectedId && state.bots[0]) state.selectedId = state.bots[0].id
      if (state.selectedId && state.selectedId !== '__new__' && !state.bots.find(b => b.id === state.selectedId)) state.selectedId = state.bots[0]?.id || ''
      render()
    } catch (err) { toast(`Load failed: ${err.message}`) }
  }

  function connectSocket () {
    try {
      const socket = io()
      socket.on('bots', list => {
        state.bots = list || []
        if (!state.selectedId && state.bots[0]) state.selectedId = state.bots[0].id
        if (!isEditing()) { renderLeft(); bindCommon(); applyLanguage() }
      })
      socket.on('status', status => {
        const before = selectedViewerUrl()
        upsert(status)
        const changed = before !== selectedViewerUrl()
        if (!isEditing()) { renderLeft(); bindCommon(); applyLanguage() }
        if (changed && state.tab === 'map') renderMap()
        if (changed || state.floatViewer.open) renderFloatPanel()
      })
      socket.on('log', entry => {
        state.logs.unshift(entry); state.logs = state.logs.slice(0, 400)
        if (!isEditing()) {
          if (state.tab === 'logs') appendLogLine(entry)
          if (state.tab === 'chat') appendChatLine(entry)
        }
      })
      socket.on('update-log', e => { state.updateLogs.unshift(e.line || e); state.updateLogs = state.updateLogs.slice(0, 400); if (!isEditing()) renderSystemOnly() })
      socket.on('update-status', () => { if (!isEditing()) renderSystemOnly() })
      socket.on('connect_error', err => toast(`Socket error: ${err.message}`))
    } catch (err) { console.warn(err) }
  }

  function appendLogLine (l) {
    const box = $('logBoxInner')
    if (!box) return renderLogsOnly()
    const empty = box.querySelector('.muted')
    if (empty) empty.remove()
    const div = document.createElement('div')
    div.className = `logLine log-${String(l.level || 'info').replace(/[^a-z0-9_-]/ig, '')}`
    div.textContent = `[${l.time || ''}] [${l.id || ''}] [${l.level || ''}] ${l.message || ''}`
    box.prepend(div)
    while (box.children.length > 400) box.lastElementChild?.remove()
  }

  function appendChatLine (l) {
    if (l.level !== 'chat') return
    const box = $('chatBoxInner')
    if (!box) return renderChat()
    const empty = box.querySelector('.muted')
    if (empty) empty.remove()
    const div = document.createElement('div')
    div.className = 'chatMsg'
    div.innerHTML = `<span>${esc((l.time || '').slice(11,19))}</span><b>[${esc(l.id || '')}]</b> ${esc(l.message || '')}`
    box.prepend(div)
    while (box.children.length > 300) box.lastElementChild?.remove()
  }

  function upsert (bot) {
    const i = state.bots.findIndex(b => b.id === bot.id)
    if (i >= 0) state.bots[i] = bot
    else state.bots.push(bot)
  }

  function renderLogin (error = '') {
    document.documentElement.classList.toggle('light', state.theme === 'light')
    document.body.innerHTML = `<div class="loginWrap"><div class="loginShell"><section class="loginHero"><div class="logo big">MC</div><span class="loginKicker">${t('Mineflayer Web Bot')}</span><h1>${t('Sign in to your Mineflayer control panel.')}</h1><p>${t('Your local web console is protected by the administrator password generated at first launch.')}</p><div class="loginChips"><span>${t('Multi bot management')}</span><span>${t('Integrated viewer')}</span><span>${t('Online inventory')}</span></div></section><section class="loginCard"><div class="loginTop"><div><h2>${t('Admin login')}</h2><p>${t('Remember to keep this window private on shared computers.')}</p></div><div class="lockIcon">⌘</div></div>${error ? `<p class="bad loginError">${esc(error)}</p>` : ''}<label class="field loginField"><span>${t('Admin password')}</span><input id="loginPassword" type="password" autocomplete="current-password" placeholder="${t('Enter admin password to continue.')}"></label><button class="btn primary loginSubmit" id="loginBtn">${t('Sign in')}</button><div class="loginActions secondary"><button class="btn" id="langToggle">${state.lang === 'zh' ? 'English' : '中文'}</button><button class="btn" id="theme">${state.theme === 'dark' ? t('Light mode') : t('Dark mode')}</button></div></section></div></div><div id="toast" class="toast"></div>`
    $('loginBtn').onclick = doLogin
    $('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })
    $('langToggle').onclick = () => { state.lang = state.lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('lang', state.lang); renderLogin(error) }
    $('theme').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', state.theme); renderLogin(error) }
    setTimeout(() => $('loginPassword')?.focus(), 20)
  }

  function shell () {
    if (!state.authenticated) return renderLogin()
    document.documentElement.classList.toggle('light', state.theme === 'light')
    document.body.innerHTML = `
      <div class="app">
        <aside class="sidebar">
          <div class="brand"><div class="logo">MC</div><div><b>Mineflayer Web Bot</b><span>1.0.0 · Node 22+</span></div></div>
          <div class="nav">${nav.map(([id,name]) => `<button data-tab="${id}" class="${state.tab===id?'active':''}">${t(name)}</button>`).join('')}</div>
          <div class="sideBottom">
            <div class="row"><button class="btn" id="langToggle">${state.lang === 'zh' ? 'English' : '中文'}</button><button class="btn" id="theme">${state.theme === 'dark' ? t('Light mode') : t('Dark mode')}</button><button class="btn warn" id="logout">${t('Logout')}</button></div>
          </div>
        </aside>
        <main class="main">
          <section class="cols"><div id="left"></div><div id="pages"></div></section>
        </main>
      </div><div class="toast" id="toast"></div>`
    document.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => switchTab(btn.dataset.tab))
    $('logout').onclick = doLogout
    $('theme').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', state.theme); render() }
    $('langToggle').onclick = () => { state.lang = state.lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('lang', state.lang); render() }
  }

  function render () {
    shell(); renderLeft(); renderPages(); bindCommon(); applyLanguage()
  }
  function switchTab (tab) {
    state.tab = tab
    document.querySelectorAll('[data-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab))
    document.querySelectorAll('.tabPage').forEach(page => page.classList.toggle('active', page.id === `page-${tab}`))
    if (tab === 'map') renderMap()
    if (tab === 'inventory') renderInventory()
    if (tab === 'control') { renderControl(); loadPlayers().catch(()=>{}) }
    applyLanguage()
  }
  function renderMetrics () { const el = $('botStats'); if (!el) return; const online = state.bots.filter(b => b.status === 'online').length; const errors = state.bots.filter(b => b.status === 'error').length; el.innerHTML = `<span>${t('Total bots')} <b>${state.bots.length}</b></span><span>${t('Online')} <b class="ok">${online}</b></span>${errors ? `<span>${t('Errors')} <b class="bad">${errors}</b></span>` : ''}` }
  function renderLeft () {
    const b = selected()
    $('left').innerHTML = `<div class="card"><div class="cardHead"><div><h3>${t('Bot list')}</h3><div class="botStats" id="botStats"></div></div><div class="row"><button class="btn small primary" id="newBot">${t('New')}</button><button class="btn small ok" id="startAllList">${t('Start all')}</button><button class="btn small warn" id="stopAllList">${t('Stop all')}</button><button class="btn small" id="reloadList">${t('Refresh')}</button></div></div><div class="cardBody grid"><input id="botSearch" placeholder="${t('Search bot')}"><div class="botList">${state.bots.map(bot => `<div class="botRow"><button class="botItem ${bot.id===botId()?'active':''}" data-select="${esc(bot.id)}"><div><b>${esc(bot.username)}</b><small>${esc(bot.id)} · ${esc(bot.target?.host)}:${esc(bot.target?.port)}</small></div><span class="tag ${bot.status==='online'?'online':bot.status==='error'?'error':''}">${esc(bot.status)}</span></button><button class="btn small bad botDel" data-delbot="${esc(bot.id)}">${t('Delete')}</button></div>`).join('') || '<p class="muted">'+t('No bots yet.')+'</p>'}</div>${b ? `<div class="row"><button class="btn ok" data-action="start">${t('Start')}</button><button class="btn warn" data-action="stop">${t('Stop')}</button><button class="btn" data-action="stop-task">${t('Stop task')}</button></div>` : ''}</div></div>`
    renderMetrics()
    document.querySelectorAll('[data-select]').forEach(btn => btn.onclick = () => { state.selectedId = btn.dataset.select; state.inventory = null; state.players = []; render() })
    document.querySelectorAll('[data-delbot]').forEach(btn => btn.onclick = async () => {
      const id = btn.dataset.delbot
      if (!confirm(t('Delete this bot?'))) return
      try { await del(`/api/bots/${encodeURIComponent(id)}`); if (state.selectedId === id) state.selectedId = ''; await refresh(); toast(t('Delete') + ' OK') } catch (err) { toast(t('Delete') + ' failed: ' + err.message) }
    })
    $('newBot').onclick = async () => {
      try {
        const data = await post('/api/bots', {})
        state.selectedId = data.bot?.id || data.bots?.at?.(-1)?.id || ''
        state.tab = 'bots'
        await refresh()
        toast(t('New') + ' OK')
      } catch (err) { toast(t('New') + ' failed: ' + err.message) }
    }
    $('startAllList').onclick = () => run('Start all', () => post('/api/bots/start-all'))
    $('stopAllList').onclick = () => run('Stop all', () => post('/api/bots/stop-all'))
    $('reloadList').onclick = refresh
  }
  function bindCommon () {
    document.querySelectorAll('[data-action]').forEach(btn => btn.onclick = () => botAction(btn.dataset.action))
  }
  function botAction (action) {
    const id = botId(); if (!id) return toast(t('Select a bot first'))
    if (action === 'start') return run('Start bot', () => post(`/api/bots/${id}/start`))
    if (action === 'stop') return run('Stop bot', () => post(`/api/bots/${id}/stop`))
    if (action === 'stop-task') return run('Stop task', () => post(`/api/bots/${id}/stop-task`))
  }

  function renderPages () {
    const pages = $('pages')
    pages.innerHTML = `<div class="tabPage ${state.tab==='bots'?'active':''}" id="page-bots"></div><div class="tabPage ${state.tab==='control'?'active':''}" id="page-control"></div><div class="tabPage ${state.tab==='inventory'?'active':''}" id="page-inventory"></div><div class="tabPage ${state.tab==='chat'?'active':''}" id="page-chat"></div><div class="tabPage ${state.tab==='map'?'active':''}" id="page-map"></div><div class="tabPage ${state.tab==='logs'?'active':''}" id="page-logs"></div><div class="tabPage ${state.tab==='system'?'active':''}" id="page-system"></div><div class="tabPage ${state.tab==='about'?'active':''}" id="page-about"></div>`
    renderBots(); renderControl(); renderInventory(); renderChat(); renderMap(); renderLogsOnly(); renderSystemOnly(); renderAbout(); renderFloatPanel()
  }

  function renderOverview () {
    const b = selected()
    $('page-overview').innerHTML = `<div class="card"><div class="cardHead"><h2>${t('Selected bot')}</h2><span class="tag ${b?.status==='online'?'online':b?.status==='error'?'error':''}">${esc(b?.status || t('none'))}</span></div><div class="cardBody"><div class="infoGrid">
      ${info('ID', b?.id)}${info('Username', b?.username)}${info('Target', b ? `${b.target?.host}:${b.target?.port}` : '-')}${info('Version', b?.minecraftVersion || b?.target?.version || 'auto')}
      ${info('Position', pos(b?.position))}${info('Health', b?.health ?? '-')}${info('Food', b?.food ?? '-')}${info('Map proxy', b?.viewerUrl || '-')}
    </div>${microsoftLoginBox(b)}${b?.lastError ? `<p class="bad">${t('Last error')}: ${esc(b.lastError)}</p>` : ''}</div></div>`
    bindMicrosoftLoginButtons()
  }

  function microsoftLoginBox (b) {
    if (!b || b.account?.auth !== 'microsoft') return ''
    const login = b.microsoftLogin
    if (!login) return `<div class="hintBox"><b>${t('Microsoft login')}</b><p>${t('Start this Microsoft bot first. The login code will appear here.')}</p><p>${t('Microsoft tokens are cached after the first successful login.')}</p></div>`
    const link = login.complete || login.verificationUri || 'https://www.microsoft.com/link'
    return `<div class="hintBox microsoftBox"><b>${t('Microsoft login')}</b><div class="msCode"><span>${t('Microsoft login code')}</span><code>${esc(login.userCode || '-')}</code></div><button class="btn primary" data-ms-login="${esc(link)}">${t('Open Microsoft login')}</button><p>${esc(login.message || t('Microsoft tokens are cached after the first successful login.'))}</p></div>`
  }
  function bindMicrosoftLoginButtons () { document.querySelectorAll('[data-ms-login]').forEach(btn => btn.onclick = () => window.open(btn.dataset.msLogin || 'https://www.microsoft.com/link', '_blank')) }

  const info = (k,v) => `<div class="info"><span>${esc(t(k))}</span><b>${esc(v ?? '-')}</b></div>`

  function formValue (id) { return ($(id)?.value ?? '').trim() }
  function formBool (id) { return Boolean($(id)?.checked) }
  function normalizedAuthmePassword () {
    const v = formValue('f-authmePassword')
    if (!v || v === '********' || v === '***') return ''
    return v
  }
  async function togglePasswordField (id) {
    const el = $(id)
    if (!el) return
    if (el.type === 'password') {
      if (el.dataset.masked === 'true') {
        const id = botId()
        if (id) {
          try {
            const data = await api(`/api/bots/${encodeURIComponent(id)}/secret/authme-password`)
            if (data.password) { el.value = data.password; el.dataset.masked = 'false' }
          } catch (err) { toast(err.message) }
        }
      }
      el.type = 'text'
    } else {
      el.type = 'password'
    }
  }
  window.__togglePasswordField = togglePasswordField
  function authmePasswordField (a) {
    const has = Boolean(a && a.hasAuthmePassword)
    const val = a?.authmePassword || (has ? '********' : '')
    return `<div class="field passwordField"><label>${esc(t('AuthMe password'))}</label><div class="passwordRow"><input id="f-authmePassword" type="password" value="${esc(val)}" data-masked="${has ? 'true' : 'false'}" autocomplete="new-password"><button type="button" class="btn small" title="${esc(t('Show password'))}" onclick="window.__togglePasswordField('f-authmePassword')">👁</button></div></div>`
  }
  function currentFormAccount () {
    const ms = Number(formValue('f-mouseSensitivity') || state.mouseSensitivity || 0.003); if (Number.isFinite(ms) && ms > 0) { state.mouseSensitivity = ms; localStorage.setItem('mouseSensitivity', String(ms)) }
    return {
      id: formValue('f-id'), username: formValue('f-username'), auth: formValue('f-auth'), host: formValue('f-host'), port: Number(formValue('f-port') || 25565), version: formValue('f-version') || false,
      authmePassword: normalizedAuthmePassword(), authmeAutoLogin: formBool('f-authmeAutoLogin'), authmeCommand: formValue('f-authmeCommand') || '/login {password}', authmeRegisterCommand: formValue('f-authmeRegisterCommand') || '/reg {password} {email}', authmeEmail: formValue('f-authmeEmail') || '', authmeAutoRegister: formBool('f-authmeAutoRegister'), authmeDelayMs: Number(formValue('f-authmeDelayMs') || 1500), joinCommands: formValue('f-joinCommands').split(/\r?\n/).map(v=>v.trim()).filter(Boolean), joinCommandDelayMs: Number(formValue('f-joinCommandDelayMs') || 2500),
      viewerPort: Number(formValue('f-viewerPort') || 0) || undefined, webInventoryPort: Number(formValue('f-webInventoryPort') || 0) || undefined, viewDistance: Number(formValue('f-viewDistance') || 6), firstPersonViewer: formBool('f-firstPersonViewer'), enableWebInventory: formBool('f-enableWebInventory'),
      canDig: formBool('f-canDig'), allow1by1towers: formBool('f-allow1by1towers'), autoReconnect: formBool('f-autoReconnect'), reconnectDelayMs: Number(formValue('f-reconnectDelayMs') || 5000), autoRespawn: formBool('f-autoRespawn'),
      enablePvpPlugin: formBool('f-enablePvpPlugin'), enableAutoEatPlugin: formBool('f-enableAutoEatPlugin'), enableArmorManager: formBool('f-enableArmorManager'), enableCollectBlock: formBool('f-enableCollectBlock'), enableToolPlugin: formBool('f-enableToolPlugin')
    }
  }
  function renderBots () {
    const b = selected(); const a = b?.account || { id:'', username:'', auth:'offline', host:'127.0.0.1', port:25565, version:false, authmeAutoLogin:true, authmeCommand:'/login {password}', authmeRegisterCommand:'/reg {password} {email}', authmeEmail:'', authmeAutoRegister:false, authmeDelayMs:1500, joinCommands:[], joinCommandDelayMs:2500, viewDistance:6, autoReconnect:true, reconnectDelayMs:5000, autoRespawn:true, enableWebInventory:true, enablePvpPlugin:true, enableAutoEatPlugin:true, enableArmorManager:true, enableCollectBlock:true, enableToolPlugin:true }
    $('page-bots').innerHTML = `<div class="card"><div class="cardHead"><h2>${b?'Edit bot':'Create bot'}</h2><div class="row"><button class="btn primary" id="saveBot">Save</button>${b?'<button class="btn bad" id="deleteBot">Delete</button>':''}</div></div><div class="cardBody grid">
      <div class="form four">${field('Bot ID','f-id',a.id)}${field('Username','f-username',a.username)}<div class="field"><label>${t('Login mode')}</label><select id="f-auth"><option value="offline">offline</option><option value="microsoft">microsoft</option></select></div><div class="field hintField"><label>${t('Microsoft login')}</label><p class="muted">${t('Microsoft tokens are cached after the first successful login.')}</p></div></div>
      <div class="form four">${field('Server host','f-host',a.host)}${field('Server port','f-port',a.port)}<div class="field"><label>MC version</label><select id="f-version">${mcVersions.map(v=>`<option value="${esc(v)}">${v || 'auto'}</option>`).join('')}</select></div>${field('View distance','f-viewDistance',a.viewDistance)}</div>
      <div class="form four">${authmePasswordField(a)}${field('AuthMe login command','f-authmeCommand',a.authmeCommand)}${field('AuthMe register command','f-authmeRegisterCommand',a.authmeRegisterCommand)}${field('AuthMe email','f-authmeEmail',a.authmeEmail || '')}</div>
      <div class="form four">${field('AuthMe delay ms','f-authmeDelayMs',a.authmeDelayMs)}${field('Join command delay ms','f-joinCommandDelayMs',a.joinCommandDelayMs || 2500)}<div class="field" style="grid-column:span 2"><label>${t('Join commands')}</label><textarea id="f-joinCommands" placeholder="/server survival&#10;/home">${esc((a.joinCommands||[]).join('\n'))}</textarea></div></div>
      <div class="form four">${field('Map internal port','f-viewerPort',a.viewerPort || '')}${field('Inventory internal port','f-webInventoryPort',a.webInventoryPort || '')}${field('Reconnect delay ms','f-reconnectDelayMs',a.reconnectDelayMs)}${field('Mouse sensitivity','f-mouseSensitivity',state.mouseSensitivity)}</div>
      <div class="checks">${check('f-authmeAutoLogin','AuthMe auto login',a.authmeAutoLogin)}${check('f-authmeAutoRegister','AuthMe auto register',a.authmeAutoRegister)}${check('f-firstPersonViewer','First person map',a.firstPersonViewer)}${check('f-enableWebInventory','Enable web-inventory plugin',a.enableWebInventory)}${check('f-canDig','Pathfinder can dig',a.canDig)}${check('f-allow1by1towers','Allow 1x1 towers',a.allow1by1towers)}${check('f-autoReconnect','Auto reconnect',a.autoReconnect)}${check('f-autoRespawn','Auto respawn',a.autoRespawn)}${check('f-enablePvpPlugin','PVP plugin',a.enablePvpPlugin)}${check('f-enableAutoEatPlugin','Auto-eat plugin',a.enableAutoEatPlugin)}${check('f-enableArmorManager','Armor Manager',a.enableArmorManager)}${check('f-enableCollectBlock','CollectBlock plugin',a.enableCollectBlock)}${check('f-enableToolPlugin','Tool plugin',a.enableToolPlugin)}</div>
    </div></div>`
    $('f-auth').value = a.auth === 'mojang' ? 'microsoft' : (a.auth || 'offline'); $('f-version').value = a.version || ''
    $('page-bots').querySelector('.cardBody').insertAdjacentHTML('beforeend', microsoftLoginBox(b))
    bindMicrosoftLoginButtons()
    $('saveBot').onclick = () => { const account = currentFormAccount(); return run('Save bot', () => b ? put(`/api/bots/${encodeURIComponent(b.id)}`, account) : post('/api/bots', account)) }
    if ($('deleteBot')) $('deleteBot').onclick = () => confirm(t('Delete this bot?')) && run('Delete bot', () => del(`/api/bots/${encodeURIComponent(b.id)}`))
  }
  const field = (label,id,val='',type='text') => `<div class="field"><label>${esc(t(label))}</label><input id="${id}" type="${type}" value="${esc(val)}"></div>`
  const check = (id,label,val) => `<label class="check"><input id="${id}" type="checkbox" ${val?'checked':''}> ${esc(t(label))}</label>`

  function renderControl () {
    const b = selected(); const p = b?.position || {}
    $('page-control').innerHTML = `<div class="opsGrid">
      <div class="card"><div class="cardHead"><h2>${t('Movement and combat')}</h2></div><div class="cardBody grid">
        <div class="form four">${field('X','goto-x')}${field('Y','goto-y')}${field('Z','goto-z')}${field('Range','goto-range','1')}</div><div class="row"><button class="btn primary" id="gotoBtn">${t('Go to coordinate')}</button><button class="btn warn" id="stopGoto">${t('Stop goto')}</button><button class="btn" id="leftClick">${t('Left click')}</button><button class="btn" id="rightClick">${t('Right click')}</button></div>
        <div class="row">${['forward','back','left','right','jump','sprint','sneak'].map(c=>`<button class="btn" data-control="${c}">${t(c)}</button>`).join('')}<button class="btn ${state.keyboardCapture?'primary':'ok'}" id="keyboardCapture">${state.keyboardCapture?t('Stop keyboard capture'):t('Start keyboard capture')}</button><button class="btn warn" id="releaseControls">${t('Release all')}</button></div>
        <div class="hintBox compactHint keyboardFocusZone" tabindex="0"><b>${state.keyboardCapture?t('Keyboard capture active'):t('Keyboard capture')}</b><p>${t('Keyboard capture help')}</p><span>${state.keyboardCapture?t('Keyboard capture active'):''}</span></div>
        <div class="form four">${field('Player','player-name')}${field('Follow range','follow-range','2')}${field('Yaw','look-yaw')}${field('Pitch','look-pitch')}</div><div class="row"><button class="btn" id="follow">${t('Follow')}</button><button class="btn" id="lookPlayer">${t('Look at player')}</button><button class="btn" id="lookYawPitch">${t('Look yaw/pitch')}</button><button class="btn bad" id="attackNearest">${t('Attack nearest')}</button><button class="btn bad" id="attackPlayer">${t('Attack player')}</button></div>
        <div class="row"><button class="btn" id="mount">${t('Mount nearest vehicle')}</button><button class="btn" id="dismount">${t('Dismount')}</button></div>
        <div class="form"><div class="field"><label>${t('Chat / command')}</label><input id="chatText" placeholder="/say hello or normal chat"></div><div class="field"><label>&nbsp;</label><button class="btn primary" id="sendChat">${t('Send chat')}</button></div></div>
      </div></div>
      <div class="card"><div class="cardHead"><h2>${t('Blocks and windows')}</h2></div><div class="cardBody grid"><div class="form four">${field('X','block-x')}${field('Y','block-y')}${field('Z','block-z')}${field('Block name','block-name')}</div><div class="row"><button class="btn" id="digCursor">${t('Dig cursor block')}</button><button class="btn" id="digCoord">${t('Dig coordinate')}</button><button class="btn" id="digNearest">${t('Dig nearest named block')}</button><button class="btn" id="collectBlock">${t('Collect block')}</button><button class="btn primary" id="openWindow">${t('Open block GUI')}</button><button class="btn" id="refreshWindow">${t('Refresh window')}</button><button class="btn warn" id="closeWindow">${t('Close window')}</button></div><div class="hintBox compactHint"><b>${t('Auto mining')}</b><p>${t('Block names hint')}</p><div class="form four">${field('Block name','mine-names')}${field('Range','mine-range','48')}${field('Count','mine-count','16')}<div class="field"><label>&nbsp;</label><div class="row"><button class="btn primary" id="autoMine">${t('Mine blocks')}</button><button class="btn ok" id="cutTrees">${t('Cut trees')}</button></div></div></div></div><div class="form four">${field('Item name','item-name')}${field('Count','item-count','1')}${field('Slot','slot')}${field('Mouse button','mouse-button','0')}</div><div class="row"><button class="btn" id="withdraw">${t('Withdraw')}</button><button class="btn" id="deposit">${t('Deposit')}</button><button class="btn" id="clickSlot">${t('Click slot')}</button><button class="btn" id="furnaceInput">${t('Furnace input')}</button><button class="btn" id="furnaceFuel">${t('Furnace fuel')}</button><button class="btn" id="furnaceTake">${t('Take output')}</button></div><div id="windowView" class="items"></div></div></div>
      <div class="card"><div class="cardHead"><h2>${t('Players')}</h2><button class="btn" id="loadPlayersOps">${t('Refresh players')}</button></div><div class="cardBody"><div id="playersOps" class="items"></div></div></div>
      <div class="card"><div class="cardHead"><h2>${t('Guard area')}</h2><span class="tag ${b?.guard?.enabled?'online':''}">${b?.guard?.enabled?t('guarding'):t('stopped')}</span></div><div class="cardBody grid"><div class="form four">${field('Center X','guard-x',num(p.x))}${field('Center Y','guard-y',num(p.y))}${field('Center Z','guard-z',num(p.z))}${field('Radius','guard-radius','16')}</div><div class="form four"><div class="field"><label>${t('Mode')}</label><select id="guard-mode"><option value="hostile">${t('hostile mobs')}</option><option value="players">${t('players')}</option><option value="all">${t('all mobs/players')}</option></select></div>${field('Interval ms','guard-interval','1000')}<label class="check"><input id="guard-return" type="checkbox" checked> ${t('Return home')}</label></div><div class="row"><button class="btn primary" id="startGuard">${t('Start guard')}</button><button class="btn warn" id="stopGuard">${t('Stop guard')}</button></div></div></div>
    </div>`
    bindControl(); bindBlocks(); bindGuard(); if($('loadPlayersOps')) $('loadPlayersOps').onclick=loadPlayers; renderOpsPlayers(); applyLanguage(); if (state.keyboardCapture) setTimeout(focusKeyboardTarget, 0)
  }
  function idPath (suffix) { const id=botId(); if (!id) throw new Error(t('Select a bot first')); return `/api/bots/${encodeURIComponent(id)}${suffix}` }
  function bindControl () {
    $('gotoBtn').onclick = () => run('Goto', () => post(idPath('/goto'), { x:formValue('goto-x'), y:formValue('goto-y'), z:formValue('goto-z'), range:formValue('goto-range') }))
    if ($('stopGoto')) $('stopGoto').onclick = () => run('Stop goto', () => post(idPath('/stop-task')))
    $('leftClick').onclick = () => run('Left click', () => post(idPath('/left-click'))); $('rightClick').onclick = () => run('Right click', () => post(idPath('/right-click')))
    document.querySelectorAll('[data-control]').forEach(btn => { btn.onmousedown=()=>post(idPath('/control'),{control:btn.dataset.control,state:true}).catch(e=>toast(e.message)); btn.onmouseup=btn.onmouseleave=()=>post(idPath('/control'),{control:btn.dataset.control,state:false}).catch(()=>{}) })
    $('releaseControls').onclick = () => releaseAllControls().then(()=>toast('Released'))
    if ($('keyboardCapture')) $('keyboardCapture').onclick = toggleKeyboardCapture
    $('follow').onclick=()=>run('Follow',()=>post(idPath('/follow'),{username:formValue('player-name'),range:formValue('follow-range')})); $('lookPlayer').onclick=()=>run('Look player',()=>post(idPath('/look-at-player'),{username:formValue('player-name')})); $('lookYawPitch').onclick=()=>run('Look',()=>post(idPath('/look'),{yaw:formValue('look-yaw'),pitch:formValue('look-pitch')}))
    $('attackNearest').onclick=()=>run('Attack nearest',()=>post(idPath('/attack'),{})); $('attackPlayer').onclick=()=>run('Attack player',()=>post(idPath('/attack'),{username:formValue('player-name')}))
    $('mount').onclick=()=>run('Mount',()=>post(idPath('/mount'),{})); $('dismount').onclick=()=>run('Dismount',()=>post(idPath('/dismount'))); $('sendChat').onclick=()=>run('Chat',()=>post(idPath('/chat'),{message:formValue('chatText')}))
  }


  function toggleKeyboardCapture () {
    state.keyboardCapture = !state.keyboardCapture
    if (!state.keyboardCapture) releaseAllControls()
    renderControl()
    if (state.tab === 'map') renderMap()
    renderFloatPanel()
    updateKeyboardLayer()
    setTimeout(focusKeyboardTarget, 0)
    setTimeout(focusKeyboardTarget, 80)
    setTimeout(focusKeyboardTarget, 250)
  }
  function focusKeyboardTarget () {
    try {
      const trap = document.getElementById('keyboardInputTrap')
      if (trap) {
        window.focus()
        trap.focus({ preventScroll: true })
        try { trap.setSelectionRange(0, 0) } catch {}
        return
      }
      const el = document.getElementById('keyboardGlobalCatcher') || document.querySelector('.viewerKeyCatcher') || document.querySelector('.keyboardFocusZone') || document.body
      if (el) { el.tabIndex = el.tabIndex < 0 ? 0 : el.tabIndex; window.focus(); el.focus({ preventScroll: true }) }
    } catch {}
  }
  function updateKeyboardLayer () {
    let el = document.getElementById('keyboardGlobalCatcher')
    document.body.classList.toggle('keyboardActiveGlobal', Boolean(state.keyboardCapture))
    if (!state.keyboardCapture) { if (el) el.remove(); return }
    if (!el) {
      el = document.createElement('div')
      el.id = 'keyboardGlobalCatcher'
      el.className = 'keyboardGlobalCatcher'
      el.tabIndex = 0
      el.innerHTML = '<input id="keyboardInputTrap" class="keyboardInputTrap" autocomplete="off" autocapitalize="off" spellcheck="false" aria-hidden="true"><div class="keyboardGlobalPanel"><b>'+esc(t('Keyboard capture active'))+'</b><span id="keyboardGlobalState">W/A/S/D · Mouse · 1-9 · Wheel</span><small>Esc '+(state.lang==='zh'?'退出键盘控制':'to exit keyboard mode')+'</small><button type="button" id="keyboardGlobalExit">×</button></div>'
      el.addEventListener('mousedown', ev => { ev.preventDefault(); focusKeyboardTarget(); try { el.requestPointerLock?.() } catch {} })
      el.addEventListener('click', ev => { ev.preventDefault(); focusKeyboardTarget() }, true)
      document.body.appendChild(el)
      const exit = document.getElementById('keyboardGlobalExit')
      if (exit) exit.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); state.keyboardCapture = false; try { document.exitPointerLock?.() } catch {}; releaseAllControls(); renderControl(); if (state.tab === 'map') renderMap(); renderFloatPanel(); updateKeyboardLayer() }
    }
    updateKeyboardHud()
    setTimeout(focusKeyboardTarget, 0)
  }
  function keyToControl (ev) {
    return keyControlMap[ev.code] || keyControlMap[ev.key]
  }

  async function setControlFromKeyboard (control, enabled) {
    const id = botId()
    if (!id || !control) return
    try { await post(`/api/bots/${encodeURIComponent(id)}/control`, { control, state: Boolean(enabled) }) } catch (err) { toast(err.message) }
  }
  async function releaseAllControls () {
    const controls = ['forward','back','left','right','jump','sprint','sneak']
    const id = botId()
    activeKeyControls.clear()
    if (!id) return
    await Promise.all(controls.map(c => post(`/api/bots/${encodeURIComponent(id)}/control`, { control: c, state: false }).catch(()=>{})))
  }
  async function selectHotbarSlot (slot) {
    const id = botId()
    if (!id) return
    const n = Math.max(0, Math.min(8, Number(slot) || 0))
    try { await post(`/api/bots/${encodeURIComponent(id)}/hotbar`, { slot: n }) } catch (err) { toast(err.message) }
  }
  function currentHotbarSlot () {
    const b = selected()
    const item = (b?.hotbar || []).find(x => x.selected)
    return Number.isFinite(Number(item?.index)) ? Number(item.index) : 0
  }
  async function shiftHotbarSlot (delta) {
    const n = (currentHotbarSlot() + Number(delta || 0) + 9) % 9
    await selectHotbarSlot(n)
  }
  let lookBucket = { dx: 0, dy: 0, timer: null }
  function queueMouseLook (dx, dy) {
    if (!state.keyboardCapture || (!dx && !dy)) return
    lookBucket.dx += dx; lookBucket.dy += dy
    if (lookBucket.timer) return
    lookBucket.timer = setTimeout(async () => {
      const data = { dx: lookBucket.dx, dy: lookBucket.dy, sensitivity: state.mouseSensitivity || 0.003 }
      lookBucket.dx = 0; lookBucket.dy = 0; lookBucket.timer = null
      const id = botId(); if (!id) return
      try { await post(`/api/bots/${encodeURIComponent(id)}/look-relative`, data) } catch (err) { toast(err.message) }
    }, 35)
  }
  function installMouseCapture () {
    if (window.__mouseCaptureInstalled) return
    window.__mouseCaptureInstalled = true
    window.addEventListener('contextmenu', ev => { if (state.keyboardCapture) { ev.preventDefault(); ev.stopPropagation() } }, true)
    window.addEventListener('mousedown', ev => {
      if (!state.keyboardCapture) return
      if (ev.target && ev.target.closest && ev.target.closest('#keyboardGlobalExit,.keyboardGlobalPanel button')) return
      ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
      focusKeyboardTarget()
      if (document.pointerLockElement !== document.getElementById('keyboardGlobalCatcher')) {
        try { document.getElementById('keyboardGlobalCatcher')?.requestPointerLock?.() } catch {}
      }
      if (ev.button === 0) post(idPath('/left-click')).catch(e=>toast(e.message))
      if (ev.button === 2) post(idPath('/right-click')).catch(e=>toast(e.message))
    }, true)
    window.addEventListener('mousemove', ev => {
      if (!state.keyboardCapture) return
      const dx = ev.movementX || 0, dy = ev.movementY || 0
      if (!dx && !dy) return
      ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
      queueMouseLook(dx, dy)
    }, true)
    window.addEventListener('wheel', ev => {
      if (!state.keyboardCapture) return
      ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
      shiftHotbarSlot(ev.deltaY > 0 ? 1 : -1)
    }, { capture: true, passive: false })
  }

  function installKeyboardCapture () {
    if (window.__keyboardCaptureInstalled) return
    window.__keyboardCaptureInstalled = true
    const onKeyDown = ev => {
      if (!state.keyboardCapture) return
      if (ev.key === 'Escape' || ev.code === 'Escape') {
        ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
        state.keyboardCapture = false
        releaseAllControls()
        renderControl(); if (state.tab === 'map') renderMap(); renderFloatPanel(); updateKeyboardLayer()
        return
      }
      if (isTextInput() && !document.getElementById('keyboardGlobalCatcher')) return
      if (/^(Digit|Numpad)[1-9]$/.test(ev.code)) {
        ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
        const digit = Number(ev.code.replace('Digit','').replace('Numpad',''))
        selectHotbarSlot(digit - 1)
        return
      }
      const control = keyToControl(ev)
      if (!control) return
      ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
      focusKeyboardTarget()
      if (activeKeyControls.has(control)) return
      activeKeyControls.add(control)
      updateKeyboardHud()
      setControlFromKeyboard(control, true)
    }
    const onKeyUp = ev => {
      if (!state.keyboardCapture) return
      if (/^(Digit|Numpad)[1-9]$/.test(ev.code)) {
        ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
        const digit = Number(ev.code.replace('Digit','').replace('Numpad',''))
        selectHotbarSlot(digit - 1)
        return
      }
      const control = keyToControl(ev)
      if (!control) return
      ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
      if (!activeKeyControls.has(control)) return
      activeKeyControls.delete(control)
      updateKeyboardHud()
      setControlFromKeyboard(control, false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    document.documentElement.addEventListener('keydown', onKeyDown, true)
    document.documentElement.addEventListener('keyup', onKeyUp, true)
    document.body.addEventListener('keydown', onKeyDown, true)
    document.body.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', () => { if (activeKeyControls.size) releaseAllControls().catch(()=>{}) })
  }
  function updateKeyboardHud () {
    const text = activeKeyControls.size ? Array.from(activeKeyControls).join(' / ') : t('Keyboard capture active')
    document.querySelectorAll('.viewerKeyCatcher span,.keyboardFocusZone span,#keyboardGlobalState').forEach(el => { el.textContent = text })
  }


  function bindBlocks () {
    const coords = () => ({x:formValue('block-x'),y:formValue('block-y'),z:formValue('block-z')})
    if (!$('digCursor')) return
    $('digCursor').onclick=()=>run('Dig cursor',()=>post(idPath('/dig-cursor'))); $('digCoord').onclick=()=>run('Dig coordinate',()=>post(idPath('/dig-block'),coords())); $('digNearest').onclick=()=>run('Dig nearest',()=>post(idPath('/dig-nearest'),{name:formValue('block-name')})); $('collectBlock').onclick=()=>run('Collect block',()=>post(idPath('/collect-block'),{name:formValue('block-name')})); if($('autoMine')) $('autoMine').onclick=()=>run('Auto mine',()=>post(idPath('/auto-mine'),{names:formValue('mine-names'),maxDistance:formValue('mine-range'),count:formValue('mine-count')})); if($('cutTrees')) $('cutTrees').onclick=()=>run('Cut trees',()=>post(idPath('/cut-trees'),{names:formValue('mine-names'),maxDistance:formValue('mine-range'),count:formValue('mine-count')}))
    $('openWindow').onclick=async()=>{ const d=await run('Open window',()=>post(idPath('/window/open'),coords())); state.win=d.window; renderWindow() }; $('refreshWindow').onclick=async()=>{ const d=await api(idPath('/window')); state.win=d.window; renderWindow() }; $('closeWindow').onclick=()=>run('Close window',()=>post(idPath('/window/close')))
    const itemBody=()=>({name:formValue('item-name'),count:formValue('item-count'),slot:formValue('slot'),mouseButton:formValue('mouse-button')})
    $('withdraw').onclick=async()=>{const d=await run('Withdraw',()=>post(idPath('/window/withdraw'),itemBody()));state.win=d.window;renderWindow()}; $('deposit').onclick=async()=>{const d=await run('Deposit',()=>post(idPath('/window/deposit'),itemBody()));state.win=d.window;renderWindow()}; $('clickSlot').onclick=async()=>{const d=await run('Click slot',()=>post(idPath('/window/click-slot'),itemBody()));state.win=d.window;renderWindow()}
    $('furnaceInput').onclick=async()=>{const d=await run('Furnace input',()=>post(idPath('/furnace/put-input'),itemBody()));state.win=d.window;renderWindow()}; $('furnaceFuel').onclick=async()=>{const d=await run('Furnace fuel',()=>post(idPath('/furnace/put-fuel'),itemBody()));state.win=d.window;renderWindow()}; $('furnaceTake').onclick=async()=>{const d=await run('Take output',()=>post(idPath('/furnace/take-output')));state.win=d.window;renderWindow()}
    renderWindow()
  }
  function bindGuard () {
    if (!$('startGuard')) return
    $('startGuard').onclick=()=>run('Start guard',()=>post(idPath('/guard/start'),{x:formValue('guard-x'),y:formValue('guard-y'),z:formValue('guard-z'),radius:formValue('guard-radius'),mode:formValue('guard-mode'),returnHome:formBool('guard-return'),intervalMs:formValue('guard-interval')})); $('stopGuard').onclick=()=>run('Stop guard',()=>post(idPath('/guard/stop')))
  }
  function renderOpsPlayers () {
    const el = $('playersOps')
    if (!el) return
    el.innerHTML=(state.players||[]).map(p=>`<div class="item"><b>${esc(p.username)}</b><span>${t('ping')} ${esc(p.ping)} · ${pos(p.position)}</span><div class="row"><button class="btn small" onclick="window.__actPlayer('follow','${esc(p.username)}')">${t('Follow')}</button><button class="btn small bad" onclick="window.__actPlayer('attack','${esc(p.username)}')">${t('Attack')}</button></div></div>`).join('') || '<p class="muted">'+t('Click refresh players.')+'</p>'
  }

  function renderBlocks () {
    if (!$('page-blocks')) return
    $('page-blocks').innerHTML = `<div class="card"><div class="cardHead"><h2>Blocks and windows</h2></div><div class="cardBody grid"><div class="form four">${field('X','block-x')}${field('Y','block-y')}${field('Z','block-z')}${field('Block name','block-name')}</div><div class="row"><button class="btn" id="digCursor">Dig cursor block</button><button class="btn" id="digCoord">Dig coordinate</button><button class="btn" id="digNearest">Dig nearest named block</button><button class="btn" id="collectBlock">Collect block</button><button class="btn primary" id="openWindow">Open block GUI</button><button class="btn" id="refreshWindow">Refresh window</button><button class="btn warn" id="closeWindow">Close window</button></div><div class="form four">${field('Item name','item-name')}${field('Count','item-count','1')}${field('Slot','slot')}${field('Mouse button','mouse-button','0')}</div><div class="row"><button class="btn" id="withdraw">Withdraw</button><button class="btn" id="deposit">Deposit</button><button class="btn" id="clickSlot">Click slot</button><button class="btn" id="furnaceInput">Furnace input</button><button class="btn" id="furnaceFuel">Furnace fuel</button><button class="btn" id="furnaceTake">Take output</button></div><div id="windowView" class="items"></div></div></div>`
    const coords = () => ({x:formValue('block-x'),y:formValue('block-y'),z:formValue('block-z')})
    $('digCursor').onclick=()=>run('Dig cursor',()=>post(idPath('/dig-cursor'))); $('digCoord').onclick=()=>run('Dig coordinate',()=>post(idPath('/dig-block'),coords())); $('digNearest').onclick=()=>run('Dig nearest',()=>post(idPath('/dig-nearest'),{name:formValue('block-name')})); $('collectBlock').onclick=()=>run('Collect block',()=>post(idPath('/collect-block'),{name:formValue('block-name')})); if($('autoMine')) $('autoMine').onclick=()=>run('Auto mine',()=>post(idPath('/auto-mine'),{names:formValue('mine-names'),maxDistance:formValue('mine-range'),count:formValue('mine-count')})); if($('cutTrees')) $('cutTrees').onclick=()=>run('Cut trees',()=>post(idPath('/cut-trees'),{names:formValue('mine-names'),maxDistance:formValue('mine-range'),count:formValue('mine-count')}))
    $('openWindow').onclick=async()=>{ const d=await run('Open window',()=>post(idPath('/window/open'),coords())); state.win=d.window; renderWindow() }; $('refreshWindow').onclick=async()=>{ const d=await api(idPath('/window')); state.win=d.window; renderWindow() }; $('closeWindow').onclick=()=>run('Close window',()=>post(idPath('/window/close')))
    const itemBody=()=>({name:formValue('item-name'),count:formValue('item-count'),slot:formValue('slot'),mouseButton:formValue('mouse-button')})
    $('withdraw').onclick=async()=>{const d=await run('Withdraw',()=>post(idPath('/window/withdraw'),itemBody()));state.win=d.window;renderWindow()}; $('deposit').onclick=async()=>{const d=await run('Deposit',()=>post(idPath('/window/deposit'),itemBody()));state.win=d.window;renderWindow()}; $('clickSlot').onclick=async()=>{const d=await run('Click slot',()=>post(idPath('/window/click-slot'),itemBody()));state.win=d.window;renderWindow()}
    $('furnaceInput').onclick=async()=>{const d=await run('Furnace input',()=>post(idPath('/furnace/put-input'),itemBody()));state.win=d.window;renderWindow()}; $('furnaceFuel').onclick=async()=>{const d=await run('Furnace fuel',()=>post(idPath('/furnace/put-fuel'),itemBody()));state.win=d.window;renderWindow()}; $('furnaceTake').onclick=async()=>{const d=await run('Take output',()=>post(idPath('/furnace/take-output')));state.win=d.window;renderWindow()}
    renderWindow()
  }
  function renderWindow () { const el=$('windowView'); if(!el)return; const w=state.win; el.innerHTML = !w?.open ? '<p class="muted">No window open.</p>' : (w.slots||[]).map(itemCard).join(''); applyLanguage() }

  function renderInventory () {
    const b=selected()
    const proxy = b?.webInventoryUrl ? `<div class="webInvWrap"><iframe class="inventoryFrame" src="${b.webInventoryUrl}" loading="lazy"></iframe></div>` : `<div class="hintBox"><b>${t('Web inventory view')}</b><p>${t('Enable web-inventory plugin')}</p></div>`
    $('page-inventory').innerHTML=`<div class="card"><div class="cardHead"><h2>${t('Online inventory')}</h2><div class="row"><button class="btn" id="loadInv">${t('Refresh inventory')}</button>${b?.webInventoryUrl?`<a class="btn" target="_blank" href="${b.webInventoryUrl}">${t('Open new window')}</a>`:''}</div></div><div class="cardBody grid"><h3>${t('Web inventory view')}</h3>${proxy}<h3>${t('Built-in inventory')}</h3><div id="invItems" class="inventoryGrid"></div></div></div>`
    $('loadInv').onclick=loadInventory; renderInvPlayers(); if(!state.inventory && b?.status==='online') setTimeout(()=>loadInventory().catch(()=>{}),0)
  }
  async function loadInventory(){ const d=await api(idPath('/inventory')); state.inventory=d.inventory; renderInvPlayers() }
  async function loadPlayers(){ const d=await api(idPath('/players')); state.players=d.players; renderInvPlayers(); renderOpsPlayers() }
  function renderInvPlayers(){ if($('invItems')) $('invItems').innerHTML=inventoryHtml(state.inventory); applyLanguage() }
  function inventoryHtml(inv){
    if(!inv) return '<p class="muted">'+t('Click refresh inventory.')+'</p>'
    const equipment = inv.equipment || {}
    const eq = Object.entries(equipment).map(([k,it])=>`<div class="item invSlot"><b>${esc(k)}</b><span>${esc(it.displayName||it.name||'-')} · ${t('slot')} ${esc(it.slot)}</span></div>`).join('') || '<p class="muted">-</p>'
    const hotbar = (inv.hotbar || []).map(hotbarSlot).join('')
    const items = (inv.items || []).map(invItemCard).join('') || '<p class="muted">'+t('Empty')+'</p>'
    return `<div class="inventorySection"><h4>${t('Equipment')}</h4><div class="items">${eq}</div></div><div class="inventorySection"><h4>${t('Quick bar')}</h4><div class="hotbarPreview">${hotbar}</div></div><div class="inventorySection"><h4>${t('Inventory')}</h4><div class="items">${items}</div></div>`
  }
  function invItemCard (it){ return `<div class="item"><b>${it.empty?t('Empty'):esc(it.displayName||it.name||'item')}</b><span>${t('slot')} ${esc(it.slot)}${it.count?` · x${esc(it.count)}`:''}${it.name?` · ${esc(it.name)}`:''}</span>${it.empty?'':`<div class="row"><button class="btn small" data-equip-slot="${esc(it.slot)}">${t('Use in hand')}</button><button class="btn small bad" data-drop-slot="${esc(it.slot)}">${t('Drop item')}</button></div>`}</div>` }
  function hotbarSlot(it, i){ const selected = it.selected ? 'selected' : ''; return `<div class="hotbarSlot ${selected}">${it.empty?'<span></span>':`<b>${esc(it.displayName||it.name||'')}</b>${it.count?`<em>${esc(it.count)}</em>`:''}`}</div>` }
  document.addEventListener('click', ev => { const equip=ev.target.closest('[data-equip-slot]'); const drop=ev.target.closest('[data-drop-slot]'); if(equip) run('Use in hand',()=>post(idPath('/equip'),{slot:equip.dataset.equipSlot})); if(drop && confirm(t('Drop item')+'?')) run('Drop item',()=>post(idPath('/drop'),{slot:drop.dataset.dropSlot})) })
  window.__actPlayer=(type,name)=> type==='follow'?run('Follow player',()=>post(idPath('/follow'),{username:name,range:2})):run('Attack player',()=>post(idPath('/attack'),{username:name}))
  function itemCard (it){ return `<div class="item"><b>${it.empty?t('Empty'):esc(it.displayName||it.name||'item')}</b><span>${t('slot')} ${esc(it.slot)}${it.count?` · x${esc(it.count)}`:''}${it.name?` · ${esc(it.name)}`:''}</span></div>` }

  function chatLogs () { return state.logs.filter(l => l.level === 'chat' || String(l.message||'').startsWith('<')) }
  function renderChat(){ const b=selected(); const logs=chatLogs(); const id=botId(); $('page-chat').innerHTML=`<div class="card"><div class="cardHead"><h2>Online chat</h2><span class="tag">${esc(b?.username||'-')}</span></div><div class="cardBody grid"><div class="chatBox" id="chatBoxInner">${logs.map(l=>`<div class="chatMsg"><span>${esc((l.time||'').slice(11,19))}</span><b>[${esc(l.id)}]</b> ${esc(l.message)}</div>`).join('') || '<p class="muted">No logs yet.</p>'}</div><div class="form"><div class="field"><label>Message</label><input id="chatPageText" placeholder="hello or /command"></div><div class="field"><label>&nbsp;</label><button class="btn primary" id="chatPageSend">Send</button></div></div></div></div>`; if($('chatPageSend')) $('chatPageSend').onclick=()=>run('Send chat',()=>post(`/api/bots/${encodeURIComponent(id)}/chat`,{message:formValue('chatPageText')})); }

  async function loadPlugins(){ const d=await api('/api/plugins'); state.plugins=d.plugins||[]; renderPlugins() }
  function renderPlugins(){ const el=$('page-plugins'); if(!el)return; if(state.tab==='plugins' && (!state.plugins||!state.plugins.length)) setTimeout(()=>loadPlugins().catch(e=>toast(e.message)),0); const reg=`<select id="plugin-reg"><option value="https://registry.npmmirror.com">China mirror</option><option value="https://registry.npmjs.org">npm official</option></select>`; el.innerHTML=`<div class="card"><div class="cardHead"><h2>Plugin manager</h2><button class="btn" id="reloadPlugins">Refresh</button></div><div class="cardBody grid"><div class="form four"><div class="field"><label>Registry</label>${reg}</div></div><div class="items pluginItems">${(state.plugins||[]).map(p=>`<div class="item pluginItem"><b>${esc(p.label||p.name)}</b><span>${esc(p.name)}</span><span>${t('Feature')}: ${esc(p.feature||'-')}</span><span>${p.installed?`${t('Installed')} ${esc(p.installedVersion||'')}`:t('Not installed')}</span><div class="row"><button class="btn small primary" data-plugin-install="${esc(p.name)}">${p.installed?t('Update'):t('Install')}</button>${p.installed?`<button class="btn small bad" data-plugin-remove="${esc(p.name)}">${t('Remove')}</button>`:''}</div></div>`).join('') || '<p class="muted">Click refresh.</p>'}</div><div class="updateBox">${state.updateLogs.map(l=>`<div>${esc(l)}</div>`).join('') || '<span class="muted">No update logs.</span>'}</div></div></div>`; if($('reloadPlugins')) $('reloadPlugins').onclick=loadPlugins; document.querySelectorAll('[data-plugin-install]').forEach(btn=>btn.onclick=()=>run('Install plugin',()=>post('/api/plugins/install',{name:btn.dataset.pluginInstall,registry:formValue('plugin-reg')}))); document.querySelectorAll('[data-plugin-remove]').forEach(btn=>btn.onclick=()=>run('Remove plugin',()=>post('/api/plugins/remove',{name:btn.dataset.pluginRemove}))); }

  function hotbarOverlay (b) {
    if (!b?.hotbar || !b.hotbar.length) return ''
    return `<div class="viewerHotbar">${b.hotbar.map(hotbarSlot).join('')}</div>`
  }

  async function setViewerPerspective (firstPerson) {
    const id = botId()
    if (!id) return toast(t('Select a bot first'))
    const data = await run('Viewer mode updated', () => post(`/api/bots/${encodeURIComponent(id)}/viewer-perspective`, { firstPerson: Boolean(firstPerson) }))
    if (data?.bot) upsert(data.bot)
    state.viewerReloadToken = Date.now()
    renderMap()
    renderFloatPanel()
  }

  function saveFloatViewer () { localStorage.setItem('floatViewer', JSON.stringify(state.floatViewer)) }
  function openFloatViewer () { state.floatViewer.open = true; state.mapInline = false; localStorage.setItem('mapInline','off'); saveFloatViewer(); renderMap(); renderFloatPanel() }
  function closeFloatViewer () { state.floatViewer.open = false; saveFloatViewer(); renderFloatPanel() }
  function resetFloatViewer () { state.floatViewer = { open: true, x: 24, y: 88, w: 560, h: 360 }; saveFloatViewer(); renderFloatPanel() }
  function renderFloatPanel(){
    let el=$('floatPanel')
    if(!el){ el=document.createElement('div'); el.id='floatPanel'; document.body.appendChild(el) }
    const b=selected()
    if(!state.floatViewer.open || !b?.viewerUrl){ el.innerHTML=''; return }
    const f=state.floatViewer
    const frameSrc = viewerFrameSrc(b)
    f.x=Math.max(0, Number(f.x)||24); f.y=Math.max(0, Number(f.y)||88); f.w=Math.max(320, Number(f.w)||560); f.h=Math.max(220, Number(f.h)||360)
    let card = el.querySelector('.floatViewer')
    const same = card && card.dataset.src === frameSrc && Boolean(card.querySelector('.viewerKeyCatcher')) === Boolean(state.keyboardCapture)
    const viewText = b.firstPersonViewer ? t('First person view') : t('Third person view')
    const switchText = b.firstPersonViewer ? t('Switch to third person') : t('Switch to first person')
    if (!same) {
      el.innerHTML=`<div class="floatViewer ${qualityClass()}" data-src="${esc(frameSrc)}" style="left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px"><div class="floatViewerHead" id="floatViewerHead"><div><b>${esc(t('Floating viewer'))}</b><span id="floatViewerMeta">${esc(b.username)} · ${esc(b.status)} · ${esc(viewText)}</span></div><div class="row"><button class="btn small ${state.keyboardCapture?'primary':'ok'}" id="floatViewerKeyboard">${esc(state.keyboardCapture?t('Stop keyboard capture'):t('Start keyboard capture'))}</button><button class="btn small" id="floatViewerMode">${esc(switchText)}</button><button class="btn small" id="floatViewerReset">${esc(t('Reset floating viewer'))}</button><button class="btn small bad" id="floatViewerClose">×</button></div></div><iframe class="floatViewerFrame" src="${frameSrc}" loading="eager"></iframe>${state.keyboardCapture?'<div class="viewerKeyCatcher float" tabindex="0"><span>'+t('Keyboard capture active')+'</span></div>':''}${hotbarOverlay(b)}<div class="floatResize" id="floatResize"></div></div>`
      bindFloatViewerEvents()
    } else {
      card.style.left=f.x+'px'; card.style.top=f.y+'px'; card.style.width=f.w+'px'; card.style.height=f.h+'px'
      const meta = $('floatViewerMeta'); if (meta) meta.textContent = `${b.username} · ${b.status} · ${viewText}`
      const modeBtn = $('floatViewerMode'); if (modeBtn) modeBtn.textContent = switchText
      const keyBtn = $('floatViewerKeyboard'); if (keyBtn) { keyBtn.textContent = state.keyboardCapture?t('Stop keyboard capture'):t('Start keyboard capture'); keyBtn.classList.toggle('primary', state.keyboardCapture); keyBtn.classList.toggle('ok', !state.keyboardCapture) }
      if (state.keyboardCapture) setTimeout(focusKeyboardTarget, 0)
    }
  }

  function bindFloatViewerEvents () {
    const card = document.querySelector('#floatPanel .floatViewer')
    const head = $('floatViewerHead')
    const resize = $('floatResize')
    if (!card || !head || !resize) return
    $('floatViewerClose').onclick = closeFloatViewer
    $('floatViewerReset').onclick = resetFloatViewer
    if ($('floatViewerKeyboard')) $('floatViewerKeyboard').onclick = toggleKeyboardCapture
    const floatCatcher=document.querySelector('.floatViewer .viewerKeyCatcher'); if(floatCatcher) floatCatcher.onclick=()=>{try{floatCatcher.focus(); window.focus()}catch{}}
    if ($('floatViewerMode')) $('floatViewerMode').onclick = () => setViewerPerspective(!Boolean(selected()?.firstPersonViewer))
    let drag=null
    head.onmousedown = ev => {
      if (ev.target.closest('button')) return
      const f = state.floatViewer
      drag={type:'move', sx:ev.clientX, sy:ev.clientY, x:f.x, y:f.y}
      ev.preventDefault()
    }
    resize.onmousedown = ev => { const f=state.floatViewer; drag={type:'resize', sx:ev.clientX, sy:ev.clientY, w:f.w, h:f.h}; ev.preventDefault() }
    window.onmousemove = ev => {
      if(!drag) return
      const f=state.floatViewer
      if(drag.type==='move') { f.x=Math.max(0, drag.x + ev.clientX - drag.sx); f.y=Math.max(0, drag.y + ev.clientY - drag.sy) }
      else { f.w=Math.max(320, drag.w + ev.clientX - drag.sx); f.h=Math.max(220, drag.h + ev.clientY - drag.sy) }
      card.style.left=f.x+'px'; card.style.top=f.y+'px'; card.style.width=f.w+'px'; card.style.height=f.h+'px'
    }
    window.onmouseup = () => { if(drag){ drag=null; saveFloatViewer() } }
  }

  function renderMap(){
    const b=selected(); const page=$('page-map'); if(!page)return
    const rawSrc=b?.viewerUrl || ''
    const src=viewerFrameSrc(b)
    const err=b?.lastError && String(b.lastError).includes('viewer failed') ? `<p class="bad">${esc(b.lastError)}</p><button class="btn" id="mapInstall">${t('Install viewer dependency')}</button>` : ''
    if(!rawSrc){ page.innerHTML=`<div class="card"><div class="cardHead"><h2>${t('Integrated map')}</h2></div><div class="cardBody"><p class="muted">${t('Start a bot first. The viewer is proxied through the main web port.')}</p>${err}</div></div>`; if($('mapInstall')) $('mapInstall').onclick=()=>run('Install viewer dependency',()=>post('/api/update/run',{mode:'core',registry:'https://registry.npmmirror.com'})); return }
    const oldFrame=page.querySelector('iframe.viewerFrame')
    const catcherMatches = Boolean(page.querySelector('.viewerKeyCatcher')) === Boolean(state.keyboardCapture)
    const viewText = b.firstPersonViewer ? t('First person view') : t('Third person view')
    if(oldFrame && oldFrame.getAttribute('src')===src && catcherMatches){
      const tip=$('viewerTip'); if(tip) tip.textContent=t('Lower view distance to 3 or 4, then restart the bot.')
      const modeTag=$('viewerModeTag'); if(modeTag) modeTag.textContent=viewText
      const q=$('viewerQuality'); if(q) q.value=state.viewerQuality
      setViewerQuality(state.viewerQuality)
      if (state.keyboardCapture) setTimeout(focusKeyboardTarget, 0)
      return
    }
    const inline = state.mapInline
    const qualitySelect = `<select id="viewerQuality"><option value="smooth">${t('Smooth')}</option><option value="balanced">${t('Balanced')}</option><option value="sharp">${t('Sharp')}</option></select>`
    page.innerHTML=`<div class="card"><div class="cardHead"><div><h2>${t('Integrated map')}</h2><span class="tag" id="viewerModeTag">${esc(viewText)}</span></div><div class="row"><label class="miniSelect"><span>${t('Viewer quality')}</span>${qualitySelect}</label><button class="btn ${state.keyboardCapture?'primary':'ok'}" id="viewerKeyboardCapture">${state.keyboardCapture?t('Stop keyboard capture'):t('Start keyboard capture')}</button><button class="btn primary" id="openFloatViewer">${t('Open floating viewer')}</button><button class="btn" id="closeFloatViewerBtn">${t('Close floating viewer')}</button><button class="btn" id="toggleInlineViewer">${inline?t('Hide inline viewer'):t('Show inline viewer')}</button><button class="btn ${b.firstPersonViewer?'primary':''}" id="viewFirst">${t('First person view')}</button><button class="btn ${!b.firstPersonViewer?'primary':''}" id="viewThird">${t('Third person view')}</button><a class="btn" target="_blank" href="${rawSrc}">${t('Open new window')}</a></div></div><div class="cardBody grid"><div class="hintBox"><b>${t('Viewer performance tip')}</b><p id="viewerTip">${t('Lower view distance to 3 or 4, then restart the bot.')}</p></div>${inline?`<div class="viewerWrap ${qualityClass()}"><iframe class="viewerFrame" src="${src}" loading="eager" allowfullscreen></iframe>${state.keyboardCapture?'<div class="viewerKeyCatcher" tabindex="0"><span>'+t('Keyboard capture active')+'</span></div>':''}${hotbarOverlay(b)}</div>`:`<p class="muted">${t('Inline viewer paused to reduce lag. The floating viewer is still available.')}</p>`}</div></div>`
    if ($('viewerQuality')) { $('viewerQuality').value = state.viewerQuality; $('viewerQuality').onchange = ev => setViewerQuality(ev.target.value) }
    if($('viewerKeyboardCapture')) $('viewerKeyboardCapture').onclick=toggleKeyboardCapture
    const catcher=$('page-map')?.querySelector('.viewerKeyCatcher'); if(catcher) { catcher.onclick=()=>focusKeyboardTarget(); setTimeout(focusKeyboardTarget, 0) }
    if($('openFloatViewer')) $('openFloatViewer').onclick=openFloatViewer
    if($('closeFloatViewerBtn')) $('closeFloatViewerBtn').onclick=closeFloatViewer
    if($('toggleInlineViewer')) $('toggleInlineViewer').onclick=()=>{state.mapInline=!state.mapInline; localStorage.setItem('mapInline', state.mapInline?'on':'off'); renderMap()}
    if($('viewFirst')) $('viewFirst').onclick=()=>setViewerPerspective(true)
    if($('viewThird')) $('viewThird').onclick=()=>setViewerPerspective(false)
  }

  function renderGuard(){ if (!$('page-guard')) return; const b=selected(); const p=b?.position||{}; $('page-guard').innerHTML=`<div class="card"><div class="cardHead"><h2>Guard area</h2><span class="tag ${b?.guard?.enabled?'online':''}">${b?.guard?.enabled?'guarding':'stopped'}</span></div><div class="cardBody grid"><div class="form four">${field('Center X','guard-x',num(p.x))}${field('Center Y','guard-y',num(p.y))}${field('Center Z','guard-z',num(p.z))}${field('Radius','guard-radius','16')}</div><div class="form four"><div class="field"><label>Mode</label><select id="guard-mode"><option value="hostile">hostile mobs</option><option value="players">players</option><option value="all">all mobs/players</option></select></div>${field('Interval ms','guard-interval','1000')}<label class="check"><input id="guard-return" type="checkbox" checked> Return home</label></div><div class="row"><button class="btn primary" id="startGuard">Start guard</button><button class="btn warn" id="stopGuard">Stop guard</button></div></div></div>`
    $('startGuard').onclick=()=>run('Start guard',()=>post(idPath('/guard/start'),{x:formValue('guard-x'),y:formValue('guard-y'),z:formValue('guard-z'),radius:formValue('guard-radius'),mode:formValue('guard-mode'),returnHome:formBool('guard-return'),intervalMs:formValue('guard-interval')})); $('stopGuard').onclick=()=>run('Stop guard',()=>post(idPath('/guard/stop')))
  }

  function renderLogsOnly(){ const el=$('page-logs'); if(!el)return; el.innerHTML=`<div class="card"><div class="cardHead"><h2>Logs</h2><button class="btn" id="clearLogs">Clear</button></div><div class="cardBody"><div class="logBox" id="logBoxInner">${state.logs.map(l=>`<div class="logLine log-${esc(l.level)}">[${esc(l.time)}] [${esc(l.id)}] [${esc(l.level)}] ${esc(l.message)}</div>`).join('') || '<p class="muted">No logs yet.</p>'}</div></div></div>`; if($('clearLogs')) $('clearLogs').onclick=()=>{state.logs=[];renderLogsOnly()}; applyLanguage() }


  function renderAbout () {
    const el = $('page-about')
    if (!el) return
    el.innerHTML = `<div class="card aboutCard"><div class="cardHead"><h2>${t('About')}</h2><a class="btn primary" target="_blank" rel="noreferrer" href="https://github.com/intellectmind/MineflayerWebBot">${t('Open GitHub')}</a></div><div class="cardBody grid">
      <div class="infoGrid">
        ${info('Project information', 'Mineflayer Web Bot')}
        ${info('Release version', '1.0.0')}
        ${info('Runtime requirement', t('Node.js 22 or newer'))}
        ${info('Official repository', 'github.com/intellectmind/MineflayerWebBot')}
      </div>
      <div class="hintBox"><b>${t('Project description')}</b><p>${t('Main features')}: ${t('Multi bot management, Microsoft login, AuthMe, integrated viewer proxy, online inventory, default plugin bundle, online dependency update.')}</p></div>
    </div></div>`
  }

  function renderSystemOnly(){ const el=$('page-system'); if(!el)return; const s=state.system; el.innerHTML=`<div class="card"><div class="cardHead"><h2>System and online update</h2><button class="btn" id="reloadSystem">Refresh</button></div><div class="cardBody grid"><div class="infoGrid">${info('Version',s?.version)}${info('Node',s?.node)}${info('Platform',`${s?.platform||'-'} ${s?.arch||''}`)}${info('Auth mode',s?.authMode || '-')}</div><div class="form four"><div class="field"><label>Update mode</label><select id="update-mode"><option value="core">core mineflayer deps</option><option value="all">all runtime deps</option></select></div><div class="field"><label>Registry</label><select id="update-reg"><option value="https://registry.npmmirror.com">China mirror</option><option value="https://registry.npmjs.org">npm official</option></select></div><div class="field"><label>&nbsp;</label><button class="btn" id="checkUpdate">Check latest</button></div><div class="field"><label>&nbsp;</label><button class="btn primary" id="runUpdate">Install update</button></div></div><div class="items">${state.updateCheck.map(p=>`<div class="item"><b>${esc(p.name)}</b><span>current ${esc(p.current)} · latest ${esc(p.latest||p.error||'-')}</span>${p.note?`<span>${esc(p.note)}</span>`:''}</div>`).join('')}</div><div class="updateBox">${state.updateLogs.map(l=>`<div>${esc(l)}</div>`).join('') || '<span class="muted">No update logs.</span>'}</div></div></div>`
    if($('reloadSystem')) $('reloadSystem').onclick=refresh
    if($('checkUpdate')) $('checkUpdate').onclick=async()=>{const d=await run('Check update',()=>post('/api/update/check',{mode:formValue('update-mode'),registry:formValue('update-reg')}));state.updateCheck=d.packages||[];renderSystemOnly()}
    if($('runUpdate')) $('runUpdate').onclick=()=>run('Run update',()=>post('/api/update/run',{mode:formValue('update-mode'),registry:formValue('update-reg')})); applyLanguage()
  }

  async function boot () {
    const ok = await checkAuth()
    if (!ok) return renderLogin()
    shell(); installKeyboardCapture(); installMouseCapture(); updateKeyboardLayer(); await refresh(); connectSocket()
  }
  boot()
})()

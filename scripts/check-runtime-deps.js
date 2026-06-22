const required = [
  ['mineflayer', 'mineflayer'],
  ['minecraft-protocol', 'minecraft-protocol'],
  ['mineflayer-pathfinder', 'mineflayer-pathfinder'],
  ['prismarine-viewer', 'prismarine-viewer'],
  ['canvas', 'canvas'],
  ['express', 'express'],
  ['socket.io', 'socket.io'],
  ['vec3', 'vec3'],
  ['mineflayer-web-inventory', 'mineflayer-web-inventory'],
  ['mineflayer-pvp', 'mineflayer-pvp'],
  ['mineflayer-auto-eat', 'mineflayer-auto-eat'],
  ['mineflayer-armor-manager', 'mineflayer-armor-manager'],
  ['mineflayer-collectblock', 'mineflayer-collectblock'],
  ['mineflayer-tool', 'mineflayer-tool']
]

const missing = []
for (const [label, mod] of required) {
  try { require.resolve(mod) } catch { missing.push(label) }
}

if (missing.length) {
  console.error(`[MISSING] ${missing.join(', ')}`)
  console.error('Run: npm install --omit=dev --legacy-peer-deps --no-audit --no-fund')
  process.exit(2)
}

console.log('[OK] Runtime dependencies and bundled plugins are ready.')

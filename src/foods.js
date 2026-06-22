// 常见 Java 版食物物品名。不同版本名字基本稳定；找不到时会降级按关键词匹配。
const FOOD_NAMES = new Set([
  'apple', 'baked_potato', 'beetroot', 'beetroot_soup', 'bread',
  'carrot', 'chorus_fruit', 'cooked_beef', 'cooked_chicken',
  'cooked_cod', 'cooked_mutton', 'cooked_porkchop', 'cooked_rabbit',
  'cooked_salmon', 'cookie', 'dried_kelp', 'golden_apple',
  'enchanted_golden_apple', 'golden_carrot', 'honey_bottle',
  'melon_slice', 'mushroom_stew', 'poisonous_potato', 'potato',
  'pumpkin_pie', 'rabbit_stew', 'beef', 'chicken', 'cod', 'mutton',
  'porkchop', 'rabbit', 'salmon', 'rotten_flesh', 'spider_eye',
  'suspicious_stew', 'sweet_berries', 'glow_berries', 'tropical_fish'
])

function isProbablyFood (item) {
  if (!item?.name) return false
  if (FOOD_NAMES.has(item.name)) return true
  return /apple|bread|potato|carrot|beef|chicken|pork|mutton|rabbit|cod|salmon|stew|berries|melon|pie|kelp|cookie|honey/.test(item.name)
}

module.exports = { FOOD_NAMES, isProbablyFood }

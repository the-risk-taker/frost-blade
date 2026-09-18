import { sfx } from './sound.js'
import { updateStats } from './talents.js'

// Everything the hero can carry. Loot and ammo are counted in the bag, gear pieces are separate items in the pack.
// Gear goes into a slot and changes stats and the hero's look. Names are in lang.js under item.<key>.
export const ITEMS = {
  gold: {},
  potion: {},
  fur: { value: 5 },
  fang: { value: 3 },
  yetiFur: { value: 9 },
  iceScale: { value: 7 },
  // Arrows give statuses on hit, piercing ones fly through foes
  arrows: { ammo: {} },
  iceArrows: { ammo: { statuses: { slow: 2.5 } } },
  fireArrows: { ammo: { statuses: { burn: 3 } } },
  pierceArrows: { ammo: { pierce: true } },
  // Melee weapons: damage, reach ahead of the hero, swing time and stamina per swing
  sword: { slot: 'weapon', value: 10, damage: 14, reach: 46, time: 0.3, stamina: 12 },
  axe: { slot: 'weapon', value: 20, damage: 26, reach: 56, time: 0.5, stamina: 20 },
  spear: { slot: 'weapon', value: 18, damage: 12, reach: 76, time: 0.38, stamina: 14, push: 1 },
  daggers: { slot: 'weapon', value: 18, damage: 7, reach: 36, time: 0.16, stamina: 6, statuses: { bleed: 3 } },
  // The staff charges frost bolts into blasts and widens the nova
  staff: { slot: 'weapon', value: 25, damage: 9, reach: 44, time: 0.35, stamina: 10, spell: 6, nova: 0.5, charged: true },
  // The pickaxe climbs ice walls and shatters ice blocks and the frozen lake
  pickaxe: { slot: 'weapon', value: 22, damage: 18, reach: 44, time: 0.42, stamina: 16, climb: 1, crack: 1 },
  // Bows: time of a full draw and arrow damage
  bow: { slot: 'bow', value: 10, draw: 0.7, might: 1 },
  shortbow: { slot: 'bow', value: 15, draw: 0.35, might: 0.65 },
  // The harpoon drags in whatever it hits
  harpoon: { slot: 'bow', value: 30, draw: 0.6, might: 1.3, pull: 1 },
  helmet: { slot: 'head', value: 8, defense: 3 },
  hood: { slot: 'head', value: 6, defense: 1, warmth: 3 },
  armor: { slot: 'body', value: 20, defense: 7 },
  chainmail: { slot: 'body', value: 12, defense: 4, warmth: 1 },
  robe: { slot: 'body', value: 10, manaRegen: 8 },
  scaleArmor: { slot: 'body', value: 24, defense: 6, thaw: 1, warmth: 1 },
  cloak: { slot: 'back', value: 6, staminaRegen: 20, warmth: 3 },
  shamanCloak: { slot: 'back', value: 12, manaRegen: 4, spell: 4, warmth: 2 },
  yetiCloak: { slot: 'back', value: 26, defense: 2, warmth: 8, thaw: 1 },
  gloves: { slot: 'hands', value: 8, attackSpeed: 0.15 },
  boots: { slot: 'feet', value: 8, speed: 0.1, grip: 3, warmth: 1 },
  // Crampons bite into the ice, so nothing slides and the mountain wind cannot push the hero around
  crampons: { slot: 'feet', value: 18, grip: 8, anchor: 1, warmth: 2 },
  ring: { slot: 'ring', value: 15, crit: 0.05 },
  amulet: { slot: 'neck', value: 15, maxMana: 15 },
  deepAmulet: { slot: 'neck', value: 22, maxMana: 10, depths: 8 },
  // Legendary uniques: a spirit wolf every third hit, more damage for a while after a kill
  alphaFang: { slot: 'neck', value: 40, unique: true, wolf: 3 },
  crown: { slot: 'head', value: 40, unique: true, defense: 3, frenzy: 0.3 },
}

export const GEAR_SLOTS = ['weapon', 'bow', 'head', 'body', 'back', 'hands', 'feet', 'ring', 'neck']
export const PACK_SIZE = 12
// Stats kept as fractions and shown as percents, the rest are whole numbers
export const PERCENT = ['crit', 'lifesteal', 'speed', 'attackSpeed', 'frenzy', 'push', 'nova', 'might']

// Rarity tiers: random bonuses, sell price multiplier and the color of the name and the sparkles on the ground
export const RARITIES = [
  { bonuses: 0, price: 1, color: '#ffffff' },
  { bonuses: 1, price: 2, color: '#6fa8ff' },
  { bonuses: 2, price: 3, color: '#ffd84a' },
  { bonuses: 3, price: 5, color: '#ff9a3c' },
]

// Random bonuses at area level 1, higher areas roll bigger ones
const BONUSES = { maxHp: 15, maxMana: 15, defense: 2, power: 3, spell: 5, crit: 0.06, lifesteal: 0.05, manaRegen: 3, staminaRegen: 10, speed: 0.06, attackSpeed: 0.08 }
const PITY = 3

const pickOne = (list, random) => list[Math.floor(random() * list.length)]
const bases = unique => Object.keys(ITEMS).filter(base => ITEMS[base].slot && !ITEMS[base].unique === !unique)

export function createItem(base, rarity = 0, random = null, scale = 1) {
  const bonus = {}
  for (let i = 0; i < RARITIES[rarity].bonuses; i++) {
    const key = pickOne(Object.keys(BONUSES), random)
    const value = (bonus[key] ?? 0) + BONUSES[key] * scale * (0.6 + random() * 0.8)
    bonus[key] = PERCENT.includes(key) ? Math.round(value * 100) / 100 : Math.round(value)
  }
  return { base, rarity, bonus }
}

// Stats of a gear piece: its base plus the rolled bonuses
export function bonuses(item) {
  const result = { ...item.bonus }
  for (const [key, value] of Object.entries(ITEMS[item.base])) if (typeof value === 'number' && key !== 'value') result[key] = (result[key] ?? 0) + value
  return result
}

// Gear dropped by foes, higher areas bring better rarities
export function rollGear(random, scale) {
  const roll = random() / scale
  return createItem(pickOne(bases(false), random), roll < 0.1 ? 2 : roll < 0.4 ? 1 : 0, random, scale)
}

// Bosses and mimics may drop a unique, after a few misses in a row one is certain
export function rollUnique(p, chance, random) {
  if (random() >= chance && ++p.pity < PITY) return null
  p.pity = 0
  return createItem(pickOne(bases(true), random), 3, random)
}

export const worn = (p, slot) => ITEMS[p.gear[slot].base]

// What the merchant has. Costs paid with loot work as simple crafting.
export const OFFERS = [
  { item: 'arrows', count: 10, cost: { gold: 6 } },
  { item: 'iceArrows', count: 10, cost: { gold: 10, fang: 1 } },
  { item: 'fireArrows', count: 10, cost: { gold: 14 } },
  { item: 'pierceArrows', count: 10, cost: { gold: 16 } },
  { item: 'potion', count: 1, cost: { gold: 12 } },
  { item: 'axe', count: 1, cost: { gold: 45 } },
  { item: 'spear', count: 1, cost: { gold: 40 } },
  { item: 'daggers', count: 1, cost: { gold: 40, fang: 2 } },
  { item: 'staff', count: 1, cost: { gold: 50, fang: 3 } },
  { item: 'pickaxe', count: 1, cost: { gold: 50 } },
  { item: 'shortbow', count: 1, cost: { gold: 35 } },
  { item: 'harpoon', count: 1, cost: { gold: 55, iceScale: 2 } },
  { item: 'helmet', count: 1, cost: { gold: 25 } },
  { item: 'hood', count: 1, cost: { fur: 2 } },
  { item: 'chainmail', count: 1, cost: { gold: 35 } },
  { item: 'armor', count: 1, cost: { gold: 60 } },
  { item: 'robe', count: 1, cost: { gold: 20, fang: 3 } },
  { item: 'cloak', count: 1, cost: { fur: 3 } },
  { item: 'shamanCloak', count: 1, cost: { gold: 30, fang: 2 } },
  { item: 'scaleArmor', count: 1, cost: { gold: 45, iceScale: 3 } },
  { item: 'yetiCloak', count: 1, cost: { gold: 30, yetiFur: 2 } },
  { item: 'gloves', count: 1, cost: { gold: 20, fur: 1 } },
  { item: 'boots', count: 1, cost: { gold: 20, fur: 2 } },
  { item: 'crampons', count: 1, cost: { gold: 30, fur: 2 } },
  { item: 'deepAmulet', count: 1, cost: { gold: 40, iceScale: 2 } },
]

export function give(p, item, count) {
  p.bag[item] = (p.bag[item] ?? 0) + count
}

// Adds loot to the hero: counted items always fit, gear needs a free place in the pack
export function collect(p, item, count) {
  if (typeof item === 'string') give(p, item, count)
  else if (p.pack.length < PACK_SIZE) p.pack.push(item)
  else return false
  return true
}

export const price = item => typeof item === 'string' ? ITEMS[item].value : ITEMS[item.base].value * RARITIES[item.rarity].price

export const canBuy = (p, { item, cost }) => !(ITEMS[item].slot && p.pack.length >= PACK_SIZE) && Object.entries(cost).every(([need, n]) => (p.bag[need] ?? 0) >= n)

export function buy(p, offer) {
  if (!canBuy(p, offer)) return
  for (const [need, n] of Object.entries(offer.cost)) give(p, need, -n)
  collect(p, ITEMS[offer.item].slot ? createItem(offer.item) : offer.item, offer.count)
  sfx.coin()
}

// Sells one counted item or a gear piece from the pack
export function sell(p, item) {
  give(p, 'gold', price(item))
  if (typeof item === 'string') give(p, item, -1)
  else p.pack.splice(p.pack.indexOf(item), 1)
  sfx.coin()
}

// Wears a gear piece from the pack, the piece worn in its slot goes back to the pack
export function equip(p, item) {
  const { slot } = ITEMS[item.base]
  p.pack.splice(p.pack.indexOf(item), 1, ...(p.gear[slot] ? [p.gear[slot]] : []))
  p.gear[slot] = item
  updateStats(p)
  sfx.pickup()
}

// Weapons are only swapped, the hero always holds a blade and a bow
export function unequip(p, slot) {
  if (slot === 'weapon' || slot === 'bow' || p.pack.length >= PACK_SIZE) return
  p.pack.push(p.gear[slot])
  p.gear[slot] = null
  updateStats(p)
  sfx.pickup()
}

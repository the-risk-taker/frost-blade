import { sfx } from './sound.js'

// Everything the hero can carry. Gear goes into a slot and changes stats and the hero's look.
// Names are in lang.js under item.<key>.
export const ITEMS = {
  gold: {},
  arrows: {},
  potion: {},
  fur: { value: 5 },
  fang: { value: 3 },
  helmet: { slot: 'head', defense: 3 },
  armor: { slot: 'body', defense: 6 },
  robe: { slot: 'body', manaRegen: 8 },
  cloak: { slot: 'back', staminaRegen: 20 },
}

// What the merchant has. Costs paid with loot work as simple crafting.
export const OFFERS = [
  { item: 'arrows', count: 10, cost: { gold: 6 } },
  { item: 'potion', count: 1, cost: { gold: 12 } },
  { item: 'helmet', count: 1, cost: { gold: 25 } },
  { item: 'armor', count: 1, cost: { gold: 45 } },
  { item: 'robe', count: 1, cost: { gold: 20, fang: 3 } },
  { item: 'cloak', count: 1, cost: { fur: 3 } },
]

export const stat = (p, key) => Object.values(p.gear).reduce((sum, item) => sum + (ITEMS[item]?.[key] ?? 0), 0)

export function give(p, item, count) {
  p.bag[item] = (p.bag[item] ?? 0) + count
}

export const canBuy = (p, { item, cost }) => !(ITEMS[item].slot && p.bag[item]) && Object.entries(cost).every(([need, n]) => (p.bag[need] ?? 0) >= n)

export function buy(p, offer) {
  if (!canBuy(p, offer)) return
  for (const [need, n] of Object.entries(offer.cost)) give(p, need, -n)
  give(p, offer.item, offer.count)
  sfx.coin()
}

export function sell(p, item) {
  if (!p.bag[item]) return
  give(p, item, -1)
  give(p, 'gold', ITEMS[item].value)
  sfx.coin()
}

// Puts gear on, or takes it off when it is already worn
export function equip(p, item) {
  const { slot } = ITEMS[item]
  p.gear[slot] = p.gear[slot] === item ? null : item
  sfx.pickup()
}

import { carried, createPlayer } from './player.js'
import { noTalents } from './talents.js'
import { ITEMS, createItem } from './items.js'

// Cross-session checkpoint: enough to resume where the hero left off, including bag, gear and talents.
// Every save has a version, older saves are upgraded one step at a time when loaded.
const KEY = 'progress'
const VERSION = 3

const MIGRATIONS = {
    // v0.0.7 saved health, mana and power grown on every level up, they now follow from the level and talents
    1: ({ maxHp, maxMana, power, ...save }) => ({ ...save, talents: noTalents(), skill: null, resets: 0 }),
    // v0.0.8 counted gear in the bag and wore it by name, now every piece is an item of its own
    2: ({ bag, gear, ...save }) => {
        const { gear: slots, pack, quiver, pity } = createPlayer()
        for (const base of Object.keys(bag).filter(base => ITEMS[base]?.slot)) {
            if (Object.values(gear).includes(base)) slots[ITEMS[base].slot] = createItem(base)
            else pack.push(createItem(base))
            delete bag[base]
        }
        return { ...save, bag, gear: slots, pack, quiver, pity }
    },
}

export const migrate = save => {
    for (let version = save?.version ?? 1; save && version < VERSION; version++) save = MIGRATIONS[version](save)
    return save
}

export function loadProgress() {
    try {
        return migrate(JSON.parse(localStorage.getItem(KEY)))
    } catch {
        return null
    }
}

export function saveProgress(game, stage) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ version: VERSION, stage, ...carried(game.player) }))
    } catch { }
}

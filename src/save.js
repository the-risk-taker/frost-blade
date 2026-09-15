import { carried } from './player.js'
import { noTalents } from './talents.js'

// Cross-session checkpoint: enough to resume where the hero left off, including bag, gear and talents.
// Every save has a version, older saves are upgraded one step at a time when loaded.
const KEY = 'progress'
const VERSION = 2

const MIGRATIONS = {
    // v0.0.7 saved health, mana and power grown on every level up, they now follow from the level and talents
    1: ({ maxHp, maxMana, power, ...save }) => ({ ...save, talents: noTalents(), skill: null, resets: 0 }),
}

export function loadProgress() {
    try {
        let save = JSON.parse(localStorage.getItem(KEY))
        for (let version = save?.version ?? 1; save && version < VERSION; version++) save = MIGRATIONS[version](save)
        return save
    } catch {
        return null
    }
}

export function saveProgress(game, stage) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ version: VERSION, stage, ...carried(game.player) }))
    } catch { }
}

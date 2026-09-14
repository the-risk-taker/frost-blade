// Cross-session checkpoint: enough to resume where the hero left off, including bag and gear.
const KEY = 'progress'

export function loadProgress() {
    try {
        return JSON.parse(localStorage.getItem(KEY))
    } catch {
        return null
    }
}

export function saveProgress(game, stage) {
    const p = game.player
    try {
        localStorage.setItem(KEY, JSON.stringify({
            stage, level: p.level, xp: p.xp, maxHp: p.maxHp, maxMana: p.maxMana, power: p.power,
            bag: p.bag, gear: p.gear,
        }))
    } catch { }
}

export function clearProgress() {
    try {
        localStorage.removeItem(KEY)
    } catch { }
}

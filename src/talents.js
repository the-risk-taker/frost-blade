import { ITEMS } from './items.js'
import { sfx } from './sound.js'

// Three branches learned node by node, one point per level up. The third node of each branch unlocks an active skill.
// Texts are in lang.js under talent.<branch><index>.
export const TALENTS = {
    warrior: [{ maxHp: 25 }, { lifesteal: 0.2 }, { skill: 'whirl' }, { defense: 3 }, { power: 4 }],
    hunter: [{ staminaRegen: 15 }, { recover: 0.5 }, { skill: 'volley' }, { trail: 1 }, { crit: 0.2 }],
    frost: [{ maxMana: 25 }, { killMana: 12 }, { skill: 'nova' }, { manaRegen: 4 }, { spell: 12 }],
}

export const noTalents = () => Object.fromEntries(Object.keys(TALENTS).map(branch => [branch, 0]))

const learned = p => Object.entries(TALENTS).flatMap(([branch, nodes]) => nodes.slice(0, p.talents[branch]))

// Bonus from worn gear and learned talents
export const stat = (p, key) => [...Object.values(p.gear).map(item => ITEMS[item]), ...learned(p)].reduce((sum, bonus) => sum + (bonus?.[key] ?? 0), 0)

export const points = p => p.level - 1 - Object.values(p.talents).reduce((sum, count) => sum + count, 0)

// Every level adds a little health, mana and power, talents add the rest
export function updateStats(p) {
    p.maxHp = 100 + 10 * (p.level - 1) + stat(p, 'maxHp')
    p.maxMana = 100 + 5 * (p.level - 1) + stat(p, 'maxMana')
    p.power = p.level - 1 + stat(p, 'power')
}

// Learns the next node of a branch. Picking a skill that is already learned makes it the active one.
export function pickTalent(p, branch, index) {
    const { skill } = TALENTS[branch][index]
    if (index === p.talents[branch] && points(p) > 0) {
        p.talents[branch]++
        updateStats(p)
    } else if (index >= p.talents[branch] || !skill) {
        return
    }
    if (skill) p.skill = skill
    sfx.pickup()
}

export const resetCost = p => 50 * (p.resets + 1)
export const canReset = p => p.bag.gold >= resetCost(p) && points(p) < p.level - 1

// The merchant gives all points back, every reset costs more
export function resetTalents(p) {
    if (!canReset(p)) return
    p.bag.gold -= resetCost(p)
    p.resets++
    p.talents = noTalents()
    p.skill = null
    updateStats(p)
    p.hp = Math.min(p.hp, p.maxHp)
    p.mana = Math.min(p.mana, p.maxMana)
    sfx.coin()
}

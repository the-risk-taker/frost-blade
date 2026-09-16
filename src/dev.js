import { TYPES, createEnemy } from './enemies.js'
import { ITEMS, collect, createItem, worn } from './items.js'
import { LEVELS, areaScale } from './levels.js'
import { XP_PER_LEVEL, WHIRL_REACH, addXp } from './player.js'
import { STATUSES, afflict } from './status.js'

// Hidden tools for balancing and testing on a phone, opened with ` or a tap on the version label
const buttons = (attribute, values, on = () => false) =>
    `<div class="dev">${values.map(value => `<span data-${attribute}="${value}" ${on(value) ? 'data-active' : ''}>${value}</span>`).join('')}</div>`

export function devPanel(game) {
    return `<h2>DEV</h2>` +
        `<h3>spawn</h3>${buttons('spawn', Object.keys(TYPES))}` +
        `<h3>give</h3>${buttons('item', Object.keys(ITEMS))}` +
        `<h3>stage</h3>${buttons('stage', LEVELS.map((_, i) => i))}` +
        `<h3>status</h3>${buttons('status', Object.keys(STATUSES))}` +
        `<h3>hero</h3>${buttons('toggle', ['god', 'boxes', 'levelup'], name => game.dev[name])}`
}

export function devClick(game, element) {
    const p = game.player
    const { spawn, item, stage, status, toggle } = element.closest('.dev span')?.dataset ?? {}
    if (spawn) game.enemies.push(createEnemy(spawn, p.x + p.dir * 120, game.stage))
    // Gear comes with a random rarity, uniques are always legendary
    const rarity = ITEMS[item]?.unique ? 3 : Math.floor(game.random() * 3)
    if (item) collect(p, ITEMS[item].slot ? createItem(item, rarity, game.random, areaScale(game.stage)) : item, item === 'gold' ? 100 : 10)
    if (stage) game.startLevel(Number(stage), p)
    if (status) for (const target of [p, ...game.enemies]) afflict(target, status, 4)
    if (toggle === 'levelup') addXp(p, p.level * XP_PER_LEVEL - p.xp, game)
    else if (toggle) game.dev[toggle] = !game.dev[toggle]
}

// Outlines as [x, y, w, h]. The fight code checks distances, so these show roughly what it tests: bodies, the weapon swing and the whirl.
export function hitboxes(game) {
    const p = game.player
    const boxes = [[p.x - 8, p.y - 34, 16, 34]]
    for (const e of game.enemies) if (e.hp > 0) boxes.push([e.x - 12, e.y - TYPES[e.type].height, 24, TYPES[e.type].height])
    const { reach } = worn(p, 'weapon')
    if (p.attackT >= 0) boxes.push([p.dir > 0 ? p.x - 14 : p.x - reach, p.y - 34, reach + 14, 34])
    if (p.whirlT >= 0) boxes.push([p.x - WHIRL_REACH, p.y - 34, WHIRL_REACH * 2, 34])
    return boxes
}

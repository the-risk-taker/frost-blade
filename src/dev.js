import { TYPES, createEnemy } from './enemies.js'
import { ITEMS, collect, createItem } from './items.js'
import { LEVELS, areaScale } from './levels.js'
import { XP_PER_LEVEL, addXp, swingBox, whirlBox } from './player.js'
import { bodyBox, surface } from './terrain.js'
import { STATUSES, afflict } from './status.js'
import { sceneLines } from './story.js'

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
    if (spawn) game.enemies.push(createEnemy(spawn, p.x + p.dir * 120, surface(game.map, p.x + p.dir * 120, p.y), game.stage))
    // Gear comes with a random rarity, uniques are always legendary
    const rarity = ITEMS[item]?.unique ? 3 : Math.floor(game.random() * 3)
    if (item) collect(p, ITEMS[item].slot ? createItem(item, rarity, game.random, areaScale(game.stage)) : item, item === 'gold' ? 100 : 10)
    // A stage jump plays its story scene like walking there would
    if (stage) {
        game.startLevel(Number(stage), p)
        game.tell(sceneLines(game.stage.theme))
        game.panel = null
    }
    if (status) for (const target of [p, ...game.enemies]) afflict(target, status, 4)
    if (toggle === 'levelup') addXp(p, p.level * XP_PER_LEVEL - p.xp, game)
    else if (toggle) game.dev[toggle] = !game.dev[toggle]
}

// The same boxes the fight code tests: bodies, the weapon swing and the whirl
export function hitboxes(game) {
    const p = game.player
    return [
        bodyBox(p),
        ...game.enemies.filter(e => e.hp > 0).map(bodyBox),
        ...p.attackT >= 0 ? [swingBox(p)] : [],
        ...p.whirlT >= 0 ? [whirlBox(p)] : [],
    ]
}

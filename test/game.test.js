import { key, emit } from './browser.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GROUND } from '../src/const.js'
import { input } from '../src/input.js'
import { Game } from '../src/game.js'
import { LEVELS } from '../src/levels.js'
import { createEnemy } from '../src/enemies.js'
import { createItem, collect, equip } from '../src/items.js'
import { tickStatuses, afflict } from '../src/status.js'

const DT = 1 / 60

function tap(code) {
    key(code)
    key(code, false)
}

function run(game, seconds, each = () => { }) {
    for (let i = 0; i < seconds / DT; i++) {
        each(i)
        game.update(DT)
        input.endFrame()
    }
}

// A game on a stage with the hero alone, so each test places the foes it needs
function arena(stage = 0) {
    const game = new Game()
    game.startLevel(stage)
    game.enemies = []
    game.roamers = Infinity
    return game
}

test('the wheel switches hotbar slots but only scrolls boxes it is over', () => {
    const over = inside => ({ closest: () => inside })
    emit('wheel', { deltaY: 100, target: over(null) })
    assert.equal(input.takeWheel(), 1)
    emit('wheel', { deltaY: 100, target: over({}) })
    assert.equal(input.takeWheel(), 0)
})

test('statuses hurt for every stack on each tick', () => {
    const target = { statuses: {} }
    afflict(target, 'bleed', 1)
    afflict(target, 'bleed', 1)
    assert.equal(tickStatuses(target, 1), 2 * 2 * 2)
    assert.deepEqual(target.statuses, {})
})

test('every stage plays for a while with every weapon without errors', () => {
    for (const [index] of LEVELS.entries()) {
        for (const weapon of ['sword', 'axe', 'spear', 'daggers', 'staff']) {
            const game = new Game()
            game.startLevel(index)
            game.dev = { god: true }
            const p = game.player
            collect(p, createItem(weapon), 1)
            equip(p, p.pack[0])
            collect(p, 'fireArrows', 20)
            p.quiver = 'fireArrows'
            key('KeyD')
            // Swings, shoots and casts in turns while walking right
            run(game, 40, i => {
                if (i % 20 === 0) tap(['Digit1', 'Digit2', 'Digit3'][i / 20 % 3])
                key('Space', i % 20 < 12)
            })
            key('KeyD', false)
            key('Space', false)
            assert.ok(game.totalKills > 0, `${weapon} on stage ${index} killed nothing`)
        }
    }
})

test('a lynx lurks out of reach and pounces when the hero comes', () => {
    const game = arena()
    const lynx = createEnemy('lynx', 400, game.stage)
    game.enemies.push(lynx)
    run(game, 1)
    assert.equal(lynx.state, 'lurk')
    game.player.x = 300
    run(game, 0.1)
    assert.notEqual(lynx.state, 'lurk')
    assert.ok(lynx.y < 0)
    run(game, 1.5)
    assert.equal(lynx.y, GROUND)
})

test('a looter steals loot and drops it when killed', () => {
    const game = arena()
    const looter = createEnemy('looter', 600, game.stage)
    game.enemies.push(looter)
    game.drop(700, GROUND, createItem('axe'), 1)
    run(game, 3)
    assert.equal(game.pickups.length, 0)
    assert.equal(looter.loot.length, 1)
    looter.hp = 1
    game.player.x = looter.x
    key('Space')
    run(game, 0.5)
    key('Space', false)
    assert.equal(looter.hp <= 0, true)
    assert.ok([...game.pickups.map(q => q.item), ...game.player.pack].some(item => item.base === 'axe'))
})

test('a poacher net roots the hero', () => {
    const game = arena()
    game.enemies.push(createEnemy('poacher', 250, game.stage))
    let rooted = false
    run(game, 6, () => { rooted ||= 'root' in game.player.statuses })
    assert.ok(rooted)
})

test('a mimic waits like a chest until the hero is close', () => {
    const game = arena()
    const mimic = createEnemy('mimic', 300, game.stage)
    game.enemies.push(mimic)
    run(game, 1)
    assert.equal(mimic.state, 'idle')
    assert.equal(mimic.x, 300)
    game.player.x = 250
    let bit = false
    run(game, 2, () => { bit ||= game.player.hp < game.player.maxHp })
    assert.ok(bit)
})

test('the Alpha Fang calls spirit wolves and piercing arrows fly through foes', () => {
    const game = arena()
    const p = game.player
    p.gear.neck = createItem('alphaFang', 3, Math.random)
    for (const x of [140, 160, 180]) game.enemies.push({ ...createEnemy('ogre', x, game.stage), hp: 1000, maxHp: 1000 })
    game.shots.push({ x: 120, y: GROUND - 20, vx: 500, vy: 0, damage: 5, ammo: 'pierceArrows', life: 3, hitSet: new Set() })
    run(game, 0.5)
    assert.ok(game.enemies.every(e => e.hp < 1000))
    assert.equal(game.spirits.length, 1)
})

import { key, emit } from './browser.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { input } from '../src/input.js'
import { Game } from '../src/game.js'
import { LEVELS } from '../src/levels.js'
import { TYPES, createEnemy } from '../src/enemies.js'
import { createItem, collect, equip } from '../src/items.js'
import { tickStatuses, afflict } from '../src/status.js'
import { parseMap, isSolid, groundBelow } from '../src/terrain.js'
import { settings } from '../src/settings.js'
import { hurtPlayer } from '../src/player.js'

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

const GROUND = 256

// A game on a flat floor with the hero alone, so each test places the foes it needs. Extra rows are drawn over the floor.
function arena(rows = []) {
    const game = new Game()
    game.startLevel(0)
    const air = '.'.repeat(60)
    game.map = parseMap([...Array(16 - rows.length).fill(air), ...rows, ...Array(4).fill('#'.repeat(60))])
    Object.assign(game.player, { x: 40, y: GROUND, safe: { x: 40, y: GROUND } })
    game.enemies = []
    game.traps = []
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
    const lynx = createEnemy('lynx', 400, GROUND, game.stage)
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
    const looter = createEnemy('looter', 600, GROUND, game.stage)
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
    game.enemies.push(createEnemy('poacher', 250, GROUND, game.stage))
    let rooted = false
    run(game, 6, () => { rooted ||= 'root' in game.player.statuses })
    assert.ok(rooted)
})

test('a mimic waits like a chest until the hero is close', () => {
    const game = arena()
    const mimic = createEnemy('mimic', 300, GROUND, game.stage)
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
    for (const x of [140, 160, 180]) game.enemies.push({ ...createEnemy('ogre', x, GROUND, game.stage), hp: 1000, maxHp: 1000 })
    game.shots.push({ x: 120, y: GROUND - 20, vx: 500, vy: 0, damage: 5, ammo: 'pierceArrows', life: 3, hitSet: new Set() })
    run(game, 0.5)
    assert.ok(game.enemies.every(e => e.hp < 1000))
    assert.equal(game.spirits.length, 1)
})

test('walls stop the hero, single steps are climbed and platforms hold only from above', () => {
    const game = arena([
        '..............=====.......................#................',
        '..........................................#................',
        '...........................#..............#................',
    ])
    const p = game.player
    key('KeyD')
    let stepped = false
    run(game, 6, () => { stepped ||= p.y === GROUND - 16 })
    key('KeyD', false)
    assert.ok(stepped)
    assert.ok(p.x < 43 * 16 && p.x > 41 * 16, `hero at ${p.x}`)

    Object.assign(p, { x: 17 * 16, y: GROUND, vx: 0 })
    key('ArrowUp')
    let above = false
    run(game, 1, () => { above ||= p.y < 13 * 16 })
    key('ArrowUp', false)
    assert.ok(above)
    assert.equal(p.y, 13 * 16)
    tap('ArrowDown')
    run(game, 1)
    assert.equal(p.y, GROUND)
})

test('a fall into a chasm costs health and brings the hero back to firm ground', () => {
    const game = arena()
    game.map.tiles.forEach(row => row.fill('.', 10, 14))
    const p = game.player
    key('KeyD')
    run(game, 1.5)
    key('KeyD', false)
    run(game, 1)
    assert.ok(p.hp < p.maxHp)
    assert.equal(p.y, GROUND)
    assert.ok(p.x < 10 * 16)
})

test('foes stop at the edge of a ledge', () => {
    const game = arena()
    game.map.tiles.forEach(row => row.fill('.', 20, 24))
    const wolf = createEnemy('wolf', 30 * 16, GROUND, game.stage)
    game.enemies.push(wolf)
    run(game, 4)
    assert.equal(wolf.y, GROUND)
    assert.ok(wolf.x > 24 * 16)
})

test('stage maps have a hero start, merchants and ground under every spawn', () => {
    for (const stage of LEVELS) {
        const game = new Game()
        game.startLevel(LEVELS.indexOf(stage))
        assert.ok(game.npcs.some(npc => npc.kind === 'board') && game.npcs.some(npc => npc.kind === 'merchant'))
        assert.ok(stage.map.every(row => row.length === stage.map[0].length))
        run(game, 0.5)
        for (const e of game.enemies.filter(e => e.state !== 'lurk')) assert.ok(e.onGround, `${e.type} at ${e.x} on ${stage.theme} floats`)
    }
})

test('a new game opens with the story scene, a boss entrance holds the fight for a moment', () => {
    const game = new Game()
    tap('Enter')
    run(game, DT)
    assert.equal(game.state, 'story')
    // The first press shows the whole line, the second moves on
    tap('Enter')
    run(game, DT)
    assert.equal(game.scene.line, 0)
    tap('Enter')
    run(game, DT)
    assert.equal(game.scene.line, 1)
    for (let i = 0; i < 20 && game.state === 'story'; i++) {
        tap('Enter')
        run(game, DT)
    }
    assert.equal(game.state, 'play')

    // Escape skips a whole scene
    game.tell([{ who: 'hero', mood: 'calm', text: 'story.cave.0' }, { who: 'hero', mood: 'calm', text: 'story.cave.1' }])
    tap('Escape')
    run(game, DT)
    assert.equal(game.state, 'play')
    assert.equal(game.panel, null)

    const arenaGame = arena()
    const alpha = createEnemy('alpha', 200, GROUND, arenaGame.stage)
    arenaGame.enemies.push(alpha)
    run(arenaGame, 0.5)
    assert.ok(arenaGame.intro)
    assert.equal(alpha.state, 'idle')
    run(arenaGame, 2)
    assert.equal(arenaGame.intro, null)
})

test('a bound key works like the action it was bound to', () => {
    settings.keys.KeyL = 'ArrowUp'
    key('KeyL')
    assert.ok(input.held('ArrowUp'))
    key('KeyL', false)
    assert.ok(!input.held('ArrowUp'))
    delete settings.keys.KeyL
})

test('hits hurt more on hard difficulty', () => {
    const lost = difficulty => {
        settings.difficulty = difficulty
        const game = arena()
        hurtPlayer(game.player, 20, 1, game)
        return game.player.maxHp - game.player.hp
    }
    assert.ok(lost('hard') > lost('normal') && lost('normal') > lost('easy'))
    settings.difficulty = 'normal'
})

test('every foe of a random group stands on the ground, not inside rock', () => {
    for (const [index] of LEVELS.entries()) {
        for (let seed = 0; seed < 20; seed++) {
            const game = new Game()
            game.seed = seed
            game.startLevel(index)
            for (const e of game.enemies.filter(e => e.state !== 'lurk')) {
                assert.ok(!isSolid(game.map, e.x, e.y - 1), `${e.type} at ${e.x},${e.y} on ${game.stage.theme} is inside rock`)
            }
        }
    }
})

test('boss arenas have no chasm to fall into', () => {
    for (const [index, stage] of LEVELS.entries()) {
        const game = new Game()
        game.startLevel(index)
        for (const boss of game.enemies.filter(e => TYPES[e.type].boss)) {
            const { engage } = TYPES[boss.type]
            for (let x = boss.x - engage; x < Math.min(game.map.w, boss.x + engage); x += 8) {
                assert.ok(groundBelow(game.map, x, 0) !== null, `chasm at ${x} in the ${boss.type} arena on ${stage.theme}`)
            }
        }
    }
})

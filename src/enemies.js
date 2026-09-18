import { sfx } from './sound.js'
import { t } from './lang.js'
import { hurtPlayer, addXp } from './player.js'
import { areaScale } from './levels.js'
import { moveBody, onIce, tileAt, surface, groundBelow, breakTile, box, overlap, bodyBox } from './terrain.js'
import { afflict, has, tickStatuses } from './status.js'
import { rollGear, rollUnique } from './items.js'
import { met, slain } from './bestiary.js'

const GRAVITY = 960
const MAX_FALL = 600
// How far above or below the hero a foe still notices him
const SIGHT = 120
// Where lurking foes wait, out of reach of every attack
const HIDDEN = -1000

function smash(damage) {
    return (e, game) => {
        game.shake = damage > 20 ? 10 : 6
        game.impact = Math.max(game.impact, damage > 20 ? 0.7 : 0.3)
        if (tileAt(game.map, e.x + e.dir * 34, e.y + 1) === '~') game.mark(e.x + e.dir * 34, e.y, 'crack')
        game.burst(e.x + e.dir * 34, e.y, '#eef7fa', 18, 110)
        sfx.smash()
        if (overlap(smashBox(e), bodyBox(game.player))) hurtPlayer(game.player, damage, e.dir, game)
    }
}

function lunge(e) {
    e.vx = e.dir * 290
    e.vy = -170
    sfx.lunge()
}

// Ground blows of heavy foes hit in front of them, the hero jumps over them
export const smashBox = e => box(e.dir > 0 ? e.x - 10 : e.x - 58, e.y - 18, 68, 22)
export const biteBox = (e, reach) => box(e.x - reach, e.y - e.h, reach * 2, e.h)

// Hurts the hero once per attack when he touches the enemy
function bite(damage, reach, statuses = {}) {
    return (e, game) => {
        if (!e.struck && overlap(biteBox(e, reach), bodyBox(game.player))) e.struck = hurtPlayer(game.player, damage, e.dir, game, statuses)
    }
}

// The yeti snatches the hero off his feet and holds him until he rolls free or is thrown
function grab(reach) {
    return (e, game) => {
        const p = game.player
        if (e.struck || p.grabbed || p.rollT >= 0 || p.hurtT > 0 || !overlap(biteBox(e, reach), bodyBox(p))) return
        e.struck = true
        p.grabbed = e
        p.grabT = 0
        p.attackT = p.drawT = p.whirlT = -1
        sfx.lunge()
    }
}

function shoot(e, game) {
    game.arrows.push({ x: e.x + e.dir * 14, y: e.y - 21, vx: e.dir * 260, life: 2, damage: 10 })
    sfx.shoot()
}

// A thrown net barely hurts but holds the hero in place
function throwNet(e, game) {
    game.arrows.push({ x: e.x + e.dir * 10, y: e.y - 20, vx: e.dir * 190, life: 2, damage: 4, statuses: { root: 2 }, net: true })
    sfx.shoot()
}

// Strikes from hiding: the lynx drops from the top of the screen, the pike bursts out of the ice
const POUNCE = { attack: 1.1, recover: 0.5, during: bite(18, 22) }
const SNATCH = { attack: 0.8, recover: 0.6, during: bite(16, 26, { root: 1.2 }) }

function pounce(e, game) {
    const p = game.player
    if (TYPES[e.type].fromHole) {
        // A hole the hero broke, or one it smashes through the ice beside him, never through plain ground
        const x = p.x + p.dir * 30
        const floor = groundBelow(game.map, x, p.y - 8)
        const hole = game.holeNear(p.x) ?? (floor !== null && breakTile(game.map, x, floor))
        if (!hole) return
        game.burst(hole.x, hole.y, '#bff0ff', 24, 180)
        sfx.shatter()
        Object.assign(e, { x: hole.x, y: hole.y, vy: -330, dir: Math.sign(p.x - hole.x) || 1, pattern: SNATCH })
    } else {
        Object.assign(e, { x: p.x + p.dir * 40, y: game.camY - 30, dir: -p.dir, vx: -p.dir * 30, pattern: POUNCE })
    }
    setState(e, 'attack')
    sfx.lunge()
}

// Back under the ice, waiting near the hero for the next chance
function sink(e, game) {
    Object.assign(e, { x: HIDDEN, home: game.player.x, vx: 0, vy: 0, cooldown: 4, state: 'lurk', t: 0 })
}

// The wraith steps out of the air behind the hero instead of walking up to him
function blink(e, game) {
    const p = game.player
    const x = Math.max(20, Math.min(game.map.w - 20, p.x - p.dir * 28))
    game.burst(e.x, e.y - e.h / 2, '#9fb6ff', 14, 90)
    Object.assign(e, { x, y: surface(game.map, x, p.y), vx: 0, vy: 0, cooldown: 2.2 })
    game.burst(e.x, e.y - e.h / 2, '#9fb6ff', 18, 110)
    sfx.cast()
}

// The icicle falls where the hero stood when the spell was cast, from the ceiling or the top of the screen
function icicle(e, game) {
    game.dropIcicle(game.player.x, game.player.y - 40)
    sfx.cast()
}

const ram = bite(25, 30)

function charge(e, game) {
    e.vx = e.dir * 380
    game.burst(e.x - e.dir * 24, e.y, '#eef7fa', 1, 60)
    ram(e, game)
}

function howl(e, game) {
    e.howls++
    game.shake = 6
    sfx.howl()
    for (const side of [-1, 1]) {
        const x = Math.max(20, Math.min(game.map.w - 20, e.x + side * 280))
        game.enemies.push(createEnemy('wolf', x, surface(game.map, x, e.y), game.stage))
        game.burst(x, e.y, '#eef7fa', 20, 120)
    }
}

// Attack patterns of the pack leader. Poses name animations used instead of the default ones.
const ALPHA = {
    lunge: { windup: 0.35, attack: 0.45, recover: 0.5, strike: lunge, during: bite(20, 30) },
    charge: { windup: 0.8, attack: 0.8, recover: 1.1, strike: sfx.lunge, during: charge, poses: { attack: 'charge' } },
    howl: { windup: 0.4, attack: 0.9, recover: 0.5, strike: howl, poses: { windup: 'howl', attack: 'howl' } },
}

// Calls the pack at 2/3 and 1/3 health, charges from afar and bites up close
function alphaPattern(e, game) {
    if (e.hp < e.maxHp * (2 - e.howls) / 3) return ALPHA.howl
    return Math.abs(game.player.x - e.x) > 90 ? ALPHA.charge : ALPHA.lunge
}

// The bat folds its wings and drops onto the hero
function dive(e, game) {
    const p = game.player
    e.vx = e.dir * 300
    e.vy = Math.sign(p.y - 20 - e.y) * 320
    sfx.lunge()
}

// Ice falls in a spread around the hero
function rain(e, game) {
    const p = game.player
    for (let i = -1; i <= 1; i++) game.dropIcicle(p.x + i * 46, p.y - 40)
    sfx.cast()
}

// A ring of frost rolling out from the caster
function frostWave(e, game) {
    const reach = 130
    game.effect('nova', e.x, e.y - 4, 1.3, 0.5)
    game.burst(e.x, e.y - 20, '#bff0ff', 30, 220)
    game.shake = 8
    if (overlap(box(e.x - reach, e.y - 70, reach * 2, 80), bodyBox(game.player))) hurtPlayer(game.player, 18, Math.sign(game.player.x - e.x) || 1, game, { slow: 2.5 })
    sfx.shatter()
}

// Snow torn loose above sweeps down the slope
function avalanche(e, game) {
    for (let i = 0; i < 6; i++) game.dropIcicle(e.x + (i - 2.5) * 52 + e.dir * 60, e.y - 40)
    game.shake = 12
    sfx.smash()
}

// Bosses call their own kind to their side
function summon(type, count) {
    return (e, game) => {
        e.howls++
        game.shake = 6
        sfx.howl()
        for (let i = 0; i < count; i++) {
            const x = Math.max(20, Math.min(game.map.w - 20, e.x + (i % 2 ? 1 : -1) * (200 + i * 60)))
            game.enemies.push(createEnemy(type, x, surface(game.map, x, e.y), game.stage))
            game.burst(x, e.y, '#eef7fa', 20, 120)
        }
    }
}

// The Guardian of the cave: a slow ice hulk that rains icicles from afar. Below half health its core opens,
// every blow on it bites twice as deep and it answers with waves of frost.
const GUARDIAN = {
    smash: { windup: 0.55, attack: 0.14, recover: 0.75, strike: smash(24) },
    rain: { windup: 0.7, attack: 0.3, recover: 0.9, strike: rain },
    wave: { windup: 0.5, attack: 0.3, recover: 0.6, strike: frostWave },
}

export const exposed = e => TYPES[e.type].core && e.hp < e.maxHp / 2

function guardianPattern(e, game) {
    if (exposed(e)) return game.random() < 0.45 ? GUARDIAN.wave : GUARDIAN.smash
    return Math.abs(game.player.x - e.x) > 110 ? GUARDIAN.rain : GUARDIAN.smash
}

// The Yeti Chief leaps across the ledges, brings down avalanches and calls his kin at half health
const YETI = {
    swipe: { windup: 0.45, attack: 0.5, recover: 0.7, strike: sfx.lunge, during: bite(26, 34) },
    leap: { windup: 0.55, attack: 0.7, recover: 0.6, strike: e => { e.vx = e.dir * 280; e.vy = -430; sfx.lunge() }, during: bite(22, 32) },
    avalanche: { windup: 0.8, attack: 0.4, recover: 1, strike: avalanche },
    call: { windup: 0.5, attack: 0.9, recover: 0.6, strike: summon('yeti', 2) },
}

function yetiPattern(e, game) {
    if (e.hp < e.maxHp / 2 && !e.howls) return YETI.call
    const far = Math.abs(game.player.x - e.x)
    if (far > 150) return game.random() < 0.5 ? YETI.leap : YETI.avalanche
    return YETI.swipe
}

// The Winter Queen keeps her distance behind icicles and frost, and calls wraiths before she gives ground
const QUEEN = {
    rain: { windup: 0.7, attack: 0.3, recover: 0.8, strike: rain },
    wave: { windup: 0.6, attack: 0.3, recover: 0.7, strike: frostWave },
    call: { windup: 0.6, attack: 0.9, recover: 0.7, strike: summon('wraith', 2) },
}

function queenPattern(e, game) {
    if (e.hp < e.maxHp * 0.6 && !e.howls) return QUEEN.call
    return Math.abs(game.player.x - e.x) < 110 ? QUEEN.wave : QUEEN.rain
}

// Every enemy runs the same loop: approach, wind up, attack, recover. Width and height give its body.
// Heavy enemies can't be knocked back or interrupted while attacking.
// Enemies with choose() pick one of their attack patterns before winding up.
// Props like chests stand still, break when hit and don't count as foes.
// Cost is the difficulty paid from a spawn budget, types without it never come from random pools.
// Weak names what hurts a foe most, shown in the bestiary.
// Mimics look like chests until the hero comes close, looters steal loot lying around, lynxes lurk out of sight.
// Fliers ignore the ground, guards block blows to the front, blinkers step through the air,
// splitters leave smaller foes behind and the one with a core opens a weak point when it is hurt enough.
export const TYPES = {
    ogre: { weak: 'frost', width: 30, hp: 60, cost: 3, speed: 42, stride: 7, height: 58, engage: 240, reach: 46, windup: 0.6, attack: 0.12, recover: 0.7, knockback: 120, heavy: true, blood: '#8f6446', strike: smash(20) },
    chief: { weak: 'bleed', width: 34, hp: 180, speed: 54, stride: 7, height: 66, engage: 260, reach: 50, windup: 0.45, attack: 0.12, recover: 0.7, knockback: 50, heavy: true, boss: true, blood: '#8f6446', strike: smash(30) },
    wolf: { weak: 'fire', width: 36, hp: 30, cost: 1, speed: 105, stride: 16, height: 28, engage: 300, reach: 80, windup: 0.4, attack: 0.45, recover: 0.5, knockback: 160, blood: '#9aa8b3', strike: lunge, during: bite(12, 20) },
    archer: { weak: 'melee', width: 16, hp: 24, cost: 1, speed: 55, stride: 10, height: 34, engage: 340, reach: 230, keepAway: 110, windup: 0.8, attack: 0.1, recover: 0.9, knockback: 150, blood: '#5d8a3a', strike: shoot },
    shaman: { weak: 'bow', width: 16, hp: 30, cost: 2, speed: 45, stride: 8, height: 42, engage: 320, reach: 260, keepAway: 150, windup: 0.9, attack: 0.2, recover: 1.4, knockback: 150, blood: '#4a74a0', strike: icicle },
    alpha: { weak: 'frost', width: 50, hp: 260, speed: 80, stride: 12, height: 40, engage: 360, reach: 220, knockback: 40, heavy: true, boss: true, blood: '#3b444c', choose: alphaPattern },
    chest: { width: 18, hp: 10, speed: 0, stride: 0, height: 16, engage: 0, reach: 0, knockback: 0, heavy: true, prop: true, blood: '#8a5a2b' },
    mimic: { weak: 'bleed', width: 18, hp: 50, cost: 2, speed: 70, stride: 12, height: 18, engage: 70, reach: 26, windup: 0.3, attack: 0.3, recover: 0.6, knockback: 60, blood: '#8a5a2b', strike: sfx.lunge, during: bite(14, 26) },
    looter: { weak: 'bow', width: 16, hp: 26, cost: 1, speed: 95, stride: 12, height: 32, engage: 360, reach: 24, windup: 0.3, attack: 0.2, recover: 0.5, knockback: 150, blood: '#5d8a3a', steals: true, strike: sfx.swing, during: bite(6, 26) },
    lynx: { weak: 'fire', width: 34, hp: 34, cost: 2, speed: 115, stride: 16, height: 28, engage: 300, reach: 80, windup: 0.35, attack: 0.45, recover: 0.5, knockback: 150, blood: '#b08a5a', lurks: true, strike: lunge, during: bite(14, 20) },
    poacher: { weak: 'melee', width: 16, hp: 30, cost: 2, speed: 55, stride: 10, height: 34, engage: 320, reach: 200, keepAway: 90, windup: 0.7, attack: 0.15, recover: 1.2, knockback: 150, blood: '#8f6446', strike: throwNet },
    guardian: { weak: 'core', width: 36, hp: 240, speed: 46, stride: 6, height: 64, engage: 300, reach: 54, knockback: 40, heavy: true, boss: true, core: true, blood: '#8fdcfa', choose: guardianPattern },
    yeti: { weak: 'fire', width: 34, hp: 90, cost: 4, speed: 50, stride: 7, height: 62, engage: 260, reach: 42, windup: 0.5, attack: 0.5, recover: 0.8, knockback: 90, heavy: true, blood: '#dfeef5', strike: sfx.lunge, during: grab(52) },
    bat: { weak: 'bow', width: 18, hp: 18, cost: 1, speed: 120, stride: 14, height: 16, engage: 320, reach: 46, windup: 0.3, attack: 0.45, recover: 0.6, knockback: 180, flies: true, blood: '#4a5e6a', strike: dive, during: bite(10, 22) },
    shieldman: { weak: 'back', width: 22, hp: 55, cost: 2, speed: 50, stride: 8, height: 40, engage: 260, reach: 34, windup: 0.5, attack: 0.3, recover: 0.7, knockback: 70, guard: true, blood: '#5d8a3a', strike: sfx.swing, during: bite(16, 28) },
    yetiChief: { weak: 'bleed', width: 44, hp: 320, speed: 72, stride: 8, height: 74, engage: 320, reach: 200, knockback: 40, heavy: true, boss: true, blood: '#dfeef5', choose: yetiPattern },
    golem: { weak: 'heavy', width: 30, hp: 80, cost: 3, speed: 38, stride: 6, height: 52, engage: 240, reach: 42, windup: 0.6, attack: 0.14, recover: 0.8, knockback: 100, heavy: true, splits: 'golemling', blood: '#8fdcfa', strike: smash(22) },
    golemling: { weak: 'heavy', width: 18, hp: 28, cost: 1, speed: 72, stride: 10, height: 28, engage: 240, reach: 28, windup: 0.35, attack: 0.3, recover: 0.5, knockback: 120, blood: '#8fdcfa', strike: sfx.swing, during: bite(12, 24) },
    wraith: { weak: 'fire', width: 18, hp: 40, cost: 2, speed: 60, stride: 9, height: 42, engage: 340, reach: 30, windup: 0.4, attack: 0.35, recover: 0.7, knockback: 120, blinks: true, blood: '#9fb6ff', strike: sfx.cast, during: bite(15, 26) },
    pike: { weak: 'bow', width: 26, hp: 34, cost: 2, speed: 60, stride: 12, height: 22, engage: 200, reach: 30, windup: 0.3, attack: 0.5, recover: 0.6, knockback: 140, lurks: true, fromHole: true, blood: '#5d8a6a', strike: lunge, during: bite(16, 24) },
    queen: { weak: 'fire', width: 20, hp: 360, speed: 54, stride: 8, height: 46, engage: 340, reach: 210, keepAway: 130, knockback: 30, heavy: true, boss: true, flees: 0.25, blood: '#bff0ff', choose: queenPattern },
}

// Loot table: [item, chance, count]. Gear is rolled at random, uniques come from bosses and mimics.
const LOOT = {
    ogre: [['gold', 1, 10], ['potion', 0.6, 1], ['gear', 0.15]],
    chief: [['gold', 1, 40], ['gear', 1], ['unique', 0.5]],
    wolf: [['fur', 0.7, 1], ['fang', 0.6, 1], ['gold', 0.5, 2]],
    archer: [['arrows', 0.8, 4], ['gold', 1, 3], ['gear', 0.08]],
    shaman: [['potion', 0.3, 1], ['gold', 1, 5], ['gear', 0.1]],
    alpha: [['gold', 1, 60], ['fur', 1, 3], ['fang', 1, 3], ['gear', 1], ['unique', 0.5]],
    chest: [['gold', 1, 8], ['potion', 0.4, 1], ['arrows', 0.5, 5], ['gear', 0.3]],
    mimic: [['gold', 1, 25], ['gear', 1], ['unique', 0.15]],
    looter: [['gold', 1, 12]],
    lynx: [['fur', 1, 2], ['fang', 0.5, 1]],
    poacher: [['fireArrows', 0.4, 4], ['iceArrows', 0.4, 4], ['gold', 1, 6]],
    guardian: [['gold', 1, 70], ['iceScale', 1, 3], ['gear', 1], ['unique', 0.5]],
    yeti: [['yetiFur', 0.7, 1], ['gold', 1, 14], ['potion', 0.4, 1], ['gear', 0.15]],
    bat: [['fang', 0.5, 1], ['gold', 1, 4]],
    shieldman: [['gold', 1, 10], ['arrows', 0.5, 5], ['gear', 0.1]],
    yetiChief: [['gold', 1, 90], ['yetiFur', 1, 4], ['gear', 1], ['unique', 0.5]],
    golem: [['iceScale', 0.8, 1], ['gold', 1, 12], ['gear', 0.12]],
    golemling: [['iceScale', 0.4, 1], ['gold', 1, 5]],
    wraith: [['gold', 1, 9], ['potion', 0.3, 1], ['gear', 0.12]],
    pike: [['iceScale', 0.7, 1], ['fang', 0.5, 1], ['gold', 1, 8]],
    queen: [['gold', 1, 120], ['iceScale', 1, 4], ['gear', 1], ['unique', 1]],
}

// Draws weighted random foes from a stage pool until their costs use up the budget
export function rollGroup(pool, budget, random) {
    const options = Object.entries(pool).filter(([type]) => TYPES[type].cost <= budget)
    if (!options.length) return []
    let roll = random() * options.reduce((sum, [, weight]) => sum + weight, 0)
    const [type] = options.find(([, weight]) => (roll -= weight) < 0)
    return [type, ...rollGroup(pool, budget - TYPES[type].cost, random)]
}

export function createEnemy(type, x, y, stage) {
    const { hp: base, lurks, width, height } = TYPES[type]
    const hp = Math.round(base * areaScale(stage))
    return { type, x: lurks ? HIDDEN : x, y, w: width, h: height, home: x, vx: 0, vy: 0, pace: 0, dir: -1, onGround: false, hp, maxHp: hp, state: lurks ? 'lurk' : 'idle', pattern: TYPES[type], t: 0, walk: 0, flashT: 0, hurtT: 0, statuses: {}, cooldown: 0, deadT: 0, struck: false, howls: 0, loot: [] }
}

function setState(e, state) {
    e.state = state
    e.t = 0
    e.struck = false
}

// Health loss from any source. The last blow counts the kill, grants XP and drops loot, more and better in higher areas.
// Whatever a looter stole falls out too. A foe that splits leaves two smaller ones behind,
// and the Winter Queen breaks off the fight and escapes instead of falling.
export function damageEnemy(e, damage, game) {
    const type = TYPES[e.type]
    e.hp -= damage
    game.popup(e.x, e.y - e.h - 20, damage)
    // The Winter Queen does not wait to fall, she vanishes once the fight turns against her
    if (type.flees && e.hp <= e.maxHp * type.flees) {
        e.fled = true
        e.hp = 0
        game.burst(e.x, e.y - e.h / 2, '#bff0ff', 40, 200)
        game.flash(e.x, e.y - e.h / 2, '#8fdcff', 120)
    }
    if (e.hp > 0) return
    if (type.splits) for (const side of [-1, 1]) game.enemies.push(createEnemy(type.splits, e.x + side * 22, e.y, game.stage))
    game.kills[e.type] = (game.kills[e.type] ?? 0) + 1
    if (!type.prop) {
        game.totalKills++
        slain(e.type)
    }
    game.shake = 6
    game.burst(e.x, e.y - e.h / 2, type.blood, 30, 160)
    if (!type.prop) game.mark(e.x, e.y, 'blood', e.dir)
    sfx.smash()
    if (!type.prop) addXp(game.player, Math.round(e.maxHp / 2), game)
    const scale = areaScale(game.stage)
    for (const [item, chance, count = 1] of LOOT[e.type]) {
        const loot = item === 'unique' ? rollUnique(game.player, chance, game.random) : game.random() >= chance ? null : item === 'gear' ? rollGear(game.random, scale) : item
        if (loot) game.drop(e.x, e.y - e.h / 2, loot, Math.floor(count * scale))
    }
    for (const q of e.loot) game.drop(e.x, e.y - e.h / 2, q.item, q.count)
}

// A blow with knockback and statuses given as { name: seconds }. Freezing only pauses the enemy, heavy ones thaw twice as fast.
// A shield held to the front turns a blow aside, an open core takes twice as much.
export function hurtEnemy(e, damage, dir, game, statuses = {}) {
    const type = TYPES[e.type]
    const committed = e.state === 'windup' || e.state === 'attack'
    if (type.guard && dir === -e.dir && !committed) {
        e.flashT = 0.08
        game.popup(e.x, e.y - e.h - 20, t('blocked'), '#8fdcfa')
        game.burst(e.x - e.dir * 14, e.y - e.h / 2, '#c5ccd0', 10, 90)
        game.hitstop(0.06)
        sfx.shield()
        return
    }
    if (exposed(e)) damage *= 2
    e.flashT = 0.08
    e.hurtT = 0.25
    for (const [name, time] of Object.entries(statuses)) afflict(e, name, type.heavy && name === 'freeze' ? time / 2 : time)
    if (!type.heavy || !committed) e.vx = dir * type.knockback
    if (!type.heavy && e.state === 'windup') setState(e, 'recover')
    game.hitstop(0.05)
    game.burst(e.x, e.y - e.h / 2, statuses.freeze ? '#bff0ff' : '#ffffff', statuses.freeze ? 20 : 8)
    if (statuses.freeze) game.effect('shatter', e.x, e.y - e.h / 2, 0.6, 0.35)
    game.flash(e.x + dir * 6, e.y - e.h / 2, '#ffffff', 36)
    sfx.hit()
    damageEnemy(e, damage, game)
}

export function updateEnemy(e, dt, game) {
    const type = TYPES[e.type]
    // Lurking foes wait out of sight and reach, roaming lynxes pounce as soon as they arrive
    if (e.state === 'lurk') {
        e.cooldown -= dt
        if (game.state === 'play' && e.cooldown <= 0 && (e.roaming || Math.abs(game.player.x - e.home) < 140)) pounce(e, game)
        return
    }
    const { pattern } = e
    e.flashT -= dt
    e.hurtT -= dt
    e.cooldown -= dt
    // Fliers hold themselves above the hero instead of falling, and drop only while they attack
    if (type.flies && e.hp > 0 && e.state !== 'attack') e.vy = Math.max(-110, Math.min(110, (game.player.y - 44 - e.y) * 2.4))
    else e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt * (type.flies ? 0.5 : 1))
    // Knockback and the walking pace move the body together, knocked back enemies slide far on ice
    const knock = e.vx
    e.vx += e.pace
    moveBody(e, dt, game.map, { step: true })
    e.vx = e.vx ? knock : 0
    // The air drags on a flier like the ground does on everyone else, so a dive or a knockback dies down
    if (e.onGround || type.flies) e.vx *= Math.max(0, 1 - dt * (onIce(game.map, e) ? 1 : 8))
    // Whatever came out of the ice slips back under it instead of drowning
    if (e.y > game.map.h + 64 && e.hp > 0) type.fromHole ? sink(e, game) : damageEnemy(e, e.hp, game)
    e.pace = 0
    if (e.hp <= 0) {
        e.deadT += dt
        return
    }
    const dot = tickStatuses(e, dt)
    if (dot) damageEnemy(e, dot, game)
    if (e.hp <= 0 || has(e, 'freeze')) return

    const slow = has(e, 'slow') ? 0.5 : 1
    e.t += dt * slow
    if (e.state === 'windup') {
        if (e.t > pattern.windup) {
            setState(e, 'attack')
            pattern.strike(e, game)
        }
    } else if (e.state === 'attack') {
        pattern.during?.(e, game)
        // A foe holding the hero keeps its grip until he breaks free
        if (e.t > pattern.attack && game.player.grabbed !== e) setState(e, 'recover')
    } else if (e.state === 'recover') {
        if (e.t > pattern.recover) {
            if (type.fromHole) return sink(e, game)
            setState(e, 'idle')
            e.cooldown = 0.4
        }
    } else {
        // Looters go for the closest loot on the ground and run from the hero once they carry some
        const prize = type.steals && game.pickups.reduce((best, q) => !best || Math.abs(q.x - e.x) < Math.abs(best.x - e.x) ? q : best, null)
        if (prize && Math.abs(prize.x - e.x) < 8) {
            e.loot.push(prize)
            game.pickups.splice(game.pickups.indexOf(prize), 1)
            sfx.pickup()
        }
        // Wandering groups know where the hero is from the moment they arrive
        const dist = (prize?.x ?? game.player.x) - e.x
        const far = Math.abs(dist)
        const engaged = game.state === 'play' && ((far < type.engage && Math.abs(game.player.y - e.y) < SIGHT) || e.roaming)
        // A foe that has noticed the hero goes into the bestiary
        if (engaged && !type.prop) {
            met(e.type)
            e.dir = Math.sign(dist) || e.dir
        }
        const reach = prize ? 4 : type.reach
        const keepAway = e.loot.length && !prize ? Infinity : type.keepAway ?? 0
        const move = !engaged ? 0 : far < keepAway ? -e.dir : far > reach ? e.dir : 0
        if (engaged && !move && e.cooldown <= 0) {
            e.pattern = type.choose?.(e, game) ?? type
            setState(e, 'windup')
        } else if (engaged && type.blinks && move && e.cooldown <= 0) {
            blink(e, game)
        } else if (move && !has(e, 'root') && (type.flies || tileAt(game.map, e.x + move * (e.w / 2 + 4), e.y + 1) !== '.')) {
            // Foes walk up to the edge of a ledge but never over it
            e.state = 'walk'
            e.pace = move * type.speed * slow
            e.walk += dt * slow * type.stride
        } else {
            e.state = 'idle'
        }
    }
}

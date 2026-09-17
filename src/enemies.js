import { sfx } from './sound.js'
import { hurtPlayer, addXp } from './player.js'
import { areaScale } from './levels.js'
import { moveBody, onIce, tileAt, surface, box, overlap, bodyBox } from './terrain.js'
import { afflict, has, tickStatuses } from './status.js'
import { rollGear, rollUnique } from './items.js'

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
function bite(damage, reach) {
    return (e, game) => {
        if (!e.struck && overlap(biteBox(e, reach), bodyBox(game.player))) e.struck = hurtPlayer(game.player, damage, e.dir, game)
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

// A lurking lynx leaps down from the top of the screen right in front of the hero
const POUNCE = { attack: 1.1, recover: 0.5, during: bite(18, 22) }

function pounce(e, game) {
    const p = game.player
    e.x = p.x + p.dir * 40
    e.y = game.camY - 30
    e.dir = -p.dir
    e.vx = e.dir * 30
    e.pattern = POUNCE
    setState(e, 'attack')
    sfx.lunge()
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

// Every enemy runs the same loop: approach, wind up, attack, recover. Width and height give its body.
// Heavy enemies can't be knocked back or interrupted while attacking.
// Enemies with choose() pick one of their attack patterns before winding up.
// Props like chests stand still, break when hit and don't count as foes.
// Cost is the difficulty paid from a spawn budget, types without it never come from random pools.
// Mimics look like chests until the hero comes close, looters steal loot lying around, lynxes lurk out of sight.
export const TYPES = {
    ogre: { width: 30, hp: 60, cost: 3, speed: 42, stride: 7, height: 58, engage: 240, reach: 46, windup: 0.6, attack: 0.12, recover: 0.7, knockback: 120, heavy: true, blood: '#8f6446', strike: smash(20) },
    chief: { width: 34, hp: 180, speed: 54, stride: 7, height: 66, engage: 260, reach: 50, windup: 0.45, attack: 0.12, recover: 0.7, knockback: 50, heavy: true, boss: true, blood: '#8f6446', strike: smash(30) },
    wolf: { width: 36, hp: 30, cost: 1, speed: 105, stride: 16, height: 28, engage: 300, reach: 80, windup: 0.4, attack: 0.45, recover: 0.5, knockback: 160, blood: '#9aa8b3', strike: lunge, during: bite(12, 20) },
    archer: { width: 16, hp: 24, cost: 1, speed: 55, stride: 10, height: 34, engage: 340, reach: 230, keepAway: 110, windup: 0.8, attack: 0.1, recover: 0.9, knockback: 150, blood: '#5d8a3a', strike: shoot },
    shaman: { width: 16, hp: 30, cost: 2, speed: 45, stride: 8, height: 42, engage: 320, reach: 260, keepAway: 150, windup: 0.9, attack: 0.2, recover: 1.4, knockback: 150, blood: '#4a74a0', strike: icicle },
    alpha: { width: 50, hp: 260, speed: 80, stride: 12, height: 40, engage: 360, reach: 220, knockback: 40, heavy: true, boss: true, blood: '#3b444c', choose: alphaPattern },
    chest: { width: 18, hp: 10, speed: 0, stride: 0, height: 16, engage: 0, reach: 0, knockback: 0, heavy: true, prop: true, blood: '#8a5a2b' },
    mimic: { width: 18, hp: 50, cost: 2, speed: 70, stride: 12, height: 18, engage: 70, reach: 26, windup: 0.3, attack: 0.3, recover: 0.6, knockback: 60, blood: '#8a5a2b', strike: sfx.lunge, during: bite(14, 26) },
    looter: { width: 16, hp: 26, cost: 1, speed: 95, stride: 12, height: 32, engage: 360, reach: 24, windup: 0.3, attack: 0.2, recover: 0.5, knockback: 150, blood: '#5d8a3a', steals: true, strike: sfx.swing, during: bite(6, 26) },
    lynx: { width: 34, hp: 34, cost: 2, speed: 115, stride: 16, height: 28, engage: 300, reach: 80, windup: 0.35, attack: 0.45, recover: 0.5, knockback: 150, blood: '#b08a5a', lurks: true, strike: lunge, during: bite(14, 20) },
    poacher: { width: 16, hp: 30, cost: 2, speed: 55, stride: 10, height: 34, engage: 320, reach: 200, keepAway: 90, windup: 0.7, attack: 0.15, recover: 1.2, knockback: 150, blood: '#8f6446', strike: throwNet },
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
// Whatever a looter stole falls out too.
export function damageEnemy(e, damage, game) {
    const type = TYPES[e.type]
    e.hp -= damage
    game.popup(e.x, e.y - e.h - 20, damage)
    if (e.hp > 0) return
    game.kills[e.type] = (game.kills[e.type] ?? 0) + 1
    if (!type.prop) game.totalKills++
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
export function hurtEnemy(e, damage, dir, game, statuses = {}) {
    const type = TYPES[e.type]
    const committed = e.state === 'windup' || e.state === 'attack'
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
        if (game.state === 'play' && (e.roaming || Math.abs(game.player.x - e.home) < 140)) pounce(e, game)
        return
    }
    const { pattern } = e
    e.flashT -= dt
    e.hurtT -= dt
    e.cooldown -= dt
    e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt)
    // Knockback and the walking pace move the body together, knocked back enemies slide far on ice
    const knock = e.vx
    e.vx += e.pace
    moveBody(e, dt, game.map, { step: true })
    e.vx = e.vx ? knock : 0
    if (e.onGround) e.vx *= Math.max(0, 1 - dt * (onIce(game.map, e) ? 1 : 8))
    if (e.y > game.map.h + 64 && e.hp > 0) damageEnemy(e, e.hp, game)
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
        if (e.t > pattern.attack) setState(e, 'recover')
    } else if (e.state === 'recover') {
        if (e.t > pattern.recover) {
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
        if (engaged) e.dir = Math.sign(dist) || e.dir
        const reach = prize ? 4 : type.reach
        const keepAway = e.loot.length && !prize ? Infinity : type.keepAway ?? 0
        const move = !engaged ? 0 : far < keepAway ? -e.dir : far > reach ? e.dir : 0
        if (engaged && !move && e.cooldown <= 0) {
            e.pattern = type.choose?.(e, game) ?? type
            setState(e, 'windup')
        } else if (move && !has(e, 'root') && tileAt(game.map, e.x + move * (e.w / 2 + 4), e.y + 1) !== '.') {
            // Foes walk up to the edge of a ledge but never over it
            e.state = 'walk'
            e.pace = move * type.speed * slow
            e.walk += dt * slow * type.stride
        } else {
            e.state = 'idle'
        }
    }
}

import { GROUND, LEVEL_W } from './const.js'
import { sfx } from './sound.js'
import { hurtPlayer, addXp } from './player.js'
import { onIce } from './levels.js'

const GRAVITY = 960

function smash(damage) {
    return (e, game) => {
        const p = game.player
        const reach = (p.x - e.x) * e.dir
        game.shake = damage > 20 ? 10 : 6
        game.burst(e.x + e.dir * 34, GROUND, '#eef7fa', 18, 110)
        sfx.smash()
        if (reach > -10 && reach < 58 && p.y > GROUND - 18) hurtPlayer(p, damage, e.dir, game)
    }
}

function lunge(e) {
    e.vx = e.dir * 290
    e.vy = -170
    sfx.lunge()
}

// Hurts the hero once per attack when he touches the enemy
function bite(damage, reach) {
    return (e, game) => {
        const p = game.player
        if (e.struck || Math.abs(p.x - e.x) > reach || p.y < e.y - TYPES[e.type].height) return
        e.struck = hurtPlayer(p, damage, e.dir, game)
    }
}

function shoot(e, game) {
    game.arrows.push({ x: e.x + e.dir * 14, y: e.y - 21, vx: e.dir * 260, life: 2 })
    sfx.shoot()
}

// The icicle falls where the hero stood when the spell was cast
function icicle(e, game) {
    game.icicles.push({ x: game.player.x, y: -40, vx: 0, vy: 1, life: 3 })
    sfx.cast()
}

const ram = bite(25, 30)

function charge(e, game) {
    e.vx = e.dir * 380
    game.burst(e.x - e.dir * 24, GROUND, '#eef7fa', 1, 60)
    ram(e, game)
}

function howl(e, game) {
    e.howls++
    game.shake = 6
    sfx.howl()
    for (const side of [-1, 1]) {
        const x = Math.max(10, Math.min(LEVEL_W - 10, e.x + side * 280))
        game.enemies.push(createEnemy('wolf', x))
        game.burst(x, GROUND, '#eef7fa', 20, 120)
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

// Every enemy runs the same loop: approach, wind up, attack, recover.
// Heavy enemies can't be knocked back or interrupted while attacking.
// Enemies with choose() pick one of their attack patterns before winding up.
// Props like chests stand still, break when hit and don't count as foes.
export const TYPES = {
    ogre: { hp: 60, speed: 42, stride: 7, height: 58, engage: 240, reach: 46, windup: 0.6, attack: 0.12, recover: 0.7, knockback: 120, heavy: true, blood: '#8f6446', strike: smash(20) },
    chief: { hp: 180, speed: 54, stride: 7, height: 66, engage: 260, reach: 50, windup: 0.45, attack: 0.12, recover: 0.7, knockback: 50, heavy: true, boss: true, blood: '#8f6446', strike: smash(30) },
    wolf: { hp: 30, speed: 105, stride: 16, height: 28, engage: 300, reach: 80, windup: 0.4, attack: 0.45, recover: 0.5, knockback: 160, blood: '#9aa8b3', strike: lunge, during: bite(12, 20) },
    archer: { hp: 24, speed: 55, stride: 10, height: 34, engage: 340, reach: 230, keepAway: 110, windup: 0.8, attack: 0.1, recover: 0.9, knockback: 150, blood: '#5d8a3a', strike: shoot },
    shaman: { hp: 30, speed: 45, stride: 8, height: 42, engage: 320, reach: 260, keepAway: 150, windup: 0.9, attack: 0.2, recover: 1.4, knockback: 150, blood: '#4a74a0', strike: icicle },
    alpha: { hp: 260, speed: 80, stride: 12, height: 40, engage: 360, reach: 220, knockback: 40, heavy: true, boss: true, blood: '#3b444c', choose: alphaPattern },
    chest: { hp: 10, speed: 0, stride: 0, height: 16, engage: 0, reach: 0, knockback: 0, heavy: true, prop: true, blood: '#8a5a2b' },
}

// Loot table: [item, chance, count]
const LOOT = {
    ogre: [['gold', 1, 10], ['potion', 0.6, 1]],
    chief: [['gold', 1, 40]],
    wolf: [['fur', 0.7, 1], ['fang', 0.6, 1], ['gold', 0.5, 2]],
    archer: [['arrows', 0.8, 4], ['gold', 1, 3]],
    shaman: [['potion', 0.3, 1], ['gold', 1, 5]],
    alpha: [['gold', 1, 60], ['fur', 1, 3], ['fang', 1, 3]],
    chest: [['gold', 1, 8], ['potion', 0.4, 1], ['arrows', 0.5, 5]],
}

export function createEnemy(type, x) {
    const { hp } = TYPES[type]
    return { type, x, y: GROUND, vx: 0, vy: 0, dir: -1, hp, maxHp: hp, state: 'idle', pattern: TYPES[type], t: 0, walk: 0, flashT: 0, slowT: 0, frozenT: 0, cooldown: 0, deadT: 0, struck: false, howls: 0 }
}

function setState(e, state) {
    e.state = state
    e.t = 0
    e.struck = false
}

export function hurtEnemy(e, damage, dir, game, slow = 0, freeze = 0) {
    const type = TYPES[e.type]
    const committed = e.state === 'windup' || e.state === 'attack'
    e.hp -= damage
    e.flashT = 0.08
    e.slowT = Math.max(e.slowT, slow)
    // Freezing only pauses the enemy, heavy ones thaw twice as fast
    e.frozenT = Math.max(e.frozenT, type.heavy ? freeze / 2 : freeze)
    if (!type.heavy || !committed) e.vx = dir * type.knockback
    if (!type.heavy && e.state === 'windup') setState(e, 'recover')
    game.hitstop(0.05)
    game.popup(e.x, e.y - type.height - 20, damage)
    game.burst(e.x, e.y - type.height / 2, freeze ? '#bff0ff' : '#ffffff', freeze ? 20 : 8)
    game.flash(e.x + dir * 6, e.y - type.height / 2, '#ffffff', 36)
    sfx.hit()
    if (e.hp > 0) return
    game.kills[e.type] = (game.kills[e.type] ?? 0) + 1
    game.shake = 6
    game.burst(e.x, e.y - type.height / 2, type.blood, 30, 160)
    sfx.smash()
    if (!type.prop) addXp(game.player, Math.round(type.hp / 2), game)
    for (const [item, chance, count] of LOOT[e.type]) if (Math.random() < chance) game.drop(e.x, e.y - type.height / 2, item, count)
}

export function updateEnemy(e, dt, game) {
    const type = TYPES[e.type]
    const { pattern } = e
    e.flashT -= dt
    e.slowT -= dt
    e.frozenT -= dt
    e.cooldown -= dt
    e.vy += GRAVITY * dt
    e.x = Math.max(10, Math.min(LEVEL_W - 10, e.x + e.vx * dt))
    e.y = Math.min(GROUND, e.y + e.vy * dt)
    if (e.y === GROUND) {
        e.vy = 0
        // Knocked back enemies slide far on ice
        e.vx *= Math.max(0, 1 - dt * (onIce(game.stage, e.x) ? 1 : 8))
    }
    if (e.hp <= 0) {
        e.deadT += dt
        return
    }
    if (e.frozenT > 0) return

    const slow = e.slowT > 0 ? 0.5 : 1
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
        const dist = game.player.x - e.x
        const far = Math.abs(dist)
        const engaged = game.state === 'play' && far < type.engage
        if (engaged) e.dir = Math.sign(dist) || e.dir
        const move = !engaged ? 0 : far > type.reach ? e.dir : far < (type.keepAway ?? 0) ? -e.dir : 0
        if (engaged && !move && e.cooldown <= 0) {
            e.pattern = type.choose?.(e, game) ?? type
            setState(e, 'windup')
        } else if (move) {
            e.state = 'walk'
            e.x += move * type.speed * slow * dt
            e.walk += dt * slow * type.stride
        } else {
            e.state = 'idle'
        }
    }
}

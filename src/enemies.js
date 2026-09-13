import { GROUND, LEVEL_W } from './const.js'
import { sfx } from './sound.js'
import { hurtPlayer } from './player.js'

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

function bite(e, game) {
  const p = game.player
  if (e.struck || Math.abs(p.x - e.x) > 20 || p.y < e.y - 30) return
  e.struck = hurtPlayer(p, 12, e.dir, game)
}

function shoot(e, game) {
  game.arrows.push({ x: e.x + e.dir * 14, y: e.y - 21, vx: e.dir * 260, life: 2 })
  sfx.shoot()
}

// Every enemy runs the same loop: approach, wind up, attack, recover.
// Heavy enemies can't be knocked back or interrupted while attacking.
export const TYPES = {
  ogre: { hp: 60, speed: 42, stride: 7, height: 58, engage: 240, reach: 46, windup: 0.6, attack: 0.12, recover: 0.7, knockback: 120, heavy: true, drop: true, blood: '#8f6446', strike: smash(20) },
  boss: { hp: 180, speed: 54, stride: 7, height: 66, engage: 260, reach: 50, windup: 0.45, attack: 0.12, recover: 0.7, knockback: 50, heavy: true, drop: true, blood: '#8f6446', strike: smash(30) },
  wolf: { hp: 30, speed: 105, stride: 16, height: 28, engage: 300, reach: 80, windup: 0.4, attack: 0.45, recover: 0.5, knockback: 160, blood: '#9aa8b3', strike: lunge, during: bite },
  archer: { hp: 24, speed: 55, stride: 10, height: 34, engage: 340, reach: 230, keepAway: 110, windup: 0.8, attack: 0.1, recover: 0.9, knockback: 150, blood: '#5d8a3a', strike: shoot },
}

export function createEnemy(type, x) {
  const { hp } = TYPES[type]
  return { type, x, y: GROUND, vx: 0, vy: 0, dir: -1, hp, maxHp: hp, state: 'idle', t: 0, walk: 0, flashT: 0, slowT: 0, cooldown: 0, deadT: 0, struck: false }
}

function setState(e, state) {
  e.state = state
  e.t = 0
  e.struck = false
}

export function hurtEnemy(e, damage, dir, game, slow = 0) {
  const type = TYPES[e.type]
  const committed = e.state === 'windup' || e.state === 'attack'
  e.hp -= damage
  e.flashT = 0.08
  e.slowT = Math.max(e.slowT, slow)
  if (!type.heavy || !committed) e.vx = dir * type.knockback
  if (!type.heavy && e.state === 'windup') setState(e, 'recover')
  game.hitstop(0.05)
  game.popup(e.x, e.y - type.height - 20, damage)
  game.burst(e.x, e.y - type.height / 2, '#ffffff', 8)
  game.flash(e.x + dir * 6, e.y - type.height / 2, '#ffffff', 36)
  sfx.hit()
  if (e.hp > 0) return
  game.shake = 6
  game.burst(e.x, e.y - type.height / 2, type.blood, 30, 160)
  sfx.smash()
  if (type.drop) {
    game.player.potions++
    game.popup(e.x, e.y - type.height - 34, '+1 mikstura', '#ff8a8a')
  }
}

export function updateEnemy(e, dt, game) {
  const type = TYPES[e.type]
  e.flashT -= dt
  e.slowT -= dt
  e.cooldown -= dt
  e.vy += GRAVITY * dt
  e.x = Math.max(10, Math.min(LEVEL_W - 10, e.x + e.vx * dt))
  e.y = Math.min(GROUND, e.y + e.vy * dt)
  if (e.y === GROUND) {
    e.vy = 0
    e.vx *= Math.max(0, 1 - dt * 8)
  }
  if (e.hp <= 0) {
    e.deadT += dt
    return
  }

  const slow = e.slowT > 0 ? 0.5 : 1
  e.t += dt * slow
  if (e.state === 'windup') {
    if (e.t > type.windup) {
      setState(e, 'attack')
      type.strike(e, game)
    }
  } else if (e.state === 'attack') {
    type.during?.(e, game)
    if (e.t > type.attack) setState(e, 'recover')
  } else if (e.state === 'recover') {
    if (e.t > type.recover) {
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

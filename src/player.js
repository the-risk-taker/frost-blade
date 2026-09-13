import { GROUND, LEVEL_W } from './const.js'
import { input } from './input.js'
import { sfx } from './sound.js'
import { TYPES, hurtEnemy } from './enemies.js'
import { stat } from './items.js'

export const SLOTS = ['sword', 'bow', 'frost', 'potion']
export const ATTACK_TIME = 0.3
export const ROLL_TIME = 0.35
export const BOW_CHARGE = 0.7

const SPEED = 125
const JUMP = 330
const GRAVITY = 960
const ARROW_GRAVITY = 520
const ROLL_SPEED = 250
const JUMP_KEYS = ['ArrowUp', 'KeyW']
const USE_KEYS = ['Space', 'KeyJ', 'Mouse0']

export function createPlayer() {
  return {
    x: 80, y: GROUND, vx: 0, vy: 0, dir: 1, onGround: true, walk: 0,
    hp: 100, mana: 100, stamina: 100, restT: 0,
    slot: 0, cooldown: 0,
    bag: { gold: 10, arrows: 10, potion: 3 },
    gear: { head: null, body: null, back: null },
    attackT: -1, hitSet: new Set(), rollT: -1, hurtT: 0, drawT: -1,
  }
}

export function canUse(p, item) {
  return { sword: p.stamina >= 12, bow: p.bag.arrows > 0, frost: p.mana >= 25, potion: p.bag.potion > 0 }[item]
}

// Arrow leaving the bow. The longer the string is drawn, the faster and farther it flies.
export function aimArrow(p) {
  const charge = Math.min(1, p.drawT / BOW_CHARGE)
  const speed = 180 + 340 * charge
  return { x: p.x + p.dir * 12, y: p.y - 23, vx: p.dir * speed, vy: -speed * 0.3, damage: Math.round(8 + 16 * charge) }
}

export function flyArrow(a, dt) {
  a.vy += ARROW_GRAVITY * dt
  a.x += a.vx * dt
  a.y += a.vy * dt
}

export function hurtPlayer(p, damage, dir, game) {
  if (p.rollT >= 0 || p.hurtT > 0 || p.hp <= 0) return false
  damage = Math.max(1, damage - stat(p, 'defense'))
  p.hp -= damage
  p.hurtT = 0.8
  p.attackT = p.drawT = -1
  p.vx = dir * 200
  p.vy = -180
  p.onGround = false
  game.shake = 8
  game.popup(p.x, p.y - 44, damage, '#ff6b5a')
  game.flash(p.x, p.y - 18, '#ff5a40', 44)
  sfx.hurt()
  if (p.hp <= 0) {
    game.state = 'dead'
    game.burst(p.x, p.y - 16, '#c21a0e', 40)
  }
  return true
}

function useItem(p, game) {
  const item = SLOTS[p.slot]
  if (!item || !canUse(p, item) || p.cooldown > 0 || p.attackT >= 0 || p.drawT >= 0) return
  if (item === 'sword') {
    p.stamina -= 12
    p.restT = 0.6
    p.attackT = 0
    p.hitSet.clear()
    sfx.swing()
  } else if (item === 'bow') {
    p.drawT = 0
  } else if (item === 'frost') {
    p.mana -= 25
    p.cooldown = 0.35
    game.bolts.push({ x: p.x + p.dir * 14, y: p.y - 22, vx: p.dir * 340, life: 1.2 })
    sfx.cast()
  } else if (item === 'potion') {
    p.bag.potion--
    p.hp = Math.min(100, p.hp + 40)
    p.cooldown = 0.5
    game.burst(p.x, p.y - 18, '#ff6b6b', 16, 60)
    game.flash(p.x, p.y - 18, '#ff6b6b', 56)
    sfx.potion()
  }
}

export function updatePlayer(p, dt, game) {
  p.hurtT -= dt
  p.cooldown -= dt
  p.restT -= dt
  if (p.restT <= 0) p.stamina = Math.min(100, p.stamina + (30 + stat(p, 'staminaRegen')) * dt)
  p.mana = Math.min(100, p.mana + (6 + stat(p, 'manaRegen')) * dt)

  for (let i = 0; i < 9; i++) if (input.hit('Digit' + (i + 1))) p.slot = i
  p.slot = (((p.slot + input.takeWheel()) % 9) + 9) % 9
  if (SLOTS[p.slot] !== 'bow') p.drawT = -1

  const move = input.held('KeyD', 'ArrowRight') - input.held('KeyA', 'ArrowLeft')
  const stunned = p.hurtT > 0.55
  if (p.rollT >= 0) {
    p.rollT += dt
    p.vx = p.dir * ROLL_SPEED
    if (p.rollT > ROLL_TIME) p.rollT = -1
  } else {
    const target = stunned || (p.attackT >= 0 && p.onGround) || p.drawT >= 0 ? 0 : move * SPEED
    p.vx += (target - p.vx) * Math.min(1, dt * (stunned ? 3 : 14))
    if (!stunned) {
      if (move && p.attackT < 0) p.dir = move
      if (input.hit(...JUMP_KEYS) && p.onGround) {
        p.vy = -JUMP
        p.onGround = false
        sfx.jump()
      }
      if (!input.held(...JUMP_KEYS) && p.vy < -120) p.vy = -120
      if (input.hit('ShiftLeft', 'ShiftRight', 'KeyK') && p.onGround && p.stamina >= 30) {
        p.stamina -= 30
        p.restT = 0.6
        p.rollT = 0
        p.attackT = p.drawT = -1
        if (move) p.dir = move
        sfx.roll()
      }
      if (input.hit(...USE_KEYS)) useItem(p, game)
    }
  }

  if (p.attackT >= 0) {
    p.attackT += dt
    if (p.attackT > 0.06 && p.attackT < 0.2) {
      const reach = p.x + p.dir * 16
      for (const e of game.enemies) {
        if (e.hp <= 0 || p.hitSet.has(e) || Math.abs(e.x - reach) > 30 || p.y < e.y - TYPES[e.type].height) continue
        p.hitSet.add(e)
        hurtEnemy(e, 14, p.dir, game)
      }
    }
    if (p.attackT > ATTACK_TIME) p.attackT = -1
  }

  // The bow is drawn while the use key is held and shoots on release
  if (p.drawT >= 0) {
    p.drawT += dt
    if (!input.held(...USE_KEYS)) {
      game.shots.push({ ...aimArrow(p), life: 3 })
      p.bag.arrows--
      p.cooldown = 0.3
      p.drawT = -1
      sfx.shoot()
    }
  }

  p.vy += GRAVITY * dt
  p.x = Math.max(10, Math.min(LEVEL_W - 10, p.x + p.vx * dt))
  p.y += p.vy * dt
  if (p.y >= GROUND) {
    if (!p.onGround) game.burst(p.x, GROUND, '#eef7fa', 6, 50)
    p.y = GROUND
    p.vy = 0
    p.onGround = true
  }
  p.walk += Math.abs(p.vx) * dt * 0.1
}

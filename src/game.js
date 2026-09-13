import { GROUND, LEVEL_W, view } from './const.js'
import { input } from './input.js'
import { createPlayer, updatePlayer, hurtPlayer } from './player.js'
import { TYPES, createEnemy, updateEnemy, hurtEnemy } from './enemies.js'

const ENEMIES = [
  ['wolf', 520], ['wolf', 590], ['ogre', 900], ['archer', 1250],
  ['ogre', 1600], ['wolf', 1700], ['archer', 2050], ['ogre', 2200],
  ['wolf', 2600], ['wolf', 2670], ['archer', 2850], ['ogre', 3250],
  ['archer', 3450], ['boss', 3950],
]

function age(list, dt) {
  for (const item of list) item.life -= dt
  return list.filter(item => item.life > 0)
}

export class Game {
  constructor() {
    this.time = 0
    this.reset()
    this.state = 'title'
  }

  reset() {
    this.state = 'play'
    this.player = createPlayer()
    this.enemies = ENEMIES.map(([type, x]) => createEnemy(type, x))
    this.bolts = []
    this.arrows = []
    this.particles = []
    this.popups = []
    this.flashes = []
    this.camX = 0
    this.shake = 0
    this.freeze = 0
  }

  burst(x, y, color, count, speed = 120, size = 2) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * speed
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.3 + Math.random() * 0.4, color, size, gravity: 400 })
    }
  }

  flash(x, y, color, size = 40) {
    this.flashes.push({ x, y, color, size, life: 0.2 })
  }

  popup(x, y, value, color = '#ffd84a') {
    this.popups.push({ x, y, value, color, life: 0.7 })
  }

  hitstop(time) {
    this.freeze = Math.max(this.freeze, time)
  }

  update(dt) {
    this.time += dt
    if (this.state !== 'play' && input.hit('Enter', 'KeyR')) return this.reset()
    if (this.freeze > 0) {
      this.freeze -= dt
      return
    }
    this.shake = Math.max(0, this.shake - dt * 25)

    const p = this.player
    if (this.state === 'play') updatePlayer(p, dt, this)
    for (const e of this.enemies) updateEnemy(e, dt, this)
    this.updateBolts(dt)
    this.updateArrows(dt)
    for (const q of this.particles) {
      q.vy += q.gravity * dt
      q.x += q.vx * dt
      q.y = Math.min(GROUND, q.y + q.vy * dt)
    }
    this.particles = age(this.particles, dt)
    for (const q of this.popups) q.y -= 24 * dt
    this.popups = age(this.popups, dt)
    this.flashes = age(this.flashes, dt)
    if (this.state === 'play' && this.enemies.every(e => e.hp <= 0)) this.state = 'win'

    const target = p.x - view.w / 2 + p.dir * 50
    this.camX = Math.max(0, Math.min(LEVEL_W - view.w, this.camX + (target - this.camX) * Math.min(1, dt * 4)))
  }

  updateBolts(dt) {
    for (const b of this.bolts) {
      b.x += b.vx * dt
      b.life -= dt
      this.particles.push({ x: b.x, y: b.y + (Math.random() - 0.5) * 4, vx: -b.vx * 0.1, vy: 0, life: 0.25, color: '#9fe6ff', size: 1, gravity: 0 })
      const target = this.enemies.find(e => e.hp > 0 && Math.abs(e.x - b.x) < 16 && b.y > e.y - TYPES[e.type].height - 4)
      if (target) {
        hurtEnemy(target, 18, Math.sign(b.vx), this, 2.5)
        this.burst(b.x, b.y, '#bff0ff', 14)
        this.flash(b.x, b.y, '#8fdcff', 48)
        b.life = 0
      }
    }
    this.bolts = this.bolts.filter(b => b.life > 0)
  }

  updateArrows(dt) {
    const p = this.player
    for (const a of this.arrows) {
      a.x += a.vx * dt
      const touching = this.state === 'play' && Math.abs(p.x - a.x) < 8 && a.y > p.y - 34 && a.y < p.y
      if (touching && hurtPlayer(p, 10, Math.sign(a.vx), this)) a.life = 0
    }
    this.arrows = age(this.arrows, dt)
  }
}

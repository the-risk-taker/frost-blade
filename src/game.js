import { GROUND, LEVEL_W, view } from './const.js'
import { input } from './input.js'
import { sfx } from './sound.js'
import { give } from './items.js'
import { t } from './lang.js'
import { LEVELS } from './levels.js'
import { updateQuests } from './quests.js'
import { createPlayer, updatePlayer, hurtPlayer, flyArrow } from './player.js'
import { TYPES, createEnemy, updateEnemy, hurtEnemy } from './enemies.js'

function age(list, dt) {
    for (const item of list) item.life -= dt
    return list.filter(item => item.life > 0)
}

export class Game {
    constructor() {
        this.time = 0
        this.startLevel(0)
        this.state = 'title'
    }

    // The hero carries his bag and gear to the next stage. A retry brings them back as they were when the stage began.
    startLevel(index, hero = createPlayer()) {
        this.level = index
        this.stage = LEVELS[index]
        this.player = { ...createPlayer(), bag: structuredClone(hero.bag), gear: { ...hero.gear } }
        this.saved = structuredClone(this.player)
        this.quests = this.stage.quests.map(quest => ({ ...quest, state: 'new' }))
        this.kills = {}
        this.state = 'play'
        this.panel = null
        this.enemies = this.stage.enemies.map(([type, x]) => createEnemy(type, x))
        this.traps = this.stage.traps.map(x => ({ x, y: 36, t: -1 }))
        this.bolts = []
        this.arrows = []
        this.shots = []
        this.icicles = []
        this.pickups = []
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

    drop(x, y, item, count) {
        this.pickups.push({ item, count, x, y, vx: (Math.random() - 0.5) * 140, vy: -150 - Math.random() * 100, t: 0 })
    }

    hitstop(time) {
        this.freeze = Math.max(this.freeze, time)
    }

    toggle(panel) {
        this.panel = this.panel === panel ? null : panel
    }

    // The quest board or the merchant the hero stands at, with the panel it opens
    nearby() {
        const { x } = this.player
        const { board, merchants } = this.stage
        if (Math.abs(x - board) < 30) return { x: board, panel: 'quests' }
        const merchant = merchants.find(m => Math.abs(x - m) < 36)
        return merchant && { x: merchant, panel: 'shop' }
    }

    // All foes are down, chests don't count
    cleared() {
        return this.enemies.every(e => e.hp <= 0 || TYPES[e.type].prop)
    }

    update(dt) {
        this.time += dt
        // The overlay with the next stage name was shown last frame, now the stage can load
        if (this.state === 'travel') return this.startLevel(this.level + 1, this.player)
        if (this.state !== 'play' && input.hit('Enter', 'KeyR')) return this.state === 'dead' ? this.startLevel(this.level, this.saved) : this.startLevel(0)
        if (this.state === 'play') {
            if (input.hit('KeyI')) this.toggle('bag')
            if (input.hit('KeyE') && (this.panel || this.nearby())) this.panel = this.panel ? null : this.nearby().panel
            if (input.hit('Escape')) this.panel = null
        }
        if (this.panel) return
        if (this.freeze > 0) {
            this.freeze -= dt
            return
        }
        this.shake = Math.max(0, this.shake - dt * 25)

        const p = this.player
        if (this.state === 'play') {
            updatePlayer(p, dt, this)
            updateQuests(this)
        }
        for (const e of this.enemies) updateEnemy(e, dt, this)
        this.updateBolts(dt)
        this.updateArrows(dt)
        this.updateShots(dt)
        this.updateTraps(dt)
        this.updateIcicles(dt)
        this.updatePickups(dt)
        for (const q of this.particles) {
            q.vy += q.gravity * dt
            q.x += q.vx * dt
            q.y = Math.min(GROUND, q.y + q.vy * dt)
        }
        this.particles = age(this.particles, dt)
        for (const q of this.popups) q.y -= 24 * dt
        this.popups = age(this.popups, dt)
        this.flashes = age(this.flashes, dt)
        if (this.state === 'play' && this.cleared()) {
            // The last stage ends with its last foe, the others with a walk to the right edge
            if (this.level === LEVELS.length - 1) this.state = 'win'
            else if (p.x > LEVEL_W - 40) this.state = 'travel'
        }

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

    updateShots(dt) {
        for (const s of this.shots) {
            flyArrow(s, dt)
            const target = this.enemies.find(e => e.hp > 0 && Math.abs(e.x - s.x) < 12 && s.y > e.y - TYPES[e.type].height && s.y < e.y + 2)
            if (target) {
                hurtEnemy(target, s.damage, Math.sign(s.vx), this)
                s.life = 0
            } else if (s.y >= GROUND) {
                this.burst(s.x, GROUND, '#eef7fa', 5, 40)
                s.life = 0
            }
        }
        this.shots = age(this.shots, dt)
    }

    // Hanging icicles shake when the hero comes close, then fall
    updateTraps(dt) {
        for (const trap of this.traps) {
            if (trap.t >= 0) {
                trap.t += dt
            } else if (this.state === 'play' && Math.abs(this.player.x - trap.x) < 50) {
                trap.t = 0
                sfx.crack()
            }
            if (trap.t > 0.4) this.icicles.push({ x: trap.x, y: trap.y, vx: 0, vy: 1, life: 3 })
        }
        this.traps = this.traps.filter(trap => trap.t <= 0.4)
    }

    // Icicles shatter on anyone below. Frost sparkles mark the ground where they will land.
    updateIcicles(dt) {
        const p = this.player
        for (const s of this.icicles) {
            s.vy += 700 * dt
            s.y += s.vy * dt
            this.particles.push({ x: s.x + (Math.random() - 0.5) * 24, y: GROUND, vx: 0, vy: -30, life: 0.4, color: '#8fdcff', size: 1, gravity: 0 })
            if (s.y < GROUND) continue
            s.life = 0
            this.burst(s.x, GROUND, '#bff0ff', 20, 140)
            sfx.shatter()
            if (this.state === 'play' && Math.abs(p.x - s.x) < 16 && p.y > GROUND - 40) hurtPlayer(p, 16, Math.sign(p.x - s.x) || 1, this)
            for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.x - s.x) < 20) hurtEnemy(e, 30, Math.sign(e.x - s.x) || 1, this)
        }
        this.icicles = age(this.icicles, dt)
    }

    // Loot falls to the ground, then flies to the hero when he walks close
    updatePickups(dt) {
        const p = this.player
        for (const q of this.pickups) {
            q.t += dt
            q.vy += 900 * dt
            q.x += q.vx * dt
            q.y = Math.min(GROUND, q.y + q.vy * dt)
            if (q.y === GROUND) q.vx = 0
            const dx = p.x - q.x
            if (this.state !== 'play' || q.t < 0.5 || Math.abs(dx) > 40) continue
            q.x += Math.sign(dx) * Math.min(Math.abs(dx), 160 * dt)
            if (Math.abs(dx) > 8) continue
            give(p, q.item, q.count)
            this.popup(q.x, q.y - 20, `+${q.count} ${t(`item.${q.item}`)}`, '#ffe9a8')
            sfx.pickup()
            q.taken = true
        }
        this.pickups = this.pickups.filter(q => !q.taken)
    }
}

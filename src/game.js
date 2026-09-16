import { GROUND, LEVEL_W, view } from './const.js'
import { input } from './input.js'
import { sfx } from './sound.js'
import { ITEMS, RARITIES, give, collect } from './items.js'
import { t } from './lang.js'
import { rng } from './pixels.js'
import { LEVELS } from './levels.js'
import { updateQuests } from './quests.js'
import { stat, updateStats } from './talents.js'
import { afflict } from './status.js'
import { createPlayer, updatePlayer, hurtPlayer, flyArrow, strike, carried } from './player.js'
import { TYPES, createEnemy, updateEnemy, hurtEnemy, rollGroup } from './enemies.js'
import { loadProgress, saveProgress } from './save.js'

function age(list, dt) {
    for (const item of list) item.life -= dt
    return list.filter(item => item.life > 0)
}

export class Game {
    constructor() {
        this.time = 0
        this.playTime = 0
        this.totalKills = 0
        this.hints = new Set()
        // Seeds everything random in the run, every stage draws from its own sequence
        this.seed = Date.now()
        // Dev panel switches, created when the panel is first opened
        this.dev = null
        this.progress = loadProgress()
        this.startLevel(0)
        this.state = 'title'
    }

    // Resumes a saved checkpoint: the stage plus everything the hero carries
    continueGame() {
        if (!this.progress) return
        const { stage, ...hero } = this.progress
        this.startLevel(stage, hero)
    }

    // The hero carries his bag, gear and talents to the next stage. A retry brings them back as they were when the stage began.
    startLevel(index, hero = createPlayer()) {
        this.level = index
        this.stage = LEVELS[index]
        this.random = rng(this.seed + index)
        const p = this.player = Object.assign(createPlayer(), carried(hero))
        updateStats(p)
        p.hp = p.maxHp
        p.mana = p.maxMana
        this.saved = structuredClone(p)
        this.quests = this.stage.quests.map(quest => ({ ...quest, state: 'new' }))
        this.kills = {}
        this.state = 'play'
        this.panel = null
        this.enemies = this.stage.enemies.flatMap(([type, x, budget]) => type === 'pool'
            ? rollGroup(this.stage.pool, budget, this.random).map((pick, i) => createEnemy(pick, x + i * 50, this.stage))
            : [createEnemy(type, x, this.stage)])
        this.roamers = 0
        this.roamT = 30
        this.traps = this.stage.traps.map(x => ({ x, y: 36, t: -1 }))
        this.bolts = []
        this.arrows = []
        this.shots = []
        this.icicles = []
        this.trails = []
        this.spirits = []
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
            const a = this.random() * Math.PI * 2, s = this.random() * speed
            this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.3 + this.random() * 0.4, color, size, gravity: 400 })
        }
    }

    flash(x, y, color, size = 40) {
        this.flashes.push({ x, y, color, size, life: 0.2 })
    }

    popup(x, y, value, color = '#ffd84a') {
        this.popups.push({ x, y, value, color, life: 0.7 })
    }

    drop(x, y, item, count) {
        this.pickups.push({ item, count, x, y, vx: (this.random() - 0.5) * 140, vy: -150 - this.random() * 100, t: 0 })
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

    // Foes that must fall to clear the stage: no chests and no wandering groups
    foes() {
        return this.enemies.filter(e => !TYPES[e.type].prop && !e.roaming)
    }

    cleared() {
        return this.foes().every(e => e.hp <= 0)
    }

    update(dt) {
        this.time += dt
        this.playTime += dt
        // The overlay with the next stage name was shown last frame, now the stage can load
        if (this.state === 'travel') return this.startLevel(this.level + 1, this.player)
        if (this.state === 'title' && this.progress && input.hit('KeyC')) return this.continueGame()
        if (this.state !== 'play' && input.hit('Enter', 'KeyR')) return this.state === 'dead' ? this.startLevel(this.level, this.saved) : this.startLevel(0)
        if (this.state === 'play') {
            if (input.hit('KeyI')) this.toggle('bag')
            if (input.hit('KeyT')) this.toggle('talents')
            if (input.hit('KeyE') && (this.panel || this.nearby())) this.panel = this.panel ? null : this.nearby().panel
            if (input.hit('Backquote')) {
                this.dev ??= { god: false, boxes: false }
                this.toggle('dev')
            }
            if (input.hit('Escape')) this.panel = this.panel ? null : 'pause'
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
            this.updateRoamers(dt)
        }
        for (const e of this.enemies) updateEnemy(e, dt, this)
        this.updateBolts(dt)
        this.updateArrows(dt)
        this.updateShots(dt)
        this.updateTraps(dt)
        this.updateIcicles(dt)
        this.updateTrails(dt)
        this.updateSpirits(dt)
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
            if (this.level === LEVELS.length - 1) {
                this.state = 'win'
                saveProgress(this, this.level)
            } else if (p.x > LEVEL_W - 40) {
                this.state = 'travel'
                saveProgress(this, this.level + 1)
            }
        }

        const target = p.x - view.w / 2 + p.dir * 50
        this.camX = Math.max(0, Math.min(LEVEL_W - view.w, this.camX + (target - this.camX) * Math.min(1, dt * 4)))
    }

    // Wandering groups come in from a screen edge now and then, up to a limit per stage
    updateRoamers(dt) {
        const { count, budget } = this.stage.roamers
        this.roamT -= dt
        if (this.roamT > 0 || this.roamers >= count) return
        this.roamT = 30 + this.random() * 20
        this.roamers++
        const side = this.camX < 40 ? 1 : this.camX + view.w > LEVEL_W - 40 ? -1 : this.random() < 0.5 ? -1 : 1
        const x = side > 0 ? this.camX + view.w + 20 : this.camX - 20
        rollGroup(this.stage.pool, budget, this.random).forEach((type, i) => this.enemies.push({ ...createEnemy(type, x + side * i * 40, this.stage), roaming: true }))
    }

    updateBolts(dt) {
        for (const b of this.bolts) {
            b.x += b.vx * dt
            b.life -= dt
            this.particles.push({ x: b.x, y: b.y + (this.random() - 0.5) * 4, vx: -b.vx * 0.1, vy: 0, life: 0.25, color: '#9fe6ff', size: 1, gravity: 0 })
            const touching = e => e.hp > 0 && Math.abs(e.x - b.x) < 16 && b.y > e.y - TYPES[e.type].height - 4
            if (!this.enemies.some(touching)) continue
            // A charged bolt blasts everyone within its radius
            for (const e of this.enemies.filter(e => touching(e) || (e.hp > 0 && Math.abs(e.x - b.x) < b.radius))) strike(this.player, e, b.damage, Math.sign(e.x - b.x) || Math.sign(b.vx), this, { slow: 2.5 })
            this.burst(b.x, b.y, '#bff0ff', 14 + b.radius)
            this.flash(b.x, b.y, '#8fdcff', 48 + b.radius * 2)
            b.life = 0
        }
        this.bolts = this.bolts.filter(b => b.life > 0)
    }

    updateArrows(dt) {
        const p = this.player
        for (const a of this.arrows) {
            a.x += a.vx * dt
            const touching = this.state === 'play' && Math.abs(p.x - a.x) < 8 && a.y > p.y - 34 && a.y < p.y
            if (touching && hurtPlayer(p, a.damage, Math.sign(a.vx), this, a.statuses)) a.life = 0
        }
        this.arrows = age(this.arrows, dt)
    }

    // Arrows that stop in a foe may come back to the quiver with the arrow recovery talent, piercing ones fly on
    updateShots(dt) {
        const p = this.player
        for (const s of this.shots) {
            flyArrow(s, dt)
            const { statuses, pierce } = ITEMS[s.ammo].ammo
            const trail = { iceArrows: '#9fe6ff', fireArrows: '#ff9a3c' }[s.ammo]
            if (trail) this.particles.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.2, color: trail, size: 1, gravity: 0 })
            const target = this.enemies.find(e => e.hp > 0 && !s.hitSet.has(e) && Math.abs(e.x - s.x) < 12 && s.y > e.y - TYPES[e.type].height && s.y < e.y + 2)
            if (target) {
                strike(p, target, s.damage, Math.sign(s.vx), this, statuses)
                s.hitSet.add(target)
                if (pierce) continue
                if (this.random() < stat(p, 'recover')) give(p, s.ammo, 1)
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

    // Icicles shatter on anyone below and chill the hero. Frost sparkles mark the ground where they will land.
    updateIcicles(dt) {
        const p = this.player
        for (const s of this.icicles) {
            s.vy += 700 * dt
            s.y += s.vy * dt
            this.particles.push({ x: s.x + (this.random() - 0.5) * 24, y: GROUND, vx: 0, vy: -30, life: 0.4, color: '#8fdcff', size: 1, gravity: 0 })
            if (s.y < GROUND) continue
            s.life = 0
            this.burst(s.x, GROUND, '#bff0ff', 20, 140)
            sfx.shatter()
            if (this.state === 'play' && Math.abs(p.x - s.x) < 16 && p.y > GROUND - 40) hurtPlayer(p, 16, Math.sign(p.x - s.x) || 1, this, { slow: 1.5 })
            for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.x - s.x) < 20) hurtEnemy(e, 30, Math.sign(e.x - s.x) || 1, this)
        }
        this.icicles = age(this.icicles, dt)
    }

    // Frost left behind by rolls slows foes walking over it
    updateTrails(dt) {
        for (const trail of this.trails) {
            if (this.random() < dt * 20) this.particles.push({ x: trail.x + (this.random() - 0.5) * 8, y: GROUND, vx: 0, vy: -20, life: 0.4, color: '#8fdcff', size: 1, gravity: 0 })
            for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.x - trail.x) < 10) afflict(e, 'slow', 1)
        }
        this.trails = age(this.trails, dt)
    }

    // Spirit wolves called by the Alpha Fang run ahead and bite every foe on their way once
    updateSpirits(dt) {
        for (const s of this.spirits) {
            s.x += s.dir * 320 * dt
            for (const e of this.enemies) {
                if (e.hp <= 0 || s.hitSet.has(e) || Math.abs(e.x - s.x) > 16) continue
                s.hitSet.add(e)
                hurtEnemy(e, 12 + this.player.power, s.dir, this, { bleed: 3 })
            }
        }
        this.spirits = age(this.spirits, dt)
    }

    // Loot falls to the ground, then flies to the hero when he walks close. Gear stays on the ground while the pack is full.
    updatePickups(dt) {
        const p = this.player
        for (const q of this.pickups) {
            // Gear better than common sparkles in the color of its rarity
            if (q.item.rarity && this.random() < dt * 14) this.particles.push({ x: q.x + (this.random() - 0.5) * 12, y: q.y - 2, vx: 0, vy: -35, life: 0.6, color: RARITIES[q.item.rarity].color, size: 1 + (q.item.rarity > 2), gravity: 0 })
            q.t += dt
            q.vy += 900 * dt
            q.x += q.vx * dt
            q.y = Math.min(GROUND, q.y + q.vy * dt)
            if (q.y === GROUND) q.vx = 0
            const dx = p.x - q.x
            if (this.state !== 'play' || q.t < 0.5 || Math.abs(dx) > 40) continue
            q.x += Math.sign(dx) * Math.min(Math.abs(dx), 160 * dt)
            if (Math.abs(dx) > 8) continue
            q.taken = collect(p, q.item, q.count)
            if (!q.taken) {
                if (!q.full) this.popup(q.x, q.y - 20, t('packFull'), '#ff6b5a')
                q.full = true
                continue
            }
            this.popup(q.x, q.y - 20, `+${q.count} ${t(`item.${q.item.base ?? q.item}`)}`, RARITIES[q.item.rarity]?.color ?? '#ffe9a8')
            sfx.pickup()
        }
        this.pickups = this.pickups.filter(q => !q.taken)
    }
}

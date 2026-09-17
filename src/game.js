import { view } from './const.js'
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
import { parseMap, moveBody, tileAt, isSolid, groundBelow, ceilingAbove, surface, box, overlap, bodyBox } from './terrain.js'
import { loadProgress, saveProgress } from './save.js'
import { TYPING, sceneLines } from './story.js'

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
        // The title scene is set a little into the forest, away from the edge of the map
        Object.assign(this.player, { x: 260 })
        this.campfire = { x: 286, y: this.player.y }
        this.camX = this.player.x - view.w / 2
    }

    // Resumes a saved checkpoint: the stage plus everything the hero carries
    continueGame() {
        if (!this.progress) return
        const { stage, ...hero } = this.progress
        this.startLevel(stage, hero)
        this.tell(sceneLines(this.stage.theme))
    }

    // Plays a story scene line by line, then the game goes on in the given state
    tell(lines, after = 'play') {
        this.state = 'story'
        this.scene = { lines, line: 0, t: 0, after }
    }

    // A key finishes typing the current line first, the next press moves on to the next line
    advanceStory() {
        const scene = this.scene
        const length = t(scene.lines[scene.line].text).length
        if (scene.t * TYPING < length) return scene.t = length / TYPING
        scene.line++
        scene.t = 0
        if (scene.line < scene.lines.length) return
        this.endStory()
    }

    endStory() {
        this.state = this.scene.after
        this.scene = null
    }

    // The hero carries his bag, gear and talents to the next stage. A retry brings them back as they were when the stage began.
    startLevel(index, hero = createPlayer()) {
        this.level = index
        this.stage = LEVELS[index]
        const map = this.map = this.stage.grid ??= parseMap(this.stage.map)
        const spawns = kind => map.spawns.filter(spawn => spawn.kind === kind)
        this.random = rng(this.seed + index)
        const p = this.player = Object.assign(createPlayer(), carried(hero), spawns('hero')[0])
        p.safe = { x: p.x, y: p.y }
        updateStats(p)
        p.hp = p.maxHp
        p.mana = p.maxMana
        this.saved = structuredClone(p)
        this.quests = this.stage.quests.map(quest => ({ ...quest, state: 'new' }))
        this.kills = {}
        this.state = 'play'
        this.panel = null
        this.npcs = [...spawns('board'), ...spawns('merchant')]
        this.enemies = map.spawns.filter(spawn => TYPES[spawn.kind] || spawn.kind === 'pool').flatMap(({ kind, x, y, budget }) => kind === 'pool'
            ? rollGroup(this.stage.pool, budget, this.random).map((pick, i) => createEnemy(pick, x + i * 40, surface(map, x + i * 40, y), this.stage))
            : [createEnemy(kind, x, y, this.stage)])
        this.roamers = 0
        this.roamT = 30
        this.traps = spawns('trap').map(({ x, y }) => ({ x, y, t: -1 }))
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
        this.effects = []
        this.marks = []
        this.camX = p.x - view.w / 2
        this.camY = p.y - view.h * 0.65
        this.shake = 0
        this.impact = 0
        this.intro = null
        this.freeze = 0
        // The hero warms up at a campfire on the title screen
        this.campfire = { x: p.x + 26, y: p.y }
    }

    // Particles are only spawned here and drawn by the renderer, which moves them on its own and stops them on the floor below
    spark(x, y, vx, vy, life, color, size = 1, gravity = 0) {
        this.particles.push({ x, y, vx, vy, life, color, size, gravity, floor: groundBelow(this.map, x, y - 1) ?? this.map.h + 64 })
    }

    // A mark left on the floor below a spot: step, blood or crack
    mark(x, y, kind, dir = 1) {
        const floor = groundBelow(this.map, x, y - 1)
        if (floor !== null && floor - y < 60) this.marks.push({ x, y: floor + (kind === 'step' ? 1 : 2), kind, dir })
    }

    burst(x, y, color, count, speed = 120, size = 2) {
        for (let i = 0; i < count; i++) {
            const a = this.random() * Math.PI * 2, s = this.random() * speed
            this.spark(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, 0.3 + this.random() * 0.4, color, size, 400)
        }
    }

    flash(x, y, color, size = 40) {
        this.flashes.push({ x, y, color, size, life: 0.2 })
    }

    // A drawn spell effect played once over its duration
    effect(kind, x, y, scale = 1, duration = 0.4) {
        this.effects.push({ kind, x, y, scale, life: duration, duration })
    }

    popup(x, y, value, color = '#ffd84a') {
        this.popups.push({ x, y, value, color, life: 0.7 })
    }

    drop(x, y, item, count) {
        this.pickups.push({ item, count, x, y, w: 8, h: 8, vx: (this.random() - 0.5) * 140, vy: -150 - this.random() * 100, t: 0, onGround: false })
    }

    // Icicles fall from the ceiling above the spot, or from the top of the screen under open sky
    dropIcicle(x, y) {
        this.icicles.push({ x, y: ceilingAbove(this.map, x, y, this.camY - 40), vx: 0, vy: 1, life: 3, floor: groundBelow(this.map, x, y) ?? this.map.h })
    }

    hitstop(time) {
        this.freeze = Math.max(this.freeze, time)
    }

    toggle(panel) {
        this.panel = this.panel === panel ? null : panel
    }

    // The quest board or the merchant the hero stands at, with the panel it opens
    nearby() {
        const p = this.player
        const npc = this.npcs.find(npc => Math.abs(p.x - npc.x) < 32 && Math.abs(p.y - npc.y) < 40)
        return npc && { ...npc, panel: npc.kind === 'board' ? 'quests' : 'shop' }
    }

    // Foes that must fall to clear the stage: no chests and no wandering groups
    foes() {
        return this.enemies.filter(e => !TYPES[e.type].prop && !e.roaming)
    }

    cleared() {
        return this.foes().every(e => e.hp <= 0)
    }

    update(dt) {
        this.particles = []
        this.marks = []
        this.time += dt
        if (input.hit('KeyO') && this.state !== 'travel') this.toggle('settings')
        // The screen faded out last frame, now the next stage loads and opens with its story scene
        if (this.state === 'travel') {
            this.startLevel(this.level + 1, this.player)
            this.tell(sceneLines(this.stage.theme))
            return
        }
        if (!this.panel && this.state === 'title' && this.progress && input.hit('KeyC')) return this.continueGame()
        if (this.state === 'story' && !this.panel) {
            this.scene.t += dt
            // Escape skips the rest of the scene
            if (input.hit('Escape')) return this.endStory()
            if (input.hit('Enter', 'Space')) this.advanceStory()
        }
        if (!this.panel && ['title', 'dead', 'win'].includes(this.state) && input.hit('Enter', 'KeyR')) {
            if (this.state === 'dead') return this.startLevel(this.level, this.saved)
            this.startLevel(0)
            this.tell(sceneLines('intro', 'forest'))
            return
        }
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
        this.impact = Math.max(0, this.impact - dt * 3)

        const p = this.player
        // A boss met for the first time gets the camera to himself for a moment
        const boss = this.state === 'play' && this.enemies.find(e => TYPES[e.type].boss && !e.met && e.hp > 0 && Math.abs(e.x - p.x) < TYPES[e.type].engage)
        if (boss) {
            boss.met = true
            this.intro = { boss, t: 1.8 }
            sfx.howl()
        }
        if (this.intro) {
            this.intro.t -= dt
            if (this.intro.t <= 0) this.intro = null
            return this.follow(dt, this.intro?.boss)
        }
        if (this.state === 'play') {
            // Play time counts only while the hero is actually playing, panels and scenes stop it above
            this.playTime += dt
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
        for (const q of this.popups) q.y -= 24 * dt
        this.popups = age(this.popups, dt)
        this.flashes = age(this.flashes, dt)
        this.effects = age(this.effects, dt)
        if (this.state === 'play' && this.cleared()) {
            // The last stage ends with its last foe, the others with a walk to the right edge
            if (this.level === LEVELS.length - 1) {
                this.tell(sceneLines('end'), 'win')
                saveProgress(this, this.level)
            } else if (p.x > this.map.w - 40) {
                this.state = 'travel'
                saveProgress(this, this.level + 1)
            }
        }

        this.follow(dt)
    }

    // The camera looks ahead where the hero faces and keeps him a bit below the middle, a map lower than the view stays at its bottom
    follow(dt, p = this.player) {
        const clamp = (value, max) => Math.max(Math.min(0, max), Math.min(max, value))
        this.camX = clamp(this.camX + (p.x - view.w / 2 + p.dir * 50 - this.camX) * Math.min(1, dt * 6), this.map.w - view.w)
        this.camY = clamp(this.camY + (p.y - view.h * 0.65 - this.camY) * Math.min(1, dt * (p.vy > 300 ? 10 : 4)), this.map.h - view.h)
    }

    // Wandering groups come in from a screen edge now and then, up to a limit per stage
    updateRoamers(dt) {
        const { count, budget } = this.stage.roamers
        this.roamT -= dt
        if (this.roamT > 0 || this.roamers >= count) return
        this.roamT = 30 + this.random() * 20
        this.roamers++
        const side = this.camX < 40 ? 1 : this.camX + view.w > this.map.w - 40 ? -1 : this.random() < 0.5 ? -1 : 1
        const x = side > 0 ? this.camX + view.w + 20 : this.camX - 20
        // Nobody comes out of a chasm
        const y = groundBelow(this.map, x, this.camY)
        if (y === null || isSolid(this.map, x, y - 1)) return
        rollGroup(this.stage.pool, budget, this.random).forEach((type, i) => this.enemies.push({ ...createEnemy(type, x + side * i * 40, surface(this.map, x + side * i * 40, y), this.stage), roaming: true }))
    }

    updateBolts(dt) {
        for (const b of this.bolts) {
            b.x += b.vx * dt
            b.life -= dt
            this.spark(b.x, b.y + (this.random() - 0.5) * 4, -b.vx * 0.1, 0, 0.25, '#9fe6ff')
            const touching = e => e.hp > 0 && overlap(box(b.x - 8, b.y - 5, 16, 10), bodyBox(e))
            if (!this.enemies.some(touching) && !isSolid(this.map, b.x, b.y)) continue
            // A charged bolt blasts everyone within its radius, also where it hits a wall
            const blast = box(b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2)
            for (const e of this.enemies.filter(e => touching(e) || (e.hp > 0 && overlap(blast, bodyBox(e))))) strike(this.player, e, b.damage, Math.sign(e.x - b.x) || Math.sign(b.vx), this, { slow: 2.5 })
            this.burst(b.x, b.y, '#bff0ff', 14 + b.radius)
            this.effect('shatter', b.x, b.y, 1 + b.radius / 60, 0.45)
            this.flash(b.x, b.y, '#8fdcff', 48 + b.radius * 2)
            b.life = 0
        }
        this.bolts = this.bolts.filter(b => b.life > 0)
    }

    updateArrows(dt) {
        const p = this.player
        for (const a of this.arrows) {
            a.x += a.vx * dt
            const touching = this.state === 'play' && overlap(box(a.x - 4, a.y - 2, 8, 4), bodyBox(p))
            if (touching && hurtPlayer(p, a.damage, Math.sign(a.vx), this, a.statuses)) a.life = 0
            if (isSolid(this.map, a.x, a.y)) a.life = 0
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
            if (trail) this.spark(s.x, s.y, 0, 0, 0.2, trail)
            const target = this.enemies.find(e => e.hp > 0 && !s.hitSet.has(e) && overlap(box(s.x - 4, s.y - 2, 8, 4), bodyBox(e)))
            if (target) {
                strike(p, target, s.damage, Math.sign(s.vx), this, statuses)
                s.hitSet.add(target)
                if (pierce) continue
                if (this.random() < stat(p, 'recover')) give(p, s.ammo, 1)
                s.life = 0
            } else if (isSolid(this.map, s.x, s.y)) {
                this.burst(s.x, s.y, '#eef7fa', 5, 40)
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
            } else if (this.state === 'play' && Math.abs(this.player.x - trap.x) < 50 && this.player.y > trap.y) {
                trap.t = 0
                sfx.crack()
            }
            if (trap.t > 0.4) this.dropIcicle(trap.x, trap.y)
        }
        this.traps = this.traps.filter(trap => trap.t <= 0.4)
    }

    // Icicles shatter on anyone below and chill the hero. Frost sparkles mark the ground where they will land.
    updateIcicles(dt) {
        const p = this.player
        for (const s of this.icicles) {
            s.vy += 700 * dt
            s.y += s.vy * dt
            this.spark(s.x + (this.random() - 0.5) * 24, s.floor, 0, -30, 0.4, '#8fdcff')
            if (s.y < s.floor) continue
            s.life = 0
            this.burst(s.x, s.floor, '#bff0ff', 20, 140)
            if (tileAt(this.map, s.x, s.floor + 1) === '~') this.mark(s.x, s.floor, 'crack')
            sfx.shatter()
            const shatter = box(s.x - 18, s.floor - 40, 36, 42)
            if (this.state === 'play' && overlap(shatter, bodyBox(p))) hurtPlayer(p, 16, Math.sign(p.x - s.x) || 1, this, { slow: 1.5 })
            for (const e of this.enemies) if (e.hp > 0 && overlap(shatter, bodyBox(e))) hurtEnemy(e, 30, Math.sign(e.x - s.x) || 1, this)
        }
        this.icicles = age(this.icicles, dt)
    }

    // Frost left behind by rolls slows foes walking over it
    updateTrails(dt) {
        for (const trail of this.trails) {
            if (this.random() < dt * 20) this.spark(trail.x + (this.random() - 0.5) * 8, trail.y, 0, -20, 0.4, '#8fdcff')
            for (const e of this.enemies) if (e.hp > 0 && overlap(box(trail.x - 10, trail.y - 8, 20, 10), bodyBox(e))) afflict(e, 'slow', 1)
        }
        this.trails = age(this.trails, dt)
    }

    // Spirit wolves called by the Alpha Fang run ahead and bite every foe on their way once
    updateSpirits(dt) {
        for (const s of this.spirits) {
            s.x += s.dir * 320 * dt
            for (const e of this.enemies) {
                if (e.hp <= 0 || s.hitSet.has(e) || !overlap(box(s.x - 16, s.y - 30, 32, 30), bodyBox(e))) continue
                s.hitSet.add(e)
                hurtEnemy(e, 12 + this.player.power, s.dir, this, { bleed: 3 })
            }
        }
        this.spirits = age(this.spirits, dt)
    }

    // Loot falls to the ground, then flies to the hero when he walks close. Gear stays on the ground while the pack is full.
    // Loot lost in a chasm is gone.
    updatePickups(dt) {
        const p = this.player
        for (const q of this.pickups) {
            // Gear better than common sparkles in the color of its rarity
            if (q.item.rarity && this.random() < dt * 14) this.spark(q.x + (this.random() - 0.5) * 12, q.y - 2, 0, -35, 0.6, RARITIES[q.item.rarity].color, 1 + (q.item.rarity > 2))
            q.t += dt
            const dx = p.x - q.x, dy = p.y - 10 - q.y, far = Math.hypot(dx, dy)
            if (this.state !== 'play' || q.t < 0.5 || far > 40) {
                q.vy = Math.min(600, q.vy + 900 * dt)
                moveBody(q, dt, this.map)
                if (q.onGround) q.vx = 0
                q.taken = q.y > this.map.h + 64
                continue
            }
            const step = Math.min(far, 160 * dt) / far
            q.x += dx * step
            q.y += dy * step
            if (far > 8) continue
            q.taken = collect(p, q.item, q.count)
            if (!q.taken) {
                if (!q.full) this.popup(q.x, q.y - 20, t('packFull'), '#ff6b5a')
                q.full = true
                continue
            }
            this.popup(q.x, q.y - 20, `+${q.count} ${t(`item.${q.item.base ?? q.item}`)}`, (q.item.rarity !== undefined ? RARITIES[q.item.rarity].color : '#ffe9a8'))
            sfx.pickup()
        }
        this.pickups = this.pickups.filter(q => !q.taken)
    }
}

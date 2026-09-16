import * as THREE from 'three'
import { GROUND, H, LEVEL_W, view } from './const.js'
import { buildWorld, buildVignette } from './art.js'
import { buildHero, buildOgre, buildWolf, buildGoblin, buildShaman, buildMerchant, buildBoard, buildChest, buildMimic, buildBolt, buildArrow, buildNet, buildIcicle, buildItems, buildStatuses, buildGlow } from './sprites.js'
import { SLOTS, ROLL_TIME, aimArrow, flyArrow, charge } from './player.js'
import { GEAR_SLOTS } from './items.js'
import { TYPES } from './enemies.js'
import { has } from './status.js'
import { hitboxes } from './dev.js'

// Canvas colors are used as-is, without sRGB conversions.
THREE.ColorManagement.enabled = false

const PARALLAX = [['sky', 0, 0], ['clouds', 0.04, 4], ['far', 0.1, 0], ['near', 0.22, 0], ['cliffs', 0.4, 0], ['forest', 0.62, 0]]
const MARGIN = 8
const ORDER = { level: 10, snowBack: 15, npc: 18, enemy: 20, hero: 21, pickup: 22, projectile: 23, glow: 24, particles: 25, bars: 26, snowFront: 27, boxes: 29, vignette: 30 }
const BOXES = 100

const SPRITE_VERTEX = `
  uniform vec4 frame;
  varying vec2 vUv;
  void main() {
    vUv = frame.xy + uv * frame.zw;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

const SPRITE_FRAGMENT = `
  uniform sampler2D map;
  uniform vec4 flash;
  uniform float alpha;
  varying vec2 vUv;
  void main() {
    vec4 color = texture2D(map, vUv);
    if (color.a < 0.5) discard;
    gl_FragColor = vec4(mix(color.rgb, flash.rgb, flash.a), alpha);
  }`

const POINT_VERTEX = `
  attribute vec3 tone;
  attribute float size;
  varying vec3 vTone;
  void main() {
    vTone = tone;
    gl_PointSize = size;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

const POINT_FRAGMENT = `
  varying vec3 vTone;
  void main() {
    gl_FragColor = vec4(vTone, 1.0);
  }`

const colors = {}
const color = hex => colors[hex] ??= new THREE.Color(hex)

function texture(canvas) {
    const map = new THREE.CanvasTexture(canvas)
    map.magFilter = map.minFilter = THREE.NearestFilter
    map.generateMipmaps = false
    return map
}

function mesh(geometry, material, order) {
    const result = new THREE.Mesh(geometry, material)
    result.renderOrder = order
    result.frustumCulled = false
    return result
}

function basic(options) {
    return new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, ...options })
}

// Plane anchored at its top-left corner.
const corner = (w, h) => new THREE.PlaneGeometry(w, h).translate(w / 2, -h / 2, 0)

const pick = (list, t) => list[Math.min(list.length - 1, Math.floor(t * list.length))]
const cycle = (list, phase) => list[Math.floor(phase / (Math.PI * 2) * list.length) % list.length]

function heroFrame(p, frames, time) {
    if (p.rollT >= 0) return pick(frames.roll, p.rollT / ROLL_TIME)
    if (p.whirlT >= 0) return pick(frames.attack, (p.whirlT * 4) % 1)
    if (p.attackT >= 0) return pick(frames.attack, p.attackT / p.attackTime)
    if (p.drawT >= 0) return pick(frames.aim, charge(p))
    if (!p.onGround) return frames.jump[p.vy < 0 ? 0 : 1]
    if (Math.abs(p.vx) > 10) return cycle(frames.walk, p.walk)
    return frames.idle[Math.floor(time * 3) % frames.idle.length]
}

function enemyFrame(e, frames) {
    if (e.state === 'walk') return cycle(frames.walk, e.walk)
    if (e.state === 'idle' || e.state === 'lurk') return frames.idle[Math.floor(e.t * 3) % frames.idle.length]
    const { pattern } = e
    const duration = e.state === 'windup' ? pattern.windup * 0.6 : pattern[e.state]
    return pick(frames[pattern.poses?.[e.state] ?? e.state], e.t / duration)
}

// Animated sprite from a baked sheet. The mesh pivot is the sheet origin (feet).
class Sprite {
    constructor(scene, sheet, order) {
        this.uniforms = {
            map: { value: null },
            frame: { value: new THREE.Vector4() },
            flash: { value: new THREE.Vector4(0, 0, 0, 0) },
            alpha: { value: 1 },
        }
        const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SPRITE_VERTEX, fragmentShader: SPRITE_FRAGMENT, transparent: true, depthTest: false, depthWrite: false })
        this.mesh = mesh(new THREE.BufferGeometry(), material, order)
        this.use(sheet)
        scene.add(this.mesh)
    }

    // Switches to another sheet, the plane follows its cell size and origin
    use(sheet) {
        if (sheet === this.sheet) return
        const { cellW, cellH, originX, originY } = sheet
        this.sheet = sheet
        this.uniforms.map.value = sheet.texture
        this.mesh.geometry.dispose()
        this.mesh.geometry = new THREE.PlaneGeometry(cellW, cellH).translate(cellW / 2 - originX, originY - cellH / 2, 0)
    }

    show(x, y, dir, cell) {
        const { canvas, cellW, cellH } = this.sheet
        this.mesh.visible = true
        this.mesh.position.set(Math.round(x), -Math.round(y), 0)
        this.mesh.scale.x = dir
        this.uniforms.frame.value.set(cell.x / canvas.width, 1 - (cell.y + cellH) / canvas.height, cellW / canvas.width, cellH / canvas.height)
    }
}

// Batch of square pixels, refilled every frame.
class PixelBatch {
    constructor(scene, capacity, order) {
        this.geometry = new THREE.BufferGeometry()
        for (const [name, size] of [['position', 3], ['tone', 3], ['size', 1]])
            this.geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(capacity * size), size))
        const material = new THREE.ShaderMaterial({ vertexShader: POINT_VERTEX, fragmentShader: POINT_FRAGMENT, transparent: true, depthTest: false, depthWrite: false })
        this.points = new THREE.Points(this.geometry, material)
        this.points.renderOrder = order
        this.points.frustumCulled = false
        this.count = 0
        scene.add(this.points)
    }

    push(x, y, hex, size) {
        const { position, tone, size: sizes } = this.geometry.attributes
        if (this.count >= sizes.count) return
        const i = this.count++
        const odd = (size % 2) / 2
        const c = color(hex)
        position.setXYZ(i, Math.round(x) + odd, -Math.round(y) - odd, 0)
        tone.setXYZ(i, c.r, c.g, c.b)
        sizes.setX(i, size)
    }

    commit() {
        for (const attribute of Object.values(this.geometry.attributes)) attribute.needsUpdate = true
        this.geometry.setDrawRange(0, this.count)
        this.count = 0
    }
}

const load = sheet => Object.assign(sheet, { texture: texture(sheet.canvas) })

const hideFrom = (list, count) => list.slice(count).forEach(item => { (item.mesh ?? item).visible = false })

export class Renderer {
    constructor(canvas, stage) {
        this.gl = new THREE.WebGLRenderer({ canvas })
        this.gl.outputColorSpace = THREE.LinearSRGBColorSpace
        this.gl.setPixelRatio(1)
        this.scene = new THREE.Scene()
        this.camera = new THREE.OrthographicCamera(0, view.w, view.h - H, -H, -10, 10)

        this.layers = PARALLAX.map(([name, factor, drift], i) => ({ name, factor, drift, mesh: this.add(mesh(corner(1, H), basic({}), i)) }))
        this.level = this.add(mesh(corner(LEVEL_W, H), basic({}), ORDER.level))
        this.vignette = this.add(mesh(corner(1, 1), basic({ map: texture(buildVignette()) }), ORDER.vignette))
        this.worlds = new Map()

        this.sheets = {
            ogre: load(buildOgre(false)), chief: load(buildOgre(true)), wolf: load(buildWolf('wolf')), alpha: load(buildWolf('alpha')), lynx: load(buildWolf('lynx')),
            archer: load(buildGoblin('archer')), looter: load(buildGoblin('looter')), poacher: load(buildGoblin('poacher')), shaman: load(buildShaman()),
            chest: load(buildChest()), mimic: load(buildMimic()), merchant: load(buildMerchant()), board: load(buildBoard()),
            bolt: load(buildBolt()), arrow: load(buildArrow()), net: load(buildNet()), icicle: load(buildIcicle()), items: load(buildItems()), statuses: load(buildStatuses()),
        }
        this.marks = []
        // Dev outlines of bodies and hit zones, 8 line ends per box
        const ends = new THREE.BufferAttribute(new Float32Array(BOXES * 8 * 3), 3)
        this.boxes = this.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', ends), new THREE.LineBasicMaterial({ color: '#ff3cf0', transparent: true, depthTest: false })))
        this.boxes.renderOrder = ORDER.boxes
        this.boxes.frustumCulled = false
        // One hero sheet per worn gear combination, baked when first needed
        this.heroSheets = {}
        this.glowMap = texture(buildGlow())
        this.npcs = []
        this.enemies = []
        this.bolts = []
        this.arrows = []
        this.nets = []
        this.shots = []
        this.spirits = []
        this.icicles = []
        this.traps = []
        this.pickups = []
        this.glows = []
        this.particles = new PixelBatch(this.scene, 2000, ORDER.particles)
        this.snowBack = new PixelBatch(this.scene, 400, ORDER.snowBack)
        this.snowFront = new PixelBatch(this.scene, 60, ORDER.snowFront)
        this.flakes = Array.from({ length: 320 }, (_, i) => ({
            x: Math.random() * 2000, y: Math.random() * H, phase: Math.random() * 6,
            front: i < 30, depth: i < 30 ? 1.4 : 0.2 + Math.random() * 0.7, speed: i < 30 ? 70 : 12 + Math.random() * 30,
        }))
        this.showStage(stage)
    }

    add(object) {
        this.scene.add(object)
        return object
    }

    // Stage art is painted when the stage is first shown and kept for retries
    showStage(stage) {
        if (!this.worlds.has(stage)) this.worlds.set(stage, buildWorld(stage))
        const world = this.worlds.get(stage)
        this.stage = stage
        this.gl.setClearColor(world.top)
        for (const layer of this.layers) {
            layer.map?.dispose()
            layer.map = layer.mesh.material.map = texture(world[layer.name])
            layer.map.wrapS = THREE.RepeatWrapping
        }
        this.level.material.map?.dispose()
        this.level.material.map = texture(world.level)
        this.resize()
    }

    // The camera shows view.w x view.h pixels with the ground kept at the bottom.
    resize() {
        const { w, h } = view
        this.gl.setSize(w, h, false)
        this.camera.right = w
        this.camera.top = h - H
        this.camera.updateProjectionMatrix()
        for (const layer of this.layers) {
            layer.mesh.scale.x = w + 2 * MARGIN
            layer.map.repeat.x = (w + 2 * MARGIN) / layer.map.image.width
        }
        this.vignette.scale.set(w, h, 1)
    }

    render(game, dt) {
        if (game.stage !== this.stage) this.showStage(game.stage)
        const p = game.player
        const cam = Math.round(game.camX)
        const shake = () => Math.round((Math.random() - 0.5) * game.shake)
        this.camera.position.set(cam + shake(), shake(), 5)

        for (const layer of this.layers) {
            layer.mesh.position.x = cam - MARGIN
            layer.map.offset.x = Math.round(cam * layer.factor + game.time * layer.drift - MARGIN) / layer.map.image.width
        }
        this.vignette.position.set(cam, view.h - H, 0)

        const blink = p.hurtT > 0 && Math.floor(game.time * 20) % 2
        const whirl = p.whirlT >= 0
        const item = whirl ? 'weapon' : SLOTS[p.slot] ?? 'weapon'
        const looks = Object.fromEntries(GEAR_SLOTS.map(slot => [slot, p.gear[slot]?.base]))
        const heroKey = Object.values(looks).join() + item
        const heroSheet = this.heroSheets[heroKey] ??= load(buildHero(looks, item))
        this.hero ??= new Sprite(this.scene, heroSheet, ORDER.hero)
        this.hero.use(heroSheet)
        // The whirl spins by turning the hero around quickly
        this.hero.show(p.x, p.y, whirl && Math.floor(p.whirlT * 12) % 2 ? -p.dir : p.dir, heroFrame(p, heroSheet.frames, game.time))
        this.hero.mesh.visible = game.state !== 'dead' && !blink
        this.hero.uniforms.flash.value.set(...(p.hurtT > 0.65 ? [1, 1, 1, 0.8] : has(p, 'freeze') ? [0.75, 0.93, 1, 0.7] : [0, 0, 0, 0]))

        const { board, merchant } = this.sheets
        const npcs = [[board, game.stage.board], ...game.stage.merchants.map(x => [merchant, x])]
        npcs.forEach(([sheet, x], i) => {
            const npc = this.npcs[i] ??= new Sprite(this.scene, sheet, ORDER.npc)
            npc.use(sheet)
            npc.show(x, GROUND, -1, sheet.frames.idle[Math.floor(game.time * 2) % sheet.frames.idle.length])
        })
        hideFrom(this.npcs, npcs.length)

        game.enemies.forEach((e, i) => this.renderEnemy(e, i))
        // Parts left over from a stage with more enemies
        for (const { sprite, back, fill } of this.enemies.slice(game.enemies.length)) sprite.mesh.visible = back.visible = fill.visible = false
        this.renderStatuses(game)
        this.renderBoxes(game)
        this.renderProjectiles(game.bolts, this.bolts, this.sheets.bolt)
        this.renderProjectiles(game.arrows.filter(a => !a.net), this.arrows, this.sheets.arrow)
        this.renderProjectiles(game.arrows.filter(a => a.net), this.nets, this.sheets.net)
        this.renderProjectiles(game.shots, this.shots, this.sheets.arrow)
        this.renderProjectiles(game.icicles, this.icicles, this.sheets.icicle)
        // Hanging icicles point down and shake before they fall
        const traps = game.traps.map(trap => ({ x: trap.x + (trap.t >= 0 ? Math.round(Math.sin(game.time * 60)) : 0), y: trap.y, vx: 0, vy: 1 }))
        this.renderProjectiles(traps, this.traps, this.sheets.icicle)

        // Spirit wolves are see-through and pale blue
        const { wolf } = this.sheets
        game.spirits.forEach((s, i) => {
            const spirit = this.spirits[i] ??= new Sprite(this.scene, wolf, ORDER.enemy)
            spirit.show(s.x, GROUND, s.dir, cycle(wolf.frames.walk, game.time * 20))
            spirit.uniforms.alpha.value = 0.6 * s.life
            spirit.uniforms.flash.value.set(0.6, 0.9, 1, 0.6)
        })
        hideFrom(this.spirits, game.spirits.length)

        const { items } = this.sheets
        game.pickups.forEach((q, i) => {
            this.pickups[i] ??= new Sprite(this.scene, items, ORDER.pickup)
            const bob = q.y < GROUND ? 0 : Math.round(Math.sin(game.time * 5 + q.x) * 1.5) - 2
            this.pickups[i].show(q.x, q.y + bob, 1, items.frames[q.item.base ?? q.item][0])
        })
        hideFrom(this.pickups, game.pickups.length)

        const glows = [
            ...game.bolts.map(b => ({ x: b.x, y: b.y, size: 30 + b.radius, color: '#4fc3f7', alpha: 0.9 })),
            ...game.icicles.map(s => ({ x: s.x, y: s.y, size: 24, color: '#4fc3f7', alpha: 0.6 })),
            ...game.flashes.map(f => ({ ...f, alpha: f.life / 0.2 })),
        ]
        // The ice shield flickers when it is about to melt
        if (p.shieldT > 0) glows.push({ x: p.x, y: p.y - 18, size: 60, color: '#8fdcff', alpha: p.shieldT < 1 && Math.floor(game.time * 10) % 2 ? 0.2 : 0.6 })
        glows.forEach((g, i) => {
            const glow = this.glows[i] ??= this.add(mesh(new THREE.PlaneGeometry(1, 1), basic({ map: this.glowMap, blending: THREE.AdditiveBlending }), ORDER.glow))
            glow.visible = true
            glow.position.set(Math.round(g.x), -Math.round(g.y), 0)
            glow.scale.set(g.size, g.size, 1)
            glow.material.color.set(g.color)
            glow.material.opacity = g.alpha
        })
        hideFrom(this.glows, glows.length)

        for (const q of game.particles) this.particles.push(q.x, q.y, q.color, q.size)
        if (p.drawT >= 0 && SLOTS[p.slot] === 'bow') {
            // Dotted flight path of the arrow being aimed
            const arrow = aimArrow(p)
            for (let i = 1; i <= 45 && arrow.y < GROUND; i++) {
                flyArrow(arrow, 0.02)
                if (i % 4) continue
                this.particles.push(arrow.x, arrow.y, '#2a1a10', 3)
                this.particles.push(arrow.x, arrow.y, '#fff3c4', 1)
            }
        }
        this.particles.commit()

        // No snowfall inside the cave
        const snowing = game.stage.theme !== 'cave'
        for (const f of this.flakes) {
            f.y += f.speed * dt
            f.x += Math.sin(game.time + f.phase) * 8 * dt
            if (f.y > view.h) f.y = -4
            const x = (((f.x - cam * f.depth) % view.w) + view.w) % view.w
            if (!snowing) continue
            if (f.front) this.snowFront.push(x, f.y, '#ffffff', 2)
            else this.snowBack.push(x, f.y, '#eaf6fb', f.depth > 0.6 ? 2 : 1)
        }
        for (const snow of [this.snowBack, this.snowFront]) {
            snow.points.position.set(cam, view.h - H, 0)
            snow.commit()
        }

        this.gl.render(this.scene, this.camera)
    }

    renderEnemy(e, i) {
        const type = TYPES[e.type]
        const { sprite, back, fill } = this.enemies[i] ??= {
            sprite: new Sprite(this.scene, this.sheets[e.type], ORDER.enemy),
            back: this.add(mesh(corner(1, 1), basic({ color: '#1a0d08' }), ORDER.bars)),
            fill: this.add(mesh(corner(1, 1), basic({ color: '#e0321f' }), ORDER.bars + 1)),
        }
        const alive = e.hp > 0
        const telegraph = e.state === 'windup' && e.t < 0.15
        const flash = e.flashT > 0 ? [1, 1, 1, 1] : has(e, 'freeze') ? [0.75, 0.93, 1, 0.7] : telegraph ? [1, 0.25, 0.15, 0.55] : has(e, 'slow') ? [0.6, 0.85, 1, 0.4] : [0, 0, 0, 0]
        sprite.use(this.sheets[e.type])
        sprite.show(e.x, e.y, e.dir, enemyFrame(e, sprite.sheet.frames))
        sprite.mesh.visible = e.deadT < 0.8
        sprite.uniforms.alpha.value = alive ? 1 : 1 - e.deadT / 0.8
        sprite.uniforms.flash.value.set(...flash)

        // The boss health is shown in the HUD instead, chests have none
        back.visible = fill.visible = alive && e.hp < e.maxHp && !type.boss && !type.prop
        const top = e.y - type.height - 10
        back.position.set(Math.round(e.x) - 13, -Math.round(top), 0)
        back.scale.set(26, 5, 1)
        fill.position.set(Math.round(e.x) - 12, -Math.round(top) - 1, 0)
        fill.scale.set(Math.max(1, Math.round(24 * e.hp / e.maxHp)), 3, 1)
    }

    // Marks of timed effects over the hero and living foes
    renderStatuses(game) {
        const p = game.player
        const { statuses } = this.sheets
        const marks = [p, ...game.enemies.filter(e => e.hp > 0)].flatMap(target => {
            const names = Object.keys(target.statuses)
            const top = target === p ? p.y - 42 : target.y - TYPES[target.type].height - 11
            return names.map((name, i) => ({ x: target.x + (i - (names.length - 1) / 2) * 9, y: top, name }))
        })
        marks.forEach((mark, i) => {
            this.marks[i] ??= new Sprite(this.scene, statuses, ORDER.bars + 1)
            this.marks[i].show(mark.x, mark.y, 1, statuses.frames[mark.name][0])
        })
        hideFrom(this.marks, marks.length)
    }

    renderBoxes(game) {
        const boxes = game.dev?.boxes ? hitboxes(game).slice(0, BOXES) : []
        const { position } = this.boxes.geometry.attributes
        boxes.forEach(([x, y, w, h], i) => [[x, y], [x + w, y], [x + w, y], [x + w, y + h], [x + w, y + h], [x, y + h], [x, y + h], [x, y]]
            .forEach(([px, py], j) => position.setXYZ(i * 8 + j, Math.round(px) + 0.5, -Math.round(py) - 0.5, 0)))
        position.needsUpdate = true
        this.boxes.geometry.setDrawRange(0, boxes.length * 8)
    }

    renderProjectiles(list, pool, sheet) {
        list.forEach((item, i) => {
            const dir = Math.sign(item.vx) || 1
            pool[i] ??= new Sprite(this.scene, sheet, ORDER.projectile)
            pool[i].show(item.x, item.y, dir, sheet.frames.fly[0])
            pool[i].mesh.rotation.z = -dir * Math.atan2(item.vy ?? 0, Math.abs(item.vx))
        })
        hideFrom(pool, list.length)
    }
}

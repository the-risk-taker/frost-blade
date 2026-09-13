import * as THREE from 'three'
import { GROUND, H, LEVEL_W, view } from './const.js'
import { buildWorld } from './art.js'
import { buildHero, buildOgre, buildWolf, buildGoblin, buildMerchant, buildBolt, buildArrow, buildItems, buildGlow } from './sprites.js'
import { ATTACK_TIME, ROLL_TIME, BOW_CHARGE, aimArrow, flyArrow } from './player.js'
import { TYPES } from './enemies.js'
import { MERCHANTS } from './game.js'

// Canvas colors are used as-is, without sRGB conversions.
THREE.ColorManagement.enabled = false

const PARALLAX = [['sky', 0, 0], ['clouds', 0.04, 4], ['far', 0.1, 0], ['near', 0.22, 0], ['cliffs', 0.4, 0], ['forest', 0.62, 0]]
const MARGIN = 8
const SKY_TOP = '#1590d0'
const ORDER = { level: 10, snowBack: 15, npc: 18, enemy: 20, hero: 21, pickup: 22, projectile: 23, glow: 24, particles: 25, bars: 26, snowFront: 27, vignette: 30 }

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
  if (p.attackT >= 0) return pick(frames.attack, p.attackT / ATTACK_TIME)
  if (p.drawT >= 0) return pick(frames.aim, p.drawT / BOW_CHARGE)
  if (!p.onGround) return frames.jump[p.vy < 0 ? 0 : 1]
  if (Math.abs(p.vx) > 10) return cycle(frames.walk, p.walk)
  return frames.idle[Math.floor(time * 3) % frames.idle.length]
}

function enemyFrame(e, frames) {
  const type = TYPES[e.type]
  if (e.state === 'windup') return pick(frames.windup, e.t / (type.windup * 0.6))
  if (e.state === 'attack') return pick(frames.attack, e.t / type.attack)
  if (e.state === 'recover') return pick(frames.recover, e.t / type.recover)
  if (e.state === 'walk') return cycle(frames.walk, e.walk)
  return frames.idle[Math.floor(e.t * 3) % frames.idle.length]
}

// Animated sprite from a baked sheet. The mesh pivot is the sheet origin (feet).
class Sprite {
  constructor(scene, sheet, order) {
    const { cellW, cellH, originX, originY } = sheet
    this.sheet = sheet
    this.uniforms = {
      map: { value: sheet.texture },
      frame: { value: new THREE.Vector4() },
      flash: { value: new THREE.Vector4(0, 0, 0, 0) },
      alpha: { value: 1 },
    }
    const geometry = new THREE.PlaneGeometry(cellW, cellH).translate(cellW / 2 - originX, originY - cellH / 2, 0)
    const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SPRITE_VERTEX, fragmentShader: SPRITE_FRAGMENT, transparent: true, depthTest: false, depthWrite: false })
    this.mesh = mesh(geometry, material, order)
    scene.add(this.mesh)
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
  constructor(canvas) {
    this.gl = new THREE.WebGLRenderer({ canvas })
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace
    this.gl.setPixelRatio(1)
    this.gl.setClearColor(SKY_TOP)
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(0, view.w, view.h - H, -H, -10, 10)

    const world = buildWorld()
    this.layers = PARALLAX.map(([name, factor, drift], i) => {
      const map = texture(world[name])
      map.wrapS = THREE.RepeatWrapping
      return { map, factor, drift, mesh: this.add(mesh(corner(1, H), basic({ map }), i)) }
    })
    this.add(mesh(corner(LEVEL_W, H), basic({ map: texture(world.level) }), ORDER.level))
    this.vignette = this.add(mesh(corner(1, 1), basic({ map: texture(world.vignette) }), ORDER.vignette))

    this.sheets = {
      ogre: load(buildOgre(false)), boss: load(buildOgre(true)), wolf: load(buildWolf()), archer: load(buildGoblin()),
      bolt: load(buildBolt()), arrow: load(buildArrow()), items: load(buildItems()),
    }
    // One hero sheet per worn gear combination, baked when first needed
    this.heroSheets = {}
    const merchant = load(buildMerchant())
    this.merchants = MERCHANTS.map(() => new Sprite(this.scene, merchant, ORDER.npc))
    this.glowMap = texture(buildGlow())
    this.enemies = []
    this.bolts = []
    this.arrows = []
    this.shots = []
    this.pickups = []
    this.glows = []
    this.particles = new PixelBatch(this.scene, 2000, ORDER.particles)
    this.snowBack = new PixelBatch(this.scene, 400, ORDER.snowBack)
    this.snowFront = new PixelBatch(this.scene, 60, ORDER.snowFront)
    this.flakes = Array.from({ length: 320 }, (_, i) => ({
      x: Math.random() * 2000, y: Math.random() * H, phase: Math.random() * 6,
      front: i < 30, depth: i < 30 ? 1.4 : 0.2 + Math.random() * 0.7, speed: i < 30 ? 70 : 12 + Math.random() * 30,
    }))
    this.resize()
  }

  add(object) {
    this.scene.add(object)
    return object
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
    const heroSheet = this.heroSheets[Object.values(p.gear).join()] ??= load(buildHero(p.gear))
    this.hero ??= new Sprite(this.scene, heroSheet, ORDER.hero)
    this.hero.sheet = heroSheet
    this.hero.uniforms.map.value = heroSheet.texture
    this.hero.show(p.x, p.y, p.dir, heroFrame(p, heroSheet.frames, game.time))
    this.hero.mesh.visible = game.state !== 'dead' && !blink
    this.hero.uniforms.flash.value.set(1, 1, 1, p.hurtT > 0.65 ? 0.8 : 0)

    this.merchants.forEach((merchant, i) => merchant.show(MERCHANTS[i], GROUND, -1, merchant.sheet.frames.idle[Math.floor(game.time * 2) % 4]))
    game.enemies.forEach((e, i) => this.renderEnemy(e, i))
    this.renderProjectiles(game.bolts, this.bolts, this.sheets.bolt)
    this.renderProjectiles(game.arrows, this.arrows, this.sheets.arrow)
    this.renderProjectiles(game.shots, this.shots, this.sheets.arrow)

    const { items } = this.sheets
    game.pickups.forEach((q, i) => {
      this.pickups[i] ??= new Sprite(this.scene, items, ORDER.pickup)
      const bob = q.y < GROUND ? 0 : Math.round(Math.sin(game.time * 5 + q.x) * 1.5) - 2
      this.pickups[i].show(q.x, q.y + bob, 1, items.frames[q.item][0])
    })
    hideFrom(this.pickups, game.pickups.length)

    const glows = [
      ...game.bolts.map(b => ({ x: b.x, y: b.y, size: 30, color: '#4fc3f7', alpha: 0.9 })),
      ...game.flashes.map(f => ({ ...f, alpha: f.life / 0.2 })),
    ]
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
    if (p.drawT >= 0) {
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

    for (const f of this.flakes) {
      f.y += f.speed * dt
      f.x += Math.sin(game.time + f.phase) * 8 * dt
      if (f.y > view.h) f.y = -4
      const x = (((f.x - cam * f.depth) % view.w) + view.w) % view.w
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
    const { sprite, back, fill } = this.enemies[i] ??= {
      sprite: new Sprite(this.scene, this.sheets[e.type], ORDER.enemy),
      back: this.add(mesh(corner(1, 1), basic({ color: '#1a0d08' }), ORDER.bars)),
      fill: this.add(mesh(corner(1, 1), basic({ color: '#e0321f' }), ORDER.bars + 1)),
    }
    const alive = e.hp > 0
    const telegraph = e.state === 'windup' && e.t < 0.15
    const flash = e.flashT > 0 ? [1, 1, 1, 1] : telegraph ? [1, 0.25, 0.15, 0.55] : e.slowT > 0 ? [0.6, 0.85, 1, 0.4] : [0, 0, 0, 0]
    sprite.show(e.x, e.y, e.dir, enemyFrame(e, sprite.sheet.frames))
    sprite.mesh.visible = e.deadT < 0.8
    sprite.uniforms.alpha.value = alive ? 1 : 1 - e.deadT / 0.8
    sprite.uniforms.flash.value.set(...flash)

    back.visible = fill.visible = alive && e.hp < e.maxHp
    const top = e.y - TYPES[e.type].height - 10
    back.position.set(Math.round(e.x) - 13, -Math.round(top), 0)
    back.scale.set(26, 5, 1)
    fill.position.set(Math.round(e.x) - 12, -Math.round(top) - 1, 0)
    fill.scale.set(Math.max(1, Math.round(24 * e.hp / e.maxHp)), 3, 1)
  }

  renderProjectiles(list, pool, sheet) {
    list.forEach((item, i) => {
      pool[i] ??= new Sprite(this.scene, sheet, ORDER.projectile)
      pool[i].show(item.x, item.y, Math.sign(item.vx), sheet.frames.fly[0])
      pool[i].mesh.rotation.z = -Math.sign(item.vx) * Math.atan2(item.vy ?? 0, Math.abs(item.vx))
    })
    hideFrom(pool, list.length)
  }
}

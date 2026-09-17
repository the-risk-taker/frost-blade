import * as THREE from 'three'
import { DENSITY, TILE, view } from './const.js'
import { buildStage } from './art.js'
import { WORN, buildHero, buildGear, buildOgre, buildWolf, buildGoblin, buildShaman, buildMerchant, buildBoard, buildChest, buildMimic, buildProjectiles, buildItems, buildStatuses, buildGlow, buildMarks, buildSpells, HERO_CLOTHES, GEAR_CLOTHES, CLOTHES } from './sprites.js'
import { buildProps, buildTrees } from './art.js'
import { turnFrame, normals, atlas } from './rig.js'
import { SLOTS, ROLL_TIME, WHIRL_TIME, aimArrow, flyArrow, charge } from './player.js'
import { GEAR_SLOTS, RARITIES } from './items.js'
import { TYPES } from './enemies.js'
import { has } from './status.js'
import { tileAt, groundBelow } from './terrain.js'
import { hitboxes } from './dev.js'
import { settings } from './settings.js'

// Canvas colors are used as-is, without sRGB conversions.
THREE.ColorManagement.enabled = false

const ORDER = { sky: 0, layers: 1, tiles: 10, reflections: 11, ice: 12, marks: 13, shadows: 14, props: 15, npc: 18, enemy: 20, hero: 21, gear: 22, grass: 23, pickup: 24, projectile: 25, glow: 26, particles: 27, bars: 28, snow: 29, foreground: 30, boxes: 31 }
const NONE = [0, 0, 0, 0]
// How the hero holds every weapon when he swings it
const STYLES = { sword: 'slash', axe: 'heavy', spear: 'thrust', daggers: 'stab', staff: 'staff' }
// Where the blade ends, for the trail left by a swing
const REACH = { sword: 44, axe: 40, spear: 70, daggers: 20, staff: 48 }

const BATCH_VERTEX = `
  attribute vec4 rect;
  attribute vec4 cell;
  attribute vec4 tint;
  attribute float alpha;
  uniform vec2 size;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec2 vWorld;
  varying vec4 vTint;
  varying float vAlpha;
  varying float vFlip;
  void main() {
    vec2 world = rect.xy + position.xy * rect.zw;
    vFlip = sign(rect.z);
    vUv = (cell.xy + position.xy * cell.zw) / size;
    vLocal = position.xy;
    vWorld = world;
    vTint = tint;
    vAlpha = alpha;
    gl_Position = projectionMatrix * viewMatrix * vec4(world.x, -world.y, 0.0, 1.0);
  }`

// Tint mixes a color over the sprite, sway bends the tops of trees, fog fades far layers, a palette swaps hero cloth keys
const BATCH_FRAGMENT = `
  uniform sampler2D map;
  uniform sampler2D palette;
  uniform vec2 size;
  uniform float time;
  uniform float sway;
  uniform vec4 fog;
  uniform float gloss;
  uniform sampler2D normalMap;
  uniform vec4 lights[8];
  uniform vec3 lightColors[8];
  uniform vec3 sky;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec2 vWorld;
  varying vec4 vTint;
  varying float vAlpha;
  varying float vFlip;
  void main() {
    vec2 uv = vUv;
    if (sway > 0.0) uv.x += floor(sin(time * 1.3 + vWorld.x * 0.02) * sway * pow(1.0 - vLocal.y, 3.0) * 3.0 + 0.5) / size.x;
    vec4 color = texture2D(map, uv);
    if (color.a < 0.02) discard;
    #ifdef PALETTE
    if (abs(color.r * 255.0 - 254.0) < 0.5) {
      color = texture2D(palette, vec2((floor(color.b * 255.0 / 64.0) + 0.5) / 4.0, (floor(color.g * 255.0 / 16.0) + 0.5) / ${CLOTHES.length}.0));
      if (color.a < 0.5) discard;
    }
    #endif
    #ifdef NORMALS
    // Relief from the normal map: light from the sky above and from the nearest lights around
    vec3 n = texture2D(normalMap, uv).xyz * 2.0 - 1.0;
    n.x *= vFlip;
    float shade = max(dot(n, normalize(vec3(-0.6, -1.0, 0.8))), 0.0) * 0.5;
    vec3 lit = sky * shade;
    for (int i = 0; i < 8; i++) {
      vec2 d = lights[i].xy - vWorld;
      float fall = max(0.0, 1.0 - length(d) / lights[i].z) * lights[i].w;
      lit += lightColors[i] * max(dot(n, normalize(vec3(d, 12.0))), 0.0) * fall;
    }
    color.rgb *= 0.8 + lit * 0.6;
    #endif
    if (gloss > 0.0) {
      color.rgb += smoothstep(0.92, 1.0, sin(vWorld.x * 0.035 - vWorld.y * 0.02 + time * 0.7)) * 0.35 * color.a;
      // Thin zigzag cracks run through the sheet of ice
      float crack = abs(fract((vWorld.x + abs(fract(vWorld.x / 7.0) - 0.5) * 6.0) / 37.0) - 0.5) * 37.0;
      if (crack < 0.5 && fract(vWorld.x / 97.0) < 0.6) color.rgb = mix(color.rgb, vec3(1.0), 0.5);
    }
    color.rgb = mix(color.rgb, vTint.rgb, vTint.a);
    color.rgb = mix(color.rgb, fog.rgb, fog.a);
    gl_FragColor = vec4(color.rgb, color.a * vAlpha);
  }`

const PARTICLE_VERTEX = `
  attribute vec4 start;
  attribute vec4 life;
  attribute vec4 tone;
  uniform float time;
  uniform float scale;
  varying vec3 vTone;
  varying float vFade;
  void main() {
    float t = time - life.x;
    if (t < 0.0 || t > life.y) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec2 p = start.xy + start.zw * t + vec2(0.0, 0.5 * life.z * t * t);
    p.y = min(p.y, life.w);
    vTone = tone.rgb;
    vFade = 1.0 - t / life.y;
    gl_PointSize = tone.w * scale;
    gl_Position = projectionMatrix * viewMatrix * vec4(floor(p.x * 2.0) / 2.0 + 0.25, -floor(p.y * 2.0) / 2.0 - 0.25, 0.0, 1.0);
  }`

const PARTICLE_FRAGMENT = `
  varying vec3 vTone;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(vTone, 1.0);
  }`

// Snow moves on the GPU alone: every flake wraps around the view at its own depth and speed
const SNOW_VERTEX = `
  attribute vec4 seed;
  uniform float time;
  uniform vec2 cam;
  uniform vec2 area;
  uniform float scale;
  uniform float wind;
  void main() {
    float x = mod(seed.x * 4096.0 - cam.x * seed.z + sin(time * 0.7 + seed.x * 50.0) * 10.0 + time * wind * seed.z, area.x);
    float y = mod(seed.y * 4096.0 + time * seed.w - cam.y * seed.z, area.y + 8.0) - 4.0;
    gl_PointSize = (seed.z > 1.2 ? 2.0 : seed.z > 0.7 ? 1.0 : 0.5) * scale;
    gl_Position = projectionMatrix * viewMatrix * vec4(cam.x + floor(x * 2.0) / 2.0, -(cam.y + floor(y * 2.0) / 2.0), 0.0, 1.0);
  }`

const SNOW_FRAGMENT = `
  void main() {
    gl_FragColor = vec4(0.93, 0.97, 1.0, 1.0);
  }`

const QUAD_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`

const BRIGHT_FRAGMENT = `
  uniform sampler2D scene;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(scene, vUv).rgb;
    float high = max(c.r, max(c.g, c.b));
    // Only bright and colorful spots glow: spells, fire and rare loot, not the white snow
    gl_FragColor = vec4(c * smoothstep(0.65, 1.0, high) * smoothstep(0.2, 0.5, high - min(c.r, min(c.g, c.b))), 1.0);
  }`

const BLUR_FRAGMENT = `
  uniform sampler2D image;
  uniform vec2 step;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(image, vUv).rgb * 0.227;
    c += (texture2D(image, vUv + step * 1.385).rgb + texture2D(image, vUv - step * 1.385).rgb) * 0.316;
    c += (texture2D(image, vUv + step * 3.231).rgb + texture2D(image, vUv - step * 3.231).rgb) * 0.070;
    gl_FragColor = vec4(c, 1.0);
  }`

// Final picture: the scene lit by the light map, bloom on bright spots, hit effects, the stage color grade and a vignette that closes in at low health
const COMPOSITE_FRAGMENT = `
  uniform sampler2D scene;
  uniform sampler2D light;
  uniform sampler2D bloom;
  uniform float bloomOn;
  uniform float aberration;
  uniform float radial;
  uniform float danger;
  uniform vec3 tint;
  uniform float saturation;
  uniform float contrast;
  uniform float aspect;
  varying vec2 vUv;
  void main() {
    vec2 d = vUv - 0.5;
    vec3 c = texture2D(scene, vUv).rgb;
    if (radial > 0.0) {
      for (float i = 1.0; i <= 5.0; i++) c += texture2D(scene, vUv - d * radial * i).rgb;
      c /= 6.0;
    }
    if (aberration > 0.0) {
      c.r = texture2D(scene, vUv + d * aberration).r;
      c.b = texture2D(scene, vUv - d * aberration).b;
    }
    c *= texture2D(light, vUv).rgb;
    c += texture2D(bloom, vUv).rgb * bloomOn;
    c = (c - 0.5) * contrast + 0.5;
    c *= tint;
    float grey = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(grey), c, saturation * (1.0 - danger * 0.6));
    float edge = smoothstep(0.3, 0.8, length(d * vec2(aspect, 1.0)));
    c *= 1.0 - edge * (0.25 + danger * 0.45);
    c = mix(c, vec3(0.5, 0.02, 0.0), edge * danger * 0.35);
    gl_FragColor = vec4(c, 1.0);
  }`

function texture(canvas, filter = THREE.NearestFilter) {
    const map = canvas.isTexture ? canvas : new THREE.CanvasTexture(canvas)
    map.magFilter = map.minFilter = filter
    map.generateMipmaps = false
    map.flipY = false
    map.needsUpdate = true
    return map
}

const snap = v => Math.round(v * DENSITY) / DENSITY
const pick = (list, t) => list[Math.max(0, Math.min(list.length - 1, Math.floor(t * list.length)))]
const cycle = (list, t) => list[((Math.floor(t * list.length) % list.length) + list.length) % list.length]
const hex = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255)

// Many quads of one texture drawn in a single call, refilled every frame or built once for static scenery
class Batch {
    constructor(scene, canvas, order, { capacity = 256, additive = false, palette = null, fog = null, sway = 0, gloss = 0, lit = null } = {}) {
        this.map = texture(canvas)
        this.capacity = capacity
        this.count = 0
        const geometry = new THREE.InstancedBufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 3))
        geometry.setIndex([0, 2, 1, 1, 2, 3])
        this.geometry = geometry
        this.allocate(capacity)
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: this.map }, palette: { value: palette }, size: { value: new THREE.Vector2(canvas.width ?? canvas.image.width, canvas.height ?? canvas.image.height) },
                time: { value: 0 }, sway: { value: sway }, gloss: { value: gloss }, fog: { value: new THREE.Vector4(...(fog ?? NONE)) },
                ...lit && { normalMap: { value: lit.map }, lights: lit.lights, lightColors: lit.colors, sky: lit.sky },
            },
            defines: { ...palette && { PALETTE: 1 }, ...lit && { NORMALS: 1 } },
            vertexShader: BATCH_VERTEX, fragmentShader: BATCH_FRAGMENT,
            transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        })
        this.mesh = new THREE.Mesh(geometry, this.material)
        this.mesh.renderOrder = order
        this.mesh.frustumCulled = false
        scene.add(this.mesh)
    }

    allocate(capacity) {
        for (const [name, size] of [['rect', 4], ['cell', 4], ['tint', 4], ['alpha', 1]]) {
            const old = this.geometry.getAttribute(name)?.array
            const array = new Float32Array(capacity * size)
            if (old) array.set(old)
            this.geometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage))
        }
        this.capacity = capacity
    }

    push(x, y, w, h, u, v, uw, vh, tint = NONE, alpha = 1) {
        if (this.count >= this.capacity) this.allocate(this.capacity * 2)
        const i = this.count++
        const { rect, cell, tint: tints, alpha: alphas } = this.geometry.attributes
        rect.setXYZW(i, x, y, w, h)
        cell.setXYZW(i, u, v, uw, vh)
        tints.setXYZW(i, ...tint)
        alphas.setX(i, alpha)
    }

    // A frame of a sheet with its origin at (x, y), mirrored when dir is -1, upside down for reflections and squashed by [sx, sy]
    sprite(sheet, frame, x, y, dir = 1, tint = NONE, alpha = 1, flip = false, [sx, sy] = [1, 1]) {
        const w = sheet.cellW / DENSITY * sx, h = sheet.cellH / DENSITY * sy
        const left = x - dir * sheet.originX / DENSITY * sx
        const top = flip ? y + sheet.originY / DENSITY * sy : y - sheet.originY / DENSITY * sy
        this.push(snap(left), snap(top), dir * w, flip ? -h : h, frame.x, frame.y, sheet.cellW, sheet.cellH, tint, alpha)
    }

    commit(time) {
        for (const attribute of Object.values(this.geometry.attributes)) attribute.needsUpdate = true
        this.geometry.instanceCount = this.count
        this.material.uniforms.time.value = time
    }

    dispose(scene) {
        scene.remove(this.mesh)
        this.geometry.dispose()
        this.material.dispose()
        this.map.dispose()
    }
}

// Particles are written once when spawned into a ring buffer, the GPU moves and ages them
class Particles {
    constructor(scene, capacity, order) {
        this.geometry = new THREE.BufferGeometry()
        for (const name of ['start', 'life', 'tone']) this.geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage))
        this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3))
        this.material = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, scale: { value: DENSITY } }, vertexShader: PARTICLE_VERTEX, fragmentShader: PARTICLE_FRAGMENT, transparent: true, depthTest: false, depthWrite: false })
        const points = new THREE.Points(this.geometry, this.material)
        points.renderOrder = order
        points.frustumCulled = false
        scene.add(points)
        this.capacity = capacity
        this.next = 0
        this.limit = capacity
    }

    add({ x, y, vx, vy, life, color, size, gravity, floor }, time) {
        const i = this.next
        this.next = (this.next + 1) % this.limit
        const { start, life: lives, tone } = this.geometry.attributes
        start.setXYZW(i, x, y, vx, vy)
        lives.setXYZW(i, time, life, gravity, floor)
        tone.setXYZW(i, ...hex(color), size)
        this.dirty = true
    }

    commit(time, zoom) {
        if (this.dirty) for (const name of ['start', 'life', 'tone']) this.geometry.attributes[name].needsUpdate = true
        this.dirty = false
        this.material.uniforms.time.value = time
        this.material.uniforms.scale.value = DENSITY * zoom
    }
}

function snow(scene, count, order) {
    const geometry = new THREE.BufferGeometry()
    const seeds = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
        const front = i < count / 12
        seeds.set([Math.random(), Math.random(), front ? 1.4 : 0.2 + Math.random() * 0.8, front ? 70 : 12 + Math.random() * 30], i * 4)
    }
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 4))
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    const material = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector2() }, area: { value: new THREE.Vector2() }, scale: { value: DENSITY }, wind: { value: 0 } }, vertexShader: SNOW_VERTEX, fragmentShader: SNOW_FRAGMENT, transparent: true, depthTest: false, depthWrite: false })
    const points = new THREE.Points(geometry, material)
    points.renderOrder = order
    points.frustumCulled = false
    scene.add(points)
    return points
}

function target(w, h, filter) {
    return new THREE.WebGLRenderTarget(w, h, { minFilter: filter, magFilter: filter, depthBuffer: false, type: THREE.UnsignedByteType })
}

function pass(fragmentShader, uniforms) {
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VERTEX, fragmentShader, depthTest: false, depthWrite: false })
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))
    return { scene, uniforms }
}

// Which animation of the hero plays and how far into it, from his state
function heroMotion(p, game, deadT) {
    if (game.state === 'title') return ['sit', game.time / 3 % 1]
    if (game.state === 'dead') return ['death', deadT / 0.9]
    if (p.rollT >= 0) return ['roll', p.rollT / ROLL_TIME]
    if (has(p, 'freeze')) return ['frozen', 0]
    if (p.whirlT >= 0) return ['whirl', p.whirlT * 2 % 1]
    if (p.attackT >= 0) return [`${STYLES[p.gear.weapon.base]}${p.combo + 1}`, p.attackT / p.attackTime]
    if (p.drawT >= 0) return SLOTS[p.slot] === 'bow' ? ['aim', charge(p) * 0.99] : ['cast', charge(p) * 0.4]
    if (p.castT > 0) return ['cast', 1 - p.castT / 0.3]
    if (p.drinkT > 0) return ['drink', 1 - p.drinkT / 0.5]
    if (p.hurtT > 0.55) return ['hurt', (0.8 - p.hurtT) / 0.25]
    if (has(p, 'root')) return ['netted', game.time * 2 % 1]
    if (!p.onGround) return p.vy < 0 ? ['jump', Math.min(0.99, (p.vy + 330) / 330)] : ['fall', Math.min(0.99, p.vy / 400)]
    if (p.landT > 0) return ['land', 1 - p.landT / 0.15]
    const speed = Math.abs(p.vx)
    if (speed > 10 && !p.moving) return ['stop', 1 - speed / 125]
    if (speed > 10) return speed < 70 ? ['start', speed / 70] : ['run', p.walk / (Math.PI * 2) % 1]
    return ['idle', game.time / 1.6 % 1]
}

function enemyMotion(e, frames, time) {
    if (e.hp <= 0) return frames.death ? pick(frames.death, e.deadT / 0.6) : frames.idle[0]
    if (e.state === 'lurk') return frames.idle[0]
    if (has(e, 'freeze')) return (frames.stun ?? frames.idle)[0]
    if (e.hurtT > 0 && frames.hurt && e.state !== 'attack') return pick(frames.hurt, 1 - e.hurtT / 0.25)
    if (!e.onGround && frames.fall && e.state !== 'attack') return frames.fall[0]
    if (e.state === 'walk') return cycle(frames.walk, e.walk / (Math.PI * 2))
    if (e.state === 'idle') return cycle(frames.idle, time / 1.4 + e.home * 0.01)
    const { pattern } = e
    const name = pattern.poses?.[e.state] ?? e.state
    const duration = e.state === 'windup' ? pattern.windup * 0.8 : pattern[e.state]
    return name === 'charge' || name === 'howl' ? cycle(frames[name], time * 1.6) : pick(frames[name], e.t / duration)
}

export class Renderer {
    constructor(canvas) {
        this.gl = new THREE.WebGLRenderer({ canvas, antialias: false })
        this.gl.outputColorSpace = THREE.LinearSRGBColorSpace
        this.gl.setPixelRatio(1)
        // Draw calls are counted over all passes of a frame
        this.gl.info.autoReset = false
        this.scene = new THREE.Scene()
        this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10)
        this.lightScene = new THREE.Scene()
        this.time = 0
        this.zoom = 1
        this.deadT = 0
        this.storyT = 0
        this.breathT = 0
        this.worlds = new Map()
        this.batches = new Map()
        this.gearSheets = {}
        this.marks = []
        this.trail = null

        const spells = buildSpells()
        this.sheets = {
            hero: buildHero(), items: buildItems(), statuses: buildStatuses(), marks: buildMarks(), glow: { canvas: buildGlow(), cellW: 64, cellH: 64, originX: 32, originY: 32, frames: { glow: [{ x: 0, y: 0 }] } },
            ...spells, board: buildBoard(), merchant: buildMerchant(), ...buildProjectiles(),
        }
        // Small sheets drawn together share one atlas texture
        const { items, statuses, marks, arrow, icicle, net, board } = this.sheets
        atlas([items, statuses, marks, arrow, icicle, net, board, ...Object.values(spells)])
        // Enemy sheets are painted when a stage with them is first entered
        this.builders = {
            ogre: () => buildOgre(false), chief: () => buildOgre(true), wolf: () => buildWolf('wolf'), alpha: () => buildWolf('alpha'), lynx: () => buildWolf('lynx'),
            archer: () => buildGoblin('archer'), looter: () => buildGoblin('looter'), poacher: () => buildGoblin('poacher'), shaman: buildShaman, chest: buildChest, mimic: buildMimic,
        }
        const white = document.createElement('canvas')
        white.width = white.height = 1
        white.getContext('2d').fillStyle = '#fff'
        white.getContext('2d').fillRect(0, 0, 1, 1)
        this.sheets.white = { canvas: white, cellW: 1, cellH: 1, originX: 0, originY: 0, frames: { white: [{ x: 0, y: 0 }] } }

        // Clothes of the worn gear as a tiny texture the hero shader looks up
        this.palette = new THREE.DataTexture(new Uint8Array(4 * CLOTHES.length * 4), 4, CLOTHES.length)
        texture(this.palette)

        this.particles = new Particles(this.scene, 8192, ORDER.particles)
        this.snow = snow(this.scene, 2400, ORDER.snow)
        this.lights = new Batch(this.lightScene, this.sheets.glow.canvas, 0, { additive: true })

        this.glowUniforms = { scene: { value: null } }
        this.bright = pass(BRIGHT_FRAGMENT, this.glowUniforms)
        this.blur = pass(BLUR_FRAGMENT, { image: { value: null }, step: { value: new THREE.Vector2() } })
        this.composite = pass(COMPOSITE_FRAGMENT, {
            scene: { value: null }, light: { value: null }, bloom: { value: null }, bloomOn: { value: 1 }, aberration: { value: 0 }, radial: { value: 0 },
            danger: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) }, saturation: { value: 1 }, contrast: { value: 1 }, aspect: { value: 1 },
        })
        this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
        this.quality = settings.quality === 'auto' ? 'high' : settings.quality
        // Nearest lights shared by every lit material
        this.lit = {
            lights: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
            colors: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
            sky: { value: new THREE.Vector3(1, 1, 1) },
        }
        this.resize()
    }

    // A batch for a sheet at a draw order, made on first use. Lit sheets get normal maps on high quality.
    batch(sheet, order, options = {}) {
        const key = `${order}:${options.palette ? 'p' : ''}`
        let byOrder = this.batches.get(sheet.canvas)
        if (!byOrder) this.batches.set(sheet.canvas, byOrder = new Map())
        const lit = options.lit && this.quality === 'high' ? this.litFor(sheet) : null
        if (!byOrder.has(key)) byOrder.set(key, new Batch(this.scene, sheet.canvas, order, { ...options, lit }))
        return byOrder.get(key)
    }

    litFor(sheet) {
        sheet.normals ??= texture(normals(sheet.canvas))
        return { map: sheet.normals, ...this.lit }
    }

    // Switching quality rebuilds every batch, so materials pick up normal maps or drop them
    setQuality(quality) {
        if (quality === this.quality) return
        this.quality = quality
        for (const byOrder of this.batches.values()) for (const batch of byOrder.values()) batch.dispose(this.scene)
        this.batches.clear()
        for (const batch of this.world?.batches ?? []) batch.dispose(this.scene)
        this.world = null
    }

    enemySheet(type) {
        return this.sheets[type] ??= this.builders[type]()
    }

    gear(base) {
        return this.gearSheets[base] ??= buildGear(base)
    }

    resize() {
        const w = view.w * DENSITY, h = view.h * DENSITY
        this.gl.setSize(w, h, false)
        for (const t of [this.sceneTarget, this.lightTarget, this.bloomA, this.bloomB]) t?.dispose()
        this.sceneTarget = target(w, h, THREE.NearestFilter)
        this.lightTarget = target(Math.ceil(w / 4), Math.ceil(h / 4), THREE.LinearFilter)
        this.bloomA = target(Math.ceil(w / 4), Math.ceil(h / 4), THREE.LinearFilter)
        this.bloomB = target(Math.ceil(w / 4), Math.ceil(h / 4), THREE.LinearFilter)
        this.composite.uniforms.aspect.value = w / h
    }

    // Stage art is painted when a stage is entered, the static scenery becomes batches built once
    showStage(game) {
        if (this.world) for (const batch of this.world.batches) batch.dispose(this.scene)
        const { stage, map } = game
        this.sheets.props ??= buildProps()
        this.sheets.trees ??= buildTrees()
        if (!this.worlds.has(stage)) this.worlds.set(stage, buildStage(stage, map))
        const art = this.worlds.get(stage)
        const fog = [...hex(art.theme.fog)]
        const layers = art.layers.map((layer, i) => ({ ...layer, batch: new Batch(this.scene, layer.canvas, ORDER.layers + i * 0.01, { fog: [...fog, layer.fog ?? 0], sway: layer.sway ?? 0 }) }))
        const foreground = { ...art.foreground, batch: new Batch(this.scene, art.foreground.canvas, ORDER.foreground) }
        const tiles = new Batch(this.scene, art.tiles.sheet.canvas, ORDER.tiles, { capacity: art.tiles.back.length, lit: this.quality === 'high' ? this.litFor(art.tiles.sheet) : null })
        for (const [x, y, key] of art.tiles.back) tiles.sprite(art.tiles.sheet, art.tiles.sheet.frames[key][0], x, y)
        tiles.commit(0)
        const ice = new Batch(this.scene, art.tiles.sheet.canvas, ORDER.ice, { capacity: art.tiles.front.length + 1, gloss: 1 })
        for (const [x, y, frame] of art.tiles.front) ice.sprite(art.tiles.sheet, art.tiles.sheet.frames[frame][0], x, y)
        const scenery = new Batch(this.scene, this.sheets.props.canvas, ORDER.props, { capacity: art.props.length + 1 })
        for (const [x, y, frame, dir] of art.props) scenery.sprite(this.sheets.props, this.sheets.props.frames[frame][0], x, y, dir)
        scenery.commit(0)
        const trees = new Batch(this.scene, this.sheets.trees.canvas, ORDER.props - 0.5, { capacity: art.trees.length + 1, sway: 1 })
        for (const [x, y, frame, dir] of art.trees) trees.sprite(this.sheets.trees, this.sheets.trees.frames[frame][0], x, y, dir)
        this.world = { art, stage, map, layers, foreground, tiles, ice, scenery, trees, batches: [...layers.map(layer => layer.batch), foreground.batch, tiles, ice, scenery, trees] }
        this.gl.setClearColor(art.top)
        for (const type of new Set([...game.enemies.map(e => e.type), ...Object.keys(stage.pool)])) this.enemySheet(type)
        this.marks = []
        // The spot where the hero stands at the start is the height the background layers are set against
        this.base = map.spawns.find(s => s.kind === 'hero').y
    }

    render(game, dt) {
        if (game.stage !== this.world?.stage || game.map !== this.world.map) this.showStage(game)
        this.time += dt
        this.gl.info.reset()
        const p = game.player
        const { art } = this.world
        this.deadT = game.state === 'dead' ? this.deadT + dt : 0

        // The camera moves in close on the title scene, story scenes and a boss entrance, leans in during boss fights and punches in on heavy blows
        const boss = game.enemies.some(e => TYPES[e.type].boss && e.hp > 0 && Math.abs(e.x - p.x) < TYPES[e.type].engage)
        // Story scenes slowly push in on the hero while they play
        this.storyT = game.state === 'story' ? this.storyT + dt : 0
        const close = game.intro ? 1.35 : game.state === 'title' ? 1.3 : game.state === 'story' ? 1.05 + Math.min(0.25, this.storyT * 0.02) : boss ? 1.12 : 1
        this.zoom += (close + game.impact * 0.14 - this.zoom) * Math.min(1, dt * (game.intro ? 5 : 2))
        const shake = () => settings.shake ? (Math.random() - 0.5) * game.shake : 0
        const w = view.w / this.zoom, h = view.h / this.zoom
        const camX = game.camX + (view.w - w) / 2 + shake(), camY = game.camY + (view.h - h) * 0.6 + shake()
        Object.assign(this.camera, { left: snap(camX), right: snap(camX) + w, top: -snap(camY), bottom: -snap(camY) - h })
        this.view = { x: camX, y: camY, w, h }
        this.camera.updateProjectionMatrix()

        for (const batch of this.batches.values()) for (const b of batch.values()) b.count = 0
        this.renderLayers(game, camX, camY, w, h)
        // Torches flicker, crystals pulse slowly
        const lights = art.lights.map(l => ({ ...l, intensity: l.flicker ? 0.85 + Math.sin(this.time * 17 + l.x) * 0.1 + Math.sin(this.time * 7) * 0.05 : 0.8 + Math.sin(this.time * 1.5 + l.x) * 0.2 }))
        this.renderHero(game, lights)
        this.renderNpcs(game)
        for (const e of game.enemies) this.renderEnemy(game, e)
        this.renderScenery(game, camX, w, lights)
        this.renderMarks(game)
        this.renderItems(game, lights)
        this.renderEffects(game, lights)
        for (const q of game.particles) this.particles.add(q, this.time)
        this.particles.commit(this.time, this.zoom * (this.gl.domElement.width / (view.w * DENSITY)))
        this.renderBoxes(game)

        const snowing = art.theme.snow
        this.snow.visible = snowing
        Object.assign(this.snow.material.uniforms.cam.value, { x: camX, y: camY })
        this.snow.material.uniforms.area.value.set(w, h)
        this.snow.material.uniforms.time.value = this.time
        // A blizzard blows over the title scene
        this.snow.material.uniforms.wind.value += ((game.state === 'title' ? -90 : -6) - this.snow.material.uniforms.wind.value) * Math.min(1, dt)
        this.snow.material.uniforms.scale.value = DENSITY * this.zoom

        for (const batch of this.batches.values()) for (const b of batch.values()) b.commit(this.time)
        for (const batch of this.world.batches) {
            batch.material.uniforms.time.value = this.time
            if (batch !== this.world.tiles && batch !== this.world.scenery) batch.commit(this.time)
        }
        this.post(game, lights, camX, camY, w, h)
    }

    // Layers repeat side by side, move with the camera by their factor and sit against the starting ground height
    renderLayers(game, camX, camY, w, h) {
        const rest = this.base - view.h * 0.65
        const draw = (layer, order) => {
            const { canvas, factor, density, batch } = layer
            batch.count = 0
            const lw = canvas.width / density, lh = canvas.height / density
            if (layer.stretch) {
                batch.push(camX, camY, w, h, 0, 0, canvas.width, canvas.height)
                return
            }
            const top = snap(this.base - 280 + (layer.top ?? 0) + (camY - rest) * (1 - factor))
            const offset = camX * (1 - factor) + (layer.drift ?? 0) * this.time
            for (let x = offset + Math.floor((camX - offset) / lw) * lw; x < camX + w; x += lw) {
                batch.push(snap(x), top, lw, lh, 0, 0, canvas.width, canvas.height, NONE, layer.alpha ?? 1)
                // The nearest bank continues down with its bottom row as far as the camera can see
                if (order === this.world.layers.length - 1) batch.push(snap(x), top + lh - 0.5, lw, Math.max(0, camY + h - top - lh) + 1, 0, canvas.height - 1, canvas.width, 1)
            }
        }
        this.world.layers.forEach(draw)
        draw(this.world.foreground)
    }

    renderHero(game, lights) {
        const p = game.player
        const { hero } = this.sheets
        const [name, t] = heroMotion(p, game, this.deadT)
        const frames = hero.frames[name]
        const frame = ['idle', 'run', 'stun', 'burn', 'netted', 'sit', 'whirl'].includes(name) ? cycle(frames, t) : pick(frames, t)
        // The whirl spins by turning the hero around quickly
        const dir = p.whirlT >= 0 && Math.floor(p.whirlT * 12) % 2 ? -p.dir : p.dir
        const blink = p.hurtT > 0 && game.state === 'play' && Math.floor(game.time * 20) % 2
        const tint = p.hurtT > 0.65 ? [1, 1, 1, 0.8] : has(p, 'freeze') ? [0.75, 0.93, 1, 0.6] : has(p, 'burn') ? [1, 0.5, 0.2, 0.25 + Math.sin(this.time * 20) * 0.1] : NONE
        const alpha = game.state === 'dead' ? Math.max(0, 1 - (this.deadT - 1.5)) : blink ? 0.25 : 1
        this.updatePalette(p)
        const body = this.batch(hero, ORDER.hero, { palette: this.palette, lit: true })
        // Squash on landing, stretch while leaping up
        const squash = p.landT > 0 ? p.landT / 0.15 * 0.16 : !p.onGround && p.vy < -200 ? -0.08 : 0
        const scale = [1 + squash, 1 - squash]
        body.sprite(hero, frame, p.x, p.y, dir, tint, alpha, false, scale)
        this.shadow(game, p.x, p.y, 20)
        if (this.reflects(game, p)) this.batch(hero, ORDER.reflections, { palette: this.palette }).sprite(hero, frame, p.x, p.y, dir, [0.6, 0.85, 1, 0.3], 0.35, true)

        const at = anchor => [p.x + dir * anchor[0] / DENSITY * scale[0], p.y + anchor[1] / DENSITY * scale[1], dir]
        if (p.gear.head && name !== 'roll') {
            const sheet = this.gear(p.gear.head.base)
            const [x, y] = at(frame.head)
            this.batch(sheet, ORDER.gear - 0.5).sprite(sheet, turnFrame(sheet, frame.head[2]), x, y, dir, tint, alpha)
        }
        // A rolling hero is curled into a ball with nothing worn sticking out
        for (const piece of name === 'roll' ? [] : GEAR_SLOTS.flatMap(slot => WORN[p.gear[slot]?.base] ?? [])) {
            const [anchor, art, back] = piece
            const sheet = this.gear(art)
            const [x, y] = at(frame[anchor])
            this.batch(sheet, back ? ORDER.hero - 0.5 : ORDER.gear - 0.6).sprite(sheet, turnFrame(sheet, frame[anchor][2]), x, y, dir, tint, alpha)
        }
        const slot = p.whirlT >= 0 || p.attackT >= 0 ? 'weapon' : SLOTS[p.slot] ?? 'weapon'
        const base = { weapon: p.gear.weapon.base, bow: p.gear.bow.base, frost: 'frost', potion: 'potion' }[slot]
        if (['roll', 'death', 'netted', 'grabbed', 'sit', 'ladder', 'rope'].includes(name) || (slot === 'potion' && !p.bag.potion)) return this.trail = null
        const sheet = this.gear(base)
        const [x, y] = at(frame.hand)
        if (name === 'aim') {
            const drawn = sheet.drawn
            this.batch(drawn, ORDER.gear).sprite(drawn, pick(drawn.frames.drawn, charge(p)), x, y, dir, tint, alpha)
        } else {
            this.batch(sheet, ORDER.gear).sprite(sheet, turnFrame(sheet, frame.hand[2]), x, y, dir, tint, alpha)
        }
        // Rare weapons glow in the color of their rarity, every swing leaves a trail behind the blade
        const item = slot === 'weapon' ? p.gear.weapon : slot === 'bow' ? p.gear.bow : null
        const color = item?.rarity ? RARITIES[item.rarity].color : '#bff6ee'
        if (item?.rarity > 0) {
            // Rare gear glows in its rarity color along the blade, stronger and pulsing for higher tiers
            const middle = (REACH[base] ?? 16) / DENSITY / 2, a = frame.hand[2]
            const glowAt = [x + dir * Math.cos(a) * middle, y + Math.sin(a) * middle]
            this.glow(glowAt[0], glowAt[1], 26 + middle * 1.4, color, (0.25 + item.rarity * 0.12) * (0.8 + Math.sin(this.time * 4) * 0.2))
            if (item.rarity > 1) lights.push({ x: glowAt[0], y: glowAt[1], radius: 50, color: hex(color), intensity: 0.7 })
        }
        if (slot === 'frost') lights.push({ x, y, radius: 50, color: [0.5, 0.85, 1], intensity: 0.8 })
        const swinging = (p.attackT >= 0 && p.attackT / p.attackTime > 0.15 && p.attackT / p.attackTime < 0.75) || p.whirlT >= 0
        if (!swinging || !REACH[base]) return this.trail = null
        const a = frame.hand[2], reach = REACH[base] / DENSITY
        const tip = [x + dir * Math.cos(a) * reach, y + Math.sin(a) * reach]
        if (this.trail) for (let i = 0; i < 16; i++) {
            const f = i / 16
            this.particles.add({ x: this.trail[0] + (tip[0] - this.trail[0]) * f, y: this.trail[1] + (tip[1] - this.trail[1]) * f, vx: 0, vy: 0, life: 0.12 + f * 0.08, color: i % 3 ? color : '#ffffff', size: 2, gravity: 0, floor: 1e5 }, this.time)
        }
        this.trail = tip
    }

    // A soft additive glow in a color
    glow(x, y, size, color, alpha) {
        this.batch(this.sheets.glow, ORDER.glow, { additive: true }).push(snap(x - size / 2), snap(y - size / 2), size, size, 0, 0, 64, 64, [...hex(color), 1], alpha)
    }

    updatePalette(p) {
        const clothes = { ...HERO_CLOTHES }
        for (const slot of GEAR_SLOTS) Object.assign(clothes, GEAR_CLOTHES[p.gear[slot]?.base])
        const key = JSON.stringify(clothes)
        if (key === this.clothes) return
        this.clothes = key
        const data = this.palette.image.data
        CLOTHES.forEach((slot, row) => {
            data.fill(0, row * 16, row * 16 + 16)
            clothes[slot]?.forEach((color, tone) => data.set([...hex(color).map(v => v * 255), 255], (row * 4 + tone) * 4))
        })
        this.palette.needsUpdate = true
    }

    // Bodies standing on ice show a faint upside down copy in it
    reflects(game, body) {
        return this.quality !== 'low' && body.onGround !== false && tileAt(game.map, body.x, body.y + 1) === '~'
    }

    // Spells over a sheet of ice below show mirrored in it
    reflect(game, sheet, frame, x, y, dir, scale) {
        const floor = groundBelow(game.map, x, y - 1)
        if (this.quality === 'low' || floor === null || floor - y > 90 || tileAt(game.map, x, floor + 1) !== '~') return
        this.batch(sheet, ORDER.reflections).sprite(sheet, frame, x, 2 * floor - y, dir, [0.6, 0.85, 1, 0.3], 0.35, true, scale)
    }

    shadow(game, x, y, width) {
        const floor = groundBelow(game.map, x, y - 1)
        if (floor === null || floor - y > 120) return
        const { marks } = this.sheets
        const scale = 1 - (floor - y) / 150
        // A light close by pushes the shadow away from itself and stretches it
        const light = this.world.art.lights.find(l => Math.abs(l.x - x) < l.radius * 1.5 && Math.abs(l.y - y) < 80)
        const lean = light ? Math.max(-1, Math.min(1, (x - light.x) / light.radius)) * 12 : 0
        width *= 1 + Math.abs(lean) / 16
        this.batch(marks, ORDER.shadows).push(snap(x + lean - width * scale / 2), snap(floor - 2), width * scale, 4, marks.frames.shadow[0].x, marks.frames.shadow[0].y, marks.cellW, marks.cellH, NONE, 0.45 * scale)
    }

    renderNpcs(game) {
        const p = game.player
        for (const npc of game.npcs) {
            const sheet = this.sheets[npc.kind]
            const near = Math.abs(p.x - npc.x) < 80 && npc.kind === 'merchant'
            const frames = near ? sheet.frames.greet : sheet.frames.idle
            const dir = npc.kind === 'merchant' ? Math.sign(p.x - npc.x) || -1 : 1
            this.batch(sheet, ORDER.npc, { lit: true }).sprite(sheet, cycle(frames, this.time / 1.2 + npc.x), npc.x, npc.y, dir)
            this.shadow(game, npc.x, npc.y, 24)
        }
    }

    renderEnemy(game, e) {
        if (e.state === 'lurk' || e.deadT > 1.2) return
        const type = TYPES[e.type]
        const sheet = this.enemySheet(e.type)
        const frame = enemyMotion(e, sheet.frames, this.time)
        const telegraph = e.state === 'windup' && e.t < 0.15
        // A hit flashes the foe pale without hiding its pose
        const tint = e.flashT > 0 ? [1, 1, 1, 0.55] : has(e, 'freeze') ? [0.75, 0.93, 1, 0.65] : telegraph ? [1, 0.25, 0.15, 0.55] : has(e, 'burn') ? [1, 0.5, 0.2, 0.3] : has(e, 'slow') ? [0.6, 0.85, 1, 0.35] : NONE
        const alpha = e.hp > 0 ? 1 : Math.max(0, 1 - (e.deadT - 0.6) / 0.6)
        // Foes gather themselves before a blow and stretch into it
        const squash = e.hp <= 0 ? 0 : e.state === 'windup' ? 0.07 * Math.min(1, e.t / e.pattern.windup) : e.state === 'attack' && e.t < 0.12 ? -0.07 : 0
        this.batch(sheet, ORDER.enemy, { lit: true }).sprite(sheet, frame, e.x, e.y, e.dir, tint, alpha, false, [1 + squash, 1 - squash])
        if (e.hp > 0) this.shadow(game, e.x, e.y, e.w + 8)
        if (this.reflects(game, e)) this.batch(sheet, ORDER.reflections).sprite(sheet, frame, e.x, e.y, e.dir, [0.6, 0.85, 1, 0.3], 0.35, true)
        // Boss health is shown in the HUD, chests have none
        if (e.hp <= 0 || e.hp >= e.maxHp || type.boss || type.prop) return
        const bars = this.batch(this.sheets.white, ORDER.bars)
        const top = snap(e.y - e.h - 10)
        bars.push(snap(e.x) - 13, top, 26, 4, 0, 0, 1, 1, [0.1, 0.05, 0.03, 1])
        bars.push(snap(e.x) - 12, top + 0.5, Math.max(0.5, snap(24 * e.hp / e.maxHp)), 3, 0, 0, 1, 1, [0.88, 0.2, 0.12, 1])
        bars.push(snap(e.x) - 12, top + 0.5, Math.max(0.5, snap(24 * e.hp / e.maxHp)), 1, 0, 0, 1, 1, [1, 0.45, 0.3, 1])
    }

    renderScenery(game, camX, w, lights) {
        const { art } = this.world
        const { props } = this.sheets
        const front = this.batch(props, ORDER.grass)
        const back = this.batch(props, ORDER.props + 0.2)
        for (const [x, y, name, dir] of art.animated) {
            if (x < camX - 60 || x > camX + w + 60) continue
            back.sprite(props, cycle(props.frames[name], this.time * (name === 'torch' ? 2.5 : 1.2) + x * 0.01), x, y, dir)
        }
        // Grass bends away from anyone walking through it and sways in the wind
        const bodies = [game.player, ...game.enemies.filter(e => e.hp > 0 && e.state !== 'lurk')]
        for (const [x, y] of art.grasses) {
            if (x < camX - 20 || x > camX + w + 20) continue
            const body = bodies.find(b => Math.abs(b.x - x) < b.w / 2 + 8 && Math.abs(b.y - y) < 12)
            const bend = body ? Math.sign(x - body.x) * (Math.abs(x - body.x) < body.w / 2 ? 2 : 1) : Math.round(Math.sin(this.time * 1.4 + x * 0.05) * 0.6)
            front.sprite(props, props.frames.grass[bend + 2], x, y + 1, 1)
        }
        if (game.state === 'title') {
            const fire = game.campfire
            back.sprite(props, cycle(props.frames.campfire, this.time * 2), fire.x, fire.y, 1)
            lights.push({ x: fire.x, y: fire.y - 16, radius: 150, color: [1, 0.65, 0.3], intensity: 0.9 + Math.sin(this.time * 13) * 0.1 })
            if (Math.random() < 0.3) this.particles.add({ x: fire.x + (Math.random() - 0.5) * 8, y: fire.y - 14, vx: (Math.random() - 0.5) * 10, vy: -30 - Math.random() * 30, life: 0.8, color: Math.random() < 0.5 ? '#f0c419' : '#f07a19', size: 1, gravity: -10, floor: 1e5 }, this.time)
        }
    }

    // Footprints, blood and cracks stay on the ground for a while and fade
    renderMarks(game) {
        for (const mark of game.marks) {
            if (this.marks.length > 240) this.marks.shift()
            this.marks.push({ ...mark, born: this.time })
        }
        const { marks } = this.sheets
        const batch = this.batch(marks, ORDER.marks)
        this.marks = this.marks.filter(m => this.time - m.born < 30)
        for (const m of this.marks) {
            const frames = marks.frames[m.kind]
            batch.sprite(marks, frames[Math.floor(m.x) % frames.length], m.x, m.y, m.dir ?? 1, NONE, Math.min(1, (30 - (this.time - m.born)) / 5) * (m.kind === 'step' ? 0.6 : 0.85))
        }
    }

    renderItems(game, lights) {
        const { items, statuses, props } = this.sheets
        const pickups = this.batch(items, ORDER.pickup)
        for (const q of game.pickups) {
            const bob = q.onGround ? Math.round(Math.sin(this.time * 5 + q.x) * 1.5) - 2 : 0
            pickups.sprite(items, items.frames[q.item.base ?? q.item][0], q.x, q.y - 8 + bob)
            if (q.item.rarity) this.glow(q.x, q.y - 8 + bob, 22 + q.item.rarity * 6, RARITIES[q.item.rarity].color, 0.3 + q.item.rarity * 0.12 + Math.sin(this.time * 5 + q.x) * 0.1)
            if (q.item.rarity > 1) lights.push({ x: q.x, y: q.y - 8, radius: 36, color: hex(RARITIES[q.item.rarity].color), intensity: 0.7 })
        }
        // Marks of timed effects over the hero and living foes
        const p = game.player
        const marks = this.batch(statuses, ORDER.bars + 1)
        for (const target of [p, ...game.enemies.filter(e => e.hp > 0 && e.state !== 'lurk')]) {
            const names = Object.keys(target.statuses)
            const top = target === p ? p.y - 44 : target.y - target.h - 14
            names.forEach((name, i) => marks.sprite(statuses, statuses.frames[name][0], target.x + (i - (names.length - 1) / 2) * 9, top))
        }
        // Spirit wolves are see-through and pale blue
        for (const s of game.spirits) {
            const wolf = this.enemySheet('wolf')
            this.batch(wolf, ORDER.enemy).sprite(wolf, cycle(wolf.frames.walk, this.time * 3), s.x, s.y, s.dir, [0.6, 0.9, 1, 0.6], 0.6 * s.life)
            lights.push({ x: s.x, y: s.y - 14, radius: 40, color: [0.5, 0.85, 1], intensity: 0.5 })
        }
        const projectile = (list, sheet, lit) => {
            const batch = this.batch(sheet, ORDER.projectile)
            for (const item of list) {
                batch.sprite(sheet, turnFrame(sheet, Math.atan2(item.vy ?? 0, item.vx)), item.x, item.y)
                if (lit) lights.push({ x: item.x, y: item.y, radius: lit, color: [0.5, 0.85, 1], intensity: 0.8 })
            }
        }
        projectile(game.arrows.filter(a => !a.net), this.sheets.arrow)
        projectile(game.arrows.filter(a => a.net), this.sheets.net)
        projectile(game.shots, this.sheets.arrow)
        // Frost bolts spin as they fly, charged ones are bigger
        for (const b of game.bolts) {
            const { bolt } = this.sheets
            const size = 1 + b.radius / 60
            this.batch(bolt, ORDER.projectile).sprite(bolt, cycle(bolt.frames.play, this.time * 3), b.x, b.y, Math.sign(b.vx) || 1, NONE, 1, false, [size, size])
            this.reflect(game, bolt, cycle(bolt.frames.play, this.time * 3), b.x, b.y, Math.sign(b.vx) || 1, [size, size])
            lights.push({ x: b.x, y: b.y, radius: 70 * size, color: [0.5, 0.85, 1], intensity: 0.8 })
        }
        projectile(game.icicles, this.sheets.icicle)
        // Hanging icicles point down and shake before they fall
        projectile(game.traps.map(trap => ({ x: trap.x + (trap.t >= 0 ? Math.round(Math.sin(game.time * 60)) : 0), y: trap.y + 8, vx: 0, vy: 1 })), this.sheets.icicle)
        for (const s of game.shots.filter(s => s.ammo === 'fireArrows')) lights.push({ x: s.x, y: s.y, radius: 40, color: [1, 0.6, 0.25], intensity: 0.8 })
    }

    renderEffects(game, lights) {
        const p = game.player
        const flash = settings.flashes ? 1 : 0.35
        const add = this.glow.bind(this)
        for (const b of game.bolts) add(b.x, b.y, 30 + b.radius, '#4fc3f7', 0.9)
        for (const f of game.flashes) {
            add(f.x, f.y, f.size, f.color, f.life / 0.2 * flash)
            lights.push({ x: f.x, y: f.y, radius: f.size * 1.5, color: hex(f.color), intensity: f.life / 0.2 })
        }
        // The ice shield flickers when it is about to melt
        const spell = (name, x, y, t, alpha = 1, scale = [1, 1], order = ORDER.glow - 0.5) => {
            const sheet = this.sheets[name]
            this.batch(sheet, order).sprite(sheet, pick(sheet.frames.play, t), x, y, 1, NONE, alpha, false, scale)
            this.reflect(game, sheet, pick(sheet.frames.play, t), x, y, 1, scale)
        }
        if (p.shieldT > 0) {
            const fading = p.shieldT < 1 && Math.floor(game.time * 10) % 2
            add(p.x, p.y - 18, 60, '#8fdcff', fading ? 0.2 : 0.5)
            spell('shield', p.x, p.y - 18, this.time * 2 % 1, fading ? 0.3 : 0.85)
        }
        if (p.whirlT >= 0) spell('slash', p.x, p.y - 16, p.whirlT / WHIRL_TIME * 2 % 1)
        for (const effect of game.effects) spell(effect.kind, effect.x, effect.y, 1 - effect.life / effect.duration, 1, [effect.scale, effect.scale])
        // Frozen bodies are held in a block of ice
        for (const body of [p, ...game.enemies.filter(e => e.hp > 0 && e.state !== 'lurk')].filter(body => has(body, 'freeze'))) {
            spell('frozen', body.x, body.y + 2, this.time % 1, 0.45, [(body.w + 10) / 30, (body.h + 12) / 50], ORDER.hero + 0.5)
        }
        // Breath steams in the cold air
        this.breathT -= 1 / 60
        if (this.breathT <= 0 && game.state === 'play') {
            this.breathT = 1.8
            for (let i = 0; i < 6; i++) this.particles.add({ x: p.x + p.dir * 7, y: p.y - 31, vx: p.dir * (8 + i * 5), vy: -5 - i * 2, life: 0.6 + i * 0.1, color: i % 2 ? '#dfeef5' : '#b9d3df', size: 1.5, gravity: -8, floor: 1e5 }, this.time)
        }
        // The hero carries a little light of his own in the dark
        lights.push({ x: p.x, y: p.y - 20, radius: 110, color: [1, 0.9, 0.75], intensity: 0.55 })
        if (p.drawT >= 0 && SLOTS[p.slot] === 'bow') {
            // Dotted flight path of the arrow being aimed
            const arrow = aimArrow(p)
            for (let i = 1; i <= 45; i++) {
                flyArrow(arrow, 0.02)
                if (i % 4 === 0) this.particles.add({ x: arrow.x, y: arrow.y, vx: 0, vy: 0, life: 0.02, color: '#fff3c4', size: 1.5, gravity: 0, floor: 1e5 }, this.time)
            }
        }
    }

    renderBoxes(game) {
        if (!game.dev?.boxes) return
        const batch = this.batch(this.sheets.white, ORDER.boxes)
        const pink = [1, 0.24, 0.94, 1]
        for (const [x, y, w, h] of hitboxes(game)) {
            batch.push(x, y, w, 0.5, 0, 0, 1, 1, pink)
            batch.push(x, y + h - 0.5, w, 0.5, 0, 0, 1, 1, pink)
            batch.push(x, y, 0.5, h, 0, 0, 1, 1, pink)
            batch.push(x + w - 0.5, y, 0.5, h, 0, 0, 1, 1, pink)
        }
    }

    // The scene goes to a texture, lights to a small one, bright spots are blurred for bloom, then everything is composed on screen
    post(game, lights, camX, camY, w, h) {
        const { theme } = this.world.art
        const gl = this.gl
        gl.setRenderTarget(this.sceneTarget)
        gl.render(this.scene, this.camera)

        // Lit sprites feel the eight lights closest to the middle of the view
        const center = [camX + w / 2, camY + h / 2]
        const near = [...lights].sort((a, b) => Math.hypot(a.x - center[0], a.y - center[1]) - Math.hypot(b.x - center[0], b.y - center[1]))
        this.lit.lights.value.forEach((v, i) => near[i] ? v.set(near[i].x, near[i].y, near[i].radius * 1.2, near[i].intensity ?? 1) : v.set(0, 0, 1, 0))
        this.lit.colors.value.forEach((v, i) => near[i] && v.set(...near[i].color))
        this.lit.sky.value.set(...theme.ambient)
        this.lights.count = 0
        for (const l of lights) {
            const size = l.radius * 2
            this.lights.push(l.x - l.radius, l.y - l.radius, size, size, 0, 0, 64, 64, [...l.color, 1], l.intensity ?? 1)
        }
        this.lights.commit(this.time)
        gl.setRenderTarget(this.lightTarget)
        gl.setClearColor(new THREE.Color(...theme.ambient))
        gl.clear()
        gl.render(this.lightScene, this.camera)
        gl.setClearColor(this.world.art.top)

        const bloom = this.quality !== 'low'
        if (bloom) {
            this.glowUniforms.scene.value = this.sceneTarget.texture
            gl.setRenderTarget(this.bloomA)
            gl.render(this.bright.scene, this.quadCamera)
            for (const [from, to, step] of [[this.bloomA, this.bloomB, [1, 0]], [this.bloomB, this.bloomA, [0, 1]]]) {
                this.blur.uniforms.image.value = from.texture
                this.blur.uniforms.step.value.set(step[0] / from.width, step[1] / from.height)
                gl.setRenderTarget(to)
                gl.render(this.blur.scene, this.quadCamera)
            }
        }

        const p = game.player
        const u = this.composite.uniforms
        const effects = settings.flashes && this.quality !== 'low' ? game.impact : 0
        u.scene.value = this.sceneTarget.texture
        u.light.value = this.lightTarget.texture
        u.bloom.value = this.bloomA.texture
        u.bloomOn.value = bloom ? 0.8 : 0
        u.aberration.value = effects * 0.012
        u.radial.value = effects * 0.012
        u.danger.value = game.state === 'play' ? Math.max(0, 1 - p.hp / p.maxHp / 0.3) : 0
        u.tint.value.set(...theme.grade.tint)
        u.saturation.value = theme.grade.saturation
        u.contrast.value = theme.grade.contrast
        gl.setRenderTarget(null)
        gl.render(this.composite.scene, this.quadCamera)
    }
}

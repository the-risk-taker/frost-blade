import { H, GROUND, LEVEL_W } from './const.js'
import { rng, hash, noise, dither, paint, dot, outline, makeCanvas } from './pixels.js'

const FAR = { rim: '#d9f1f6', light: '#8ccbd9', mid: '#79bccd', shadow: '#5ea7bd', dark: '#4e97b0', crevice: '#43889f', snow: '#e8f7fa', snowShadow: '#b3dce8' }
const NEAR = { rim: '#f2f8f7', light: '#a8b8b2', mid: '#93a49f', shadow: '#667779', dark: '#546569', crevice: '#3d4c52', snow: '#eef6f5', snowShadow: '#b7ccd0', grass: '#4aa85b', grassShadow: '#2e7d4c' }
const PINE = { dark: '#153a4b', mid: '#22687a', light: '#35908f', high: '#56b2a4', snow: '#e9f5f7', trunk: '#8a532e', trunkDark: '#5a341f' }
const HAZY_PINE = { dark: '#2e6f80', mid: '#3c8391', light: '#4f9aa2', high: '#62aeb2', snow: '#d9eef2', trunk: '#4a7f8a', trunkDark: '#3c6f7a' }

function sky() {
  const bands = ['#1590d0', '#1b9fdc', '#22ade6', '#2cb9ee', '#45c4f1']
  return paint(64, H, (x, y) => {
    const t = y / 44
    const i = Math.min(bands.length - 1, Math.floor(t))
    return t - i > 0.75 && dither(x, y) ? bands[Math.min(bands.length - 1, i + 1)] : bands[i]
  })
}

function clouds(seed) {
  const w = 1280, h = 240, r = rng(seed)
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < 18; i++) {
    const cx = r() * w, cy = 30 + r() * 120
    for (let j = 0; j < 12; j++) {
      const px = cx + (r() - 0.5) * 170, py = cy + (r() - 0.5) * 24, rad = 8 + r() * 20
      for (let y = Math.max(0, Math.floor(py - rad)); y < Math.min(h, py + rad); y++)
        for (let x = Math.floor(px - rad); x < px + rad; x++)
          if ((x - px) ** 2 + (y - py) ** 2 < rad * rad) mask[y * w + ((x % w) + w) % w] = 1
    }
  }
  const inside = (x, y) => y >= 0 && y < h && mask[y * w + ((x % w) + w) % w]
  return paint(w, H, (x, y) => {
    if (!inside(x, y)) return
    if (!inside(x, y - 1)) return '#ffffff'
    if (!inside(x, y + 3)) return '#9fd0e8'
    if (!inside(x, y + 7) || (!inside(x, y + 12) && dither(x, y))) return '#c4e5f5'
    return inside(x - 4, y - 4) ? '#e9f6fc' : '#ffffff'
  })
}

function mountains(seed, count, top, bottom, slope, c) {
  const w = 1280, r = rng(seed)
  const peaks = Array.from({ length: count }, (_, i) => ({ x: (i + r() * 0.6) * w / count, y: top + r() * (bottom - top) }))
  const columns = Array.from({ length: w }, (_, x) => {
    let best = { top: Infinity }
    for (const p of peaks)
      for (const dx of [x - p.x - w, x - p.x, x - p.x + w]) {
        const t = p.y + Math.abs(dx) * slope
        if (t < best.top) best = { top: t, dx, peak: p.y }
      }
    best.top = Math.round(best.top + (noise(x, 0, 4, seed, w) - 0.5) * 6)
    return best
  })
  return paint(w, H, (x, y) => {
    const { top, dx, peak } = columns[x]
    if (y < top) return
    const depth = y - peak, below = y - top
    const ridge = dx + (noise(x, y, 16, seed + 1, w) - 0.5) * depth * 0.7 + (noise(x, y, 4, seed + 5, w) - 0.5) * 4
    const lit = ridge < 0
    if (below === 0) return lit ? c.rim : c.snowShadow
    const snowLine = 16 + noise(x, y, 8, seed + 2, w) * 34
    if (depth < snowLine && !(depth > snowLine - 3 && dither(x, y))) return lit ? c.snow : c.snowShadow
    if (Math.abs(ridge) < 1) return c.crevice
    if (c.grass && below > 30 && noise(x, y, 16, seed + 3, w) > 0.58) return lit ? c.grass : c.grassShadow
    const crack = noise(x, y / 5, 4, seed + 4, w)
    if (crack > 0.72) return lit ? c.mid : c.dark
    if (crack < 0.18 && depth < snowLine + 40) return lit ? c.snow : c.snowShadow
    return lit ? c.light : c.shadow
  })
}

// Rugged rock slabs with snowy tops and ledges
function cliffs(seed) {
  const w = 960, r = rng(seed)
  const tops = [], local = [], widths = [], ids = []
  for (let x = 0, id = 0; x < w; id++) {
    const width = Math.floor(18 + r() * 40), top = Math.floor(160 + r() * 30)
    for (let i = 0; i < width && x < w; i++, x++) {
      tops[x] = top
      local[x] = i
      widths[x] = width
      ids[x] = id
    }
  }
  return paint(w, H, (x, y) => {
    const d = y - tops[x]
    if (d < 0) return
    const cap = 3 + Math.floor(hash(x, 1, seed) * 3)
    if (d < cap) return d === 0 ? '#ffffff' : '#e2eff2'
    if (d === cap) return '#9fb6bc'
    const size = 10 + Math.floor(hash(ids[x], 4, seed) * 14)
    const offset = Math.floor(hash(ids[x], 2, seed) * size)
    const band = Math.floor((d + offset) / size), bandY = (d + offset) % size
    if (bandY === 0 && noise(x, band * 50, 8, seed + 1, w) > 0.35) return '#3a474d'
    if (bandY === 1 && hash(ids[x] * 7 + band, 3, seed) > 0.4) return '#dcebee'
    if (local[x] === 0) return '#2f3b40'
    if (local[x] === 1) return '#b3c0bd'
    if (local[x] >= widths[x] - 3) return '#56666b'
    const n = noise(x, y, 6, seed, w)
    return n > 0.62 ? '#9aa9a7' : n < 0.3 ? '#6f8083' : '#849596'
  })
}

// Pine tree with tiered branches, snow on each tier and a lit left side.
function pine(ctx, cx, base, h, r, c) {
  const seed = Math.floor(r() * 1e6)
  const top = base - h, bottom = base - Math.max(4, Math.floor(h * 0.1))
  const tiers = Math.max(3, Math.round(h / 22))
  for (let y = bottom - 6; y <= base; y++) {
    dot(ctx, cx - 1, y, c.trunk)
    dot(ctx, cx, y, c.trunk)
    dot(ctx, cx + 1, y, c.trunkDark)
  }
  for (let y = top; y < bottom; y++) {
    const t = (y - top) / (bottom - top)
    const tier = (t * tiers) % 1
    const half = (1 + t * h * 0.24) * (0.45 + 0.55 * tier)
    for (let x = Math.floor(-half); x <= Math.ceil(half); x++) {
      const edge = Math.abs(x) - half
      if (edge > 0 || (edge > -1.5 && hash(x, y - top, seed) > 0.55)) continue
      const n = noise(x, y - top, 3, seed) - x / (half + 1) * 0.3
      let color = n > 0.66 ? c.high : n > 0.48 ? c.light : n > 0.3 ? c.mid : c.dark
      if (tier > 0.88) color = c.dark
      else if (tier < 0.1 + hash(x, y - top, seed + 1) * 0.12 && n > 0.5) color = c.snow
      dot(ctx, cx + x, y, color)
    }
  }
}

function forest(seed) {
  const w = 960, r = rng(seed)
  const bank = Array.from({ length: w }, (_, x) => 240 + Math.round(noise(x, 0, 24, seed, w) * 8))
  const canvas = paint(w, H, (x, y) => {
    if (y < bank[x]) return
    if (y === bank[x]) return '#f4fafc'
    return noise(x, y, 12, seed + 1, w) > 0.6 ? '#c0d9e4' : '#d6e8f0'
  })
  const ctx = canvas.getContext('2d')
  for (let x = 0; x < w; x += 10 + r() * 30) {
    const h = 28 + r() * 36, base = 244 + Math.floor(r() * 4), treeSeed = Math.floor(r() * 1e6)
    for (const shift of [-w, 0, w])
      if (x + shift > -40 && x + shift < w + 40) pine(ctx, Math.floor(x + shift), base, h, rng(treeSeed), HAZY_PINE)
  }
  return canvas
}

// Draws into a scratch canvas, outlines it and copies it onto ctx.
function stamp(ctx, x, y, w, h, color, draw) {
  const canvas = makeCanvas(w, h)
  draw(canvas.getContext('2d'))
  outline(canvas, color)
  ctx.drawImage(canvas, Math.round(x), Math.round(y))
}

function shadow(ctx, cx, base, half) {
  ctx.fillStyle = '#c2dbe7'
  ctx.fillRect(Math.round(cx - half), base - 2, half * 2, 3)
  ctx.fillRect(Math.round(cx - half * 0.7), base - 4, Math.round(half * 1.4), 2)
}

function boulder(ctx, cx, base, rw, rh, r) {
  const seed = Math.floor(r() * 1e6)
  shadow(ctx, cx, GROUND, rw + 3)
  stamp(ctx, cx - rw - 1, base - rh - 1, rw * 2 + 3, rh + 2, '#101417', c => {
    for (let y = 0; y <= rh; y++) {
      for (let x = -rw; x <= rw; x++) {
        const nx = x / rw, ny = (y - rh / 2) / (rh / 2)
        const n = noise(x, y, 4, seed)
        if (nx * nx + ny * ny > 1.05 - n * 0.3) continue
        const light = -nx * 0.45 - ny * 0.8 + (n - 0.5) * 0.7
        const snow = ny < -0.35 && n > 0.45
        dot(c, rw + 1 + x, y + 1, snow ? (ny < -0.6 ? '#f5fafc' : '#d2e3ea') : light > 0.55 ? '#7f898e' : light > 0.15 ? '#5d666b' : light > -0.3 ? '#454d52' : '#31373b')
      }
    }
  })
}

function crystals(ctx, cx, base, r) {
  const shards = Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({ x: (r() - 0.5) * 20, h: 12 + r() * 28, w: 2 + r() * 3, lean: (r() - 0.5) * 0.7 }))
  stamp(ctx, cx - 30, base - 44, 60, 45, '#1f5f78', c => {
    for (const s of shards) {
      for (let y = 0; y < s.h; y++) {
        const half = s.w * Math.min(1, (s.h - y) / (s.h * 0.45))
        for (let x = -half; x <= half; x++)
          dot(c, 30 + s.x + x + s.lean * y, 44 - y, x < -half * 0.3 ? '#effcff' : x < half * 0.4 ? '#a9e3f0' : '#62b3cf')
      }
    }
  })
}

function level(seed) {
  const r = rng(seed)
  const drift = Array.from({ length: LEVEL_W }, (_, x) => 228 + Math.round(noise(x, 0, 48, seed) * 14))
  const canvas = paint(LEVEL_W, H, (x, y) => {
    if (y < drift[x]) return
    if (y < GROUND) {
      if (y === drift[x]) return '#ffffff'
      const n = noise(x, y, 14, seed + 1) + (y - drift[x]) * 0.004
      if (n > 0.66 || (n > 0.6 && dither(x, y))) return '#c2dbe7'
      return hash(x, y, seed + 2) > 0.997 ? '#ffffff' : '#e4f1f6'
    }
    // Snow lip with icicles over dark cobblestones
    const d = y - GROUND
    const lip = hash(x >> 1, 5, seed) > 0.7 ? 4 : 3
    if (d < lip) return d === 0 ? '#ffffff' : '#e3f0f5'
    const icicle = hash(Math.floor(x / 3), 6, seed)
    if (x % 3 === 1 && icicle > 0.8 && d < lip + (icicle - 0.8) * 40) return '#bfe3ee'
    const row = Math.floor(d / 6), shift = row & 1 ? 4 : 0
    const lx = (x + shift) % 8, ly = d % 6
    if (lx === 0 || ly === 0) return d < 12 && hash(x, y, seed) > 0.55 ? '#c9dce3' : '#15181b'
    const deep = d > 44
    if (lx === 1 || ly === 1) return deep ? '#3b4247' : '#6a747a'
    if (lx === 7 || ly === 5) return deep ? '#23282c' : '#3a4146'
    const v = hash(Math.floor((x + shift) / 8), row, seed)
    return deep ? (v < 0.5 ? '#2b3135' : '#33393e') : v < 0.5 ? '#474f55' : '#555e64'
  })
  const ctx = canvas.getContext('2d')
  for (let x = 40; x < LEVEL_W; x += 70 + r() * 150) {
    const h = Math.floor(110 + r() * 60), half = Math.ceil(h * 0.25) + 2
    shadow(ctx, x, GROUND - 1, half)
    stamp(ctx, x - half, GROUND - h - 3, half * 2, h + 4, '#0e2a36', c => pine(c, half, h + 2, h, r, PINE))
  }
  for (let i = 0; i < 36; i++) boulder(ctx, Math.floor(r() * LEVEL_W), GROUND + 2, Math.floor(10 + r() * 16), Math.floor(9 + r() * 12), r)
  for (let i = 0; i < 18; i++) crystals(ctx, Math.floor(r() * LEVEL_W), GROUND + 1, r)
  return canvas
}

function vignette() {
  // Stretched over the whole view, so its own size only sets the shape
  const w = 640, h = 360
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.35, w / 2, h * 0.45, w * 0.62)
  gradient.addColorStop(0, 'rgba(8, 24, 40, 0)')
  gradient.addColorStop(1, 'rgba(8, 24, 40, 0.35)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
  return canvas
}

export function buildWorld() {
  return {
    sky: sky(),
    clouds: clouds(7),
    far: mountains(11, 6, 20, 75, 0.95, FAR),
    near: mountains(23, 8, 70, 115, 1.15, NEAR),
    cliffs: cliffs(31),
    forest: forest(57),
    level: level(42),
    vignette: vignette(),
  }
}

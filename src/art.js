import { TILE, DENSITY } from './const.js'
import { rng, hash, noise, dither, paint, dot, outline, makeCanvas } from './pixels.js'
import { sheet, shape, limb, ball, humanoid, INK } from './rig.js'

// Far layers keep the height of the old screen and are drawn at half the density of the rest
const H = 360

const FAR = { rim: '#d9f1f6', light: '#8ccbd9', mid: '#79bccd', shadow: '#5ea7bd', dark: '#4e97b0', crevice: '#43889f', snow: '#e8f7fa', snowShadow: '#b3dce8' }
const NEAR = { rim: '#f2f8f7', light: '#a8b8b2', mid: '#93a49f', shadow: '#667779', dark: '#546569', crevice: '#3d4c52', snow: '#eef6f5', snowShadow: '#b7ccd0', grass: '#4aa85b', grassShadow: '#2e7d4c' }
// Dark ice formations inside the cave
const CAVE_FAR = { rim: '#5d93ab', light: '#2f5870', mid: '#294f66', shadow: '#1f3d52', dark: '#1a3447', crevice: '#142a3a', snow: '#6fb0c8', snowShadow: '#3f7890' }
const CAVE_NEAR = { rim: '#7fb8cc', light: '#3a5f6f', mid: '#335666', shadow: '#243f4d', dark: '#1e3542', crevice: '#152833', snow: '#8fcfe0', snowShadow: '#4f8ea3' }
// Bare rock and deep snow, too high for anything green to grow
const PEAK_NEAR = { rim: '#ffffff', light: '#c3d4dc', mid: '#a8bcc6', shadow: '#7a8f9c', dark: '#64798a', crevice: '#4a5e70', snow: '#f4fbff', snowShadow: '#c8dde9' }
// Mountains lit by the setting sun behind the castle
const DUSK_FAR = { rim: '#f3c9b0', light: '#a8779a', mid: '#9a6c8e', shadow: '#7a5579', dark: '#6a4a6c', crevice: '#583d5c', snow: '#f0d4d0', snowShadow: '#c49aac' }
const PINE = { dark: '#153a4b', mid: '#22687a', light: '#35908f', high: '#56b2a4', snow: '#e9f5f7', trunk: '#8a532e', trunkDark: '#5a341f' }
const HAZY_PINE = { dark: '#2e6f80', mid: '#3c8391', light: '#4f9aa2', high: '#62aeb2', snow: '#d9eef2', trunk: '#4a7f8a', trunkDark: '#3c6f7a' }
const SKIES = {
  forest: ['#1590d0', '#1b9fdc', '#22ade6', '#2cb9ee', '#45c4f1'],
  cave: ['#0a121b', '#0d1824', '#111f2e', '#152738', '#1a2f42'],
  ruins: ['#3b2a55', '#5a3a66', '#80506e', '#b0686e', '#d98a6e'],
  peaks: ['#0b4f8c', '#1268ab', '#1d85c9', '#36a2e2', '#6cc4f0'],
  lake: ['#040a18', '#08142a', '#0e2040', '#183358', '#2f5580'],
}

function sky(bands) {
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

// Cave ceiling with rock teeth and icicles hanging from it
function ceiling(seed) {
  const w = 960, r = rng(seed)
  const base = Array.from({ length: w }, (_, x) => 20 + Math.round(noise(x, 0, 32, seed, w) * 30))
  const tips = [...base]
  for (let i = 0; i < 60; i++) {
    const cx = Math.floor(r() * w), length = 15 + r() * 70, half = 2 + r() * 5
    for (let dx = -Math.floor(half); dx <= half; dx++) {
      const x = (cx + dx + w) % w
      tips[x] = Math.max(tips[x], Math.round(base[x] + length * (1 - Math.abs(dx) / half)))
    }
  }
  return paint(w, H, (x, y) => {
    if (y >= tips[x]) return
    if (y === tips[x] - 1) return '#6fb0c8'
    if (y >= base[x]) return x % 3 ? '#2b5870' : '#3d7890'
    return noise(x, y, 8, seed + 1, w) > 0.6 ? '#1c2c38' : '#16222c'
  })
}

// Ruined walls and towers of the castle, dark against the dusk
function castle(seed) {
  const w = 1280, r = rng(seed)
  const tops = [], towers = []
  for (let x = 0; x < w;) {
    const tower = r() < 0.4
    const width = tower ? 28 + Math.floor(r() * 16) : 50 + Math.floor(r() * 90)
    const top = tower ? 80 + Math.floor(r() * 40) : 140 + Math.floor(r() * 40)
    for (let i = 0; i < width && x < w; i++, x++) {
      tops[x] = top + Math.round(Math.max(0, noise(x, top, 10, seed, w) - 0.55) * 120)
      towers[x] = tower ? i : -1
    }
  }
  return paint(w, H, (x, y) => {
    const d = y - tops[x]
    const merlon = Math.floor(x / 5) % 2 === 0
    if (d < -5 || (d < 0 && !merlon)) return
    if (d === -5 || (d === 0 && !merlon)) return '#e9dce6'
    // Window slits in the towers
    if (towers[x] % 14 > 5 && towers[x] % 14 < 9 && d % 36 > 12 && d % 36 < 26) return '#1c1224'
    const row = Math.floor(y / 5)
    if (y % 5 === 0 || (x + (row & 1) * 5) % 10 === 0) return '#3b2e45'
    return noise(x, y, 12, seed + 1, w) > 0.55 ? '#5c4a66' : '#4f3f59'
  })
}

// Pine tree with tiered branches, snow on each tier and a lit left side
function pine(ctx, cx, base, h, r, c) {
  const seed = Math.floor(r() * 1e6)
  const top = base - h, bottom = base - Math.max(4, Math.floor(h * 0.1))
  const tiers = Math.max(3, Math.round(h / 40))
  const trunk = Math.max(1, Math.round(h / 90))
  for (let y = bottom - 10; y <= base; y++) {
    for (let x = -trunk; x <= trunk; x++) dot(ctx, cx + x, y, x === trunk ? c.trunkDark : x === -trunk ? c.high : c.trunk)
  }
  for (let y = top; y < bottom; y++) {
    const t = (y - top) / (bottom - top)
    const tier = (t * tiers) % 1
    const half = (1 + t * h * 0.24) * (0.45 + 0.55 * tier)
    for (let x = Math.floor(-half); x <= Math.ceil(half); x++) {
      const edge = Math.abs(x) - half
      if (edge > 0 || (edge > -2 && hash(x, y - top, seed) > 0.55)) continue
      const n = noise(x, y - top, 4, seed) - x / (half + 1) * 0.3
      let color = n > 0.66 ? c.high : n > 0.48 ? c.light : n > 0.3 ? c.mid : c.dark
      if (tier > 0.9) color = c.dark
      else if (tier < 0.1 + hash(x, y - top, seed + 1) * 0.12 && n > 0.45) color = c.snow
      dot(ctx, cx + x, y, color)
    }
  }
}

// Paints into a scratch canvas, outlines it and copies it under the given origin
function stamp(ctx, x, y, w, h, color, draw) {
  const canvas = makeCanvas(w, h)
  draw(canvas.getContext('2d'))
  outline(canvas, color)
  ctx.drawImage(canvas, Math.round(x), Math.round(y))
}

// Near layers at full density: a bank with hazy trees or ice crystals, and a row of big dark trees right behind the path
function bank(seed, theme, base, trees, c) {
  const w = 1920, r = rng(seed)
  const edge = bankEdge(w, seed, base)
  const [top, shade, fill] = c.bank
  // Deep below the bank it gets dark, that is what shows at the bottom of chasms
  const deep = c.rock[0]
  const canvas = paint(w, 720, (x, y) => {
    if (y < edge[x]) return
    if (y < edge[x] + 2) return top
    const depth = y - edge[x]
    if (depth > 120 || (depth > 90 && dither(x, y))) return deep
    return noise(x, y, 24, seed + 1, w) > 0.6 ? shade : fill
  })
  const ctx = canvas.getContext('2d')
  for (let x = 0; x < w; x += trees.step + r() * trees.step) {
    const h = trees.h + r() * trees.h * 0.7, treeSeed = Math.floor(r() * 1e6)
    for (const shift of [-w, 0, w]) {
      const cx = Math.floor(x + shift)
      if (cx <= -120 || cx >= w + 120) continue
      if (theme === 'cave') crystalCluster(ctx, cx, edge[((cx % w) + w) % w] + 6, h / 70, rng(treeSeed), c.crystal)
      else if (theme === 'ruins' && trees.walls) wall(ctx, cx, edge[((cx % w) + w) % w] + 6, h, rng(treeSeed), c.pine)
      else pine(ctx, cx, edge[((cx % w) + w) % w] + 8, h, rng(treeSeed), c.pine)
    }
  }
  return canvas
}

const bankEdge = (w, seed, base) => Array.from({ length: w }, (_, x) => base + Math.round(noise(x, 0, 48, seed, w) * 16))

function crystalCluster(ctx, cx, base, size, r, c) {
  const shards = Array.from({ length: 3 + Math.floor(r() * 4) }, () => ({ x: (r() - 0.5) * 40 * size, h: (24 + r() * 56) * size, w: (4 + r() * 6) * size, lean: (r() - 0.5) * 0.7 }))
  for (const s of shards) {
    for (let y = 0; y < s.h; y++) {
      const half = s.w * Math.min(1, (s.h - y) / (s.h * 0.45))
      for (let x = -half; x <= half; x++) dot(ctx, cx + s.x + x + s.lean * y, base - y, x < -half * 0.3 ? c[3] : x < half * 0.4 ? c[2] : c[1])
    }
  }
}

// Ruined wall piece with windows and a broken top
function wall(ctx, cx, base, h, r, c) {
  const width = 60 + Math.floor(r() * 80), seed = Math.floor(r() * 1e6)
  for (let x = 0; x < width; x++) {
    const top = base - h + Math.floor(noise(x, 0, 12, seed) * h * 0.4)
    for (let y = top; y <= base; y++) {
      const brick = (y % 12 === 0) || ((x + (Math.floor(y / 12) & 1) * 12) % 24 === 0)
      const window = Math.abs(x - width / 2) < 7 && y > base - h * 0.7 && y < base - h * 0.4
      dot(ctx, cx - width / 2 + x, y, window ? c.dark : y < top + 3 ? c.snow : brick ? c.dark : x < 3 ? c.high : c.mid)
    }
  }
}

// Foreground silhouettes pass in front of the action: tree trunks, hanging ice or broken arches, almost black
function foreground(seed, theme) {
  const w = 2400, canvas = makeCanvas(w, 720), ctx = canvas.getContext('2d'), r = rng(seed)
  const dark = { forest: ['#06121a', '#0d2230'], cave: ['#040a10', '#0c1a26'], ruins: ['#0c0612', '#1a0f24'], peaks: ['#08161f', '#102a38'], lake: ['#030810', '#081624'] }[theme]
  for (let x = 900 + r() * 300; x < w - 100; x += 1400 + r() * 600) {
    const cx = Math.floor(x)
    // Ice hangs into the view where there is a roof over the world, elsewhere dark trunks pass by
    if (theme === 'cave' || theme === 'lake') {
      for (let i = 0; i < 5; i++) {
        const sx = cx + (r() - 0.5) * 160, len = 60 + r() * 200, half = 6 + r() * 12
        for (let y = 0; y < len; y++) for (let dx = -half * (1 - y / len); dx <= half * (1 - y / len); dx++) dot(ctx, sx + dx, y, dx > 0 ? dark[0] : dark[1])
      }
    } else if (theme === 'ruins') {
      for (let y = 0; y < 720; y++) for (let dx = -26; dx <= 26; dx++) {
        const arch = y < 140 && Math.hypot(dx + 90, y - 140) < 110 && Math.hypot(dx + 90, y - 140) > 70
        if (Math.abs(dx) < 22 || arch) dot(ctx, cx + dx + (arch ? 0 : 0), y, dx > 10 ? dark[0] : dark[1])
      }
    } else {
      const half = 7 + r() * 5
      for (let y = 0; y < 720; y++) for (let dx = -half; dx <= half; dx++) dot(ctx, cx + dx + Math.sin(y / 90) * 4, y, dx > half * 0.4 ? dark[0] : dark[1])
      for (let i = 0; i < 3; i++) {
        const by = 80 + r() * 300, len = 80 + r() * 140, dir = r() < 0.5 ? -1 : 1
        for (let t = 0; t < len; t++) for (let dy = -4 + t * 0.02; dy <= 4 - t * 0.02; dy++) dot(ctx, cx + dir * t, by + t * 0.35 + dy, dark[0])
      }
    }
  }
  return canvas
}

// Soft fog band drifting through the valleys
function mist(seed) {
  const w = 1920, h = 240
  return paint(w, h, (x, y) => {
    const n = noise(x, y, 64, seed, w) * (1 - Math.abs(y - h / 2) / (h / 2))
    if (n < 0.28) return
    return n > 0.42 ? '#ffffff' : (x + y) & 1 ? '#ffffff' : undefined
  })
}

// Colors and light of each stage. Ambient darkens places far from lights, grade tints the whole picture.
export const THEMES = {
  forest: {
    ambient: [1, 1, 1], grade: { tint: [0.98, 1, 1.04], saturation: 1.05, contrast: 1.04 },
    rock: ['#15181b', '#2b3135', '#474f55', '#5f686e'], cap: ['#8fb4c6', '#c2dbe7', '#e4f1f6', '#ffffff'],
    bank: ['#e4f1f6', '#b2cfdc', '#c6dde7'], pine: { dark: '#2e6f80', mid: '#3c8391', light: '#4f9aa2', high: '#62aeb2', snow: '#d9eef2', trunk: '#4a7f8a', trunkDark: '#3c6f7a' },
    near: { dark: '#153a4b', mid: '#22687a', light: '#35908f', high: '#56b2a4', snow: '#e9f5f7', trunk: '#8a532e', trunkDark: '#5a341f' },
    fog: '#bfe3f2', snow: true,
  },
  cave: {
    ambient: [0.3, 0.36, 0.48], grade: { tint: [0.92, 1, 1.12], saturation: 1.1, contrast: 1.1 },
    rock: ['#0c1820', '#1e3542', '#335666', '#4a7686'], cap: ['#3f6b80', '#6fa8bf', '#a9d6e6', '#e0f6ff'],
    bank: ['#8fc3d6', '#2a4b5c', '#34596b'], crystal: ['#1f5f78', '#62b3cf', '#a9e3f0', '#effcff'],
    near: { dark: '#0e2230', mid: '#1a3a4c', light: '#2a5468', high: '#3d7086', snow: '#6fb0c8', trunk: '#1a3a4c', trunkDark: '#0e2230' },
    fog: '#1a2f42', snow: false,
  },
  ruins: {
    ambient: [0.82, 0.72, 0.84], grade: { tint: [1.06, 0.98, 1], saturation: 1, contrast: 1.06 },
    rock: ['#1c1224', '#3b2e45', '#4f3f59', '#6e5c7a'], cap: ['#b39ab0', '#d9c8d8', '#efe6ef', '#ffffff'],
    bank: ['#efe0ea', '#b89ab0', '#cdb4c6'], pine: { dark: '#3a2a48', mid: '#4f3f5c', light: '#5f4f6c', high: '#76667f', snow: '#efe0ea', trunk: '#3a2a48', trunkDark: '#2a1f36' },
    near: { dark: '#1c1224', mid: '#3b2e45', light: '#4f3f59', high: '#6e5c7a', snow: '#efe6ef', trunk: '#3b2e45', trunkDark: '#1c1224' },
    fog: '#d98a6e', snow: true,
  },
  // Thin air high on the mountain: pale rock, deep snow and a hard cold light
  peaks: {
    ambient: [1, 1, 1], grade: { tint: [0.99, 1.01, 1.07], saturation: 0.95, contrast: 1.08 },
    rock: ['#16202a', '#2c3f4e', '#4a6478', '#63849a'], cap: ['#9fc6d8', '#cfe6f0', '#eef7fb', '#ffffff'],
    bank: ['#e8f4f8', '#b8d6e4', '#cbe3ec'], pine: HAZY_PINE,
    near: { dark: '#1b3a4a', mid: '#2a5468', light: '#3d7086', high: '#56949f', snow: '#e9f5f7', trunk: '#3a6272', trunkDark: '#26404e' },
    fog: '#cfe8f5', snow: true,
  },
  // Night over the lake, lit only by the sky and what glows under the ice
  lake: {
    ambient: [0.55, 0.62, 0.8], grade: { tint: [0.94, 0.99, 1.14], saturation: 1.08, contrast: 1.06 },
    rock: ['#0b1420', '#182838', '#2b4055', '#3e5a74'], cap: ['#4f7f9c', '#88b8d0', '#bfe0ef', '#eafaff'],
    bank: ['#cfe8f4', '#33607c', '#42748f'], pine: { dark: '#0e2230', mid: '#173648', light: '#204a5e', high: '#2d6274', snow: '#8fc0d4', trunk: '#173648', trunkDark: '#0e2230' },
    near: { dark: '#08121c', mid: '#112232', high: '#254256', light: '#1a3244', snow: '#6fa8c0', trunk: '#112232', trunkDark: '#08121c' },
    crystal: ['#1f5f78', '#62b3cf', '#a9e3f0', '#effcff'],
    fog: '#14243a', snow: true,
  },
}

// Parallax layers from the sky to the foreground. Factor is how much they follow the camera, fog fades far ones into the haze.
function layers(stage) {
  const { theme } = stage
  const c = THEMES[theme]
  const cave = theme === 'cave'
  const far = { forest: FAR, cave: CAVE_FAR, ruins: DUSK_FAR, peaks: FAR, lake: CAVE_FAR }[theme]
  return [
    { canvas: sky(SKIES[theme]), factor: 0, density: 1, stretch: true },
    ...cave ? [] : [{ canvas: clouds(7), factor: 0.04, drift: 4, density: 1, fog: 0.1 }],
    { canvas: mountains(11, 6, 20, 75, 0.95, far), factor: 0.1, density: 1, fog: 0.3 },
    { canvas: theme === 'ruins' ? castle(23) : mountains(23, 8, 70, 115, 1.15, { cave: CAVE_NEAR, lake: CAVE_NEAR, peaks: PEAK_NEAR }[theme] ?? NEAR), factor: 0.22, density: 1, fog: 0.2 },
    { canvas: cave ? ceiling(31) : cliffs(31), factor: 0.4, density: 1, fog: 0.12 },
    { canvas: mist(5), factor: 0.5, drift: 10, density: 2, alpha: cave ? 0.12 : 0.3, top: 400 },
    // Little grows high on the mountain or out on the lake, so their banks stay almost bare
    { canvas: bank(57, theme, 480, { step: { cave: 90, peaks: 150, lake: 110 }[theme] ?? 30, h: cave ? 80 : 70 }, { ...c, pine: c.pine }), factor: 0.62, density: 2, fog: 0.06, sway: 1 },
    { canvas: bank(91, theme, 540, { step: { cave: 160, peaks: 280, lake: 220 }[theme] ?? 110, h: cave ? 110 : 150, walls: true }, { ...c, bank: [c.cap[3], c.cap[1], c.cap[2]], pine: c.near, crystal: THEMES.cave.crystal }), factor: 0.82, density: 2, fog: 0.18, sway: 1.5 },
  ]
}

// Tiles are painted once per look into an atlas. Solid tiles know which sides are open to the air and how deep they are.
const TILE_ART = TILE * DENSITY

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16

function tilePixel(theme, { char, up, down, left, right, depth, variant, level }, x, y) {
  const c = THEMES[theme]
  if (char === '=') return platformPixel(theme, left, right, x, y)
  // Chasms fall into darkness below the ground
  if (char === 'abyss') return bayer(x, y) < Math.min(1, (level * TILE_ART + y) / 40) ? '#04070b' : c.rock[0]
  // Round corners where the top meets an open side
  if (up && ((left && x + y < 3) || (right && 31 - x + y < 3))) return
  const wave = Math.round(Math.sin(x / TILE_ART * Math.PI * 2) * 2 + Math.sin(x / TILE_ART * Math.PI * 6 + 1) * 1.5)
  // Snow lies thick on top and drips down over the rock in a few places
  const drip = Math.max(0, Math.round(Math.sin(x / TILE_ART * Math.PI * 4 + 2) * 6 - 2))
  // Some tops carry a snowdrift
  const cap = 11 + wave + drip + (variant === 2 && theme !== 'cave' ? Math.round(Math.sin(x / TILE_ART * Math.PI) * 5) : 0)
  if (char === '~' && y < 12) return y === 0 ? '#ffffff' : '#1d4f6ecc'
  if (up && char === '#' && y < cap) return y === 0 ? c.cap[0] : y < 4 ? c.cap[3] : y < cap - 2 ? ((x * 3 + y) % 11 === 0 ? c.cap[1] : c.cap[2]) : c.cap[1]
  const rock = depth > 1 ? [c.rock[0], c.rock[0], c.rock[1], c.rock[2]] : c.rock
  if (up && y < cap + 2) return rock[0]
  if (left && x < 2) return x === 0 ? rock[0] : rock[3]
  if (right && x > 29) return rock[0]
  if (down && y > 29) return y === 31 ? rock[0] : rock[1]
  // Roots run through the forest ground under the snow
  if (theme === 'forest' && up && variant === 1 && y > cap + 2 && y < 26 && Math.abs(y - 18 - Math.sin(x * 0.3) * 3) < 0.8) return x % 9 < 5 ? '#4a2c16' : rock[0]
  return fillPixel(theme, rock, variant, x, y)
}

function fillPixel(theme, rock, variant, x, y) {
  if (theme === 'cave') {
    const facet = (x * 2 + y * 3 + variant * 5) % 23
    if (facet === 0) return rock[0]
    if (hash(x >> 2, y >> 2, variant) > 0.9) return THEMES.cave.crystal[1]
    return facet < 8 ? rock[3] : facet < 15 ? rock[2] : rock[1]
  }
  // Stones in the forest, bricks in the ruins, offset every other row
  const [bw, bh] = theme === 'ruins' ? [16, 8] : [16, 12]
  const row = Math.floor(y / bh), shift = row & 1 ? bw / 2 : 0
  const lx = (x + shift) % bw, ly = y % bh
  if (lx === 0 || ly === 0) return rock[0]
  const shade = hash(Math.floor((x + shift) / bw), row, variant)
  if (lx === 1 || ly === 1) return rock[3]
  if (lx === bw - 1 || ly === bh - 1) return rock[1]
  if (theme === 'ruins' && shade > 0.8 && ly > bh - 4) return '#4a5e34'
  // Broken bricks leave dark gaps and rubble in the ruins
  if (theme === 'ruins' && variant === 1 && shade < 0.25) return ly > bh / 2 && dither(x, y) ? rock[2] : rock[0]
  return shade > 0.5 ? rock[2] : dither(x, y) && shade > 0.3 ? rock[2] : rock[1]
}

// Wooden planks in the forest, ice ledges in the cave and stone slabs in the ruins, with supports at open ends
function platformPixel(theme, left, right, x, y) {
  const c = THEMES[theme]
  const ends = (left && x < 3) || (right && x > 28)
  if (y > 12) {
    if (theme === 'cave') return y < 12 + (hash(x >> 1, 0, 3) * 8) && x % 5 < 2 ? c.crystal[2] : undefined
    return ends && y < 20 && x % 32 > 0 && x < 31 ? '#3a2210' : undefined
  }
  if (y === 0) return theme === 'ruins' ? c.cap[3] : '#ffffff'
  if (y < 3) return theme === 'cave' ? c.crystal[3] : c.cap[2]
  if (y === 12) return INK
  if (theme === 'cave') return x % 9 === 0 ? c.crystal[1] : c.crystal[2]
  if (theme === 'ruins') return x % 16 === 0 ? c.rock[0] : y < 6 ? c.rock[3] : c.rock[2]
  return x % 16 === 0 ? '#3a2210' : y % 4 === 3 ? '#6a4220' : y < 6 ? '#b07a44' : '#8a5a2b'
}

// Glossy ice laid over reflections, drawn after them
function icePixel(x, y, cracked) {
  if (y >= 12) return
  if (y === 0) return '#ffffff'
  if (cracked && (Math.abs(y - 3 - Math.abs(((x * 0.7) % 12) - 6)) < 0.8 || (x % 11 === 4 && y > 4))) return '#ffffffdd'
  if ((x - y * 2 + 64) % 29 < 2) return '#ffffffaa'
  return y < 3 ? '#dff6ffaa' : '#8fd3ea66'
}

function tiles(map, theme) {
  const keys = new Map(), back = [], front = []
  const at = (tx, ty) => tx < 0 || tx >= map.cols ? '#' : map.tiles[ty]?.[tx] ?? '.'
  // Ice blocks are drawn on top of the tiles instead, so the floor under them is already open here
  const solidAt = (tx, ty) => ['#', '~', 'I'].includes(at(tx, ty))
  // Top of the ground of the nearest solid column on either side of a chasm column
  const top = tx => map.tiles.findIndex((row, ty) => ty > 8 && solidAt(tx, ty))
  const edgeTop = tx => {
    let left = tx, right = tx
    while (left > 0 && map.tiles[map.rows - 1][left] === '.') left--
    while (right < map.cols - 1 && map.tiles[map.rows - 1][right] === '.') right++
    return Math.min(top(left), top(right))
  }
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      const char = map.tiles[ty][tx]
      // Empty tiles of a chasm, from the height of the ground beside it down to the bottom of the map
      const pit = map.tiles[map.rows - 1][tx] === '.' && char === '.' && ty >= edgeTop(tx)
      if ((char === '.' || char === 'X') && !pit) continue
      const tile = pit ? { char: 'abyss', level: Math.min(2, ty - edgeTop(tx)) } : char === '=' ? { char, left: at(tx - 1, ty) !== '=', right: at(tx + 1, ty) !== '=' }
        : { char, up: !solidAt(tx, ty - 1), down: ty < map.rows - 1 && !solidAt(tx, ty + 1), left: !solidAt(tx - 1, ty), right: !solidAt(tx + 1, ty), depth: solidAt(tx, ty - 1) + solidAt(tx, ty - 2), variant: Math.floor(hash(tx, ty, 9) * 3) }
      const key = JSON.stringify(tile)
      if (!keys.has(key)) keys.set(key, tile)
      back.push([tx * TILE, ty * TILE, key])
      if (char === '~' || char === 'I') front.push([tx * TILE, ty * TILE, hash(tx, ty, 4) < 0.3 ? 'crackedIce' : 'ice'])
    }
  }
  const animations = Object.fromEntries([...keys].map(([key, tile]) => [key, [ctx => {
    ctx.drawImage(paint(TILE_ART, TILE_ART, (x, y) => tilePixel(theme, tile, x, y)), 0, 0)
  }]]))
  animations.ice = [ctx => ctx.drawImage(paint(TILE_ART, TILE_ART, (x, y) => icePixel(x, y, false)), 0, 0)]
  animations.crackedIce = [ctx => ctx.drawImage(paint(TILE_ART, TILE_ART, (x, y) => icePixel(x, y, true)), 0, 0)]
  return { sheet: plainSheet(TILE_ART, TILE_ART, animations), back, front }
}

// A block of ice set into the floor and the hole left where the sheet was shattered, both drawn over the tiles
export function buildTilePatches() {
  const size = TILE_ART
  return plainSheet(size, size, {
    block: [ctx => ctx.drawImage(paint(size, size, (x, y) => {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y)
      if (edge === 0) return THEMES.cave.crystal[0]
      if (x < 3 || y < 3) return THEMES.cave.crystal[3]
      return (x * 3 + y * 5) % 29 < 3 ? THEMES.cave.crystal[2] : THEMES.cave.crystal[1]
    }), 0, 0)],
    hole: [ctx => ctx.drawImage(paint(size, size, (x, y) => {
      const rim = 2 + Math.round(Math.sin(x * 0.6) * 1.5)
      if (y < rim) return y < rim - 1 ? '#dff6ff' : '#8fd3ea'
      return (x * 7 + y * 3) % 31 === 0 ? '#12384f' : y > size - 6 ? '#020509' : '#061626'
    }), 0, 0)],
  })
}

// A sheet without outlines, frames drawn from the top left corner
function plainSheet(cellW, cellH, animations) {
  const names = Object.keys(animations)
  const cols = 16
  const count = names.reduce((sum, name) => sum + animations[name].length, 0)
  const canvas = makeCanvas(cols * cellW, Math.ceil(count / cols) * cellH)
  const frames = {}
  let i = 0
  for (const name of names) {
    frames[name] = animations[name].map(draw => {
      const x = (i % cols) * cellW, y = Math.floor(i / cols) * cellH
      i++
      const cell = makeCanvas(cellW, cellH)
      draw(cell.getContext('2d'))
      canvas.getContext('2d').drawImage(cell, x, y)
      return { x, y }
    })
  }
  return { canvas, frames, cellW, cellH, originX: 0, originY: 0 }
}

// Props standing on the ground, drawn with the same tools as the characters
const PROP_ART = {
  boulder: v => ctx => shape(ctx, [0, -14], 30, 0, (lx, ly) => {
    const n = Math.hypot(lx / (22 + v * 4), ly / (14 + v * 2)) + (noise(lx, ly, 6, v) - 0.5) * 0.25
    if (n > 1 || ly > 13) return
    if (ly < -6 && noise(lx, ly, 5, v + 3) > 0.45) return ly < -10 ? '#ffffff' : '#d2e3ea'
    return ball(['#1d2226', '#31373b', '#5d666b', '#7f898e'], lx / 22, ly / 14, n)
  }),
  stump: () => ctx => {
    limb(ctx, [0, 0], [0, -18], 18, 16, ['#2e1a0e', '#5a3418', '#8a5a2b', '#b07a44'])
    shape(ctx, [0, -20], 12, 0, (lx, ly) => Math.abs(lx) < 8 && Math.abs(ly) < 3 && (Math.abs(ly) > 2 ? '#ffffff' : '#e4f1f6'))
  },
  bones: () => ctx => {
    limb(ctx, [-18, -2], [8, -4], 4, 4, ['#6e6450', '#b9ad8c', '#e8e0c8', '#fbf7ea'])
    shape(ctx, [14, -7], 10, 0, (lx, ly) => Math.hypot(lx, ly) < 7 && (lx > 1 && lx < 4 && ly < 0 && ly > -3 ? '#1a1410' : ball(['#6e6450', '#b9ad8c', '#e8e0c8', '#fbf7ea'], lx / 7, ly / 7, Math.hypot(lx, ly) / 7)))
    limb(ctx, [-6, -4], [-12, -16], 3, 2, ['#6e6450', '#b9ad8c', '#e8e0c8', '#fbf7ea'])
  },
  cart: () => ctx => {
    shape(ctx, [0, -24], 44, -0.12, (lx, ly) => Math.abs(lx) < 36 && Math.abs(ly) < 10 && (ly < -8 ? '#ffffff' : Math.abs(lx) > 34 || Math.abs(ly) > 8 ? '#2e1a0e' : (Math.round(ly) % 5 === 0 ? '#5a3418' : '#8a5a2b')))
    for (const x of [-22, 20]) shape(ctx, [x, -10], 12, 0, (lx, ly) => {
      const n = Math.hypot(lx, ly)
      return n < 10 && (n > 8 || Math.abs(lx) < 1 || Math.abs(ly) < 1) && '#3a2210'
    })
  },
  rubble: v => ctx => {
    for (let i = 0; i < 4; i++) shape(ctx, [-18 + i * 12, -5 - (i % 2) * 3], 8, i * 0.7 + v, (lx, ly) => Math.abs(lx) < 6 && Math.abs(ly) < 4 && (ly < -2 ? '#efe6ef' : lx < 0 ? '#6e5c7a' : '#4f3f59'))
  },
  crystal: v => ctx => crystalCluster(ctx, 0, 0, 0.5 + v * 0.2, rng(40 + v), THEMES.cave.crystal),
  stalagmite: v => ctx => shape(ctx, [0, -30], 34, 0, (lx, ly) => {
    const half = (ly + 30) * (0.18 + v * 0.03)
    return ly < 30 && ly > -30 && Math.abs(lx) < half && (lx < -half * 0.4 ? '#4a7686' : lx > half * 0.5 ? '#0c1820' : '#335666')
  }),
  statue: () => ctx => {
    limb(ctx, [0, 0], [0, -12], 30, 30, ['#1c1224', '#3b2e45', '#6e5c7a', '#8f7c9a'])
    limb(ctx, [0, -14], [0, -50], 14, 12, ['#1c1224', '#4f3f59', '#76667f', '#9a8aa6'])
    limb(ctx, [0, -30], [14, -58], 5, 4, ['#1c1224', '#4f3f59', '#76667f', '#9a8aa6'])
    shape(ctx, [0, -58], 8, 0, (lx, ly) => Math.hypot(lx, ly) < 6 && ball(['#1c1224', '#4f3f59', '#76667f', '#efe6ef'], lx / 6, ly / 6, Math.hypot(lx, ly) / 6))
  },
  pillar: v => ctx => shape(ctx, [0, -40], 44, 0, (lx, ly) => {
    const top = -40 + (v + 1) * 8 + noise(lx, 0, 4, v) * 12
    if (Math.abs(lx) > 11 || ly < top || ly > 40) return
    if (ly < top + 3) return '#efe6ef'
    if (Math.round(ly) % 22 === 0) return '#2a1f36'
    return lx < -7 ? '#8f7c9a' : lx > 7 ? '#3b2e45' : Math.round(lx) % 5 === 0 ? '#4f3f59' : '#6e5c7a'
  }),
}

// Animated props: flickering torches, banners in the wind, a campfire and grass bending away from passing feet
const torch = t => ctx => {
  limb(ctx, [0, 0], [0, -34], 4, 3, ['#2e1a0e', '#5a3418', '#8a5a2b', '#b07a44'])
  const flicker = Math.sin(t * Math.PI * 2) * 1.5
  shape(ctx, [0, -42], 10, 0, (lx, ly) => {
    const half = 4.5 - (-ly - flicker) * 0.5
    return ly < 5 && ly > -9 - flicker && Math.abs(lx + Math.sin(t * 6.3 + ly) * 0.8) < half && (Math.abs(lx) < half * 0.4 && ly > -2 ? '#fff2a8' : ly > 0 ? '#f07a19' : '#f0c419')
  })
}
const banner = t => ctx => {
  limb(ctx, [0, 0], [0, -64], 3, 3, ['#1c1224', '#3b2e45', '#6e5c7a', '#8f7c9a'])
  shape(ctx, [10, -48], 24, 0, (lx, ly) => {
    const wave = Math.sin(lx * 0.35 - t * Math.PI * 2) * 2 * (lx + 10) / 20
    return lx > -10 && lx < 12 && ly > -14 + wave && ly < 10 + wave - Math.max(0, lx - 4) && (Math.abs(ly - wave) < 2 ? '#e2c070' : '#7d1b22')
  })
}
const campfire = t => ctx => {
  for (const a of [-0.5, 0.5]) limb(ctx, [-12 * Math.sign(a), 0], [10 * Math.sign(a), -6], 5, 5, ['#2e1a0e', '#5a3418', '#8a5a2b', '#b07a44'])
  shape(ctx, [0, -14], 16, 0, (lx, ly) => {
    const half = 8 - (-ly) * 0.45 + Math.sin(t * 6.3 + ly * 0.8) * 1.2
    return ly < 8 && ly > -16 && Math.abs(lx) < half && (Math.abs(lx) < half * 0.4 && ly > -4 ? '#fff2a8' : ly > -2 ? '#f07a19' : '#f0c419')
  })
}
const grass = bend => ctx => {
  for (const [x, h] of [[-5, 12], [-1, 16], [3, 13], [6, 9]]) limb(ctx, [x, 0], [x + bend * 5 + (x * 0.2), -h + Math.abs(bend) * 3], 2, 1, ['#3e5a3a', '#4a6a44', '#8aa878', '#c8dcc0'])
}

export function buildProps() {
  const set = (name, count) => Object.fromEntries(Array.from({ length: count }, (_, v) => [`${name}${v}`, [PROP_ART[name](v)]]))
  return sheet(96, 96, 48, 88, {
    ...set('boulder', 3), ...set('stump', 1), ...set('bones', 1), ...set('cart', 1), ...set('rubble', 2),
    ...set('crystal', 3), ...set('stalagmite', 2), ...set('statue', 1), ...set('pillar', 3),
    torch: [0, 0.25, 0.5, 0.75].map(torch),
    banner: [0, 0.25, 0.5, 0.75].map(banner),
    campfire: [0, 0.25, 0.5, 0.75].map(campfire),
    grass: [-2, -1, 0, 1, 2].map(b => grass(b / 2)),
  })
}

// Big pines of the forest, standing right behind the path
export function buildTrees() {
  return sheet(200, 420, 100, 416, Object.fromEntries([0, 1, 2].map(v => [`pine${v}`, [ctx => pine(ctx, 0, 0, 250 + v * 50, rng(70 + v), THEMES.forest.near)]])))
}

// Props scattered over the ground of a stage from its seed. Lights come with torches, crystals and campfires.
function decorate(map, theme, seed) {
  const r = rng(seed), props = [], trees = [], grasses = [], animated = [], lights = []
  const spawnNear = x => map.spawns.some(s => (s.kind === 'board' || s.kind === 'merchant' || s.kind === 'hero') && Math.abs(s.x - x) < 40)
  const pick = list => list[Math.floor(r() * list.length)]
  let lastTree = -1000
  for (let tx = 1; tx < map.cols - 1; tx++) {
    for (let ty = 1; ty < map.rows; ty++) {
      const char = map.tiles[ty][tx]
      if ((char !== '#' && char !== '~') || map.tiles[ty - 1][tx] !== '.') continue
      const x = tx * TILE + 8, y = ty * TILE, roll = r()
      const dir = r() < 0.5 ? -1 : 1
      if (theme === 'forest') {
        if (roll < 0.14 && x - lastTree > 90 && !spawnNear(x)) {
          trees.push([x, y + 4, pick(['pine0', 'pine1', 'pine2']), dir])
          lastTree = x
        } else if (roll < 0.22) props.push([x, y + 3, pick(['boulder0', 'boulder1', 'boulder2']), dir])
        else if (roll < 0.24) props.push([x, y + 2, 'stump0', dir])
        else if (roll < 0.255) props.push([x, y + 1, 'bones0', dir])
        else if (roll < 0.26) props.push([x, y + 2, 'cart0', dir])
      } else if (theme === 'cave') {
        if (roll < 0.08) {
          props.push([x, y + 2, pick(['crystal0', 'crystal1', 'crystal2']), dir])
          lights.push({ x, y: y - 10, radius: 70, color: [0.35, 0.8, 1], flicker: 0 })
        } else if (roll < 0.16) props.push([x, y + 2, pick(['stalagmite0', 'stalagmite1']), dir])
        else if (roll < 0.18) props.push([x, y + 1, 'bones0', dir])
      } else if (theme === 'ruins') {
        if (roll < 0.07 && !spawnNear(x)) props.push([x, y + 2, pick(['pillar0', 'pillar1', 'pillar2']), dir])
        else if (roll < 0.16) props.push([x, y + 2, pick(['rubble0', 'rubble1']), dir])
        else if (roll < 0.175) props.push([x, y + 2, 'statue0', dir])
        else if (roll < 0.2) animated.push([x, y, 'banner', dir])
      } else if (theme === 'peaks') {
        if (roll < 0.14) props.push([x, y + 3, pick(['boulder0', 'boulder1', 'boulder2']), dir])
        else if (roll < 0.22) props.push([x, y + 2, pick(['stalagmite0', 'stalagmite1']), dir])
        else if (roll < 0.24) props.push([x, y + 1, 'bones0', dir])
      } else {
        // Crystals frozen into the lake glow up through the sheet
        if (roll < 0.07) {
          props.push([x, y + 2, pick(['crystal0', 'crystal1', 'crystal2']), dir])
          lights.push({ x, y: y - 10, radius: 70, color: [0.35, 0.8, 1], flicker: 0 })
        } else if (roll < 0.13) props.push([x, y + 2, pick(['stalagmite0', 'stalagmite1']), dir])
        else if (roll < 0.15) props.push([x, y + 1, 'bones0', dir])
      }
      if ((theme === 'forest' || theme === 'ruins') && r() < 0.3) grasses.push([x + (r() - 0.5) * 12, y + 1])
      break
    }
  }
  // Torches light the way next to every merchant and the quest board in dark places
  if (theme !== 'forest') for (const s of map.spawns.filter(s => s.kind === 'merchant' || s.kind === 'board')) {
    animated.push([s.x + 26, s.y, 'torch', 1])
    lights.push({ x: s.x + 26, y: s.y - 44, radius: 120, color: [1, 0.7, 0.35], flicker: 1 })
  }
  return { props, trees, grasses, animated, lights }
}

// Everything painted for one stage when it is entered
export function buildStage(stage, map) {
  const { theme } = stage
  return {
    theme: THEMES[theme],
    top: SKIES[theme][0],
    layers: layers(stage),
    foreground: { canvas: foreground(13, theme), factor: 1.35, density: 2 },
    tiles: tiles(map, theme),
    ...decorate(map, theme, { forest: 42, cave: 17, ruins: 71, peaks: 88, lake: 55 }[theme]),
  }
}

// Illustrated boards for the narrator in story scenes, painted from the same pieces as the stage backgrounds
export function buildBoards() {
  const w = 320, h = 160
  const board = (bands, draw) => {
    const canvas = makeCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(paint(w, h, (x, y) => {
      const t = y / h * bands.length
      const i = Math.min(bands.length - 1, Math.floor(t))
      return t - i > 0.7 && dither(x, y) ? bands[Math.min(bands.length - 1, i + 1)] : bands[i]
    }), 0, 0)
    draw(ctx, rng(w))
    return canvas
  }
  const snowfall = (ctx, r, count, slant) => {
    for (let i = 0; i < count; i++) {
      const x = r() * w, y = r() * h
      limb(ctx, [x, y], [x + slant, y + 2], 1, 1, ['#ffffff', '#eaf6fb', '#ffffff', '#ffffff'])
    }
  }
  return {
    // The last sunset over the valley and the village under the snow
    valley: board(['#2a1a3a', '#4a2a50', '#7a3a58', '#b05a5a', '#e08a60'], (ctx, r) => {
      shape(ctx, [160, 92], 30, 0, (lx, ly) => Math.hypot(lx, ly) < 26 && ly < 0 && (Math.hypot(lx, ly) < 20 ? '#ffe0a0' : '#ffb070'))
      ctx.drawImage(mountains(11, 6, 20, 75, 0.95, DUSK_FAR), 0, 30, 640, 150, 0, 60, 320, 75)
      ctx.drawImage(paint(w, 40, (x, y) => y > noise(x, 0, 30, 3) * 10 && (y < 2 + noise(x, 0, 30, 3) * 10 ? '#f0d4d0' : '#c49aac')), 0, 120)
      for (const [x, s] of [[40, 1], [70, 0.8], [230, 1.1], [270, 0.9]]) {
        const roof = 14 * s
        ctx.drawImage(paint(40, 30, (px, py) => {
          const dx = Math.abs(px - 20)
          if (py < roof && dx <= py * 1.1 + 1) return py < 4 || dx > py * 1.1 - 2 ? '#ffffff' : '#3a2a3a'
          if (py >= roof && py < roof + 12 && dx < roof * 0.8) return dx < 3 && py > roof + 3 && py < roof + 8 ? '#ffd86a' : '#2a1a2a'
        }), x - 20, 128 - roof - 12)
      }
      snowfall(ctx, r, 60, 0)
    }),
    seekers: seekersBoard(),
    // A bare ridge over a sea of peaks, the wind tearing a plume of snow off the summit
    peaks: board(['#0b4f8c', '#1268ab', '#1d85c9', '#36a2e2'], (ctx, r) => {
      ctx.drawImage(mountains(11, 6, 20, 75, 0.95, FAR), 0, 20, 640, 160, 0, 36, 320, 80)
      ctx.drawImage(mountains(23, 5, 40, 95, 1.2, PEAK_NEAR), 0, 30, 640, 180, 0, 66, 320, 90)
      const ridge = x => 16 + Math.sin(x * 0.018) * 9 + noise(x, 0, 40, 9) * 8
      ctx.drawImage(paint(w, 60, (x, y) => {
        const edge = ridge(x)
        if (y < edge) return
        return y < edge + 2 ? '#ffffff' : y < edge + 8 ? '#cfe6f0' : (x * 3 + y * 5) % 23 === 0 ? '#2c3f4e' : '#4a6478'
      }), 0, 116)
      // A lone seeker on the ridge, leaning into the wind the snow is blowing with
      blit(ctx, posed(SEEKER, {
        legF: [0.5, 0.55], legB: [-0.45, 0.2], armF: [0.55, 0.8], armB: [-0.5, 1.0], lean: 0.35, head: 0.1, wave: 0.4,
      }), [104, 118 + Math.round(ridge(104)) + 3], 0.42)
      snowfall(ctx, r, 90, -4)
    }),
    // The Winter Queen on her frozen lake under the northern lights
    // Whispering crystals glowing in the dark of the cave
    crystals: board(['#050a10', '#0a141e', '#0e1c2a', '#122436'], (ctx, r) => {
      ctx.drawImage(ceiling(31), 0, 0, 960, 120, 0, 0, 320, 40)
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1)
      shape(ctx, [160, 120], 90, 0, (lx, ly) => Math.hypot(lx, ly * 1.8) < 80 && dither(Math.round(lx), Math.round(ly)) && Math.hypot(lx, ly * 1.8) > 30 && '#1d4a60')
      for (const [x, size] of [[80, 0.6], [160, 1.3], [240, 0.8], [120, 0.4], [205, 0.5]]) crystalCluster(ctx, x, 150, size, rng(x), THEMES.cave.crystal)
      ctx.drawImage(paint(w, 12, (x, y) => (y > noise(x, 0, 20, 2) * 6) && (y < 2 ? '#6fa8bf' : '#0c1820')), 0, 148)
    }),
    // The ruined castle against the dusk, one lit window in the tower
    castle: board(['#2a1a3a', '#4a2a50', '#7a3a58', '#b05a5a'], (ctx, r) => {
      ctx.drawImage(mountains(11, 6, 20, 75, 0.95, DUSK_FAR), 0, 30, 640, 150, 0, 40, 320, 75)
      ctx.drawImage(castle(23), 0, 70, 640, 290, 0, 78, 320, 145)
      shape(ctx, [150, 90], 4, 0, (lx, ly) => Math.abs(lx) < 1.5 && Math.abs(ly) < 3 && '#ffb040')
      snowfall(ctx, r, 50, -1)
    }),
    queen: board(['#050a18', '#0a1428', '#102038', '#18304a'], (ctx, r) => {
      ctx.drawImage(paint(w, 70, (x, y) => {
        const wave = 20 + Math.sin(x * 0.03) * 12 + Math.sin(x * 0.011 + 1) * 10
        const d = Math.abs(y - wave)
        return d < 6 && (d < 2 ? '#8ff0c0' : dither(x, y) ? '#3ab08a' : undefined)
      }), 0, 0)
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(r() * w), Math.floor(r() * 60), 1, 1)
      shape(ctx, [250, 80], 50, 0, (lx, ly) => {
        const spire = Math.abs(lx) < 14 - ly * 0.0 && ly > -40 + Math.abs(lx) * 2.5 && ly < 30
        const side = Math.abs(Math.abs(lx) - 22) < 6 && ly > -15 + Math.abs(Math.abs(lx) - 22) * 2.5 && ly < 30
        return (spire || side) && (lx < -2 ? '#bfe8f8' : '#6fb0d0')
      })
      ctx.drawImage(paint(w, 50, (x, y) => (x * 3 + y * 7) % 23 === 0 ? '#dff6ff' : y < 2 ? '#8fd3ea' : y % 6 === 0 ? '#3a6a88' : '#2a5470'), 0, 110)
      // The queen stands on the ice in a trailing gown, mirrored faintly under her feet
      humanoid(ctx, QUEEN, { x: 120, y: 138, legF: [0.1, 0.1], legB: [-0.1, 0.1], armF: [0.15, 0.25], armB: [-0.15, 0.25] })
      shape(ctx, [120, 148], 16, 0, (lx, ly) => Math.abs(lx) < 10 - ly * 0.5 && ly > -4 && ly < 12 && dither(lx + 120, ly) && '#0a1020')
    }),
  }
}

// A board body posed with the character rig at full size in its own cell, so it can be blitted down
// to whatever the distance calls for and the whole figure shrinks together. Joints come back in cell pixels.
const posed = (look, pose) => {
  const cell = makeCanvas(96, 104)
  const ctx = cell.getContext('2d')
  ctx.translate(48, 96)
  return { cell, ...humanoid(ctx, look, pose).anchors }
}

const blit = (ctx, { cell }, [x, y], scale) =>
  ctx.drawImage(cell, 0, 0, 96, 104, Math.round(x - 48 * scale), Math.round(y - 96 * scale), Math.round(96 * scale), Math.round(104 * scale))

// Cloaked travellers with packs, drawn with the character rig as dark shapes against the snow
const DUSK = ['#0e151d', '#141e29', '#1b2835', '#2c3d4f']
const SEEKER = {
  thigh: 12, shin: 13, torso: 20, shoulder: 3, neck: 10, upper: 10, fore: 10, foot: 4,
  legW: [8, 7, 6], bootW: 7, armW: [7, 6, 5], handR: 2.8,
  ramps: { pants: DUSK, boots: DUSK, sleeve: DUSK, hand: DUSK },
  back: { pants: DUSK, boots: DUSK, sleeve: DUSK, hand: DUSK },
  // A pack on the back with a rolled blanket on top
  behindArm(ctx, { chest, lean }) {
    shape(ctx, [chest[0] - 9 - lean * 6, chest[1] + 9], 12, lean, (lx, ly) => (Math.abs(lx) < 6 && Math.abs(ly) < 9) || (Math.abs(ly + 10) < 3 && Math.abs(lx) < 7) ? (lx < -4 ? DUSK[3] : DUSK[1]) : null)
  },
  // A long cloak flapping back in the wind
  body(ctx, { hip, chest, lean, pose }) {
    const center = [(hip[0] + chest[0]) / 2, (hip[1] + chest[1]) / 2 + 6]
    shape(ctx, center, 30, lean, (lx, ly) => {
      const half = 7 + Math.max(0, ly + 10) * 0.35
      const flap = ly > 0 ? Math.sin(ly * 0.4 + pose.wave * 6.3) * 2 - ly * 0.25 : 0
      if (ly < -14 || ly > 20 || lx < -half + flap || lx > half * 0.8) return
      return lx < -half + flap + 1.5 ? DUSK[3] : DUSK[1]
    })
  },
  face(ctx, { head, lean }) {
    shape(ctx, head, 12, lean, (lx, ly) => {
      const hood = Math.hypot(lx, ly) < 8.5 || (lx < -4 && lx > -11 && ly > -6 && ly < 2 - (lx + 4) * 0.4)
      return hood && (lx < -6 || ly < -6 ? DUSK[3] : DUSK[0])
    })
  },
}

// The Winter Queen, a dark figure in a gown trailing over the ice, crowned with spikes of it.
// Her rig is cut to board size, so she is drawn straight onto the board and keeps her one pixel wide details.
const GOWN = ['#050a14', '#0a1020', '#14243c', '#2e5a82']
const FLAT = ['#0a1020', '#0a1020', '#0a1020', '#0a1020']
// Spikes sit on the pixel centers left of the middle, so the gaps between them stay a pixel wide
const CROWN = [[-4.5, 3], [-2.5, 5], [-0.5, 7], [1.5, 5], [3.5, 3]]
const QUEEN = {
  thigh: 6, shin: 7, torso: 11, shoulder: 2, neck: 5, upper: 6, fore: 6, foot: 2,
  legW: [4, 3, 3], bootW: 3, armW: [4, 3, 2], handR: 1.6,
  // Limbs are flat, the gown covers them and only its own edges catch the light
  ramps: { pants: FLAT, boots: FLAT, sleeve: FLAT, hand: FLAT },
  back: { pants: FLAT, boots: FLAT, sleeve: FLAT, hand: FLAT },
  // A gown from the shoulders down to a train on the ice
  body(ctx, { hip, chest, lean }) {
    const center = [(hip[0] + chest[0]) / 2, (hip[1] + chest[1]) / 2 + 4]
    shape(ctx, center, 24, lean, (lx, ly) => {
      const half = 4.5 + Math.max(0, ly + 6) * 0.34
      if (ly < -9 || ly > 17 || Math.abs(lx) > half) return
      return lx < -half + 1.5 ? GOWN[3] : lx > half - 1.5 ? GOWN[0] : GOWN[1]
    })
  },
  // Hair falling around the face, eyes lit from within and a crown of ice spikes
  face(ctx, { head, lean }) {
    shape(ctx, head, 12, lean, (lx, ly) => {
      const spike = CROWN.some(([dx, high]) => ly < -3.5 && ly > -3.5 - high && Math.abs(lx - dx) < 0.6)
      if (spike || (ly > -4.2 && ly < -3.2 && lx > -5 && lx < 4)) return lx < 0 ? '#dff6ff' : '#8fd0e8'
      if (!(Math.abs(lx) < 3.2 - Math.max(0, ly) * 0.1 && ly > -4 && ly < 8) && Math.hypot(lx, ly) > 3.5) return
      if (Math.abs(Math.abs(lx) - 1.5) < 0.6 && ly > -1 && ly < 0.2) return '#8ff0ff'
      return lx < -2.5 ? GOWN[3] : Math.hypot(lx, ly) < 2.8 ? GOWN[1] : GOWN[0]
    })
  },
}

// Seekers walk away along a trail of footprints into the blizzard toward the mountains, the first one carries a torch
function seekersBoard() {
  const w = 640, h = 320, r = rng(81)
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const bands = ['#39475a', '#475669', '#586777', '#6a7a88', '#7e8d99', '#93a1ab']
  ctx.drawImage(paint(w, 190, (x, y) => {
    const t = y / 190 * bands.length, i = Math.min(bands.length - 1, Math.floor(t))
    return t - i > 0.65 && dither(x, y) ? bands[Math.min(bands.length - 1, i + 1)] : bands[i]
  }), 0, 0)
  ctx.globalAlpha = 0.55
  ctx.drawImage(mountains(23, 8, 70, 115, 1.15, FAR), 0, 50, 1280, 260, -40, 60, 720, 146)
  ctx.globalAlpha = 1
  // A nearer ridge and a band of fog rolling over it
  const ridge = x => 170 + Math.round(noise(x, 0, 90, 4) * 28 + noise(x, 0, 20, 5) * 6)
  ctx.drawImage(paint(w, 90, (x, y) => {
    const top = ridge(x) - 150
    if (y < top) return
    return y < top + 3 ? '#e8f2f6' : noise(x, y, 18, 6) > 0.6 ? '#9fb2bd' : '#b3c4cc'
  }), 0, 150)
  ctx.drawImage(paint(w, 60, (x, y) => {
    const n = noise(x, y, 40, 7) * (1 - Math.abs(y - 30) / 30)
    return n > 0.3 && (n > 0.42 || dither(x, y)) ? '#d9e4ea' : undefined
  }), 0, 170)
  // The snowfield in front with soft drifts
  const ground = x => 222 + Math.round(noise(x, 0, 120, 8) * 10)
  ctx.drawImage(paint(w, 110, (x, y) => {
    const top = ground(x) - 210
    if (y < top) return
    if (y < top + 2) return '#ffffff'
    const n = noise(x, y, 48, 9) + y * 0.003
    return n > 0.74 ? '#d3e0e7' : n > 0.62 && dither(x, y) ? '#dfe9ee' : '#eef5f8'
  }), 0, 210)
  // The trail curves from the near corner up to the far snow, people walk along it smaller with distance
  const trail = t => [40 + t * 450 + Math.sin(t * 3) * 40, 316 - t * 92]
  for (let t = 0.02; t < 0.95; t += 0.018) {
    const [x, y] = trail(t), side = Math.round(t / 0.018) % 2 ? 1 : -1, size = 3 - t * 2
    shape(ctx, [x, y + side * size * 1.5], 5, 0, (lx, ly) => Math.hypot(lx / size, ly / (size * 0.45)) < 1 && '#a9bcc7')
  }
  const walkers = [0.28, 0.42, 0.56, 0.7, 0.83]
  walkers.forEach((t, i) => {
    const [x, y] = trail(t), scale = 0.95 - t * 0.75, a = i * 1.7
    const leader = i === walkers.length - 1
    const body = posed(SEEKER, {
      legF: [0.6 * Math.sin(a), 0.3 + 0.9 * Math.max(0, -Math.cos(a))], legB: [-0.6 * Math.sin(a), 0.3 + 0.9 * Math.max(0, Math.cos(a))],
      armF: leader ? [2.1, 0.4] : [0.5 - 0.4 * Math.sin(a), 0.9], armB: [-0.4 + 0.4 * Math.sin(a), 0.9],
      lean: 0.3, head: 0.15, wave: i * 0.3,
    })
    const [hx, hy] = body.hand
    const torch = [x + hx * scale, y + hy * scale]
    // The torch throws warm light around, thinning out with distance
    if (leader) shape(ctx, torch, 70, 0, (lx, ly) => {
      const d = Math.hypot(lx, ly) / 70
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(Math.round(ly) & 3) * 4 + (Math.round(lx) & 3)] / 16
      return d < 1 && bayer < (1 - d) ** 1.5 * 0.8 && (d < 0.3 ? '#ffe6b8' : '#f3d9b6')
    })
    blit(ctx, body, [x, y], scale)
    if (leader) {
      limb(ctx, torch, [torch[0] + 2, torch[1] - 6], 3, 2, ['#3a2210', '#5a3418', '#8a5a2b', '#b07a44'])
      shape(ctx, [torch[0] + 2, torch[1] - 13], 12, 0, (lx, ly) => Math.abs(lx + ly * 0.3) < 5 + ly * 0.45 && ly < 6 && ly > -10 && (ly > 2 ? '#f07a19' : Math.abs(lx + ly * 0.3) < 2 ? '#fff2a8' : '#f0c419'))
    }
  })
  // Snow driven sideways by the wind, big flakes closest
  for (let i = 0; i < 260; i++) {
    const x = r() * w, y = r() * h, near = r() < 0.12, len = near ? 10 + r() * 8 : 3 + r() * 7
    limb(ctx, [x, y], [x - len, y + len * 0.35], near ? 2 : 1, near ? 2 : 1, near ? ['#ffffff', '#ffffff', '#ffffff', '#ffffff'] : ['#e6f0f5', '#e6f0f5', '#f4f9fb', '#ffffff'])
  }
  return canvas
}

// Every baked canvas is read back at least once, by outline(), normals() or a portrait cut. Reading a canvas the
// browser keeps on the GPU flushes its whole draw queue, and these are drawn a pixel at a time, so the read costs
// far more than the drawing. Asking for a CPU backed context here makes the whole bake many times faster.
export function makeCanvas(w, h) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d', { willReadFrequently: true })
    return canvas
}

export function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export function hash(x, y, seed) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h = Math.imul(h ^ (h >>> 16), 2246822519)
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

// Smooth value noise in [0, 1]. Tiles horizontally when period is a multiple of cell.
export function noise(x, y, cell, seed, period = 0) {
    const gx = x / cell, gy = y / cell
    const x0 = Math.floor(gx), y0 = Math.floor(gy)
    const n = period / cell
    const at = (i, j) => hash(n ? ((i % n) + n) % n : i, j, seed)
    const sx = (gx - x0) ** 2 * (3 - 2 * (gx - x0))
    const sy = (gy - y0) ** 2 * (3 - 2 * (gy - y0))
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx
    return top + (bottom - top) * sy
}

export const dither = (x, y) => (x + y) & 1

const rgbCache = {}
const rgb = hex => rgbCache[hex] ??= [1, 3, 5, 7].map(i => parseInt(hex.slice(i, i + 2) || 'ff', 16))

// Builds a canvas pixel by pixel, colorAt returns '#rrggbb', '#rrggbbaa' or nothing for transparent.
export function paint(w, h, colorAt) {
    const canvas = makeCanvas(w, h)
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const color = colorAt(x, y)
            if (!color) continue
            const c = rgb(color)
            const i = (y * w + x) * 4
            img.data[i] = c[0]
            img.data[i + 1] = c[1]
            img.data[i + 2] = c[2]
            img.data[i + 3] = c[3]
        }
    }
    ctx.putImageData(img, 0, 0)
    return canvas
}

export function dot(ctx, x, y, color) {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
}

// Paints a 1px outline around every opaque shape of the canvas.
export function outline(canvas, color) {
    const { width: w, height: h } = canvas
    const ctx = canvas.getContext('2d')
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0
    const edges = []
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edges.push((y * w + x) * 4)
    const [r, g, b] = rgb(color)
    for (const i of edges) d.set([r, g, b, 255], i)
    ctx.putImageData(img, 0, 0)
}

// Pixel drawing helpers relative to an origin. Scale draws the same shapes bigger.
export function painter(ctx, ox = 0, oy = 0, scale = 1) {
    const rect = (x, y, w, h, color) => {
        ctx.fillStyle = color
        ctx.fillRect(Math.round(ox + x * scale), Math.round(oy + y * scale), Math.ceil(w * scale), Math.ceil(h * scale))
    }
    const line = (x0, y0, x1, y1, color, size = 1) => {
        const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
        const half = Math.floor(size / 2)
        for (let i = 0; i <= n; i++) rect(x0 + (x1 - x0) * i / n - half, y0 + (y1 - y0) * i / n - half, size, size, color)
    }
    const disc = (cx, cy, r, color) => {
        for (let y = -r; y <= r; y++)
            for (let x = -r; x <= r; x++)
                if (x * x + y * y <= r * r + r) rect(cx + x, cy + y, 1, 1, typeof color === 'function' ? color(x, y) : color)
    }
    return { rect, line, disc }
}

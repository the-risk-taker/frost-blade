import { TILE } from './const.js'

// Map legend: . air, # rock, ~ ice, = platform that holds only from above, v icicle hanging from the ceiling.
// The other marks stand on the tile they are drawn in: @ hero start, B quest board, M merchant, c chest,
// w wolf, o ogre, a archer, s shaman, A Alpha, K Chief, 1-9 random group from the stage pool with that budget.
const MARKS = { '@': 'hero', B: 'board', M: 'merchant', v: 'trap', c: 'chest', w: 'wolf', o: 'ogre', a: 'archer', s: 'shaman', A: 'alpha', K: 'chief' }

export function parseMap(rows) {
    const spawns = []
    const tiles = rows.map((row, ty) => [...row].map((char, tx) => {
        const kind = MARKS[char] ?? (char > '0' && char <= '9' ? 'pool' : null)
        if (!kind) return char
        spawns.push({ kind, x: (tx + 0.5) * TILE, y: (kind === 'trap' ? ty : ty + 1) * TILE, budget: Number(char) })
        return '.'
    }))
    return { tiles, cols: rows[0].length, rows: rows.length, w: rows[0].length * TILE, h: rows.length * TILE, spawns }
}

// The map sides are walls, above and below it is open air
export function tileAt(map, x, y) {
    const tx = Math.floor(x / TILE)
    if (tx < 0 || tx >= map.cols) return '#'
    return map.tiles[Math.floor(y / TILE)]?.[tx] ?? '.'
}

export const solid = char => char === '#' || char === '~'
export const isSolid = (map, x, y) => solid(tileAt(map, x, y))
export const onIce = (map, b) => tileAt(map, b.x, b.y + 1) === '~'
export const onPlatform = (map, b) => tileAt(map, b.x, b.y + 1) === '='

// Points along a span, one for every tile it crosses
function samples(from, to) {
    const points = []
    for (let v = from + 0.01; v < to; v += TILE) points.push(v)
    return [...points, to - 0.01]
}

// Whether a body of w x h standing at (x, y) touches no solid tile
function fits(map, x, y, w, h) {
    return samples(x - w / 2, x + w / 2).every(sx => samples(y - h, y).every(sy => !isSolid(map, sx, sy)))
}

// Top of the first floor at or below y, or null over a chasm
export function groundBelow(map, x, y) {
    for (let ty = Math.max(0, Math.ceil(y / TILE)); ty < map.rows; ty++) if (tileAt(map, x, ty * TILE) !== '.') return ty * TILE
    return null
}

// Where a body put at (x, y) comes to stand: out of any rock it was put in, then down to the floor under it
export function surface(map, x, y) {
    while (y > 0 && isSolid(map, x, y - 1)) y = Math.floor((y - 1) / TILE) * TILE
    return groundBelow(map, x, y - 1) ?? y
}

// Bottom of the first ceiling above y, or limit when there is none
export function ceilingAbove(map, x, y, limit) {
    for (let ty = Math.floor(y / TILE); ty * TILE > limit; ty--) if (isSolid(map, x, ty * TILE)) return (ty + 1) * TILE
    return limit
}

// Moves a body { x, y, vx, vy, w, h } where y is its feet and stops it on tiles.
// Walking bodies climb single tile steps, platforms hold them only when falling from above and not dropping through.
export function moveBody(b, dt, map, { step = false, drop = false } = {}) {
    const x = b.x + b.vx * dt
    if (fits(map, x, b.y, b.w, b.h)) {
        b.x = x
    } else if (step && b.onGround && fits(map, x, b.y - TILE, b.w, b.h)) {
        b.x = x
        b.y -= TILE
    } else if (b.vx) {
        b.x = b.vx > 0 ? Math.floor((x + b.w / 2) / TILE) * TILE - b.w / 2 - 0.02 : Math.ceil((x - b.w / 2) / TILE) * TILE + b.w / 2 + 0.02
        b.vx = 0
    }

    const y = b.y + b.vy * dt
    b.onGround = false
    if (b.vy < 0) {
        if (fits(map, b.x, y, b.w, b.h)) b.y = y
        else {
            b.y = Math.ceil((y - b.h) / TILE) * TILE + b.h
            b.vy = 0
        }
        return
    }
    for (let ty = Math.ceil(b.y / TILE - 1e-6); ty * TILE <= y; ty++) {
        const floor = samples(b.x - b.w / 2, b.x + b.w / 2).map(sx => tileAt(map, sx, ty * TILE))
        if (floor.some(solid) || (!drop && floor.includes('='))) {
            b.y = ty * TILE
            b.vy = 0
            b.onGround = true
            return
        }
    }
    b.y = y
}

export const box = (x, y, w, h) => [x, y, w, h]
export const overlap = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]
export const bodyBox = b => box(b.x - b.w / 2, b.y - b.h, b.w, b.h)

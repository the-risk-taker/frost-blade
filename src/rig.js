import { makeCanvas, outline } from './pixels.js'

// Dark outline around every baked shape
export const INK = '#150f19'

// Point d pixels away along angle a. Angles start straight down and grow toward the side a body faces.
export const along = ([x, y], a, d) => [x + Math.sin(a) * d, y + Math.cos(a) * d]

// Angle on the canvas (0 pointing right, growing clockwise) of a direction measured like limbs
export const screenAngle = a => Math.atan2(Math.cos(a), Math.sin(a))

const dot = (ctx, x, y, color) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, 1, 1)
}

// Paints the pixels within r of a center. colorAt gets coordinates turned back by angle, so parts are drawn upright and tilted by the pose.
export function shape(ctx, [cx, cy], r, angle, colorAt) {
    const cos = Math.cos(angle), sin = Math.sin(angle)
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy
            const color = colorAt(dx * cos + dy * sin, dy * cos - dx * sin)
            if (color) dot(ctx, x, y, color)
        }
    }
}

// A limb between two joints, rounded at the ends and tapering from w0 to w1.
// Ramps are [edge, shadow, mid, light], the light comes from the upper left of the canvas.
export function limb(ctx, [x0, y0], [x1, y1], w0, w1, ramp) {
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1, len = Math.sqrt(len2)
    const nx = -dy / len, ny = dx / len
    const lit = -nx - ny > 0 ? 1 : -1
    const r = Math.max(w0, w1) / 2 + 1
    for (let y = Math.floor(Math.min(y0, y1) - r); y <= Math.ceil(Math.max(y0, y1) + r); y++) {
        for (let x = Math.floor(Math.min(x0, x1) - r); x <= Math.ceil(Math.max(x0, x1) + r); x++) {
            const px = x + 0.5 - x0, py = y + 0.5 - y0
            const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2))
            const half = (w0 + (w1 - w0) * t) / 2
            const ox = px - dx * t, oy = py - dy * t
            const d = Math.hypot(ox, oy)
            if (d > half) continue
            // The rim runs along the sides only, so joints of one limb blend together
            const side = (ox * nx + oy * ny) / half * lit
            const rim = d > half - 1 && t > 0 && t < 1
            dot(ctx, x, y, rim ? ramp[0] : side > 0.3 ? ramp[3] : side < -0.35 ? ramp[1] : ramp[2])
        }
    }
}

// Ramp tone for a round part with the light from the upper left, n is the distance from the center from 0 to 1
export function ball(ramp, lx, ly, n) {
    const light = (-lx - ly) / 2
    return n > 0.86 ? ramp[0] : light > 0.25 ? ramp[3] : light < -0.3 ? ramp[1] : ramp[2]
}

// Bakes animations into one atlas. Each frame draws around the origin and may return anchors where gear is attached.
// Behind is drawn after outlining, under what is already there, with its own dark edge.
// Frames of grounded animations are moved so their lowest pixel rests on the origin, like a body rolling on the floor.
export function sheet(cellW, cellH, originX, originY, animations, grounded = [], ink = INK) {
    const names = Object.keys(animations)
    const cols = Math.max(...names.map(name => animations[name].length))
    const canvas = makeCanvas(cols * cellW, names.length * cellH)
    const frames = {}
    names.forEach((name, row) => {
        frames[name] = animations[name].map((draw, col) => {
            const cell = makeCanvas(cellW, cellH)
            const ctx = cell.getContext('2d')
            ctx.translate(originX, originY)
            const { anchors, behind, after } = draw(ctx) ?? {}
            if (ink) outline(cell, ink)
            ctx.globalCompositeOperation = 'destination-over'
            behind?.(ctx)
            ctx.globalCompositeOperation = 'source-over'
            after?.(ctx)
            const drop = grounded.includes(name) ? originY - lowest(cell) : 0
            canvas.getContext('2d').drawImage(cell, col * cellW, row * cellH + drop)
            const moved = Object.fromEntries(Object.entries(anchors ?? {}).map(([key, [x, y, ...rest]]) => [key, [x, y + drop, ...rest]]))
            return { x: col * cellW, y: row * cellH, ...moved }
        })
    })
    return { canvas, frames, cellW, cellH, originX, originY }
}

function lowest(canvas) {
    const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    for (let y = height - 1; y >= 0; y--) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]) return y + 1
    return height
}

// Packs sheets into one canvas on shelves and moves their frames onto it, so they share a texture and a draw call
export function atlas(sheets, width = 4096) {
    let x = 0, y = 0, shelf = 0
    const spots = sheets.map(({ canvas }) => {
        if (x + canvas.width > width) [x, y, shelf] = [0, y + shelf, 0]
        const spot = [x, y]
        x += canvas.width
        shelf = Math.max(shelf, canvas.height)
        return spot
    })
    const packed = makeCanvas(width, y + shelf)
    sheets.forEach((sheet, i) => {
        const [dx, dy] = spots[i]
        packed.getContext('2d').drawImage(sheet.canvas, dx, dy)
        for (const list of Object.values(sheet.frames)) list.forEach(frame => Object.assign(frame, { x: frame.x + dx, y: frame.y + dy }))
        sheet.canvas = packed
    })
    return packed
}

// Samples an animation at count frames, t goes from 0 to 1 without reaching 1 so loops join smoothly
export const frames = (count, draw) => Array.from({ length: count }, (_, i) => ctx => draw(ctx, i / count))

// Pose values between keys, t from 0 to 1 across keys spread evenly. Arrays blend element by element.
export function tween(keys, t) {
    const at = Math.min(keys.length - 1.001, t * (keys.length - 1))
    const i = Math.floor(at), f = at - i
    const mix = (a, b) => Array.isArray(a) ? a.map((v, j) => mix(v, b[j])) : a + (b - a) * f
    return Object.fromEntries(Object.keys(keys[i]).map(key => [key, mix(keys[i][key], keys[i + 1][key] ?? keys[i][key])]))
}

// Turns an image around its center into count frames. Nearest neighbor sampling keeps the pixels sharp.
export function rotations(image, count) {
    const size = Math.ceil(Math.hypot(image.width, image.height)) + 2
    const cols = 8
    const canvas = makeCanvas(cols * size, Math.ceil(count / cols) * size)
    const turn = Array.from({ length: count }, (_, i) => {
        const cell = makeCanvas(size, size)
        const ctx = cell.getContext('2d')
        ctx.imageSmoothingEnabled = false
        ctx.translate(size / 2, size / 2)
        ctx.rotate(i / count * Math.PI * 2)
        ctx.drawImage(image, -image.width / 2, -image.height / 2)
        outline(cell, INK)
        const x = (i % cols) * size, y = Math.floor(i / cols) * size
        canvas.getContext('2d').drawImage(cell, x, y)
        return { x, y }
    })
    return { canvas, frames: { turn }, cellW: size, cellH: size, originX: size / 2, originY: size / 2 }
}

// Canvas angle of a frame from rotations()
export const turnFrame = (sheet, angle) => {
    const { turn } = sheet.frames
    return turn[((Math.round(angle / (Math.PI * 2) * turn.length) % turn.length) + turn.length) % turn.length]
}

// A two legged body posed by joint angles. Limb angles start straight down and grow toward the facing side,
// knees bend back and elbows forward. Spin turns the whole body around its hips, for rolls and falls.
// Look holds lengths, widths and ramps, and draws the torso and head with shape() in their own upright coordinates.
export function humanoid(ctx, look, pose) {
    const p = { x: 0, y: 0, lean: 0, head: 0, spin: 0, legF: [0.1, 0.1], legB: [-0.1, 0.1], armF: [0.15, 0.3], armB: [-0.15, 0.3], ...pose }
    const { thigh, shin, torso, upper, fore, neck } = look
    const pivot = [p.x, p.y - thigh - shin - 2]
    const cos = Math.cos(p.spin), sin = Math.sin(p.spin)
    const turn = ([x, y]) => [pivot[0] + (x - pivot[0]) * cos - (y - pivot[1]) * sin, pivot[1] + (x - pivot[0]) * sin + (y - pivot[1]) * cos]
    const up = Math.PI - p.lean
    const hip = pivot
    const chest = along(hip, up, torso)
    const shoulder = along(hip, up, torso - look.shoulder)
    const head = along(chest, up - p.head, neck)
    const leg = ([a, bend]) => {
        const knee = along(hip, a, thigh)
        return [knee, along(knee, a - bend, shin), a - bend]
    }
    const arm = ([a, bend]) => {
        const elbow = along(shoulder, a, upper)
        return [elbow, along(elbow, a + bend, fore), a + bend]
    }
    const [kneeF, footF, shinF] = leg(p.legF), [kneeB, footB, shinB] = leg(p.legB)
    const [elbowF, handF, foreF] = arm(p.armF), [elbowB, handB, foreB] = arm(p.armB)

    const drawLeg = (knee, foot, a, back) => {
        const r = back ? look.back : look.ramps
        limb(ctx, turn(hip), turn(knee), look.legW[0], look.legW[1], r.pants)
        limb(ctx, turn(knee), turn(foot), look.legW[1], look.legW[2], r.pants)
        limb(ctx, turn(along(knee, a, shin * 0.45)), turn(foot), look.bootW, look.bootW, r.boots)
        limb(ctx, turn(foot), turn(along(foot, a + Math.PI / 2 - 0.15, look.foot)), look.bootW - 1, look.bootW - 2, r.boots)
    }
    const drawArm = (elbow, hand, back) => {
        const r = back ? look.back : look.ramps
        limb(ctx, turn(shoulder), turn(elbow), look.armW[0], look.armW[1], r.sleeve)
        limb(ctx, turn(elbow), turn(hand), look.armW[1], look.armW[2], r.sleeve)
        shape(ctx, turn(hand), look.handR + 1, 0, (lx, ly) => {
            const n = Math.hypot(lx, ly) / look.handR
            return n <= 1 && ball(r.hand, lx, ly, n)
        })
    }
    const joints = { hip: turn(hip), chest: turn(chest), head: turn(head), handF: turn(handF), handB: turn(handB), lean: p.lean + p.spin, pose: p }

    look.behindArm?.(ctx, joints)
    drawArm(elbowB, handB, true)
    drawLeg(kneeB, footB, shinB, true)
    look.body(ctx, joints)
    drawLeg(kneeF, footF, shinF, false)
    look.face(ctx, joints)
    look.carry?.(ctx, joints)
    drawArm(elbowF, handF, false)
    look.front?.(ctx, joints)
    return {
        anchors: {
            // Held gear turns with the forearm, grip tilts it within the hand
            hand: [...joints.handF, screenAngle(foreF) + p.spin + (p.grip ?? look.grip ?? 0)],
            handB: [...joints.handB, screenAngle(foreB) + p.spin],
            head: [...joints.head, p.lean + p.head + p.spin],
            chest: [...joints.chest, p.lean + p.spin],
            // Worn pieces sit on the body upright, turned by the lean, or along a forearm or shin
            shoulder: [...turn(shoulder), p.lean + p.spin],
            hip: [...joints.hip, p.lean + p.spin],
            wristF: [...joints.handF, p.spin - foreF],
            wristB: [...joints.handB, p.spin - foreB],
            footF: [...turn(footF), p.spin - shinF],
            footB: [...turn(footB), p.spin - shinB],
        },
        behind: look.behind && (c => look.behind(c, joints)),
    }
}

// A four legged body: spine from hips to chest tilted by pitch (front up), legs in pairs [upper angle, bend],
// the neck carries the head drawn by the look, the tail hangs from the hips.
export function quadruped(ctx, look, pose) {
    const p = { x: 0, y: 0, pitch: 0, legs: [[0.1, 0.2], [-0.1, 0.2], [0.1, -0.3], [-0.1, -0.3]], neck: 0.9, head: 0, jaw: 0, tail: 0.6, ...pose }
    const { length, height, upper, lower, neck } = look
    const center = [p.x, p.y - height]
    const front = [Math.cos(p.pitch), -Math.sin(p.pitch)]
    const chest = [center[0] + front[0] * length / 2, center[1] + front[1] * length / 2]
    const hips = [center[0] - front[0] * length / 2, center[1] - front[1] * length / 2]
    const head = along(chest, Math.PI - p.neck, neck)
    const drawLeg = (root, [a, bend], ramp) => {
        const knee = along(root, a, upper)
        const paw = along(knee, a + bend, lower)
        limb(ctx, root, knee, look.legW[0], look.legW[1], ramp)
        limb(ctx, knee, paw, look.legW[1], look.legW[2], ramp)
        limb(ctx, paw, [paw[0] + 3, paw[1]], look.legW[2] + 1, look.legW[2], ramp)
    }
    const joints = { center, chest, hips, head, pitch: p.pitch, pose: p }
    const far = look.fur.map((_, i) => look.fur[Math.max(0, i - 1)])
    drawLeg(chest, p.legs[1], far)
    drawLeg(hips, p.legs[3], far)
    look.tail(ctx, joints)
    look.body(ctx, joints)
    limb(ctx, chest, head, look.neckW, look.neckW - 2, look.fur)
    drawLeg(chest, p.legs[0], look.fur)
    drawLeg(hips, p.legs[2], look.fur)
    look.face(ctx, joints)
    return { anchors: { head, chest } }
}

// Normal map of a sheet for lit sprites: shapes bulge toward their middle, brighter pixels stand out a little
export function normals(source) {
    const { width: w, height: h } = source
    const data = source.getContext('2d').getImageData(0, 0, w, h).data
    const height = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) height[i] = data[i * 4 + 3] ? 1 : 0
    // Every pass raises pixels that have no empty neighbor, up to four pixels deep
    for (let pass = 0; pass < 3; pass++) {
        const next = height.slice()
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
            const i = y * w + x
            if (height[i] && height[i - 1] && height[i + 1] && height[i - w] && height[i + w]) next[i] = Math.min(height[i - 1], height[i + 1], height[i - w], height[i + w]) + 1
        }
        height.set(next)
    }
    const canvas = makeCanvas(w, h)
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(w, h)
    const at = (x, y) => height[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))] + (data[(Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4 + 1] / 255) * 0.6
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (!data[i + 3]) continue
        const nx = at(x - 1, y) - at(x + 1, y), ny = at(x, y - 1) - at(x, y + 1), nz = 2
        const len = Math.hypot(nx, ny, nz)
        img.data.set([(nx / len + 1) * 127.5, (ny / len + 1) * 127.5, (nz / len + 1) * 127.5, 255], i)
    }
    ctx.putImageData(img, 0, 0)
    return canvas
}

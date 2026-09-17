import { makeCanvas, outline, hash, paint } from './pixels.js'
import { INK, along, shape, limb, ball, sheet, frames, tween, rotations, humanoid, quadruped } from './rig.js'

const TAU = Math.PI * 2
const ease = t => 1 - (1 - t) ** 2
const { sin, cos, abs, max, min, hypot, round, PI } = Math

const SKIN = ['#6e3b2a', '#c27b5c', '#e9b48c', '#f9d7b5']
const HAIR = ['#2b130b', '#552a14', '#83421e', '#b0642f']
const SCARF = ['#4a0e15', '#8a1f26', '#c1343a', '#ea6a5c']
const IRON = ['#2b3034', '#4f575c', '#7d858a', '#c5ccd0']
const GOLD = ['#5a3a0c', '#9a6a1c', '#e2c070', '#fff2a8']
const WOOD = ['#2e1a0e', '#5a3418', '#8a5a2b', '#b07a44']
const ICE = ['#1f5f8a', '#3aa6e0', '#8fdcfa', '#ffffff']
const BLADE = ['#12524d', '#2a9d94', '#4fd6c8', '#d4fff8']
const FUR = ['#262d33', '#4c5862', '#6b7884', '#9aa8b3']
const BONE = ['#6e6450', '#b9ad8c', '#e8e0c8', '#fbf7ea']
const LEATHER = ['#2a170d', '#52301b', '#7a4a29', '#a0693a']

// Hero clothes that gear recolors. They are baked in key colors and the renderer swaps every key for the ramp of the worn piece.
// A key is red 254, green picks the slot and blue the tone.
export const CLOTHES = ['vest', 'shirt', 'pants', 'hands', 'boots', 'cape']
const key = slot => [0, 1, 2, 3].map(tone => `#fe${(CLOTHES.indexOf(slot) * 16 + 8).toString(16).padStart(2, '0')}${(tone * 64 + 32).toString(16)}`)
// Back limbs are a tone darker
const darker = ramp => [ramp[0], ramp[0], ramp[1], ramp[2]]

// Plain clothes of the hero, gear replaces some of them. A missing cape is not drawn at all.
export const HERO_CLOTHES = {
    vest: LEATHER,
    shirt: ['#6e5c42', '#a8916c', '#d8c19c', '#f0e2c4'],
    pants: ['#15100d', '#2a201b', '#3e312a', '#54443a'],
    hands: SKIN,
    boots: ['#120b08', '#2a1a12', '#46301f', '#634530'],
    cape: null,
}

// Worn body, hands, feet and back gear as ramps of the clothes they change
export const GEAR_CLOTHES = {
    armor: { vest: IRON, shirt: ['#3c4247', '#5d656a', '#8a9398', '#dde3e6'] },
    chainmail: { vest: ['#30363a', '#4f565b', '#6f777c', '#9aa2a7'] },
    robe: { vest: ['#10214a', '#1d3a78', '#2f5aa8', '#5c8ae0'], shirt: ['#3a6c9c', '#6fa8dc', '#a8d4f0', '#dff2ff'], pants: ['#10214a', '#1d3a78', '#2f5aa8', '#4a78c8'] },
    gloves: { hands: LEATHER },
    boots: { boots: LEATHER },
    cloak: { cape: FUR },
    shamanCloak: { cape: ['#101c2c', '#1f3550', '#2f5078', '#4a74a0'] },
}

const HERO = {
    thigh: 12, shin: 13, torso: 20, shoulder: 3, neck: 10, upper: 10, fore: 10, foot: 4,
    legW: [8, 7, 6], bootW: 7, armW: [6, 5, 5], handR: 2.6, grip: -0.5,
    ramps: { pants: key('pants'), boots: key('boots'), sleeve: key('shirt'), hand: key('hands') },
    back: { pants: darker(key('pants')), boots: darker(key('boots')), sleeve: darker(key('shirt')), hand: darker(key('hands')) },

    // Scarf ends trail behind, the vest is open over the shirt with a belt on the hips
    body(ctx, { hip, chest, lean, pose }) {
        const wave = pose.wave ?? 0
        const knot = along(chest, PI - lean, -2)
        for (const [dy, length] of [[0, 13], [3, 10]]) {
            const end = [knot[0] - length * cos(pose.scarf ?? 0.3), knot[1] + dy + length * sin(pose.scarf ?? 0.3) + sin(wave * TAU + dy) * 2]
            limb(ctx, knot, end, 5, 4, SCARF)
        }
        const vest = key('vest'), shirt = key('shirt'), pants = key('pants')
        const center = [(hip[0] + chest[0]) / 2, (hip[1] + chest[1]) / 2]
        shape(ctx, center, 16, lean, (lx, ly) => {
            const half = 7.5 - max(0, ly) * 0.12 - (ly < -8 ? (ly + 8) ** 2 * 0.3 : 0)
            if (abs(lx) > half || ly < -11.5 || ly > 11.5) return
            if (abs(lx) > half - 1) return lx < 0 ? vest[2] : vest[0]
            if (ly > 8) return pants[lx < -2 ? 3 : 2]
            if (ly > 5) return lx > 1 && lx < 4 ? GOLD[ly > 6.5 ? 1 : 3] : '#241510'
            if (lx > 0.5 && lx < 5) return lx < 1.5 ? shirt[1] : ly < -9 ? shirt[3] : shirt[2]
            if (lx >= 5) return vest[1]
            return lx < -4 ? vest[3] : (lx + ly * 0.5) % 5 < 1 ? vest[1] : vest[2]
        })
    },

    face(ctx, { head, chest, lean, pose }) {
        shape(ctx, head, 14, lean + (pose.head ?? 0), (lx, ly) => {
            const n = hypot(lx, ly) / 8.5
            // Nose and hair strands reach out of the round head
            const nose = lx > 7 && lx < 10 && ly > -1 && ly < 2
            const tail = lx < -6 && lx > -12 && ly > -3 && ly < 5 - (lx + 6) * 0.6
            if (n > 1 && !nose && !tail) return
            if (tail) return (ly + lx) % 3 < 1 ? HAIR[1] : HAIR[2]
            if (brow(pose.mood, lx, ly - 0.9)) return HAIR[0]
            const hair = ly < -4.4 + lx * 0.15 || lx < -2.5 || (lx < 3 && ly < -1)
            if (hair) return n > 0.9 ? HAIR[0] : (lx * 2 + ly) % 4 < 1 ? HAIR[1] : ly < -6 && lx < 2 ? HAIR[3] : HAIR[2]
            if (lx > 3 && lx < 5.5 && ly > -2 && ly < 1.5) return lx > 4.5 && ly < -0.5 ? '#ffffff' : '#1d1410'
            if (mouth(pose.mood, lx, ly)) return SKIN[0]
            if (lx > -2.5 && lx < 0 && ly > -1 && ly < 2.5) return SKIN[1]
            return nose ? SKIN[2] : ball(SKIN, lx / 8.5, ly / 8.5, n)
        })
        // Scarf wrapped around the neck
        limb(ctx, along(chest, PI - lean, -1).map((v, i) => v - [3, 0][i]), along(chest, PI - lean, 1).map((v, i) => v + [4, 0][i]), 6, 6, SCARF)
    },

    // A cape hangs from the shoulders and flows back with speed
    behind(ctx, { chest, hip, lean, pose }) {
        const cape = key('cape')
        const flow = pose.cape ?? 0.25
        const root = along(chest, PI - lean, -2)
        const end = [root[0] - 4 - sin(flow) * 26, root[1] + cos(flow) * 26 + sin((pose.wave ?? 0) * TAU) * 1.5]
        limb(ctx, root, end, 9, 16, cape)
        limb(ctx, root, end, 1, 1, cape)
    },
}

// Brows and mouth show the mood of a face in dialogs: calm, angry or worried
function brow(mood, lx, ly) {
    const tilt = { angry: 0.45, worried: -0.4 }[mood] ?? 0
    return lx > 2.5 && lx < 6.5 && Math.abs(ly + 3.75 - (lx - 4.5) * tilt) < 0.65
}

function mouth(mood, lx, ly) {
    if (mood === 'worried') return lx > 4.5 && lx < 6.5 && ly > 3.5 && ly < 5
    if (mood === 'angry') return lx > 3.5 && lx < 7 && ly > 3.5 && ly < 4.5 + (lx > 5 ? 0.6 : 0)
    return lx > 4 && lx < 7 && ly > 3.5 && ly < 4.5 - (lx > 6 ? 0.6 : 0)
}

const hero = pose => ctx => humanoid(ctx, HERO, pose)
const loop = (count, pose) => frames(count, (ctx, t) => humanoid(ctx, HERO, pose(t)))
const keyed = (count, keys, extra = () => ({})) => frames(count, (ctx, t) => humanoid(ctx, HERO, { ...tween(keys, t), ...extra(t) }))
const hold = (pose, count = 1) => Array(count).fill(hero(pose))

// Legs and arms of a stride at phase a, used by running and climbing
const stride = (a, reach = 0.8) => ({
    legF: [reach * sin(a), 0.25 + 1.1 * max(0, -cos(a))],
    legB: [-reach * sin(a), 0.25 + 1.1 * max(0, cos(a))],
    armF: [-0.8 * sin(a), 1.2],
    armB: [0.8 * sin(a), 1.2],
})

// Three blows of a combo for a kind of weapon, each from a wind up through the hit to the follow through
function combo(keys, count = 6) {
    return keys.map(chain => keyed(count, chain))
}

const SLASH = [
    [{ armF: [-2.3, 0.5], lean: -0.1, grip: -1.2, legF: [0.3, 0.3], legB: [-0.3, 0.2] }, { armF: [-2.6, 0.6], lean: -0.15, grip: -1.1, legF: [0.4, 0.3], legB: [-0.3, 0.2] }, { armF: [1.2, 0.1], lean: 0.25, grip: -0.3, legF: [0.6, 0.4], legB: [-0.5, 0.2] }, { armF: [0.5, 0.2], lean: 0.2, grip: -0.1, legF: [0.6, 0.4], legB: [-0.5, 0.2] }, { armF: [0.3, 0.4], lean: 0.1, grip: -0.6, legF: [0.4, 0.3], legB: [-0.3, 0.2] }],
    [{ armF: [0.3, 0.3], lean: 0.15, grip: 0.4, legF: [0.4, 0.4], legB: [-0.4, 0.2] }, { armF: [0.1, 0.5], lean: 0.2, grip: 0.8, legF: [0.5, 0.5], legB: [-0.4, 0.2] }, { armF: [2.2, 0.1], lean: -0.1, grip: -0.2, legF: [0.4, 0.2], legB: [-0.5, 0.2] }, { armF: [2.6, 0.2], lean: -0.15, grip: -0.4, legF: [0.4, 0.2], legB: [-0.5, 0.2] }, { armF: [1.2, 0.5], lean: 0, grip: -1, legF: [0.3, 0.2], legB: [-0.3, 0.2] }],
    [{ armF: [-2.9, 0.2], lean: -0.2, grip: -0.1, y: 2, legF: [0.5, 0.8], legB: [-0.5, 0.8] }, { armF: [-3.1, 0.2], lean: -0.25, grip: 0, y: -2, legF: [0.3, 0.4], legB: [-0.3, 0.6] }, { armF: [1.4, 0], lean: 0.4, grip: 0, y: 2, legF: [0.8, 0.9], legB: [-0.6, 0.6] }, { armF: [0.7, 0.1], lean: 0.45, grip: 0.2, y: 3, legF: [0.8, 1], legB: [-0.6, 0.6] }, { armF: [0.5, 0.3], lean: 0.2, grip: -0.5, y: 1, legF: [0.5, 0.5], legB: [-0.4, 0.4] }],
]
const HEAVY = SLASH.map(chain => chain.map((key, i) => ({ ...key, lean: key.lean * 1.5, armF: [key.armF[0] * (i < 2 ? 1.08 : 1), key.armF[1]], y: (key.y ?? 0) + (i === 2 || i === 3 ? 3 : 0) })))
const THRUST = [0.9, 1.6, 2.1].map(height => [
    { armF: [height - 0.4, 1.6], armB: [height - 0.6, 1.6], lean: -0.15, grip: -1.2, legF: [0.4, 0.3], legB: [-0.4, 0.3] },
    { armF: [height - 0.3, 2], armB: [height - 0.5, 1.8], lean: -0.2, grip: -1.5, legF: [0.3, 0.3], legB: [-0.5, 0.3] },
    { armF: [height, 0], armB: [height - 0.2, 0.6], lean: 0.3, grip: 0, legF: [0.8, 0.3], legB: [-0.6, 0.1] },
    { armF: [height, 0], armB: [height - 0.2, 0.6], lean: 0.3, grip: 0, legF: [0.8, 0.3], legB: [-0.6, 0.1] },
    { armF: [height - 0.3, 0.9], armB: [height - 0.5, 0.9], lean: 0.05, grip: -0.8, legF: [0.4, 0.3], legB: [-0.4, 0.3] },
])
const STAB = [[1.3, 1.1], [1.7, 0.9], [1.0, 1.9]].map(([high, low]) => [
    { armF: [high - 0.5, 1.8], armB: [low + 0.3, 0.3], lean: 0, grip: -1.4, legF: [0.4, 0.4], legB: [-0.3, 0.3] },
    { armF: [high, 0.1], armB: [low - 0.4, 1.6], lean: 0.25, grip: -0.1, legF: [0.6, 0.4], legB: [-0.4, 0.3] },
    { armF: [high - 0.4, 1.5], armB: [low, 0.1], lean: 0.2, grip: -1.2, legF: [0.5, 0.4], legB: [-0.4, 0.3] },
    { armF: [high - 0.6, 1.2], armB: [low - 0.5, 1.2], lean: 0.05, grip: -1.2, legF: [0.4, 0.4], legB: [-0.3, 0.3] },
])
const STAFF = SLASH.map(chain => chain.map(key => ({ ...key, armB: [key.armF[0] - 0.3, key.armF[1] + 0.4], grip: key.grip - 0.2 })))

// Every move of the hero, also those the game will use later. Weapons, bows and head gear are drawn on the anchors of these frames.
export function buildHero() {
    const idle = t => ({ y: sin(t * TAU) > 0.3 ? 1 : 0, armF: [0.1 + 0.04 * sin(t * TAU), 0.3], armB: [-0.12, 0.3], legF: [0.12, 0.05], legB: [-0.1, 0.05], head: 0.04 * sin(t * TAU), wave: t, cape: 0.15 + 0.05 * sin(t * TAU) })
    const run = t => ({ ...stride(t * TAU), y: round(-abs(sin(t * TAU)) * 2) + 1, lean: 0.2, head: -0.12, wave: t * 2, cape: 0.9, scarf: 0.1 })
    const animations = {
        idle: loop(8, idle),
        run: loop(8, run),
        start: keyed(6, [{ ...stride(0.5), lean: 0.35, cape: 0.5 }, { ...stride(1.2), lean: 0.3, cape: 0.7 }]),
        stop: keyed(6, [{ legF: [0.8, 0.1], legB: [-0.6, 0.7], armF: [0.9, 0.5], armB: [-0.8, 0.6], lean: -0.3, y: 2, cape: 0.9 }, { legF: [0.5, 0.1], legB: [-0.4, 0.5], armF: [0.5, 0.4], armB: [-0.4, 0.5], lean: -0.15, y: 1, cape: 0.4 }]),
        jump: keyed(6, [{ legF: [0.7, 1.4], legB: [-0.2, 1], armF: [-0.6, 0.8], armB: [0.8, 0.6], lean: 0.1, cape: 0.8, scarf: -0.5 }, { legF: [0.9, 1.6], legB: [0.1, 1.4], armF: [-0.9, 0.9], armB: [1, 0.5], lean: 0.15, cape: 1, scarf: -0.7 }]),
        fall: keyed(6, [{ legF: [0.4, 0.3], legB: [-0.3, 0.5], armF: [1.9, 0.4], armB: [-1.8, 0.4], lean: 0, cape: -0.5, scarf: 0.9 }, { legF: [0.2, 0.2], legB: [-0.2, 0.3], armF: [2.2, 0.3], armB: [-2.1, 0.3], lean: -0.05, cape: -0.8, scarf: 1.1 }]),
        land: keyed(6, [{ legF: [0.9, 1.7], legB: [-0.5, 1.4], armF: [0.6, 0.6], armB: [-0.4, 0.6], lean: 0.45, y: 7, cape: 0.2 }, { legF: [0.3, 0.5], legB: [-0.2, 0.4], armF: [0.3, 0.4], armB: [-0.2, 0.4], lean: 0.15, y: 2, cape: 0.2 }]),
        roll: frames(8, (ctx, t) => humanoid(ctx, HERO, { legF: [1.6, 2.7], legB: [1.4, 2.6], armF: [1.2, 1.8], armB: [1, 1.7], lean: 0.8, head: 0.6, spin: t * TAU, cape: 1.2 })),
        slash1: combo(SLASH)[0], slash2: combo(SLASH)[1], slash3: combo(SLASH)[2],
        heavy1: combo(HEAVY, 7)[0], heavy2: combo(HEAVY, 7)[1], heavy3: combo(HEAVY, 7)[2],
        thrust1: combo(THRUST)[0], thrust2: combo(THRUST)[1], thrust3: combo(THRUST)[2],
        stab1: combo(STAB, 6)[0], stab2: combo(STAB, 6)[1], stab3: combo(STAB, 6)[2],
        staff1: combo(STAFF)[0], staff2: combo(STAFF)[1], staff3: combo(STAFF)[2],
        // Blows from the air straight down and from a crouch up, lifting light foes
        pound: keyed(6, [{ legF: [0.9, 1.6], legB: [0.2, 1.4], armF: [-2.9, 0.1], armB: [-2.6, 0.3], lean: -0.2, grip: 0, y: -12, cape: -0.6 }, { legF: [0.8, 1.5], legB: [0.1, 1.3], armF: [-3.1, 0.1], armB: [-2.8, 0.2], lean: -0.1, grip: 0, y: -10, cape: -0.8 }, { legF: [0.9, 1.7], legB: [-0.5, 1.4], armF: [0.6, 0], armB: [0.4, 0.2], lean: 0.5, grip: 0.1, y: 6, cape: 0.8 }, { legF: [0.9, 1.7], legB: [-0.5, 1.4], armF: [0.4, 0.1], armB: [0.3, 0.3], lean: 0.5, grip: 0.2, y: 7, cape: 0.8 }]),
        launch: keyed(6, [{ legF: [0.9, 1.7], legB: [-0.5, 1.4], armF: [0.3, 0.4], lean: 0.4, grip: 0.8, y: 7 }, { legF: [0.9, 1.6], legB: [-0.5, 1.3], armF: [0.1, 0.5], lean: 0.45, grip: 1, y: 7 }, { legF: [0.3, 0.2], legB: [-0.2, 0.2], armF: [2.6, 0.1], lean: -0.15, grip: -0.3, y: -3 }, { legF: [0.2, 0.2], legB: [-0.2, 0.2], armF: [2.9, 0.1], lean: -0.2, grip: -0.4, y: -4 }, { legF: [0.3, 0.3], legB: [-0.3, 0.3], armF: [1.4, 0.6], lean: 0, grip: -1 }]),
        block: keyed(6, [{ armF: [1.1, 1.3], armB: [0.8, 1.6], lean: -0.15, grip: -2.1, legF: [0.5, 0.4], legB: [-0.5, 0.3], y: 2 }, { armF: [1.2, 1.4], armB: [0.9, 1.6], lean: -0.2, grip: -2.2, legF: [0.5, 0.5], legB: [-0.5, 0.4], y: 3 }]),
        parry: keyed(5, [{ armF: [1.2, 1.4], armB: [0.9, 1.6], lean: -0.2, grip: -2.2, legF: [0.5, 0.5], legB: [-0.5, 0.4], y: 3 }, { armF: [2.4, 0.3], armB: [0.3, 0.8], lean: -0.1, grip: -0.9, legF: [0.4, 0.3], legB: [-0.4, 0.3], y: 1 }, { armF: [1.6, 0.8], armB: [0.2, 0.6], lean: 0.1, grip: -1.4, legF: [0.4, 0.3], legB: [-0.4, 0.3] }]),
        dodge: keyed(6, [{ legF: [0.5, 0.2], legB: [-0.9, 1], armF: [0.9, 0.7], armB: [-1.2, 0.4], lean: -0.5, y: 3, cape: 1 }, { legF: [0.9, 0.3], legB: [-0.5, 1.3], armF: [1.3, 0.8], armB: [-1.5, 0.3], lean: -0.7, y: 6, cape: 1.3 }, { legF: [0.3, 0.2], legB: [-0.3, 0.4], armF: [0.4, 0.5], armB: [-0.4, 0.4], lean: -0.1, y: 1, cape: 0.4 }]),
        hurt: keyed(6, [{ armF: [-0.6, 0.9], armB: [1.1, 0.6], lean: -0.4, head: -0.3, legF: [0.5, 0.2], legB: [-0.2, 0.4], y: 1, cape: 0.9 }, { armF: [-0.3, 0.6], armB: [0.7, 0.5], lean: -0.25, head: -0.2, legF: [0.4, 0.2], legB: [-0.2, 0.3], cape: 0.5 }]),
        death: keyed(8, [{ armF: [-0.6, 0.9], armB: [1.1, 0.6], lean: -0.4, head: -0.3, legF: [0.5, 0.2], legB: [-0.2, 0.4], y: 1, spin: 0 }, { armF: [-1.4, 0.5], armB: [-1.2, 0.5], lean: -0.3, head: -0.4, legF: [0.7, 0.9], legB: [0.3, 1.2], y: 6, spin: -0.6 }, { armF: [-2.4, 0.3], armB: [-2.1, 0.3], lean: -0.1, head: -0.2, legF: [0.4, 0.3], legB: [0.2, 0.3], y: 25, spin: -1.57 }, { armF: [-2.6, 0.2], armB: [-2.2, 0.2], lean: 0, head: -0.1, legF: [0.3, 0.2], legB: [0.1, 0.2], y: 26, spin: -1.57 }]),
        stun: loop(6, t => ({ lean: 0.2 * sin(t * TAU), head: 0.3 * sin(t * TAU + 1), armF: [0.3 + 0.2 * sin(t * TAU), 0.5], armB: [-0.3, 0.5], legF: [0.2, 0.3], legB: [-0.2, 0.3], y: 2, wave: t })),
        frozen: hold({ armF: [1.1, 1.5], armB: [0.8, 1.6], lean: -0.1, head: -0.2, legF: [0.3, 0.3], legB: [-0.3, 0.3], y: 1 }),
        burn: loop(6, t => ({ ...stride(t * TAU, 0.5), armF: [-2.6 + 0.5 * sin(t * TAU * 2), 0.4], armB: [-2.4 - 0.5 * sin(t * TAU * 2), 0.4], lean: 0.1, head: -0.3, wave: t * 3, cape: 0.8 })),
        netted: loop(6, t => ({ legF: [0.7, 1.8], legB: [-0.3, 1.9], armF: [-1 + 0.4 * sin(t * TAU), 1.8], armB: [-1.3 - 0.4 * sin(t * TAU), 1.7], lean: 0.5 + 0.1 * sin(t * TAU), head: 0.2, y: 8 })),
        grabbed: loop(6, t => ({ legF: [0.5 * sin(t * TAU), 0.6], legB: [-0.5 * sin(t * TAU), 0.6], armF: [-2.6, 0.3 + 0.3 * sin(t * TAU)], armB: [-2.4, 0.3], lean: -0.1, head: -0.3, y: -8 })),
        ladder: loop(6, t => ({ legF: [0.9 + 0.5 * sin(t * TAU), 1.5 + 0.5 * sin(t * TAU)], legB: [0.9 - 0.5 * sin(t * TAU), 1.5 - 0.5 * sin(t * TAU)], armF: [2.4 + 0.4 * sin(t * TAU), 0.8], armB: [2.4 - 0.4 * sin(t * TAU), 0.8], lean: 0.1, y: round(sin(t * TAU)) })),
        rope: loop(6, t => ({ legF: [0.2 + 0.2 * sin(t * TAU), 0.3], legB: [-0.1 + 0.2 * sin(t * TAU), 0.4], armF: [3 + 0.25 * sin(t * TAU), 0.1], armB: [-3 + 0.25 * sin(t * TAU), 0.1], lean: 0.05 * sin(t * TAU), y: -4 })),
        // Bow drawn from slack to full, the string hand pulls back to the chest
        aim: [0, 0.6, 1.2, 1.8, 2.4, 3].map(d => hero({ armF: [1.57, 0], armB: [1.35, 1.2 + d * 0.5], lean: -0.05, grip: 0, legF: [0.45, 0.2], legB: [-0.4, 0.2] })),
        cast: keyed(6, [{ armF: [0.9, 1.4], armB: [0.2, 1.2], lean: -0.1, grip: 0 }, { armF: [1.2, 1.6], armB: [0.5, 1.5], lean: -0.15, grip: 0, y: 1 }, { armF: [1.6, 0], armB: [0.3, 0.8], lean: 0.2, grip: 0 }, { armF: [1.5, 0.1], armB: [0.1, 0.6], lean: 0.1, grip: 0 }]),
        drink: keyed(6, [{ armF: [0.4, 1.2], lean: 0, head: 0, grip: 0 }, { armF: [1.1, 2.4], lean: -0.15, head: -0.35, grip: 0 }, { armF: [1.2, 2.6], lean: -0.2, head: -0.45, grip: 0 }, { armF: [0.6, 1.4], lean: 0, head: 0, grip: 0 }]),
        whirl: frames(8, (ctx, t) => humanoid(ctx, HERO, { armF: [1.57 + 0.2 * sin(t * TAU), 0.1], armB: [-1.6, 0.2], lean: 0.1 * sin(t * TAU * 2), grip: 0, legF: [0.5, 0.4], legB: [-0.5, 0.4], y: 3, cape: 1, scarf: 0.2, wave: t * 2 })),
        sit: loop(6, t => ({ legF: [1.5, 1.6], legB: [1.3, 1.7], armF: [1.1, 0.9 + 0.05 * sin(t * TAU)], armB: [0.9, 0.9], lean: 0.25 + 0.03 * sin(t * TAU), head: 0.1, y: 12, wave: t, cape: -0.1 })),
    }
    return sheet(96, 104, 48, 92, animations, ['roll'])
}

// Gear pieces are single drawings turned into every angle, held by the hand anchor or worn on the head anchor.
// Weapons point right from the grip in the middle of the canvas.
function drawing(size, draw) {
    const canvas = makeCanvas(size, size)
    const ctx = canvas.getContext('2d')
    ctx.translate(size / 2, size / 2)
    draw(ctx)
    return canvas
}

const GEAR_ART = {
    sword: ctx => {
        limb(ctx, [-8, 0], [-1, 0], 4, 4, WOOD)
        shape(ctx, [-10, 0], 3, 0, (lx, ly) => hypot(lx, ly) < 2.6 && ball(GOLD, lx, ly, hypot(lx, ly) / 2.6))
        limb(ctx, [0, -6], [0, 6], 3, 3, GOLD)
        shape(ctx, [22, 0], 22, 0, (lx, ly) => {
            const half = lx > 17 ? (22 - lx) * 0.55 : 2.5
            if (lx < -20 || lx > 22 || abs(ly) > half) return
            return ly < -1 ? BLADE[3] : ly < 0.5 ? BLADE[2] : ly < 1.5 ? BLADE[1] : BLADE[0]
        })
    },
    axe: ctx => {
        limb(ctx, [-12, 0], [34, 0], 4, 4, WOOD)
        shape(ctx, [30, 5], 12, 0, (lx, ly) => {
            const inside = lx > -6 && lx < 6 && ly > -3 && ly < 9 - abs(lx) * 0.2 && ly < 3 + (lx + 6) * 1.1
            if (!inside) return
            return ly > 6 ? IRON[3] : lx < -3 ? IRON[1] : IRON[2]
        })
        limb(ctx, [24, -2], [36, -2], 3, 3, IRON)
    },
    spear: ctx => {
        limb(ctx, [-28, 0], [48, 0], 3, 3, WOOD)
        shape(ctx, [54, 0], 10, 0, (lx, ly) => {
            const half = lx < 0 ? 3.5 + lx * 0.3 : 3.5 - lx * 0.4
            if (lx < -6 || abs(ly) > half) return
            return ly < 0 ? IRON[3] : IRON[1]
        })
        limb(ctx, [46, -3], [46, 3], 2, 2, GOLD)
    },
    daggers: ctx => {
        limb(ctx, [-6, 0], [-1, 0], 3, 3, WOOD)
        limb(ctx, [0, -4], [0, 4], 2, 2, GOLD)
        shape(ctx, [10, 0], 12, 0, (lx, ly) => {
            const half = lx > 5 ? (10 - lx) * 0.45 : 2
            if (lx < -9 || lx > 10 || abs(ly) > half) return
            return ly < 0 ? BLADE[3] : BLADE[1]
        })
    },
    staff: ctx => {
        limb(ctx, [-14, 0], [36, 0], 4, 3, WOOD)
        for (const x of [-4, 10, 24]) limb(ctx, [x, -2], [x + 2, 2], 1, 1, BONE)
        shape(ctx, [42, 0], 8, 0, (lx, ly) => {
            const n = abs(lx) / 7 + abs(ly) / 4.5
            return n <= 1 && (lx < -1 && ly < 0 ? ICE[3] : n > 0.75 ? ICE[0] : ly < 0 ? ICE[2] : ICE[1])
        })
    },
    // Bows stand across the aim with the string on the side of the hand
    bow: ctx => bowArt(ctx, 18, 0),
    shortbow: ctx => bowArt(ctx, 13, 0),
    frost: ctx => shape(ctx, [4, 0], 7, 0, (lx, ly) => {
        const n = hypot(lx, ly) / 5
        return n <= 1 && (n < 0.35 ? ICE[3] : ball(ICE, lx / 5, ly / 5, n))
    }),
    potion: ctx => {
        limb(ctx, [3, -8], [3, -5], 3, 3, WOOD)
        shape(ctx, [3, 0], 7, 0, (lx, ly) => {
            const n = hypot(lx, ly * 1.1) / 5
            return (n <= 1 || (abs(lx) < 1.6 && ly > -6 && ly < 0)) && (ly < -4 ? '#b8d8e0' : lx < -1.5 && ly < -1 ? '#ff9a90' : n > 0.8 ? '#6e1016' : lx > 1.5 ? '#9c1a20' : '#d42a30')
        })
    },
    helmet: ctx => shape(ctx, [0, 0], 14, 0, (lx, ly) => {
        const n = hypot(lx, ly + 1) / 10
        if (ly > 1 || n > 1) return lx > 5 && lx < 10 && ly > 1 && ly < 7 ? IRON[1] : null
        return ly > -1 ? IRON[1] : ly > -2 && lx > -6 ? IRON[3] : ball(IRON, lx / 10, (ly + 1) / 10, n)
    }),
    hood: ctx => shape(ctx, [0, 0], 14, 0, (lx, ly) => {
        const n = hypot(lx + 1, ly) / 11
        if (n > 1 || (lx > 2 && ly > -3)) return
        return ly < -7 && lx < 2 ? FUR[3] : (lx * 3 + ly) % 5 < 1 ? FUR[1] : ball(FUR, lx / 11, ly / 11, n)
    }),
    crown: ctx => shape(ctx, [0, -6], 12, 0, (lx, ly) => {
        const spikes = ly < -2 && ly > -7 && (abs(lx) < 1.5 || abs(lx - 6) < 1.5 || abs(lx + 6) < 1.5)
        if (!(spikes || (ly >= -2 && ly <= 2 && abs(lx) < 8.5))) return
        if (abs(lx) < 1.5 && ly > -1 && ly < 1.5) return SCARF[2]
        return ly < -5 ? GOLD[3] : ly > 1 ? GOLD[1] : GOLD[2]
    }),
}

function bowArt(ctx, r, draw) {
    for (let i = -r; i <= r; i++) {
        const x = round(6 * (1 - (i / r) ** 2)) + 2
        limb(ctx, [x, i], [x + 1, i], 3, 3, abs(i) > r - 3 ? WOOD : [WOOD[0], WOOD[1], WOOD[2], WOOD[3]])
    }
    ctx.fillStyle = BONE[2]
    for (let i = -r + 1; i < r; i++) ctx.fillRect(round(2 - draw * (1 - abs(i) / r)), i, 1, 1)
}

// A bow drawn back by d pixels of string with an arrow nocked
function drawnBow(r, d) {
    return drawing(64, ctx => {
        bowArt(ctx, r, d)
        limb(ctx, [2 - d, 0], [26 - d, 0], 2, 2, WOOD)
        limb(ctx, [26 - d, 0], [30 - d, 0], 4, 1, IRON)
    })
}

// Where each piece sits in hand or on the head and how far the canvas reaches
// Worn pieces drawn over the body, each on an anchor of the hero frames. Back ones are drawn behind the body.
export const WORN = {
    armor: [['shoulder', 'pauldron']],
    chainmail: [['hip', 'mailSkirt']],
    robe: [['hip', 'hem']],
    cloak: [['chest', 'furCollar']],
    shamanCloak: [['chest', 'boneCollar']],
    gloves: [['wristF', 'cuff'], ['wristB', 'cuff', 'back']],
    boots: [['footF', 'bootTop'], ['footB', 'bootTop', 'back']],
    ring: [['wristF', 'ringBand']],
    amulet: [['chest', 'pendant']],
    alphaFang: [['chest', 'fangPendant']],
}

Object.assign(GEAR_ART, {
    pauldron: ctx => shape(ctx, [0, 0], 10, 0, (lx, ly) => {
        const n = hypot(lx / 7, ly / 5)
        if (n > 1 || ly > 3) return
        return abs(lx) < 1 && ly < -3 ? GOLD[2] : ly > 1.5 ? IRON[1] : ball(IRON, lx / 7, ly / 5, n)
    }),
    mailSkirt: ctx => shape(ctx, [0, 6], 12, 0, (lx, ly) => abs(lx) < 8 + ly * 0.15 && ly > -6 && ly < 5 && (ly > 3.5 ? IRON[0] : (round(lx) + round(ly)) % 2 ? IRON[1] : IRON[3])),
    hem: ctx => shape(ctx, [0, 9], 14, 0, (lx, ly) => {
        const half = 8 + (ly + 9) * 0.25
        if (abs(lx) > half || ly < -9 || ly > 9) return
        if (ly > 7) return GOLD[2]
        return abs(lx) > half - 1 ? '#10214a' : lx < -half + 3 ? '#5c8ae0' : (round(lx) % 4 === 0 ? '#1d3a78' : '#2f5aa8')
    }),
    furCollar: ctx => shape(ctx, [-2, 5], 12, 0, (lx, ly) => {
        const n = hypot(lx / 7, ly / 3)
        return (n <= 1 || (n < 1.25 && hash(round(lx), round(ly), 3) > 0.5)) && ((round(lx * 2 + ly) & 3) === 0 ? FUR[1] : ly < -1 ? FUR[3] : FUR[2])
    }),
    boneCollar: ctx => {
        for (let i = -3; i <= 3; i++) limb(ctx, [i * 2.2 - 1, 4 + abs(i) * 0.4], [i * 2.2 - 1, 6 + abs(i) * 0.4], 2, 2, BONE)
        shape(ctx, [2, 9], 5, 0, (lx, ly) => hypot(lx, ly) < 3.2 && (abs(ly) < 1 && abs(abs(lx) - 1.2) < 0.7 ? '#1a1410' : BONE[2]))
    },
    cuff: ctx => limb(ctx, [0, -7], [0, -3], 7, 8, [LEATHER[0], LEATHER[1], LEATHER[3], FUR[3]]),
    bootTop: ctx => limb(ctx, [0, -11], [0, -8], 9, 9, [FUR[0], FUR[1], FUR[2], FUR[3]]),
    ringBand: ctx => shape(ctx, [0, -1], 3, 0, (lx, ly) => hypot(lx, ly) < 1.8 && (lx < 0 ? GOLD[3] : '#5c85ff')),
    pendant: ctx => {
        limb(ctx, [-4, -1], [0, 6], 1, 1, GOLD)
        limb(ctx, [4, -1], [0, 6], 1, 1, GOLD)
        shape(ctx, [0, 8], 4, 0, (lx, ly) => hypot(lx, ly) < 2.6 && (lx < -0.5 && ly < -0.5 ? '#c0d4ff' : '#2a55d6'))
    },
    fangPendant: ctx => {
        limb(ctx, [-4, -1], [0, 5], 1, 1, LEATHER)
        shape(ctx, [0, 9], 5, 0, (lx, ly) => ly > -3 && ly < 4 && abs(lx) < 2 - ly * 0.4 && (ly < -1.5 ? '#ff4a2f' : BONE[3]))
    },
})

const GEAR_SIZE = { sword: 96, axe: 96, spear: 144, daggers: 48, staff: 104, bow: 48, shortbow: 48, frost: 24, potion: 24, helmet: 32, hood: 32, crown: 32, pauldron: 24, mailSkirt: 28, hem: 36, furCollar: 28, boneCollar: 28, cuff: 20, bootTop: 28, ringBand: 12, pendant: 24, fangPendant: 24 }

export function buildGear(base) {
    const art = rotations(drawing(GEAR_SIZE[base], GEAR_ART[base]), ['sword', 'axe', 'spear', 'daggers', 'staff', 'bow', 'shortbow'].includes(base) ? 32 : 16)
    if (base !== 'bow' && base !== 'shortbow') return art
    // Bows also have frames with the string drawn back, used while aiming straight ahead
    const drawn = [0, 3, 6, 9].map(d => drawnBow(base === 'bow' ? 18 : 13, d))
    return { ...art, drawn: sheet(64, 64, 32, 32, { drawn: drawn.map(canvas => ctx => { ctx.drawImage(canvas, -32, -32) }) }) }
}

// Frames tweened through key poses of a rig, extra adds values that switch instead of blending
const blend = (draw, look) => (count, keys, extra = () => ({})) => frames(count, (ctx, t) => draw(ctx, look, { ...tween(keys, t), ...extra(t) }))

// Every foe shares these animation names: the fight loop picks idle, walk, windup, attack and recover,
// the renderer adds hurt, death, stun and fall.
const standard = (count, pose) => frames(count, (ctx, t) => pose(ctx, t))

const GOBLIN = {
    skin: ['#1f3a14', '#3f6b2a', '#5d8a3a', '#86b34e'],
    cloth: ['#1d1420', '#3a2a3f', '#5a4262', '#7a5a84'],
    boots: ['#120b08', '#2a1a10', '#3e2a1a', '#56402a'],
}
const LOOTER = { ...GOBLIN, cloth: ['#1c1917', '#3a3430', '#5a524a', '#7a7068'] }
const POACHER = { ...GOBLIN, skin: SKIN, cloth: ['#172012', '#2e3d22', '#4a5e34', '#6a7e4a'] }

function goblinLook(c, carry) {
    return {
        thigh: 7, shin: 8, torso: 13, shoulder: 2, neck: 11, upper: 8, fore: 7, foot: 4,
        legW: [7, 6, 5], bootW: 6, armW: [5, 4, 4], handR: 2.4, grip: 0,
        ramps: { pants: c.cloth, boots: c.boots, sleeve: c.skin, hand: c.skin },
        back: { pants: darker(c.cloth), boots: darker(c.boots), sleeve: darker(c.skin), hand: darker(c.skin) },
        behindArm: carry === 'sack' ? (ctx, { chest, lean }) => shape(ctx, along(chest, PI - lean, -4).map((v, i) => v - [9, 0][i]), 10, 0, (lx, ly) => {
            const n = hypot(lx, ly * 1.1) / 8
            return n <= 1 && ((lx + ly * 2) % 6 < 1 ? LEATHER[1] : ball(LEATHER, lx / 8, ly / 8, n))
        }) : undefined,
        body(ctx, { hip, chest, lean }) {
            const center = [(hip[0] + chest[0]) / 2, (hip[1] + chest[1]) / 2]
            shape(ctx, center, 12, lean, (lx, ly) => {
                const half = 6.5 - (ly < -5 ? (ly + 5) ** 2 * 0.3 : 0)
                if (abs(lx) > half || abs(ly) > 8) return
                if (ly > 3 && ly < 5) return '#1f140c'
                return abs(lx) > half - 1 ? c.cloth[0] : lx < -3 ? c.cloth[3] : (lx + ly) % 4 < 1 ? c.cloth[1] : c.cloth[2]
            })
        },
        // Big head with long ears, a hood and bright eyes
        face(ctx, { head, lean, pose }) {
            shape(ctx, head, 18, lean + (pose.head ?? 0), (lx, ly) => {
                const n = hypot(lx, ly) / 9.5
                const ear = lx < -4 && lx > -17 && ly > -6 + (lx + 4) * 0.35 && ly < -2 + (lx + 4) * 0.15
                const nose = lx > 7 && lx < 13 && ly > -1 && ly < 3 - (lx - 7) * 0.4
                if (n > 1 && !ear && !nose) return
                if (ear) return ly > -3 + (lx + 4) * 0.2 ? c.skin[1] : c.skin[2]
                if (ly < -3 - lx * 0.1 && lx < 6) return n > 0.9 ? c.cloth[0] : ly < -7 ? c.cloth[3] : c.cloth[2]
                if (lx > 2 && lx < 6 && ly > -2 && ly < 1) return lx > 4.5 ? '#1a1208' : '#ffe34a'
                if (ly > 4 && ly < 5.5 && lx > 1 && lx < 8) return (lx | 0) % 3 === 0 ? '#f3ead0' : '#2a160e'
                return nose ? c.skin[2] : ball(c.skin, lx / 9.5, ly / 9.5, n)
            })
        },
        carry(ctx, { handF, handB, pose }) {
            if (carry === 'bow') {
                const d = pose.draw ?? 0
                for (let i = -15; i <= 15; i++) {
                    const x = handF[0] + round(6 * (1 - (i / 15) ** 2))
                    limb(ctx, [x, handF[1] + i], [x + 1, handF[1] + i], 3, 3, WOOD)
                }
                ctx.fillStyle = BONE[2]
                const pull = handF[0] - (handF[0] - handB[0]) * min(1, d)
                for (let i = -14; i <= 14; i++) ctx.fillRect(round(handF[0] + (pull - handF[0]) * (1 - abs(i) / 15)), round(handF[1] + i), 1, 1)
                if (pose.loaded !== false) limb(ctx, [pull, handF[1]], [pull + 26, handF[1]], 2, 2, WOOD)
            }
            if (carry === 'sack' && pose.loaded !== false) limb(ctx, handF, along(handF, 1.9, 10), 3, 2, IRON)
            if (carry === 'net' && pose.loaded !== false) shape(ctx, handF, 8, 0, (lx, ly) => hypot(lx, ly) < 7 && ((round(lx + ly) & 3) === 0 || (round(lx - ly) & 3) === 0) && BONE[2])
        },
    }
}

function goblinAnimations(look, carry) {
    const walk = t => ({ ...stride(t * TAU, 0.7), y: round(-abs(sin(t * TAU)) * 1.5), lean: 0.1, armF: [1.2, 0.3], armB: carry === 'bow' ? [1, 1.4] : [0.6 * sin(t * TAU), 1] })
    const aim = d => ({ armF: [1.57, 0], armB: [1.4, 0.8 + d * 1.2], lean: -0.05 - d * 0.1, draw: d, legF: [0.4, 0.2], legB: [-0.4, 0.2] })
    const throwing = d => ({ armF: [-0.5 - d * 2, 0.8], armB: [0.5, 0.6], lean: -0.1 - d * 0.2, legF: [0.4, 0.2], legB: [-0.4, 0.2] })
    const poseAt = carry === 'bow' ? aim : carry === 'net' ? throwing : d => ({ armF: [-0.4 - d * 1.6, 1.2], armB: [0.6, 0.6], lean: 0.2, legF: [0.5, 0.4], legB: [-0.4, 0.3] })
    const hand = { armF: [1.2, 0.3], armB: carry === 'bow' ? [1, 1.4] : [0.2, 0.8] }
    const rest = { ...hand, lean: 0, head: 0, y: 0, legF: [0.15, 0.1], legB: [-0.15, 0.1] }
    // The pose right after the arrow, the net or the knife has left
    const released = carry === 'bow' ? { ...aim(0), lean: -0.2 }
        : carry === 'net' ? { armF: [1.8, 0.2], armB: [0.2, 0.6], lean: 0.25, legF: [0.6, 0.3], legB: [-0.4, 0.2] }
            : { armF: [1.6, 0], armB: [-0.4, 0.6], lean: 0.35, legF: [0.7, 0.3], legB: [-0.5, 0.2] }
    const blended = blend(humanoid, look)
    return {
        idle: standard(6, (ctx, t) => humanoid(ctx, look, { ...hand, y: sin(t * TAU) > 0 ? 1 : 0, head: 0.05 * sin(t * TAU), legF: [0.15, 0.1], legB: [-0.15, 0.1] })),
        walk: standard(8, (ctx, t) => humanoid(ctx, look, walk(t))),
        windup: frames(6, (ctx, t) => humanoid(ctx, look, poseAt(min(1, t * 1.2)))),
        attack: blended(6, [poseAt(1), released, released], t => ({ loaded: carry === 'net' && t < 0.2 })),
        recover: blended(6, [released, rest], t => ({ loaded: t > 0.6 })),
        hurt: blended(6, [rest, { ...rest, lean: -0.4, head: -0.3, y: 1 }, rest]),
        death: standard(8, (ctx, t) => humanoid(ctx, look, { armF: [-1.5 * t, 0.4], armB: [-1.2 * t, 0.4], lean: -0.3, head: -0.3, spin: -1.57 * min(1, t * 1.6), y: 13 * min(1, t * 1.6), legF: [0.3, 0.2], legB: [0.1, 0.3], loaded: false })),
        stun: standard(6, (ctx, t) => humanoid(ctx, look, { ...hand, lean: 0.25 * sin(t * TAU), head: 0.35 * sin(t * TAU + 1), y: 1 })),
        fall: frames(6, (ctx, t) => humanoid(ctx, look, { ...hand, legF: [0.5 + 0.2 * sin(t * TAU), 0.8], legB: [-0.3, 0.9], armF: [2 + 0.3 * sin(t * TAU), 0.3] })),
    }
}

export function buildGoblin(kind) {
    const carry = { archer: 'bow', looter: 'sack', poacher: 'net' }[kind]
    const look = goblinLook({ archer: GOBLIN, looter: LOOTER, poacher: POACHER }[kind], carry)
    return sheet(96, 80, 44, 74, goblinAnimations(look, carry))
}

const SHAMAN = {
    robe: ['#10203a', '#1f3550', '#2f5078', '#4a74a0'],
    skin: ['#2e5560', '#4f7f8a', '#6fa3ab', '#96c6c9'],
}

const SHAMAN_LOOK = {
    thigh: 9, shin: 10, torso: 18, shoulder: 3, neck: 10, upper: 10, fore: 9, foot: 4,
    legW: [7, 6, 5], bootW: 6, armW: [7, 6, 5], handR: 2.6, grip: 0,
    ramps: { pants: SHAMAN.robe, boots: GOBLIN.boots, sleeve: SHAMAN.robe, hand: SHAMAN.skin },
    back: { pants: darker(SHAMAN.robe), boots: darker(GOBLIN.boots), sleeve: darker(SHAMAN.robe), hand: darker(SHAMAN.skin) },
    // A long robe down to the ankles with a wolf pelt over the shoulders and bones on the belt
    body(ctx, { hip, chest, lean }) {
        const c = SHAMAN.robe
        shape(ctx, [hip[0], hip[1]], 26, lean * 0.5, (lx, ly) => {
            const half = 6 + max(0, ly + 16) * 0.28
            if (abs(lx) > half || ly < -19 || ly > 17) return
            if (ly > -2 && ly < 1) return lx > -2 && lx < 1 ? BONE[2] : '#1f140c'
            if (ly < -14) return abs(lx) > half - 1 ? FUR[0] : lx < 0 ? FUR[3] : FUR[2]
            return abs(lx) > half - 1 ? c[0] : lx < -half + 3 ? c[3] : (lx * 2 + ly) % 7 < 1 ? c[1] : c[2]
        })
    },
    face(ctx, { head, lean, pose }) {
        shape(ctx, head, 16, lean + (pose.head ?? 0), (lx, ly) => {
            const n = hypot(lx, ly) / 8.5
            const snout = lx > 2 && lx < 14 && ly > -9 && ly < -4
            const ear = abs(lx + 2) < 2.5 && ly < -7 && ly > -14
            if (n > 1 && !snout && !ear) return
            if (snout || ear || ly < -3 || lx < -3) return (lx > 8 && ly > -6) ? BONE[0] : ly < -7 ? BONE[3] : BONE[2]
            if (lx > 2 && lx < 5 && ly > -2 && ly < 0.5) return '#bff0ff'
            return ball(SHAMAN.skin, lx / 8.5, ly / 8.5, n)
        })
    },
    // Staff with an ice crystal that glows brighter while the spell gathers
    front(ctx, { handF, pose }) {
        const lift = pose.raise ?? 0
        limb(ctx, [handF[0], handF[1] + 20], [handF[0], handF[1] - 22], 3, 3, WOOD)
        shape(ctx, [handF[0], handF[1] - 27], 10, 0, (lx, ly) => {
            const n = abs(lx) / (3 + lift * 2) + abs(ly) / (6 + lift * 3)
            return n <= 1 && (lx < 0 && ly < 0 ? ICE[3] : n > 0.7 ? ICE[0] : ly < 0 ? ICE[2] : ICE[1])
        })
    },
}

export function buildShaman() {
    const s = (count, pose) => frames(count, (ctx, t) => humanoid(ctx, SHAMAN_LOOK, { legF: [0.05, 0], legB: [-0.05, 0], ...pose(t) }))
    const hold = { armF: [0.9, 0.9], armB: [-0.2, 0.4] }
    const raised = r => ({ armF: [0.9 + r * 1.6, 0.9 - r * 0.7], armB: [-0.2 - r, 0.4], raise: r, lean: -0.1 * r, head: -0.2 * r })
    return sheet(80, 104, 36, 98, {
        idle: standard(6, (ctx, t) => humanoid(ctx, SHAMAN_LOOK, { ...hold, legF: [0.05, 0], legB: [-0.05, 0], y: sin(t * TAU) > 0 ? 1 : 0, head: 0.06 * sin(t * TAU) })),
        walk: standard(8, (ctx, t) => humanoid(ctx, SHAMAN_LOOK, { ...stride(t * TAU, 0.3), ...hold, y: round(-abs(sin(t * TAU))), lean: 0.05 })),
        windup: s(6, t => raised(min(1, t * 1.2))),
        attack: s(6, t => ({ ...raised(1), armF: [2.6, 0.1], armB: [-1.4, 0.4], raise: 1.2 + 0.2 * sin(t * TAU) })),
        recover: s(6, t => raised(1 - t)),
        hurt: s(6, t => ({ ...hold, lean: -0.3 * sin(t * PI), head: -0.3 * sin(t * PI) })),
        death: standard(8, (ctx, t) => humanoid(ctx, SHAMAN_LOOK, { ...hold, lean: -0.2, spin: -1.57 * min(1, t * 1.6), y: 16 * min(1, t * 1.6), head: -0.3 })),
        stun: standard(6, (ctx, t) => humanoid(ctx, SHAMAN_LOOK, { ...hold, lean: 0.2 * sin(t * TAU), head: 0.3 * sin(t * TAU + 1) })),
        fall: s(6, t => ({ ...hold, armB: [-1.5 + 0.3 * sin(t * TAU), 0.3] })),
    })
}

const OGRE = {
    skin: ['#3a2618', '#6e4a33', '#9a6a48', '#c49468'],
    fur: ['#20140d', '#3e2a1e', '#5b3b2a', '#7d5638'],
}

function ogreLook(chief) {
    const k = chief ? 1.12 : 1
    const skin = chief ? ['#2e2a24', '#5e5244', '#86765e', '#b09a7a'] : OGRE.skin
    return {
        thigh: 14 * k, shin: 12 * k, torso: 28 * k, shoulder: 5, neck: 11 * k, upper: 15 * k, fore: 14 * k, foot: 6,
        legW: [15, 13, 11], bootW: 12, armW: [13, 12, 10], handR: 5, grip: 0,
        ramps: { pants: skin, boots: skin, sleeve: skin, hand: skin },
        back: { pants: darker(skin), boots: darker(skin), sleeve: darker(skin), hand: darker(skin) },
        // Big belly, a fur loincloth and a belt, the chief wears iron shoulder plates
        body(ctx, { hip, chest, lean }) {
            const center = [(hip[0] + chest[0]) / 2, (hip[1] + chest[1]) / 2]
            shape(ctx, center, 28 * k, lean, (lx, ly) => {
                const half = (13 + (ly > -4 ? 3 - abs(ly - 4) * 0.2 : -(ly + 4) * 0.1)) * k
                if (abs(lx) > half || abs(ly) > 17 * k) return
                if (ly > 9 * k) return abs(lx) > half - 1 ? OGRE.fur[0] : (round(lx) & 3) === 0 ? OGRE.fur[1] : OGRE.fur[2]
                if (ly > 6 * k) return '#2a160e'
                if (chief && ly < -9 * k && lx > -4) return ly < -14 * k ? IRON[3] : abs(lx) > half - 1 ? IRON[0] : IRON[2]
                return abs(lx) > half - 1 ? skin[0] : lx > 3 && ly > -6 && ly < 5 ? skin[3] : lx < -6 ? skin[1] : skin[2]
            })
        },
        face(ctx, { head, lean, pose }) {
            shape(ctx, head, 16 * k, lean + (pose.head ?? 0), (lx, ly) => {
                const n = hypot(lx, ly * 1.1) / (9 * k)
                const jaw = lx > -2 && lx < 12 * k && ly > 1 && ly < 9 * k
                const horn = chief && ((abs(lx + 6 + ly * 0.5) < 2 && ly < -6 && ly > -16) || (abs(lx - 5 + ly * 0.35) < 2 && ly < -6 && ly > -17))
                if (n > 1 && !jaw && !horn) return
                if (horn) return ly < -12 ? BONE[3] : BONE[1]
                if (chief && ly < -3) return abs(ly + 3) < 1 ? IRON[0] : ly < -7 ? IRON[3] : IRON[2]
                if ((abs(lx - 3) < 1.2 || abs(lx - 9 * k) < 1.2) && ly > 0 && ly < 4) return '#f3ead0'
                if (lx > 1 && lx < 5 && ly > -4 && ly < -1.5) return lx > 3 ? '#ff4a2f' : '#2a160e'
                if (ly > -5 && ly < -3.5 && lx > -1 && lx < 7) return skin[0]
                if (jaw && ly > 5 * k) return skin[1]
                return ball(skin, lx / 9, ly / 9, min(0.85, n))
            })
        },
        // A spiked club, heavier for the chief
        front(ctx, { handF, pose }) {
            const a = pose.club ?? 0
            const end = [handF[0] + cos(a) * 34 * k, handF[1] + sin(a) * 34 * k]
            const start = [handF[0] - cos(a) * 6, handF[1] - sin(a) * 6]
            limb(ctx, start, [handF[0] + cos(a) * 14, handF[1] + sin(a) * 14], 5, 6, WOOD)
            limb(ctx, [handF[0] + cos(a) * 12, handF[1] + sin(a) * 12], end, 8, 13 * k, WOOD)
            for (const d of [20, 28]) for (const side of [-1, 1]) {
                const base = [handF[0] + cos(a) * d * k, handF[1] + sin(a) * d * k]
                limb(ctx, base, [base[0] - sin(a) * side * 9, base[1] + cos(a) * side * 9], 3, 1, IRON)
            }
        },
    }
}

// The club follows the forearm, so wind ups lift the whole arm over the head
export function buildOgre(chief) {
    const look = ogreLook(chief)
    const o = (count, pose) => frames(count, (ctx, t) => humanoid(ctx, look, { lean: 0.3, head: -0.2, legF: [0.25, 0.2], legB: [-0.25, 0.2], armB: [-0.3, 0.5], ...pose(t) }))
    return sheet(176, 176, 84, 164, {
        idle: standard(6, (ctx, t) => humanoid(ctx, look, { lean: 0.3, head: -0.2, legF: [0.25, 0.2], legB: [-0.25, 0.2], armB: [-0.3, 0.5], armF: [0.5 + 0.05 * sin(t * TAU), 0.4], club: 0.8, y: sin(t * TAU) > 0 ? 1 : 0 })),
        walk: standard(8, (ctx, t) => humanoid(ctx, look, { ...stride(t * TAU, 0.45), lean: 0.35, head: -0.2, armF: [0.5 + 0.15 * sin(t * TAU), 0.4], armB: [-0.3 - 0.3 * sin(t * TAU), 0.5], club: 0.8, y: round(-abs(sin(t * TAU)) * 3) })),
        windup: o(6, t => {
            const u = ease(min(1, t * 1.2))
            return { armF: [0.5 - 3.4 * u, 0.4], lean: 0.3 - 0.4 * u, head: -0.3, club: -1.3 - 1.4 * u, y: 4 * u }
        }),
        attack: o(6, t => {
            const u = min(1, t * 1.2)
            return { armF: [-1.6 + 2.7 * u, 0.4], lean: 0.3 + 0.3 * u, club: -2.3 + 2.6 * u, y: 3 + 2 * u, legF: [0.6, 0.6], legB: [-0.5, 0.5] }
        }),
        recover: o(6, t => ({ armF: [1 - 0.5 * t, 0.4], club: 0.6 + 0.2 * t, lean: 0.4 - 0.1 * t, y: 2 - 2 * t })),
        hurt: o(6, t => ({ armF: [0.5 - 0.3 * sin(t * PI), 0.4], club: 0.8 - 0.3 * sin(t * PI), lean: 0.3 - 0.25 * sin(t * PI), head: -0.2 - 0.3 * sin(t * PI) })),
        death: standard(8, (ctx, t) => humanoid(ctx, look, { lean: 0.3 - t * 0.2, head: -0.4, armF: [-1 * t, 0.4], armB: [-1.2 * t, 0.5], club: 0.5 + t, spin: -1.57 * min(1, t * 1.5), y: 30 * min(1, t * 1.5), legF: [0.3, 0.2], legB: [-0.2, 0.3] })),
        stun: standard(6, (ctx, t) => humanoid(ctx, look, { lean: 0.3 + 0.2 * sin(t * TAU), head: 0.4 * sin(t * TAU + 1), armF: [0.3, 0.4], armB: [-0.3, 0.5], club: 1.2, legF: [0.25, 0.2], legB: [-0.25, 0.2] })),
        fall: o(6, t => ({ armF: [1.5 + 0.2 * sin(t * TAU), 0.4], club: -0.2, legF: [0.5, 0.8], legB: [-0.3, 0.9] })),
    })
}

const MERCHANT = { robe: ['#241a10', '#3b2a1a', '#5e4128', '#86603a'], beard: ['#6a6a6a', '#a0a0a0', '#cfcfcf', '#f0f0f0'] }

const MERCHANT_LOOK = {
    ...SHAMAN_LOOK,
    ramps: { pants: MERCHANT.robe, boots: GOBLIN.boots, sleeve: MERCHANT.robe, hand: SKIN },
    back: { pants: darker(MERCHANT.robe), boots: darker(GOBLIN.boots), sleeve: darker(MERCHANT.robe), hand: darker(SKIN) },
    behindArm(ctx, { chest }) {
        shape(ctx, [chest[0] - 12, chest[1] + 4], 16, 0, (lx, ly) => {
            if (abs(lx) > 7 || abs(ly) > 12) return
            if (ly < -12 + 5) return abs(lx) > 6 ? SCARF[0] : SCARF[2]
            return abs(lx) > 6 || abs(ly) > 11 ? LEATHER[0] : abs(ly - 2) < 1 ? LEATHER[1] : lx < -3 ? LEATHER[3] : LEATHER[2]
        })
    },
    body(ctx, joints) {
        SHAMAN_LOOK.body.call(this, ctx, joints)
        shape(ctx, joints.hip, 26, 0, (lx, ly) => {
            const half = 6 + max(0, ly + 16) * 0.28
            if (abs(lx) > half - 1 || ly < -14 || ly > 16) return
            return lx < -half + 3 ? MERCHANT.robe[3] : (lx * 2 + ly) % 7 < 1 ? MERCHANT.robe[1] : MERCHANT.robe[2]
        })
    },
    face(ctx, { head, pose }) {
        shape(ctx, head, 16, pose.head ?? 0, (lx, ly) => {
            const n = hypot(lx, ly) / 8.5
            const beard = lx > -2 && lx < 9 && ly > 1 && ly < 12 - abs(lx - 3) * 0.5
            const hood = n <= 1.25 && (ly < -3 || lx < -1)
            if (n > 1 && !beard && !hood) return
            if (brow(pose.mood, lx, ly + 1)) return MERCHANT.beard[3]
            if (hood) return n > 1.15 ? MERCHANT.robe[0] : ly < -7 ? MERCHANT.robe[3] : MERCHANT.robe[2]
            if (beard) return round(lx) % 2 ? MERCHANT.beard[1] : MERCHANT.beard[2]
            if (lx > 3 && lx < 5 && ly > -2 && ly < 0.5) return '#1d1410'
            return ball(SKIN, lx / 8.5, ly / 8.5, n)
        })
    },
    // Walking staff with a lantern
    front(ctx, { handF }) {
        limb(ctx, [handF[0], handF[1] + 34], [handF[0], handF[1] - 30], 3, 3, WOOD)
        limb(ctx, [handF[0], handF[1] - 30], [handF[0] + 7, handF[1] - 30], 2, 2, WOOD)
        shape(ctx, [handF[0] + 8, handF[1] - 24], 6, 0, (lx, ly) => abs(lx) < 4 && abs(ly) < 5 && (abs(lx) > 3 || abs(ly) > 4 ? IRON[1] : '#ffd86a'))
    },
}

export function buildMerchant() {
    const pose = t => ({ armF: [0.7, 1], armB: [-0.2, 0.4], legF: [0.05, 0], legB: [-0.05, 0], y: sin(t * TAU) > 0 ? 1 : 0, head: 0.05 * sin(t * TAU) })
    return sheet(96, 112, 48, 104, {
        idle: standard(6, (ctx, t) => humanoid(ctx, MERCHANT_LOOK, pose(t))),
        greet: standard(6, (ctx, t) => humanoid(ctx, MERCHANT_LOOK, { ...pose(t), armB: [2.6 + 0.3 * sin(t * TAU * 2), 0.5], head: -0.1 })),
    })
}

const WOLF = { fur: ['#262d33', '#4c5862', '#6b7884', '#9aa8b3'], belly: '#c9d4dc', eye: '#ffd23f' }
const ALPHA = { fur: ['#101418', '#2a3238', '#3b444c', '#58636c'], belly: '#8a969f', eye: '#ff4a2f' }
const LYNX = { fur: ['#4a3420', '#7a5a38', '#a8814f', '#d0aa74'], belly: '#f2e6cc', eye: '#9fe84a' }

function wolfLook(c, kind) {
    const k = kind === 'alpha' ? 1.35 : 1
    return {
        length: 30 * k, height: 26 * k, upper: 13 * k, lower: 13 * k, neck: 12 * k,
        legW: [7 * k, 5 * k, 4 * k], neckW: 11 * k, fur: c.fur,
        tail(ctx, { hips, pose }) {
            const a = pose.tail
            const short = kind === 'lynx'
            const mid = along(hips, -PI / 2 - a * 0.6, (short ? 6 : 12) * k)
            limb(ctx, hips, mid, 7 * k, 6 * k, c.fur)
            if (short) return limb(ctx, mid, along(mid, -PI / 2 - a, 4), 5, 4, [c.fur[0], c.fur[0], c.fur[0], c.fur[1]])
            limb(ctx, mid, along(mid, -PI / 2 - a * 1.2, 11 * k), 6 * k, 3, [c.fur[0], c.fur[1], c.fur[2], c.belly])
        },
        body(ctx, { center, pitch }) {
            const len = 30 * k
            shape(ctx, center, len, -pitch, (lx, ly) => {
                const half = (9 + (lx > 0 ? 2.5 : 0) - (abs(lx) > len / 2 ? (abs(lx) - len / 2) * 0.9 : 0)) * k
                if (abs(ly - (lx > 0 ? -1 : 0)) > half || abs(lx) > len / 2 + 8 * k) return
                const edge = abs(ly) > half - 1.2
                if (edge) return c.fur[0]
                if (kind === 'lynx' && hash(round(lx / 3), round(ly / 3), 7) > 0.8) return c.fur[1]
                if (kind === 'alpha' && abs(ly + lx * 0.4) < 1 && lx > 2 && lx < 12) return '#c9a0a0'
                if (ly > half - 4) return c.belly
                return ly < -half + 3 ? c.fur[3] : (round(lx * 0.7 + ly) & 3) === 0 ? c.fur[1] : c.fur[2]
            })
        },
        face(ctx, { head, pose }) {
            const jaw = pose.jaw
            shape(ctx, head, 22 * k, -(PI / 2 - pose.neck) * 0.4 + pose.head, (lx, ly) => {
                lx /= k
                ly /= k
                const skull = hypot(lx, ly) < 8
                const snout = lx > 3 && lx < 16 && ly > -3 && ly < 2
                const lower = lx > 3 && lx < 14 && ly > 2 + jaw * (lx - 3) * 0.1 && ly < 5 + jaw * (lx - 3) * 0.12
                const ear = lx > -5 && lx < 1 && ly < -6 && ly > -14 - (kind === 'lynx' ? 3 : 0) + abs(lx + 2) * 1.2
                if (!skull && !snout && !lower && !ear) return
                if (ear) return lx > -3 && lx < -1 && ly > -11 ? '#5a1a1a' : c.fur[1]
                if (snout && lx > 13 && ly < 0) return '#141414'
                if (lower) return jaw > 0.2 && ly < 3 + jaw * (lx - 3) * 0.1 ? '#ffffff' : c.fur[1]
                if (jaw > 0.2 && lx > 4 && ly > 1.5 && ly < 3 + jaw * (lx - 3) * 0.1) return '#5a1a1a'
                if (lx > 2 && lx < 5 && ly > -4 && ly < -2) return c.eye
                if (snout) return ly < -1 ? c.fur[3] : c.fur[2]
                return ly > 4 ? c.belly : ball(c.fur, lx / 8, ly / 8, hypot(lx, ly) / 8)
            })
        },
    }
}

// Four leg gaits: legs are [front near, front far, back near, back far]
const gait = (a, spread = 0.7) => [[spread * sin(a), -0.5 + 0.5 * max(0, cos(a))], [spread * sin(a + 0.6), -0.5 + 0.5 * max(0, cos(a + 0.6))], [-spread * sin(a), 0.6 * max(0, -cos(a)) - 0.2], [-spread * sin(a + 0.6), 0.6 * max(0, -cos(a + 0.6)) - 0.2]]

export function buildWolf(kind) {
    const look = wolfLook({ wolf: WOLF, alpha: ALPHA, lynx: LYNX }[kind], kind)
    const w = (count, pose) => frames(count, (ctx, t) => quadruped(ctx, look, pose(t)))
    const blended = blend(quadruped, look)
    const lunge = [{ pitch: 0.25, neck: 1.1, jaw: 1, tail: 1.2, legs: [[1.2, -0.3], [1.1, -0.3], [-1.1, 0.3], [-1, 0.3]] }, { pitch: 0.1, neck: 1.2, jaw: 0.8, tail: 1.1, legs: [[1, -0.3], [0.9, -0.3], [-1.2, 0.3], [-1.1, 0.3]] }]
    const stand = { pitch: 0, neck: 0.9, jaw: 0, tail: 0.6, legs: [[0.1, 0.2], [-0.1, 0.2], [0.1, -0.3], [-0.1, -0.3]] }
    const crouch = d => ({ y: 5 * d, pitch: -0.12 * d, neck: 1.2 + 0.2 * d, jaw: 0.6 * d, tail: 0.2, legs: [[0.5, -1 * d], [0.4, -1 * d], [-0.3, 0.9 * d], [-0.4, 0.9 * d]] })
    const run = t => ({ legs: gait(t * TAU), y: round(-abs(sin(t * TAU)) * 2), pitch: 0.06 * sin(t * TAU), tail: 0.9, neck: 1.25 })
    const animations = {
        idle: standard(6, (ctx, t) => quadruped(ctx, look, { tail: 0.4 + 0.15 * sin(t * TAU), y: sin(t * TAU) > 0 ? 1 : 0, head: 0.05 * sin(t * TAU) })),
        walk: standard(8, (ctx, t) => quadruped(ctx, look, run(t))),
        windup: w(6, t => crouch(min(1, t * 1.25))),
        attack: blended(6, lunge),
        recover: w(6, t => crouch(0.6 * (1 - t))),
        charge: standard(8, (ctx, t) => quadruped(ctx, look, { ...run(t), legs: gait(t * TAU, 1.1), pitch: 0.12 * sin(t * TAU), jaw: 0.5, neck: 1.35 })),
        howl: standard(6, (ctx, t) => quadruped(ctx, look, { pitch: 0.3, neck: 0.25, head: -0.9, jaw: 0.6 + 0.2 * sin(t * TAU * 2), tail: 0.2, y: 2, legs: [[0.1, 0], [0, 0], [0.3, -0.9], [0.2, -0.9]] })),
        hurt: blended(6, [stand, { pitch: 0.2, neck: 0.7, jaw: 0.5, tail: 0.1, legs: [[-0.3, 0], [-0.4, 0], [-0.5, 0.2], [-0.4, 0.2]] }, stand]),
        death: standard(8, (ctx, t) => quadruped(ctx, look, { y: 16 * min(1, t * 1.5) * k(kind), pitch: -0.1, neck: 1.6, head: 0.5, jaw: 0.3, tail: 0, legs: [[1.3 * t, 0], [1.1 * t, 0], [-1.3 * t, 0], [-1.1 * t, 0]] })),
        stun: standard(6, (ctx, t) => quadruped(ctx, look, { neck: 1.5 + 0.2 * sin(t * TAU), head: 0.3 * sin(t * TAU), pitch: 0.05 * sin(t * TAU), tail: 0.1, y: 2 })),
        fall: w(6, t => ({ pitch: -0.2, neck: 1.3, tail: 1.3, legs: [[0.8 + 0.2 * sin(t * TAU), 0], [0.7, 0], [-0.8 - 0.2 * sin(t * TAU), 0], [-0.7, 0]] })),
    }
    return kind === 'alpha' ? sheet(160, 112, 76, 104, animations) : sheet(120, 88, 58, 82, animations)
}

const k = kind => kind === 'alpha' ? 1.35 : 1

const CHEST = ['#3a2210', '#6a4220', '#8a5a2b', '#b07a44']

// A chest seen from the side, its lid lifted by open pixels and the whole box hopping when it is a mimic
function chestArt(ctx, open, hop, teeth) {
    const y = -hop
    shape(ctx, [0, -12 + y], 22, 0, (lx, ly) => {
        if (abs(lx) > 18 || ly < -0.5 || ly > 12) return
        if (abs(lx) > 17 || ly > 11) return CHEST[0]
        if (abs(lx - 10) < 2 || abs(lx + 10) < 2) return ly < 1 ? IRON[3] : IRON[2]
        return (round(ly) % 5 === 0) ? CHEST[1] : lx < -12 ? CHEST[3] : CHEST[2]
    })
    if (teeth) {
        shape(ctx, [0, -13 + y - open / 2], 20, 0, (lx, ly) => abs(lx) < 16 && abs(ly) <= open / 2 + 0.5 && '#5a1a1a')
        for (let x = -14; x <= 14; x += 5) {
            limb(ctx, [x, -12 + y], [x, -15 + y], 2, 1, BONE)
            limb(ctx, [x + 2, -13 + y - open], [x + 2, -10 + y - open], 2, 1, BONE)
        }
    }
    shape(ctx, [0, -18 + y - open], 22, 0, (lx, ly) => {
        const top = -6 + (lx * lx) / 90
        if (abs(lx) > 18 || ly < top || ly > 5) return
        if (abs(lx) > 17 || ly < top + 1) return ly < top + 1 ? CHEST[3] : CHEST[0]
        if (teeth && ly > 0 && ly < 3 && abs(abs(lx) - 5) < 1.5) return '#ff4a2f'
        if (!teeth && abs(lx) < 2.5 && ly > 0) return GOLD[2]
        return abs(lx - 10) < 2 || abs(lx + 10) < 2 ? IRON[2] : ly > 3 ? CHEST[1] : CHEST[2]
    })
}

// Treasure chest with a glint now and then
export function buildChest() {
    const plain = ctx => chestArt(ctx, 0, 0, false)
    const glint = ctx => {
        chestArt(ctx, 0, 0, false)
        return { after: c => limb(c, [8, -24], [8, -24], 2, 2, ['#ffffff', '#ffffff', '#ffffff', '#ffffff']) }
    }
    return sheet(48, 40, 24, 36, { idle: [plain, plain, plain, glint], death: [ctx => chestArt(ctx, 8, 0, false)] })
}

// Looks like a chest while it waits
export function buildMimic() {
    const plain = ctx => chestArt(ctx, 0, 0, false)
    return sheet(48, 64, 24, 58, {
        idle: [plain, plain, plain, plain],
        walk: frames(8, (ctx, t) => chestArt(ctx, 3, 6 * abs(sin(t * PI)), true)),
        windup: frames(6, (ctx, t) => chestArt(ctx, 2 + 7 * t, 0, true)),
        attack: frames(6, (ctx, t) => chestArt(ctx, 14 - 3 * t, 6 * sin(t * PI), true)),
        recover: frames(6, (ctx, t) => chestArt(ctx, 9 * (1 - t) + 1, 0, true)),
        hurt: frames(6, (ctx, t) => chestArt(ctx, 2 + 5 * sin(t * PI), 2 * sin(t * PI), true)),
        death: frames(6, (ctx, t) => chestArt(ctx, 14 + 4 * t, 0, true)),
        stun: frames(6, (ctx, t) => chestArt(ctx, 2 + sin(t * TAU), 1 + sin(t * TAU), true)),
        fall: frames(6, (ctx, t) => chestArt(ctx, 6 + sin(t * TAU), 0, true)),
    })
}

// Quest board with notes pinned under a snowy roof
export function buildBoard() {
    return sheet(80, 104, 40, 100, {
        idle: [ctx => {
            limb(ctx, [-22, 0], [-22, -76], 5, 5, WOOD)
            limb(ctx, [22, 0], [22, -76], 5, 5, WOOD)
            shape(ctx, [0, -56], 30, 0, (lx, ly) => abs(lx) < 27 && abs(ly) < 18 && (abs(lx) > 25.5 || abs(ly) > 16.5 ? WOOD[0] : (round(ly) % 6 === 0 ? WOOD[1] : WOOD[2])))
            shape(ctx, [0, -80], 34, 0, (lx, ly) => abs(lx) < 31 - max(0, ly) * 0 && ly > -4 && ly < 4 && (ly < -1 ? '#f4fafc' : ly < 1 ? '#c2dbe7' : WOOD[1]))
            for (const [x, y, w, h] of [[-20, -68, 16, 20], [2, -66, 18, 14], [-6, -48, 14, 10]]) {
                shape(ctx, [x + w / 2, y + h / 2], max(w, h), 0, (lx, ly) => abs(lx) < w / 2 && abs(ly) < h / 2 && ((round(ly) % 3 === 0 && abs(lx) < w / 2 - 2 && ly > -h / 2 + 2) ? '#8a7a5a' : '#efe0c0'))
                limb(ctx, [x + w / 2, y + 1], [x + w / 2, y + 1], 2, 2, SCARF)
            }
        }],
    })
}

// Loot, gear and skill icons in 32 pixel cells with the origin in the middle, shown on the ground, in panels and on the hotbar
const glass = (ctx, c, body) => shape(ctx, c, 12, 0, (lx, ly) => {
    const n = hypot(lx, ly) / 8
    return n <= 1 && (lx < -3 && ly < -3 ? '#ffffff' : ball(body, lx / 8, ly / 8, n))
})
const quiver = (tip, feather) => ctx => {
    for (const x of [-6, 0, 6]) {
        limb(ctx, [x - 4, 10], [x + 4, -8], 2, 2, WOOD)
        limb(ctx, [x + 4, -8], [x + 6, -12], 4, 1, tip)
        limb(ctx, [x - 4, 10], [x - 6, 13], 4, 3, feather)
    }
}
const flat = color => [color[0], color[1], color[1], color[2]]

const ICON_ART = {
    gold: ctx => {
        glass(ctx, [-4, 4], ['#6a4a10', '#c98f1c', '#f0c419', '#fff2a8'])
        glass(ctx, [5, -3], ['#6a4a10', '#c98f1c', '#f0c419', '#fff2a8'])
    },
    potion: ctx => {
        limb(ctx, [0, -13], [0, -9], 5, 5, WOOD)
        limb(ctx, [0, -9], [0, -4], 5, 5, ['#6f8a90', '#8fb0b8', '#b8d8e0', '#e8f8ff'])
        glass(ctx, [0, 4], ['#4a0a0e', '#9c1a20', '#d42a30', '#ff9a90'])
    },
    fur: ctx => shape(ctx, [0, 0], 15, 0, (lx, ly) => {
        const inside = abs(lx) < 12 - max(0, ly - 4) && abs(ly) < 8 || (abs(abs(lx) - 9) < 3 && ly > 5 && ly < 12)
        return inside && ((round(lx + ly) & 3) === 0 ? FUR[1] : ly < -5 ? FUR[3] : FUR[2])
    }),
    fang: ctx => shape(ctx, [0, 0], 15, 0.4, (lx, ly) => {
        const half = 4 - (ly + 12) * 0.16
        return ly > -12 && ly < 12 && abs(lx + (ly + 12) * 0.12) < half && (lx < -1 ? BONE[3] : lx > 2 ? BONE[1] : BONE[2])
    }),
    arrows: quiver(IRON, SCARF),
    iceArrows: quiver(ICE, ICE),
    fireArrows: quiver(['#8a2a0a', '#f07a19', '#f0c419', '#fff2a8'], ['#8a2a0a', '#f07a19', '#f0c419', '#fff2a8']),
    pierceArrows: quiver(['#8a9398', '#c5ccd0', '#ffffff', '#ffffff'], IRON),
    sword: ctx => {
        limb(ctx, [-12, 12], [-7, 7], 3, 3, WOOD)
        limb(ctx, [-11, 3], [-3, 11], 3, 3, GOLD)
        shape(ctx, [3, -3], 16, -PI / 4, (lx, ly) => lx > -9 && lx < 16 && abs(ly) < (lx > 11 ? (16 - lx) * 0.5 : 2.5) && (ly < -0.5 ? BLADE[3] : ly < 1 ? BLADE[2] : BLADE[1]))
    },
    axe: ctx => {
        limb(ctx, [-12, 13], [9, -8], 3, 3, WOOD)
        shape(ctx, [8, -8], 12, -PI / 4, (lx, ly) => lx > -5 && lx < 5 && ly > -1 && ly < 9 - abs(lx) * 0.3 && (ly > 6 ? IRON[3] : lx < -2 ? IRON[1] : IRON[2]))
    },
    spear: ctx => {
        limb(ctx, [-13, 13], [7, -7], 2, 2, WOOD)
        shape(ctx, [10, -10], 8, -PI / 4, (lx, ly) => lx > -4 && lx < 7 && abs(ly) < (lx < 0 ? 2.5 + lx * 0.3 : 2.5 - lx * 0.35) + 0.5 && (ly < 0 ? IRON[3] : IRON[1]))
    },
    daggers: ctx => {
        for (const [x, a] of [[-4, -PI / 4], [5, -PI / 3]]) {
            limb(ctx, [x - 7, 9], [x - 4, 6], 3, 3, WOOD)
            shape(ctx, [x + 1, 1], 9, a, (lx, ly) => lx > -3 && lx < 8 && abs(ly) < (lx > 4 ? (8 - lx) * 0.5 : 2) && (ly < 0 ? BLADE[3] : BLADE[1]))
        }
    },
    staff: ctx => {
        limb(ctx, [-12, 13], [6, -5], 3, 3, WOOD)
        shape(ctx, [9, -9], 7, -PI / 4, (lx, ly) => {
            const n = abs(lx) / 6 + abs(ly) / 4
            return n <= 1 && (lx < -1 && ly < 0 ? ICE[3] : n > 0.75 ? ICE[0] : ICE[2])
        })
    },
    bow: ctx => { ctx.save(); ctx.rotate(-PI / 4); ctx.translate(-4, 0); bowArt(ctx, 15, 0); ctx.restore() },
    shortbow: ctx => { ctx.save(); ctx.rotate(-PI / 4); ctx.translate(-4, 0); bowArt(ctx, 11, 0); ctx.restore() },
    helmet: ctx => { ctx.save(); ctx.scale(1.4, 1.4); GEAR_ART.helmet(ctx); ctx.restore() },
    hood: ctx => { ctx.save(); ctx.scale(1.3, 1.3); GEAR_ART.hood(ctx); ctx.restore() },
    crown: ctx => { ctx.save(); ctx.translate(0, 6); ctx.scale(1.3, 1.3); GEAR_ART.crown(ctx); ctx.restore() },
    armor: ctx => torsoIcon(ctx, GEAR_CLOTHES.armor.vest, GEAR_CLOTHES.armor.shirt),
    chainmail: ctx => torsoIcon(ctx, GEAR_CLOTHES.chainmail.vest, GEAR_CLOTHES.chainmail.vest, true),
    robe: ctx => torsoIcon(ctx, GEAR_CLOTHES.robe.vest, GEAR_CLOTHES.robe.shirt, false, true),
    cloak: ctx => capeIcon(ctx, FUR),
    shamanCloak: ctx => capeIcon(ctx, GEAR_CLOTHES.shamanCloak.cape, BONE),
    gloves: ctx => {
        for (const x of [-6, 5]) {
            limb(ctx, [x, 8], [x, -2], 9, 8, LEATHER)
            limb(ctx, [x - 3, -2], [x - 3, -10], 3, 3, LEATHER)
            limb(ctx, [x + 1, -3], [x + 1, -11], 3, 3, LEATHER)
            limb(ctx, [x + 5, 2], [x + 7, -3], 3, 3, LEATHER)
        }
    },
    boots: ctx => {
        for (const x of [-7, 3]) {
            limb(ctx, [x, -11], [x, 6], 8, 8, LEATHER)
            limb(ctx, [x, 8], [x + 9, 8], 7, 5, LEATHER)
        }
    },
    ring: ctx => {
        shape(ctx, [0, 4], 11, 0, (lx, ly) => {
            const n = hypot(lx, ly * 1.2)
            return n > 5 && n < 9.5 && (ly < -2 ? GOLD[3] : ly > 3 ? GOLD[1] : GOLD[2])
        })
        glass(ctx, [0, -7], ['#0e2a70', '#2a55d6', '#5c85ff', '#c0d4ff'])
    },
    amulet: ctx => {
        for (const side of [-1, 1]) limb(ctx, [side * 9, -13], [0, 1], 2, 2, GOLD)
        glass(ctx, [0, 6], ['#0e2a70', '#2a55d6', '#5c85ff', '#c0d4ff'])
    },
    alphaFang: ctx => {
        for (const side of [-1, 1]) limb(ctx, [side * 9, -13], [0, -4], 2, 2, LEATHER)
        shape(ctx, [0, 4], 12, 0, (lx, ly) => ly > -6 && ly < 11 && abs(lx) < 4 - (ly + 6) * 0.2 && (ly < -3 ? ALPHA.eye : lx < 0 ? BONE[3] : BONE[1]))
    },
    // Skills from the hotbar and the talent tree
    frost: ctx => {
        for (const a of [0, PI / 3, 2 * PI / 3]) limb(ctx, along([0, 0], a, 13), along([0, 0], a + PI, 13), 2, 2, flat(ICE))
        glass(ctx, [0, 0], ICE)
    },
    freeze: ctx => {
        ICON_ART.sword(ctx)
        for (const [x, y] of [[8, -10], [12, 2], [-2, -6]]) limb(ctx, [x - 3, y], [x + 3, y], 2, 2, ['#ffffff', '#ffffff', '#ffffff', '#ffffff']) || limb(ctx, [x, y - 3], [x, y + 3], 2, 2, ['#ffffff', '#ffffff', '#ffffff', '#ffffff'])
    },
    shield: ctx => shape(ctx, [0, 0], 15, 0, (lx, ly) => {
        const n = hypot(lx, ly) / 13
        return n <= 1 && (abs(lx) < 1 || abs(ly) < 1 ? '#dff6ff' : n > 0.85 ? ICE[0] : lx + ly < -6 ? ICE[3] : lx + ly < 4 ? ICE[2] : ICE[1])
    }),
    whirl: ctx => {
        shape(ctx, [0, 0], 15, 0, (lx, ly) => {
            const n = hypot(lx, ly)
            return n > 11 && n < 14 && ((Math.atan2(ly, lx) + PI) % 2.1) < 1.5 && '#8ff0e4'
        })
        ICON_ART.sword(ctx)
    },
    volley: ctx => {
        for (const x of [-9, 0, 9]) {
            limb(ctx, [x - 3, -12], [x + 1, 6], 2, 2, WOOD)
            limb(ctx, [x + 1, 6], [x + 2, 12], 4, 1, IRON)
        }
    },
    nova: ctx => {
        shape(ctx, [0, 0], 15, 0, (lx, ly) => {
            const n = hypot(lx, ly)
            return (n > 11 && n < 14 && ICE[2]) || (n > 7 && n < 9 && ICE[1])
        })
        glass(ctx, [0, 0], ICE)
    },
}

function torsoIcon(ctx, outer, inner, rings = false, long = false) {
    shape(ctx, [0, 0], 15, 0, (lx, ly) => {
        const half = ly < -8 ? 13 : 9
        if (abs(lx) > half || ly < -12 || ly > (long ? 14 : 11)) return
        if (ly < -8 && abs(lx) < 4) return
        if (rings && (round(lx) + round(ly)) % 2 === 0) return outer[3]
        return abs(lx) > half - 1 ? outer[0] : abs(lx) < 3 ? inner[2] : lx < -5 ? outer[3] : outer[2]
    })
}

function capeIcon(ctx, ramp, trim = FUR) {
    shape(ctx, [0, 0], 15, 0, (lx, ly) => {
        const half = 7 + (ly + 12) * 0.28
        if (abs(lx) > half || ly < -12 || ly > 13) return
        if (ly < -8) return trim[ly < -10 ? 3 : 2]
        return abs(lx) > half - 1 ? ramp[0] : (round(lx) % 5 === 0 ? ramp[1] : lx < -4 ? ramp[3] : ramp[2])
    })
}

export function buildItems() {
    return sheet(32, 32, 16, 16, Object.fromEntries(Object.entries(ICON_ART).map(([item, draw]) => [item, [draw]])))
}

// Marks of timed effects shown over health bars
const STATUS_ART = {
    slow: ctx => shape(ctx, [0, 0], 7, 0, (lx, ly) => abs(ly) < 6 && abs(lx) < abs(ly) * 0.8 + 1 && (abs(ly) > 4 ? ICE[2] : ICE[1])),
    freeze: ctx => {
        for (const a of [0, PI / 3, 2 * PI / 3]) limb(ctx, along([0, 0], a, 6), along([0, 0], a + PI, 6), 2, 2, ['#ffffff', '#ffffff', '#ffffff', '#ffffff'])
    },
    bleed: ctx => shape(ctx, [0, 1], 7, 0, (lx, ly) => (hypot(lx, ly - 1.5) < 4 || (abs(lx) < 3 - (-ly - 2) * 0.6 && ly < 0 && ly > -6)) && (lx < -1 && ly < 1 ? '#ff6b5a' : '#c21a0e')),
    burn: ctx => shape(ctx, [0, 0], 7, 0, (lx, ly) => abs(lx) < 4.5 - (-ly) * 0.55 && ly < 5 && ly > -6 && (abs(lx) < 1.8 && ly > -1 ? '#fff2a8' : ly > 1 ? '#f07a19' : '#f0c419')),
    root: ctx => {
        for (const y of [-3, 2]) limb(ctx, [-5, y], [5, y], 2, 2, WOOD)
        for (const x of [-2, 2]) limb(ctx, [x, -6], [x, 5], 2, 2, BONE)
    },
    frenzy: ctx => {
        for (const y of [-2, 3]) {
            limb(ctx, [-4, y + 2], [0, y - 2], 2, 2, SCARF)
            limb(ctx, [0, y - 2], [4, y + 2], 2, 2, SCARF)
        }
    },
}

export function buildStatuses() {
    return sheet(16, 16, 8, 8, Object.fromEntries(Object.entries(STATUS_ART).map(([name, draw]) => [name, [draw]])))
}

// Projectiles point right and turn with their flight
export function buildProjectiles() {
    const arrow = drawing(40, ctx => {
        limb(ctx, [-14, 0], [12, 0], 2, 2, WOOD)
        limb(ctx, [12, 0], [17, 0], 5, 1, IRON)
        limb(ctx, [-17, -2], [-11, 0], 2, 2, SCARF)
        limb(ctx, [-17, 2], [-11, 0], 2, 2, SCARF)
    })
    const icicle = drawing(40, ctx => shape(ctx, [0, 0], 18, 0, (lx, ly) => {
        const half = 5 - (lx + 12) * 0.2
        return lx > -12 && abs(ly) < half && (ly < -1 ? ICE[3] : ly < 2 ? ICE[2] : ICE[1])
    }))
    const net = drawing(28, ctx => shape(ctx, [0, 0], 12, 0, (lx, ly) => hypot(lx, ly) < 10 && ((round(lx + ly) & 3) === 0 || (round(lx - ly) & 3) === 0) && BONE[2]))
    return { arrow: rotations(arrow, 32), icicle: rotations(icicle, 32), net: rotations(net, 8) }
}

// Soft round light, stretched and tinted for glows and the light map
export function buildGlow() {
    const canvas = makeCanvas(64, 64)
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.45)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    return canvas
}

// Marks left on the ground: footprints, blood, a crack in the ice and a scorch, plus the dithered shadow under bodies
export function buildMarks() {
    const dither = (color, lx, ly, n) => (n < 0.6 || (round(lx) + round(ly)) % 2 === 0) && color
    return sheet(32, 16, 16, 8, {
        step: [ctx => shape(ctx, [0, 1], 6, 0, (lx, ly) => abs(ly) < 1.2 && abs(lx - 2) < 3 && '#b3cfdc')],
        blood: [0, 1, 2].map(v => ctx => shape(ctx, [0, 0], 15, 0, (lx, ly) => {
            const n = hypot(lx / (8 + v * 2), ly / 2.5)
            return (n < 1 || hash(round(lx), round(ly), v) > 0.93 && abs(ly) < 3 && abs(lx) < 13) && (n < 0.5 ? '#6e0a08' : '#a0140c')
        })),
        crack: [ctx => {
            limb(ctx, [-10, 0], [-2, -1], 1, 1, ['#ffffff', '#ffffff', '#ffffff', '#ffffff'])
            limb(ctx, [-2, -1], [4, 2], 1, 1, ['#ffffff', '#ffffff', '#ffffff', '#ffffff'])
            limb(ctx, [4, 2], [11, 0], 1, 1, ['#dff6ff', '#dff6ff', '#dff6ff', '#dff6ff'])
            limb(ctx, [-2, -1], [0, 3], 1, 1, ['#dff6ff', '#dff6ff', '#dff6ff', '#dff6ff'])
        }],
        shadow: [ctx => shape(ctx, [0, 0], 16, 0, (lx, ly) => {
            const n = hypot(lx / 14, ly / 3.5)
            return n < 1 && dither('#0a1a28', lx, ly, n)
        })],
    })
}

// Paints the cloth key colors of a baked hero canvas with clothes, like the renderer does on the GPU
function wear(canvas, clothes) {
    const ctx = canvas.getContext('2d')
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
        if (d[i] !== 254 || !d[i + 3]) continue
        const color = clothes[CLOTHES[(d[i + 1] - 8) / 16]]?.[(d[i + 2] - 32) / 64]
        if (color) d.set([1, 3, 5].map(j => parseInt(color.slice(j, j + 2), 16)), i)
        else d[i + 3] = 0
    }
    ctx.putImageData(img, 0, 0)
}

// Faces for dialogs cut out around the head of a still pose, one for every mood
export function buildPortraits() {
    const cut = (sheetOf, size, lift) => Object.fromEntries(['calm', 'angry', 'worried'].map(mood => {
        const art = sheetOf(mood)
        const [frame] = art.frames.face
        const canvas = makeCanvas(size, size)
        canvas.getContext('2d').drawImage(art.canvas, art.originX + frame.head[0] - size / 2, art.originY + frame.head[1] - size / 2 + lift, size, size, 0, 0, size, size)
        return [mood, canvas]
    }))
    const still = { armF: [0.2, 0.3], armB: [-0.2, 0.3] }
    const hero = cut(mood => sheet(96, 104, 48, 92, { face: [ctx => humanoid(ctx, HERO, { ...still, mood })] }), 40, 6)
    for (const canvas of Object.values(hero)) wear(canvas, HERO_CLOTHES)
    return {
        hero,
        merchant: cut(mood => sheet(96, 112, 48, 104, { face: [ctx => humanoid(ctx, MERCHANT_LOOK, { ...still, mood })] }), 40, 6),
        chief: Object.fromEntries(['calm', 'angry', 'worried'].map(mood => [mood, chiefPortrait(mood)])),
    }
}

// Nine slice frame of dark wood with snow and icicles on top, stretched around panels by CSS border-image
export function buildFrame() {
    const size = 18, edge = 6, far = size - 1
    return paint(size, size, (x, y) => {
        const d = Math.min(x, y, far - x, far - y)
        if (d >= edge) return '#241208f2'
        if (d === 0 || d === edge - 1) return INK
        // Snow lies on the top edge with icicles hanging into the wood
        if (y < 3 && d === y) return y === 1 ? '#ffffff' : '#c2dbe7'
        if (y === 3 && x > 5 && x < 12 && x % 2 === 0) return '#8fdcfa'
        if (Math.abs(x - y) < 1 || Math.abs(far - x - y) < 1) return d > 1 && d < 4 ? '#8fdcfa' : WOOD[1]
        return d === 1 ? WOOD[3] : d === 4 ? WOOD[1] : WOOD[2]
    })
}

// Spell effects drawn frame by frame. Each is played once over its life or looped while it lasts.
const WHITE = ['#dff6ff', '#ffffff', '#ffffff', '#ffffff']
const SPELLS = {
    // A spinning ice crystal with sparkles circling it and a frosty tail
    bolt: [48, 32, 24, 16, 6, t => ctx => {
        limb(ctx, [-4, 0], [-22, sin(t * TAU) * 2], 5, 1, [ICE[0], ICE[1], ICE[2], ICE[2]])
        shape(ctx, [2, 0], 12, t * TAU, (lx, ly) => {
            const n = abs(lx) / 9 + abs(ly) / 5
            return n <= 1 && (n < 0.35 ? '#ffffff' : lx < 0 === ly < 0 ? ICE[3] : ICE[1])
        })
        for (let k = 0; k < 3; k++) {
            const a = t * TAU * 2 + k * 2.1
            limb(ctx, [2 + cos(a) * 11, sin(a) * 6], [2 + cos(a) * 11, sin(a) * 6], 2, 2, WHITE)
        }
    }],
    // Shards of ice flying apart from a bright flash
    shatter: [96, 96, 48, 48, 7, t => ctx => {
        if (t < 0.4) shape(ctx, [0, 0], 14, 0, (lx, ly) => hypot(lx, ly) < 12 * (1 - t * 2.2) && '#ffffff')
        for (let k = 0; k < 9; k++) {
            const a = k / 9 * TAU + 0.3, d = 6 + t * 36, size = 6 * (1 - t) + 1.5
            shape(ctx, [cos(a) * d, sin(a) * d + t * t * 10], size + 1, a + t * 4, (lx, ly) => abs(lx) / size + abs(ly) / (size * 0.45) <= 1 && (ly < 0 ? ICE[3] : ICE[1]))
        }
    }],
    // A ring of frost rolling out along the ground with spikes of ice rising from it
    nova: [460, 220, 230, 110, 8, t => ctx => {
        const radius = 24 + t * 196, thick = 10 * (1 - t) + 2
        shape(ctx, [0, 0], 230, 0, (lx, ly) => {
            const d = abs(hypot(lx, ly * 2.2) - radius)
            return d < thick && (t < 0.6 || (round(lx) + round(ly)) % 2 === 0) && (d < thick * 0.4 ? '#ffffff' : ICE[2])
        })
        if (t < 0.75) for (let k = 0; k < 18; k++) {
            const a = k / 18 * TAU, x = cos(a) * radius, y = sin(a) * radius / 2.2
            limb(ctx, [x, y], [x * 1.08, y * 1.08 - 14 * (1 - t)], 5, 1, ICE)
        }
    }],
    // A bubble of ice facets with a glint running over it
    shield: [80, 88, 40, 44, 6, t => ctx => shape(ctx, [0, 0], 40, 0, (lx, ly) => {
        const hex = max(abs(lx) * 0.866 + abs(ly) * 0.5, abs(ly))
        if (hex > 36 || hex < 31 - (round(lx * 0.4 + ly * 0.6) % 3 === 0 ? 2 : 0)) return (hex < 31 && (round(lx + ly * 2) + round(t * 46)) % 23 === 0) && '#dff6ff'
        return abs(lx + ly - 50 + t * 100) < 5 ? '#ffffff' : hex > 34 ? ICE[1] : ICE[2]
    })],
    // Slashes of the blade whirl sweeping around the hero
    slash: [216, 96, 108, 60, 6, t => ctx => shape(ctx, [0, 0], 108, 0, (lx, ly) => {
        const d = abs(hypot(lx, ly * 2.4) - 92)
        const head = t * TAU * 2
        const behind = ((head - Math.atan2(ly * 2.4, lx)) % TAU + TAU) % TAU
        if (behind > 2.6) return
        const width = 7 * (1 - behind / 2.6)
        return d < width && (behind < 0.5 ? '#ffffff' : behind < 1.4 ? '#bff6ee' : '#4fd6c8')
    })],
    // A burst of light rays for critical hits
    crit: [72, 72, 36, 36, 6, t => ctx => {
        for (let k = 0; k < 8; k++) {
            const a = k / 8 * TAU + 0.2, from = 4 + t * 12, to = from + (k % 2 ? 10 : 20) * (1 - t)
            limb(ctx, [cos(a) * from, sin(a) * from], [cos(a) * to, sin(a) * to], 3 * (1 - t) + 1, 1, [GOLD[1], GOLD[2], GOLD[3], '#ffffff'])
        }
        shape(ctx, [0, 0], 8, t * 3, (lx, ly) => abs(lx) + abs(ly) < 7 * (1 - t) && '#ffffff')
    }],
    // A block of ice holding a frozen foe, with a glint passing over it
    frozen: [96, 112, 48, 108, 6, t => ctx => shape(ctx, [0, -54], 56, 0, (lx, ly) => {
        const top = -46 + abs(sin(lx * 0.3)) * 6
        if (abs(lx) > 30 - max(0, ly - 30) * 0.3 || ly < top || ly > 54) return
        const edge = abs(lx) > 27 || ly < top + 3
        return abs(lx - ly * 0.4 - 80 + t * 160) < 3 ? '#ffffff' : edge ? ICE[2] : (round(lx * 0.7 + ly) % 9 === 0 ? ICE[3] : '#8fdcfa')
    })],
}

export function buildSpells() {
    return Object.fromEntries(Object.entries(SPELLS).map(([name, [w, h, ox, oy, count, draw]]) =>
        [name, sheet(w, h, ox, oy, { play: frames(count, (ctx, t) => draw(t)(ctx)) }, [], null)]))
}

// The Ogre Chief in close up: a horned iron helm, a heavy brow over a burning eye, tusks and a fur collar
function chiefPortrait(mood) {
    const skin = ['#2a241e', '#5e5244', '#86765e', '#b09a7a']
    const canvas = makeCanvas(48, 48)
    const ctx = canvas.getContext('2d')
    shape(ctx, [22, 47], 26, 0, (lx, ly) => hypot(lx / 25, ly / 9) < 1 && ((round(lx * 0.8 + ly) & 3) === 0 ? OGRE.fur[1] : ly < -4 ? OGRE.fur[3] : OGRE.fur[2]))
    limb(ctx, [19, 44], [22, 32], 12, 11, skin)
    // Skull, then a jaw jutting forward
    shape(ctx, [21, 25], 16, 0, (lx, ly) => {
        const n = hypot(lx / 13, ly / 12)
        return n < 1 && ball(skin, lx / 13, ly / 12, n)
    })
    shape(ctx, [30, 32], 12, 0, (lx, ly) => {
        const n = hypot(lx / 9, ly / 6.5)
        return n < 1 && (ly > 2 ? skin[1] : ball(skin, lx / 9, ly / 6.5, n))
    })
    shape(ctx, [11, 26], 6, 0, (lx, ly) => Math.abs(lx) < 3 - ly * 0.4 && ly > -5 && ly < 3 && (lx < 0 ? skin[3] : skin[1]))
    limb(ctx, [34, 22], [37, 26], 4, 3, skin)
    // Mouth and tusks, the snarl opens wider when angry
    const snarl = mood === 'angry' ? 2 : 0
    limb(ctx, [25, 35], [38, 34 - snarl], 2, 2, [INK, INK, INK, INK])
    limb(ctx, [34, 35], [36, 28 - snarl], 3, 1, BONE)
    limb(ctx, [28, 36], [29, 31 - snarl], 3, 1, BONE)
    // A scar over the cheek
    limb(ctx, [17, 24], [23, 31], 2, 2, ['#c9b49a', '#c9b49a', '#c9b49a', '#c9b49a'])
    // The iron helm with a rim of rivets and two horns
    shape(ctx, [20, 16], 16, 0, (lx, ly) => {
        const n = hypot(lx / 14, ly / 10)
        if (n > 1 || ly > 2) return
        if (ly > -0.5) return Math.round(lx) % 4 === 0 ? IRON[3] : IRON[0]
        return ball(IRON, lx / 14, ly / 10, n)
    })
    limb(ctx, [9, 12], [4, 5], 5, 4, BONE)
    limb(ctx, [4, 5], [6, 0], 4, 2, BONE)
    limb(ctx, [28, 9], [33, 4], 5, 4, BONE)
    limb(ctx, [33, 4], [32, 0], 4, 2, BONE)
    // The eye glows under a brow that slants with the mood
    const tilt = { angry: 2, worried: -2 }[mood] ?? 0
    limb(ctx, [25, 20 - tilt / 2], [35, 20 + tilt], 3, 3, [INK, skin[0], skin[0], skin[0]])
    shape(ctx, [30, 24], 3, 0, (lx, ly) => Math.abs(lx) < 2 && Math.abs(ly) < 1.2 && (lx > 0.5 && ly < 0 ? '#fff2a8' : '#ff4a2f'))
    outline(canvas, INK)
    return canvas
}

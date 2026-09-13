import { makeCanvas, outline, painter } from './pixels.js'

const INK = '#150f19'
const HERO = {
    hair: ['#4a2412', '#7b3a1a', '#a8582a'],
    skin: ['#b9765a', '#e9b48c', '#f7d2ae'],
    shirt: ['#9e8763', '#d8c19c', '#efe0c0'],
    vest: ['#3f2415', '#6e4225', '#94602f'],
    scarf: ['#7d1b22', '#b52d30', '#e0554c'],
    pants: ['#221915', '#3a2c26'],
    backPants: ['#150f0c', '#2a201b'],
    boots: ['#150d0a', '#3a261a'],
    blade: ['#2a9d94', '#4fd6c8', '#d4fff8'],
    belt: '#241510', gold: '#e2c070', eye: '#1d1410', hilt: '#5a3a22', guard: '#c9a050',
}
const OGRE = {
    skin: ['#5e3f2c', '#8f6446', '#b3845a', '#d0a476'],
    fur: ['#2e1c13', '#5b3b2a', '#7d5638'],
    club: ['#3e2414', '#6d4527', '#8f5f36'],
    iron: ['#474e53', '#7d858a', '#b5bcc0'],
    horn: ['#b9ad8c', '#ece3c8'],
    tusk: '#f3ead0', eye: '#ff4a2f', mouth: '#2a160e',
}
const WOLF = { fur: ['#3c4650', '#6b7884', '#9aa8b3', '#c9d4dc'], eye: '#ffd23f', nose: '#141414', mouth: '#5a1a1a', teeth: '#ffffff' }
const ALPHA = { ...WOLF, fur: ['#20262c', '#3b444c', '#58636c', '#dfe8ee'], eye: '#ff4a2f' }
const ICE = ['#3aa6e0', '#8fdcfa', '#ffffff']
const SHAMAN = {
    robe: ['#1f3550', '#2f5078', '#4a74a0'],
    skin: ['#4f7f8a', '#6fa3ab', '#96c6c9'],
    staff: '#7a5230', bone: '#e8e0c8', eye: '#bff0ff',
}
const GOBLIN = {
    skin: ['#3f6b2a', '#5d8a3a', '#86b34e'],
    cloth: ['#3a2a3f', '#5a4262', '#7a5a84'],
    bow: ['#5a3418', '#8a5a2b'],
    boots: '#2a1a10', belt: '#1f140c', pupil: '#1a1208', eye: '#ffe34a', string: '#e8e0c8', shaft: '#c9a878', tip: '#b8c8d2', feather: '#d04040', tooth: '#f3ead0',
}
const IRON = ['#3c4247', '#6b7378', '#a3aaaf']
// Body gear recolors the hero's clothes
const GEAR = {
    armor: { vest: IRON, shirt: ['#555c61', '#7d858a', '#b5bcc0'] },
    robe: { vest: ['#1d3566', '#2f5aa8', '#5c8ae0'], shirt: ['#6fa8dc', '#a8d4f0', '#dff2ff'] },
}
const MERCHANT = { robe: ['#3b2a1a', '#5e4128', '#86603a'], pack: ['#4a2f1a', '#7a5230', '#a87a48'], beard: ['#a0a0a0', '#dcdcdc'], lamp: '#ffd86a' }

// Loot and gear in a 16x16 cell with the origin at the bottom center
const ITEM_ART = {
    gold: ({ rect, disc }) => {
        disc(-2, -5, 3, '#c98f1c')
        disc(2, -8, 3, '#f0c419')
        rect(1, -10, 2, 1, '#fff2a8')
    },
    arrows: ({ rect, line }) => {
        for (const x of [-3, 0, 3]) {
            line(x - 2, -2, x + 2, -11, GOBLIN.shaft)
            rect(x + 1, -13, 3, 3, GOBLIN.tip)
            rect(x - 3, -3, 2, 2, GOBLIN.feather)
        }
    },
    potion: ({ rect, disc }) => {
        rect(-1, -14, 3, 2, '#8a5a2b')
        rect(-1, -12, 3, 3, '#b8d8e0')
        disc(0, -5, 4, (x, y) => x < -1 && y < -1 ? '#ff9a90' : x > 1 ? '#9c1a20' : '#d42a30')
    },
    fur: ({ rect }) => {
        rect(-6, -9, 12, 7, WOLF.fur[1])
        rect(-6, -9, 12, 2, WOLF.fur[2])
        rect(-4, -6, 8, 1, WOLF.fur[3])
        rect(-7, -3, 2, 2, WOLF.fur[1])
        rect(5, -3, 2, 2, WOLF.fur[1])
    },
    fang: ({ rect }) => {
        rect(-3, -12, 5, 3, GOBLIN.tooth)
        rect(-2, -9, 4, 3, GOBLIN.tooth)
        rect(-1, -6, 3, 2, GOBLIN.tooth)
        rect(0, -4, 2, 2, '#c9bc98')
    },
    helmet: ({ rect }) => {
        rect(-5, -11, 10, 6, IRON[1])
        rect(-4, -12, 8, 1, IRON[1])
        rect(-4, -11, 8, 1, IRON[2])
        rect(-5, -5, 3, 3, IRON[0])
        rect(2, -5, 3, 3, IRON[0])
        rect(-1, -5, 2, 3, IRON[1])
    },
    armor: ({ rect }) => {
        const [dark, mid] = GEAR.armor.shirt
        rect(-5, -12, 10, 11, mid)
        for (let y = -10; y < -1; y += 3) rect(-5, y, 10, 1, dark)
        rect(-7, -12, 3, 4, IRON[1])
        rect(4, -12, 3, 4, IRON[1])
        rect(-2, -12, 4, 2, INK)
    },
    robe: ({ rect }) => {
        const [dark, mid] = GEAR.robe.vest
        rect(-4, -13, 8, 9, mid)
        rect(-6, -5, 12, 4, mid)
        rect(-6, -2, 12, 1, dark)
        rect(-1, -13, 2, 12, GEAR.robe.shirt[1])
    },
    cloak: ({ rect }) => {
        rect(-5, -12, 10, 11, WOLF.fur[1])
        rect(-6, -3, 12, 2, WOLF.fur[1])
        rect(-5, -12, 2, 11, WOLF.fur[0])
        rect(-5, -13, 10, 3, WOLF.fur[3])
    },
}

const phases = n => Array.from({ length: n }, (_, i) => i / n)
const ease = t => 1 - (1 - t) ** 2

// Returns a point d pixels along angle a from (x, y), shifted sideways by off.
const ray = (x, y, a) => (d, off = 0) => [x + Math.cos(a) * d - Math.sin(a) * off, y + Math.sin(a) * d + Math.cos(a) * off]

// Bakes animations into one atlas. Each frame draw() may return a callback drawn after outlining.
function sheet(cellW, cellH, originX, originY, animations, scale = 1) {
    const names = Object.keys(animations)
    const cols = Math.max(...names.map(name => animations[name].length))
    const canvas = makeCanvas(cols * cellW, names.length * cellH)
    const frames = {}
    names.forEach((name, row) => {
        frames[name] = animations[name].map((draw, col) => {
            const cell = makeCanvas(cellW, cellH)
            const after = draw(painter(cell.getContext('2d'), originX, originY, scale))
            outline(cell, INK)
            after?.()
            canvas.getContext('2d').drawImage(cell, col * cellW, row * cellH)
            return { x: col * cellW, y: row * cellH }
        })
    })
    return { canvas, frames, cellW, cellH, originX, originY }
}

function hero({ rect, line }, { bob = 0, walk, air = 0, swing, wave = 0, draw, gear, item = 'sword' }) {
    const c = { ...HERO, ...GEAR[gear.body] }
    const moving = walk !== undefined
    const step = moving ? Math.round(Math.sin(walk) * 3) : 0
    const y = moving ? -Math.round(Math.abs(Math.cos(walk))) : bob
    const tail = Math.round(Math.sin(wave * Math.PI * 2) * 1.5)
    const [backLift, frontLift] = air < 0 ? [1, 4] : air > 0 ? [3, 1] : [Math.max(0, -step - 1), Math.max(0, step - 1)]
    if (gear.back) line(-4, -24 + y, -9, -6 + tail, WOLF.fur[1], 5)
    const leg = (x, lift, [dark, mid]) => {
        rect(x, -13, 3, 10 - lift, mid)
        rect(x, -13, 1, 10 - lift, dark)
        rect(x, -4 - lift, 4, 4, c.boots[0])
        rect(x, -4 - lift, 4, 1, c.boots[1])
    }
    leg(-4 - step, backLift, c.backPants)
    leg(1 + step, frontLift, c.pants)

    rect(-6, -17 + y, 4, 6, c.vest[0])
    rect(-4, -26 + y, 9, 13, c.shirt[1])
    rect(3, -26 + y, 2, 13, c.shirt[2])
    rect(-4, -26 + y, 6, 13, c.vest[1])
    rect(-4, -26 + y, 1, 13, c.vest[0])
    rect(1, -25 + y, 1, 11, c.vest[2])
    rect(-4, -16 + y, 9, 2, c.belt)
    rect(2, -16 + y, 2, 2, c.gold)
    if (gear.body === 'robe') {
        rect(-5, -14 + y, 11, 8, c.vest[1])
        rect(-5, -14 + y, 2, 8, c.vest[0])
    }

    rect(-2, -34 + y, 7, 8, c.skin[1])
    rect(-2, -27 + y, 7, 1, c.skin[0])
    rect(4, -32 + y, 1, 3, c.skin[2])
    rect(5, -30 + y, 1, 2, c.skin[1])
    rect(2, -31 + y, 1, 2, c.eye)
    rect(2, -32 + y, 2, 1, c.hair[0])
    rect(-1, -30 + y, 1, 2, c.skin[0])
    rect(-3, -36 + y, 8, 3, c.hair[1])
    rect(-1, -36 + y, 4, 1, c.hair[2])
    rect(-4, -34 + y, 3, 6, c.hair[1])
    rect(-4, -29 + y, 2, 1, c.hair[0])
    rect(3, -34 + y, 2, 1, c.hair[1])
    if (gear.head) {
        rect(-4, -38 + y, 10, 5, IRON[1])
        rect(-4, -38 + y, 10, 1, IRON[2])
        rect(-4, -34 + y, 10, 1, IRON[0])
        rect(4, -33 + y, 1, 3, IRON[1])
    }

    line(-3, -25 + y, -9, -23 + y + tail, c.scarf[0], 2)
    rect(-3, -27 + y, 8, 3, c.scarf[1])
    rect(0, -27 + y, 4, 1, c.scarf[2])

    const shoulder = -23 + y
    // With the bow selected but not drawn, it hangs unstrung until aiming takes over
    if (draw !== undefined || item === 'bow') {
        const d = draw ?? 0
        for (let i = -9; i <= 9; i++) rect(9 + Math.round(4 * (1 - (i / 9) ** 2)), shoulder + i, 2, 1, Math.abs(i) > 7 ? GOBLIN.bow[0] : GOBLIN.bow[1])
        line(9, shoulder - 9, 9 - d, shoulder, GOBLIN.string)
        line(9 - d, shoulder, 9, shoulder + 9, GOBLIN.string)
        if (draw !== undefined) {
            line(8 - d, shoulder, 20 - d, shoulder, GOBLIN.shaft)
            rect(20 - d, shoulder - 1, 3, 3, GOBLIN.tip)
        }
        line(1, shoulder, 12, shoulder, c.shirt[1], 3)
        rect(12, shoulder - 1, 3, 3, c.skin[1])
        line(0, shoulder + 1, 8 - d, shoulder, c.skin[1], 2)
        return
    }

    // Frost bolt and potion are simply held forward, no swing pose for them
    if (item === 'frost') {
        const hand = ray(1, shoulder, 0.9)(9)
        line(1, shoulder, ...hand, c.shirt[1], 3)
        rect(hand[0] - 2, hand[1] - 2, 4, 4, '#3aa6e0')
        rect(hand[0] - 1, hand[1] - 1, 2, 2, '#ffffff')
        return
    }
    if (item === 'potion') {
        const hand = ray(1, shoulder, 0.9)(9)
        line(1, shoulder, ...hand, c.shirt[1], 3)
        rect(hand[0] - 2, hand[1] - 4, 4, 3, '#8a5a2b')
        rect(hand[0] - 2, hand[1] - 1, 4, 4, '#d42a30')
        return
    }

    let arm = 0.9
    let sword = -1 + (moving ? Math.sin(walk) * 0.1 : 0)
    if (swing !== undefined) arm = sword = -2.1 + 3.1 * ease(Math.min(1, swing / 0.55))
    const hand = ray(1, shoulder, arm)(7)
    const s = ray(...hand, sword)
    line(...s(4), ...s(21), c.blade[1], 2)
    line(...s(5), ...s(20), c.blade[2])
    line(...s(5, 1), ...s(20, 1), c.blade[0])
    line(...s(-2), ...s(2), c.hilt, 2)
    line(...s(3, -3), ...s(3, 3), c.guard, 2)
    line(1, shoulder, ...hand, c.shirt[1], 3)
    rect(hand[0] - 1, hand[1] - 1, 3, 3, c.skin[1])

    if (swing > 0 && swing <= 0.5) {
        return () => {
            for (let a = Math.max(-2.1, arm - 1.8); a < arm; a += 0.03) {
                const color = a > arm - 0.7 ? '#ffffff' : '#8ff0e4'
                rect(...ray(1, shoulder, a)(27), 1, 1, color)
                rect(...ray(1, shoulder, a)(26), 1, 1, color)
                if (a > arm - 0.9) rect(...ray(1, shoulder, a)(25), 1, 1, '#8ff0e4')
            }
        }
    }
}

function roll({ disc }, t) {
    const spin = t * Math.PI * 2
    disc(0, -9, 8, (x, y) => Math.floor((Math.atan2(y, x) + spin) * 3 / Math.PI + 12) & 1 ? HERO.vest[1] : HERO.shirt[1])
    const [hx, hy] = ray(0, -9, spin - 1.2)(5)
    disc(Math.round(hx), Math.round(hy), 3, HERO.hair[1])
}

function merchant({ rect, line }, { bob }) {
    const c = MERCHANT, y = bob
    rect(-13, -31 + y, 9, 18, c.pack[1])
    rect(-13, -31 + y, 9, 2, c.pack[2])
    rect(-13, -23 + y, 9, 1, c.pack[0])
    rect(-12, -36 + y, 7, 5, HERO.scarf[1])
    rect(-4, -2, 4, 2, HERO.boots[1])
    rect(2, -2, 4, 2, HERO.boots[1])
    rect(-5, -28 + y, 11, 26 - y, c.robe[1])
    rect(-5, -28 + y, 3, 26 - y, c.robe[0])
    rect(4, -26 + y, 2, 24 - y, c.robe[2])
    rect(-5, -16 + y, 11, 2, HERO.belt)
    rect(1, -16 + y, 2, 2, HERO.gold)
    rect(-4, -39 + y, 10, 12, c.robe[1])
    rect(-4, -39 + y, 10, 2, c.robe[0])
    rect(-4, -37 + y, 3, 9, c.robe[0])
    rect(0, -36 + y, 6, 7, HERO.skin[1])
    rect(3, -34 + y, 1, 2, HERO.eye)
    rect(0, -31 + y, 6, 5, c.beard[1])
    rect(0, -31 + y, 2, 5, c.beard[0])
    line(10, -44 + y, 10, -1, HERO.hilt, 2)
    rect(8, -26 + y, 4, 3, HERO.skin[1])
    rect(11, -45 + y, 4, 1, HERO.hilt)
    rect(13, -44 + y, 4, 5, c.lamp)
}

function ogre({ rect, line }, { walk, bob = 0, arm = 1.25, chief }) {
    const c = OGRE, s = c.skin
    const moving = walk !== undefined
    const step = moving ? Math.round(Math.sin(walk) * 3) : 0
    const y = moving ? -Math.round(Math.abs(Math.cos(walk)) * 1.5) : bob
    if (moving) arm += Math.sin(walk) * 0.2

    rect(-10, -38 + y, 5, 18, s[0])
    rect(-11 - step, -15, 7, 12, s[0])
    rect(-12 - step, -3, 9, 3, s[0])
    rect(1 + step, -15, 7, 12, s[1])
    rect(1 + step, -15, 2, 12, s[0])
    rect(1 + step, -3, 10, 3, s[2])
    rect(1 + step, -1, 10, 1, s[1])

    rect(-16, -46 + y, 11, 21, s[0])
    rect(-13, -45 + y, 24, 25, s[1])
    rect(-10, -46 + y, 16, 3, s[2])
    rect(-13, -43 + y, 3, 22, s[0])
    rect(1, -35 + y, 10, 13, s[2])
    rect(3, -34 + y, 6, 2, s[3])
    rect(0, -43 + y, 8, 2, s[3])

    rect(-15, -22 + y, 27, 8, c.fur[1])
    rect(-15, -22 + y, 27, 1, c.fur[0])
    rect(-15, -21 + y, 27, 1, c.fur[2])
    for (let x = -14; x < 12; x += 5) rect(x, -19 + y, 1, 5, c.fur[0])
    for (let x = -15; x < 12; x += 4) rect(x, -14 + y, 3, 3, c.fur[1])

    rect(4, -53 + y, 12, 12, s[1])
    rect(3, -54 + y, 8, 2, c.fur[0])
    rect(4, -52 + y, 13, 3, s[0])
    rect(6, -44 + y, 11, 4, s[2])
    rect(6, -40 + y, 10, 1, s[0])
    rect(15, -49 + y, 3, 4, s[2])
    rect(17, -46 + y, 1, 1, s[0])
    rect(10, -49 + y, 4, 2, c.mouth)
    rect(11, -49 + y, 2, 1, c.eye)
    rect(8, -43 + y, 9, 1, c.mouth)
    rect(9, -45 + y, 2, 3, c.tusk)
    rect(15, -45 + y, 2, 3, c.tusk)
    rect(1, -50 + y, 3, 5, s[0])
    if (chief) {
        rect(-7, -48 + y, 14, 6, c.iron[1])
        rect(-7, -48 + y, 14, 1, c.iron[2])
        rect(-7, -43 + y, 14, 1, c.iron[0])
        rect(2, -58 + y, 16, 7, c.iron[1])
        rect(4, -57 + y, 11, 1, c.iron[2])
        rect(2, -52 + y, 16, 1, c.iron[0])
        line(3, -56 + y, -3, -63 + y, c.horn[0], 3)
        line(17, -56 + y, 21, -64 + y, c.horn[1], 3)
    }

    const shoulder = [6, -40 + y]
    const upper = ray(...shoulder, arm)
    const fist = upper(15)
    const club = ray(...fist, arm)
    line(...club(-3), ...club(14), c.club[1], 4)
    line(...club(11), ...club(27), c.club[1], 7)
    line(...club(12, 3), ...club(26, 3), c.club[0], 2)
    line(...club(13, -4), ...club(13, 4), c.iron[1], 2)
    rect(...club(19, -4), 2, 2, c.iron[2])
    rect(...club(24, -1), 2, 2, c.iron[2])
    line(...shoulder, ...fist, s[1], 6)
    line(...upper(10), ...upper(13), c.fur[0], 6)
    rect(fist[0] - 3, fist[1] - 3, 7, 7, s[2])
}

function wolf({ rect, line }, { run, crouch = 0, leap = false, bob = 0, wag = 0, snarl = false, howl = false, c = WOLF }) {
    const f = c.fur
    const y = crouch + bob
    const head = y + crouch
    const leg = (x, offset, color) => {
        const front = x > 0
        const foot = leap ? x + (front ? 8 : -8) : run === undefined ? x : x + Math.round(Math.sin(run + offset) * 4)
        const lift = leap ? 4 : run === undefined ? 0 : Math.max(0, Math.round(Math.cos(run + offset) * 3))
        line(x, -11 + y, foot, -2 - lift, color, 3)
        rect(foot - 1, -2 - lift, 4, 2, f[0])
    }
    leg(-10, Math.PI, f[0])
    leg(10, 0, f[0])

    line(-17, -16 + y, -25, -20 + y + wag, f[1], 3)
    rect(-27, -22 + y + wag, 3, 3, f[3])
    rect(-17, -20 + y, 29, 11, f[1])
    rect(-16, -21 + y, 25, 2, f[0])
    rect(-14, -18 + y, 18, 1, f[2])
    rect(-13, -10 + y, 20, 2, f[3])
    rect(6, -19 + y, 7, 10, f[2])

    leg(-14, 0, f[1])
    leg(6, Math.PI, f[1])

    if (howl) {
        // Head thrown back with the muzzle to the sky
        rect(6, -27 + y, 9, 8, f[1])
        rect(7, -34 + y, 9, 9, f[1])
        rect(5, -37 + y, 3, 5, f[0])
        line(15, -29 + y, 20, -36 + y, c.mouth, 2)
        line(13, -33 + y, 19, -40 + y, f[2], 4)
        rect(19, -43 + y, 2, 2, c.nose)
        rect(11, -31 + y, 2, 1, c.nose)
        return
    }
    rect(9, -26 + head, 10, 10, f[1])
    rect(9, -27 + head, 8, 2, f[0])
    rect(10, -30 + head, 3, 4, f[0])
    rect(15, -30 + head, 3, 4, f[0])
    rect(11, -29 + head, 1, 2, f[3])
    rect(18, -22 + head, 8, 4, f[2])
    rect(25, -22 + head, 2, 2, c.nose)
    rect(15, -24 + head, 2, 1, c.eye)
    if (snarl) {
        rect(18, -18 + head, 8, 2, c.mouth)
        rect(19, -18 + head, 1, 1, c.teeth)
        rect(23, -18 + head, 1, 1, c.teeth)
        rect(18, -16 + head, 6, 1, f[1])
    } else {
        rect(18, -18 + head, 7, 2, f[2])
    }
}

function goblin({ rect, line }, { walk, bob = 0, draw = 0, loaded = true }) {
    const c = GOBLIN
    const moving = walk !== undefined
    const step = moving ? Math.round(Math.sin(walk) * 2) : 0
    const y = moving ? -Math.round(Math.abs(Math.cos(walk))) : bob

    rect(-9, -22 + y, 3, 11, c.bow[0])
    rect(-9, -25 + y, 1, 3, c.string)
    rect(-7, -24 + y, 1, 2, c.feather)
    rect(-4 - step, -10, 3, 8, c.cloth[0])
    rect(-5 - step, -2, 4, 2, c.boots)
    rect(1 + step, -10, 3, 8, c.cloth[1])
    rect(1 + step, -2, 5, 2, c.boots)
    rect(-5, -21 + y, 10, 12, c.cloth[1])
    rect(-5, -21 + y, 2, 12, c.cloth[0])
    rect(3, -20 + y, 1, 10, c.cloth[2])
    rect(-5, -12 + y, 10, 1, c.belt)

    rect(-3, -32 + y, 10, 10, c.skin[1])
    rect(-3, -32 + y, 2, 10, c.skin[0])
    rect(0, -24 + y, 7, 2, c.skin[0])
    line(-3, -29 + y, -10, -33 + y, c.skin[1], 2)
    rect(7, -28 + y, 3, 2, c.skin[2])
    rect(4, -29 + y, 2, 2, c.pupil)
    rect(5, -29 + y, 1, 1, c.eye)
    rect(3, -24 + y, 1, 1, c.tooth)
    rect(6, -24 + y, 1, 1, c.tooth)
    rect(-4, -34 + y, 11, 3, c.cloth[0])
    rect(-5, -32 + y, 3, 5, c.cloth[0])

    // Bow bends forward, the string is pulled back by draw pixels
    const grip = -18 + y
    for (let i = -8; i <= 8; i++) rect(11 + Math.round(4 * (1 - (i / 8) ** 2)), grip + i, 2, 1, Math.abs(i) > 6 ? c.bow[0] : c.bow[1])
    line(11, grip - 8, 11 - draw, grip, c.string)
    line(11 - draw, grip, 11, grip + 8, c.string)
    if (loaded) {
        line(10 - draw, grip, 22 - draw, grip, c.shaft)
        rect(22 - draw, grip - 1, 3, 3, c.tip)
        rect(8 - draw, grip - 1, 2, 1, c.feather)
    }
    line(-1, -19 + y, 10 - draw, grip, c.skin[1], 2)
    line(2, -19 + y, 15, grip, c.skin[1], 2)
}

function shaman({ rect, line }, { walk, bob = 0, raise = 0 }) {
    const c = SHAMAN, f = WOLF.fur
    const moving = walk !== undefined
    const step = moving ? Math.round(Math.sin(walk) * 2) : 0
    const y = moving ? -Math.round(Math.abs(Math.cos(walk))) : bob
    const lift = Math.round(raise * 10)

    rect(-5 - step, -3, 5, 3, GOBLIN.boots)
    rect(1 + step, -3, 5, 3, GOBLIN.boots)
    rect(-6, -26 + y, 12, 12, c.robe[1])
    rect(-7, -14 + y, 14, 11 - y, c.robe[1])
    rect(-7, -26 + y, 3, 23 - y, c.robe[0])
    rect(4, -24 + y, 2, 21 - y, c.robe[2])
    rect(-6, -15 + y, 12, 2, GOBLIN.belt)
    rect(-1, -13 + y, 2, 3, c.bone)
    rect(-8, -28 + y, 15, 5, f[2])
    rect(-8, -24 + y, 15, 1, f[1])

    // Pale face under a wolf skull hood
    rect(-2, -36 + y, 8, 8, c.skin[1])
    rect(-2, -36 + y, 2, 8, c.skin[0])
    rect(6, -32 + y, 2, 2, c.skin[2])
    rect(3, -33 + y, 2, 2, c.eye)
    rect(-4, -40 + y, 11, 5, f[3])
    rect(-5, -37 + y, 3, 10, f[2])
    rect(3, -39 + y, 6, 3, c.bone)
    rect(-3, -43 + y, 2, 3, f[3])
    rect(3, -43 + y, 2, 3, f[3])

    // Staff with an ice crystal, lifted up to cast
    const top = -48 + y - lift
    line(10, top, 10, -2 + y - lift, c.staff, 2)
    rect(9, top - 5, 3, 8, ICE[1])
    rect(8, top - 3, 5, 4, ICE[1])
    rect(8, top - 3, 1, 4, ICE[0])
    rect(10, top - 4, 1, 3, ICE[2])
    line(2, -24 + y, 10, -22 + y - lift, c.robe[1], 3)
    rect(9, -23 + y - lift, 3, 3, c.skin[1])
    if (raise < 1) return
    return () => {
        for (const [dx, dy] of [[-5, -1], [5, -2], [0, -9], [-3, -7], [4, 3]]) rect(10 + dx, top + dy, 1, 1, ICE[2])
    }
}

// Regular wolves and their bigger pack leader, who also charges and howls
export function buildWolf(alpha) {
    const pose = extra => p => wolf(p, { c: alpha ? ALPHA : WOLF, ...extra })
    const run = phases(6).map(t => pose({ run: t * Math.PI * 2, wag: -2 }))
    const animations = {
        idle: phases(4).map(t => pose({ bob: t < 0.5 ? 0 : 1, wag: Math.round(Math.sin(t * Math.PI * 2) * 2) })),
        walk: run,
        windup: [1, 2, 3].map(crouch => pose({ crouch, snarl: true })),
        attack: [pose({ leap: true, snarl: true, wag: -3 })],
        recover: [2, 0].map(crouch => pose({ crouch })),
        charge: [...run, ...run, ...run],
        howl: [0, 1].map(bob => pose({ howl: true, bob })),
    }
    return alpha ? sheet(96, 72, 46, 68, animations, 1.4) : sheet(64, 40, 30, 36, animations)
}

export function buildShaman() {
    return sheet(40, 80, 16, 76, {
        idle: phases(4).map(t => p => shaman(p, { bob: t < 0.5 ? 0 : 1 })),
        walk: phases(8).map(t => p => shaman(p, { walk: t * Math.PI * 2 })),
        windup: [0.3, 0.6, 1].map(raise => p => shaman(p, { raise })),
        attack: [p => shaman(p, { raise: 1 })],
        recover: [0.6, 0.3, 0].map(raise => p => shaman(p, { raise })),
    })
}

export function buildIcicle() {
    return sheet(24, 8, 12, 4, {
        fly: [({ rect }) => {
            rect(-9, -2, 6, 5, ICE[0])
            rect(-4, -2, 6, 4, ICE[1])
            rect(2, -1, 5, 3, ICE[1])
            rect(7, 0, 3, 1, ICE[2])
            rect(-8, -1, 12, 1, ICE[2])
        }],
    })
}

export function buildGoblin() {
    return sheet(48, 40, 18, 37, {
        idle: phases(4).map(t => p => goblin(p, { bob: t < 0.5 ? 0 : 1 })),
        walk: phases(8).map(t => p => goblin(p, { walk: t * Math.PI * 2 })),
        windup: [0, 2, 4, 6].map(draw => p => goblin(p, { draw })),
        attack: [p => goblin(p, { loaded: false })],
        recover: [p => goblin(p, { loaded: false }), p => goblin(p, {})],
    })
}

export function buildArrow() {
    return sheet(20, 6, 10, 3, {
        fly: [({ rect }) => {
            rect(-8, 0, 13, 1, GOBLIN.shaft)
            rect(5, -1, 3, 3, GOBLIN.tip)
            rect(-9, -1, 3, 1, GOBLIN.feather)
            rect(-9, 1, 3, 1, GOBLIN.feather)
        }],
    })
}

export function buildHero(gear, item) {
    const pose = extra => p => hero(p, { gear, item, ...extra })
    return sheet(64, 60, 31, 55, {
        idle: phases(4).map(t => pose({ bob: t < 0.5 ? 0 : 1, wave: t })),
        walk: phases(8).map(t => pose({ walk: t * Math.PI * 2, wave: t * 2 })),
        jump: [-1, 1].map(air => pose({ air, wave: 0.25 })),
        attack: phases(6).map(t => pose({ swing: t })),
        roll: phases(6).map(t => p => roll(p, t)),
        aim: [0, 3, 6].map(draw => pose({ draw })),
    })
}

function chest({ rect }) {
    rect(-9, -12, 18, 12, '#8a5a2b')
    rect(-9, -14, 18, 4, '#a8703a')
    rect(-9, -14, 18, 1, '#c98f4a')
    rect(-9, -10, 18, 1, '#5a3418')
    rect(-9, -2, 18, 2, '#5a3418')
    rect(-7, -14, 2, 14, IRON[1])
    rect(5, -14, 2, 14, IRON[1])
    rect(-1, -11, 3, 4, HERO.gold)
    rect(0, -9, 1, 1, INK)
}

// Treasure chest with a glint now and then
export function buildChest() {
    const glint = p => {
        chest(p)
        return () => p.rect(3, -13, 1, 1, '#ffffff')
    }
    return sheet(24, 20, 12, 18, { idle: [chest, chest, chest, glint] })
}

// Quest board with notes pinned under a snowy roof
export function buildBoard() {
    return sheet(40, 52, 20, 50, {
        idle: [({ rect }) => {
            rect(-12, -40, 3, 40, HERO.hilt)
            rect(9, -40, 3, 40, HERO.hilt)
            rect(-14, -37, 28, 20, HERO.vest[1])
            rect(-14, -37, 28, 2, HERO.vest[2])
            rect(-15, -41, 30, 4, HERO.vest[0])
            rect(-15, -42, 30, 1, '#eef6f5')
            rect(-11, -33, 9, 11, HERO.shirt[2])
            rect(1, -32, 10, 8, HERO.shirt[1])
            for (const y of [-30, -27, -24]) rect(-9, y, 5, 1, HERO.shirt[0])
            for (const y of [-29, -26]) rect(3, y, 6, 1, HERO.shirt[0])
            rect(-7, -34, 1, 1, HERO.scarf[1])
            rect(6, -33, 1, 1, HERO.scarf[1])
        }],
    })
}

export function buildMerchant() {
    return sheet(40, 56, 18, 52, { idle: phases(4).map(t => p => merchant(p, { bob: t < 0.5 ? 0 : 1 })) })
}

export function buildItems() {
    return sheet(16, 16, 8, 16, Object.fromEntries(Object.entries(ITEM_ART).map(([item, draw]) => [item, [draw]])))
}

export function buildOgre(chief) {
    const pose = extra => p => ogre(p, { chief, ...extra })
    return sheet(96, 96, 42, 90, {
        idle: phases(4).map(t => pose({ bob: t < 0.5 ? 0 : 1 })),
        walk: phases(8).map(t => pose({ walk: t * Math.PI * 2 })),
        windup: phases(5).map(t => pose({ bob: 1, arm: 1.25 - 3.6 * ease(t * 1.25) })),
        attack: [1, 2, 3].map(i => pose({ arm: -2.35 + 1.1 * i })),
        recover: [0, 1, 2].map(i => pose({ arm: 0.95 + 0.15 * i })),
    })
}

export function buildBolt() {
    return sheet(18, 10, 9, 5, {
        fly: [({ rect }) => {
            rect(-7, -1, 10, 2, '#5cc8f2')
            rect(-3, -2, 6, 4, '#5cc8f2')
            rect(1, -1, 5, 2, '#bff0ff')
            rect(-1, -1, 4, 2, '#ffffff')
            rect(5, 0, 2, 1, '#ffffff')
        }],
    })
}

export function buildGlow() {
    const canvas = makeCanvas(32, 32)
    const ctx = canvas.getContext('2d')
    for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
            const d = Math.hypot(x - 15.5, y - 15.5) / 16
            if (d >= 1) continue
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.ceil((1 - d) * 4) / 4 * 0.6})`
            ctx.fillRect(x, y, 1, 1)
        }
    }
    return canvas
}

export function buildIcons() {
    const icon = draw => {
        const canvas = makeCanvas(32, 32)
        draw(painter(canvas.getContext('2d')))
        outline(canvas, INK)
        return canvas
    }
    const sword = ({ line }, blade) => {
        line(11, 21, 26, 6, blade[1], 3)
        line(12, 19, 26, 6, blade[2])
        line(7, 17, 15, 25, HERO.guard, 2)
        line(5, 27, 10, 22, HERO.hilt, 3)
    }
    return {
        sword: icon(p => sword(p, HERO.blade)),
        bow: icon(({ rect, line }) => {
            for (let i = -11; i <= 11; i++) rect(10 + Math.round(8 * (1 - (i / 11) ** 2)), 16 + i, 3, 1, Math.abs(i) > 8 ? GOBLIN.bow[0] : GOBLIN.bow[1])
            line(10, 5, 10, 27, GOBLIN.string)
            line(5, 16, 24, 16, GOBLIN.shaft)
            rect(24, 15, 3, 3, GOBLIN.tip)
            rect(4, 15, 3, 1, GOBLIN.feather)
            rect(4, 17, 3, 1, GOBLIN.feather)
        }),
        frost: icon(({ line, disc }) => {
            line(16, 4, 16, 28, '#bff0ff')
            line(4, 16, 28, 16, '#bff0ff')
            disc(16, 16, 7, (x, y) => x * x + y * y < 8 ? '#ffffff' : x + y < 0 ? '#8fdcfa' : '#3aa6e0')
        }),
        freeze: icon(p => {
            sword(p, ICE)
            for (const [x, y] of [[20, 7], [27, 16], [14, 12]]) {
                p.rect(x - 1, y, 3, 1, ICE[2])
                p.rect(x, y - 1, 1, 3, ICE[2])
            }
        }),
        shield: icon(({ rect, disc }) => {
            disc(16, 16, 11, (x, y) => x * x + y * y > 80 ? ICE[0] : x + y < -4 ? ICE[2] : ICE[1])
            rect(15, 8, 2, 16, '#bff0ff')
            rect(8, 15, 16, 2, '#bff0ff')
        }),
        potion: icon(({ rect, disc }) => {
            rect(13, 4, 6, 4, '#8a5a2b')
            rect(14, 8, 4, 5, '#b8d8e0')
            disc(16, 20, 8, (x, y) => x < -3 && y < -2 ? '#ff9a90' : y < -5 ? '#a51c22' : x > 3 ? '#9c1a20' : '#d42a30')
        }),
    }
}

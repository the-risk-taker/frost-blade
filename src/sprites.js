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
const GOBLIN = {
  skin: ['#3f6b2a', '#5d8a3a', '#86b34e'],
  cloth: ['#3a2a3f', '#5a4262', '#7a5a84'],
  bow: ['#5a3418', '#8a5a2b'],
  boots: '#2a1a10', belt: '#1f140c', pupil: '#1a1208', eye: '#ffe34a', string: '#e8e0c8', shaft: '#c9a878', tip: '#b8c8d2', feather: '#d04040', tooth: '#f3ead0',
}

const phases = n => Array.from({ length: n }, (_, i) => i / n)
const ease = t => 1 - (1 - t) ** 2

// Returns a point d pixels along angle a from (x, y), shifted sideways by off.
const ray = (x, y, a) => (d, off = 0) => [x + Math.cos(a) * d - Math.sin(a) * off, y + Math.sin(a) * d + Math.cos(a) * off]

// Bakes animations into one atlas. Each frame draw() may return a callback drawn after outlining.
function sheet(cellW, cellH, originX, originY, animations) {
  const names = Object.keys(animations)
  const cols = Math.max(...names.map(name => animations[name].length))
  const canvas = makeCanvas(cols * cellW, names.length * cellH)
  const frames = {}
  names.forEach((name, row) => {
    frames[name] = animations[name].map((draw, col) => {
      const cell = makeCanvas(cellW, cellH)
      const after = draw(painter(cell.getContext('2d'), originX, originY))
      outline(cell, INK)
      after?.()
      canvas.getContext('2d').drawImage(cell, col * cellW, row * cellH)
      return { x: col * cellW, y: row * cellH }
    })
  })
  return { canvas, frames, cellW, cellH, originX, originY }
}

function hero({ rect, line }, { bob = 0, walk, air = 0, swing, wave = 0 }) {
  const c = HERO
  const moving = walk !== undefined
  const step = moving ? Math.round(Math.sin(walk) * 3) : 0
  const y = moving ? -Math.round(Math.abs(Math.cos(walk))) : bob
  const [backLift, frontLift] = air < 0 ? [1, 4] : air > 0 ? [3, 1] : [Math.max(0, -step - 1), Math.max(0, step - 1)]
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

  const tail = Math.round(Math.sin(wave * Math.PI * 2) * 1.5)
  line(-3, -25 + y, -9, -23 + y + tail, c.scarf[0], 2)
  rect(-3, -27 + y, 8, 3, c.scarf[1])
  rect(0, -27 + y, 4, 1, c.scarf[2])

  let arm = 0.9
  let sword = -1 + (moving ? Math.sin(walk) * 0.1 : 0)
  if (swing !== undefined) arm = sword = -2.1 + 3.1 * ease(Math.min(1, swing / 0.55))
  const shoulder = -23 + y
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

function ogre({ rect, line }, { walk, bob = 0, arm = 1.25, boss }) {
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
  if (boss) {
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

function wolf({ rect, line }, { run, crouch = 0, leap = false, bob = 0, wag = 0, snarl = false }) {
  const c = WOLF, f = c.fur
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

export function buildWolf() {
  return sheet(64, 40, 30, 36, {
    idle: phases(4).map(t => p => wolf(p, { bob: t < 0.5 ? 0 : 1, wag: Math.round(Math.sin(t * Math.PI * 2) * 2) })),
    walk: phases(6).map(t => p => wolf(p, { run: t * Math.PI * 2, wag: -2 })),
    windup: [1, 2, 3].map(crouch => p => wolf(p, { crouch, snarl: true })),
    attack: [p => wolf(p, { leap: true, snarl: true, wag: -3 })],
    recover: [2, 0].map(crouch => p => wolf(p, { crouch })),
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

export function buildHero() {
  return sheet(64, 60, 31, 55, {
    idle: phases(4).map(t => p => hero(p, { bob: t < 0.5 ? 0 : 1, wave: t })),
    walk: phases(8).map(t => p => hero(p, { walk: t * Math.PI * 2, wave: t * 2 })),
    jump: [-1, 1].map(air => p => hero(p, { air, wave: 0.25 })),
    attack: phases(6).map(t => p => hero(p, { swing: t })),
    roll: phases(6).map(t => p => roll(p, t)),
  })
}

export function buildOgre(boss) {
  const pose = extra => p => ogre(p, { boss, ...extra })
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
  return {
    sword: icon(({ line }) => {
      line(11, 21, 26, 6, HERO.blade[1], 3)
      line(12, 19, 26, 6, HERO.blade[2])
      line(7, 17, 15, 25, HERO.guard, 2)
      line(5, 27, 10, 22, HERO.hilt, 3)
    }),
    frost: icon(({ line, disc }) => {
      line(16, 4, 16, 28, '#bff0ff')
      line(4, 16, 28, 16, '#bff0ff')
      disc(16, 16, 7, (x, y) => x * x + y * y < 8 ? '#ffffff' : x + y < 0 ? '#8fdcfa' : '#3aa6e0')
    }),
    potion: icon(({ rect, disc }) => {
      rect(13, 4, 6, 4, '#8a5a2b')
      rect(14, 8, 4, 5, '#b8d8e0')
      disc(16, 20, 8, (x, y) => x < -3 && y < -2 ? '#ff9a90' : y < -5 ? '#a51c22' : x > 3 ? '#9c1a20' : '#d42a30')
    }),
  }
}

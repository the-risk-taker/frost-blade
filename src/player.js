import { GROUND, LEVEL_W } from './const.js'
import { input } from './input.js'
import { sfx } from './sound.js'
import { TYPES, hurtEnemy } from './enemies.js'
import { stat, updateStats, noTalents } from './talents.js'
import { onIce, areaScale } from './levels.js'
import { afflict, has, tickStatuses } from './status.js'
import { t } from './lang.js'

export const SLOTS = ['sword', 'bow', 'frost', 'potion']
// Mana skills have their own keys, touch screens have buttons for them.
// The skill picked in the talent tree has one more key and cools down after use.
export const SKILLS = { KeyX: 'freeze', KeyC: 'shield' }
export const SKILL_KEY = 'KeyQ'
export const COOLDOWNS = { whirl: 6, volley: 8, nova: 10 }
export const ATTACK_TIME = 0.3
export const ROLL_TIME = 0.35
export const WHIRL_TIME = 0.5
export const WHIRL_REACH = 48
export const BOW_CHARGE = 0.7
export const XP_PER_LEVEL = 100

const SPEED = 125
const JUMP = 330
const GRAVITY = 960
const ARROW_GRAVITY = 520
const ROLL_SPEED = 250
const NOVA_REACH = 100
const JUMP_KEYS = ['ArrowUp', 'KeyW']
const USE_KEYS = ['Space', 'KeyJ', 'Mouse0']

export function createPlayer() {
    return {
        x: 80, y: GROUND, vx: 0, vy: 0, dir: 1, onGround: true, walk: 0,
        hp: 100, maxHp: 100, mana: 100, maxMana: 100, stamina: 100, restT: 0,
        xp: 0, level: 1, power: 0, talents: noTalents(), skill: null, resets: 0,
        slot: 0, cooldown: 0, skillT: 0,
        bag: { gold: 10, arrows: 10, potion: 3 },
        gear: { head: null, body: null, back: null },
        attackT: -1, chill: false, hitSet: new Set(), rollT: -1, whirlT: -1, hurtT: 0, drawT: -1, shieldT: 0, statuses: {},
    }
}

// What the hero keeps between stages and sessions, everything else starts fresh
export const carried = hero => structuredClone(Object.fromEntries(['bag', 'gear', 'xp', 'level', 'talents', 'skill', 'resets'].map(key => [key, hero[key]])))

// Kills grant XP. Filling the bar levels the hero up: a talent point and a bit more health, mana and power.
export function addXp(p, amount, game) {
    p.xp += amount
    if (p.xp < p.level * XP_PER_LEVEL) return
    p.xp -= p.level * XP_PER_LEVEL
    p.level++
    updateStats(p)
    p.hp = p.maxHp
    p.mana = p.maxMana
    game.popup(p.x, p.y - 60, t('levelUp', { level: p.level }), '#ffe9a8')
    hint(game, 'Talent')
    sfx.coin()
}

// Shows a one-time tip the first time a mechanic is used, never again this session
function hint(game, key) {
    if (game.hints.has(key)) return
    game.hints.add(key)
    game.popup(game.player.x, game.player.y - 70, t(`hint${key}`), '#ffe9a8')
}

export function canUse(p, item) {
    const ready = p.skillT <= 0
    return {
        sword: p.stamina >= 12, bow: p.bag.arrows > 0, frost: p.mana >= 25, freeze: p.mana >= 30, shield: p.mana >= 40 && p.shieldT <= 0, potion: p.bag.potion > 0,
        whirl: ready && p.stamina >= 25, volley: ready && p.bag.arrows > 0, nova: ready && p.mana >= 40,
    }[item]
}

// Arrow leaving the bow. The longer the string is drawn, the faster and farther it flies.
export function aimArrow(p) {
    const charge = Math.min(1, p.drawT / BOW_CHARGE)
    const speed = 180 + 340 * charge
    return { x: p.x + p.dir * 12, y: p.y - 23, vx: p.dir * speed, vy: -speed * 0.3, damage: Math.round(8 + 16 * charge) + p.power }
}

export function flyArrow(a, dt) {
    a.vy += ARROW_GRAVITY * dt
    a.x += a.vx * dt
    a.y += a.vy * dt
}

// Every blow of the hero lands here: talents add critical hits, life stolen in melee and mana for kills
export function strike(p, e, damage, dir, game, statuses = {}, melee = false) {
    const crit = game.random() < stat(p, 'crit')
    hurtEnemy(e, crit ? damage * 2 : damage, dir, game, statuses)
    if (crit) game.popup(e.x, e.y - TYPES[e.type].height - 30, t('crit'), '#ff9a3c')
    if (melee) p.hp = Math.min(p.maxHp, p.hp + damage * stat(p, 'lifesteal'))
    if (e.hp <= 0 && !TYPES[e.type].prop) p.mana = Math.min(p.maxMana, p.mana + stat(p, 'killMana'))
}

// Health loss from any source, the hero falls when it runs out. God mode from the dev panel ignores it.
function loseHp(p, damage, game) {
    if (game.dev?.god) return
    p.hp -= damage
    game.popup(p.x, p.y - 44, damage, '#ff6b5a')
    if (p.hp > 0) return
    game.state = 'dead'
    game.burst(p.x, p.y - 16, '#c21a0e', 40)
}

export function hurtPlayer(p, damage, dir, game, statuses = {}) {
    if (p.rollT >= 0 || p.hurtT > 0 || p.hp <= 0) return false
    // The ice shield takes the whole hit and breaks
    if (p.shieldT > 0) {
        p.shieldT = 0
        game.burst(p.x, p.y - 18, '#bff0ff', 24, 140)
        game.flash(p.x, p.y - 18, '#8fdcff', 64)
        sfx.shatter()
        return true
    }
    for (const [name, time] of Object.entries(statuses)) afflict(p, name, time)
    // Foes in higher areas hit harder
    loseHp(p, Math.max(1, Math.round(damage * areaScale(game.stage)) - stat(p, 'defense')), game)
    p.hurtT = 0.8
    p.attackT = p.drawT = p.whirlT = -1
    p.vx = dir * 200
    p.vy = -180
    p.onGround = false
    game.shake = 8
    game.flash(p.x, p.y - 18, '#ff5a40', 44)
    sfx.hurt()
    return true
}

function useItem(p, item, game) {
    if (!item || !canUse(p, item) || p.cooldown > 0 || p.attackT >= 0 || p.drawT >= 0 || p.whirlT >= 0) return
    if (COOLDOWNS[item]) p.skillT = COOLDOWNS[item]
    if (item === 'sword' || item === 'freeze') {
        // The freezing strike is a sword swing paid with mana
        p.chill = item === 'freeze'
        if (p.chill) {
            p.mana -= 30
            game.burst(p.x + p.dir * 14, p.y - 22, '#bff0ff', 12, 80, 1)
            sfx.cast()
            hint(game, 'Freeze')
        } else {
            p.stamina -= 12
            p.restT = 0.6
        }
        p.attackT = 0
        p.hitSet.clear()
        sfx.swing()
    } else if (item === 'bow') {
        p.drawT = 0
        hint(game, 'Bow')
    } else if (item === 'frost') {
        p.mana -= 25
        p.cooldown = 0.35
        game.bolts.push({ x: p.x + p.dir * 14, y: p.y - 22, vx: p.dir * 340, life: 1.2, damage: 18 + p.power + stat(p, 'spell') })
        sfx.cast()
    } else if (item === 'shield') {
        p.mana -= 40
        p.shieldT = 6
        p.cooldown = 0.3
        game.flash(p.x, p.y - 18, '#8fdcff', 64)
        sfx.shield()
        hint(game, 'Shield')
    } else if (item === 'potion') {
        p.bag.potion--
        p.hp = Math.min(p.maxHp, p.hp + 40)
        p.cooldown = 0.5
        game.burst(p.x, p.y - 18, '#ff6b6b', 16, 60)
        game.flash(p.x, p.y - 18, '#ff6b6b', 56)
        sfx.potion()
    } else if (item === 'whirl') {
        p.stamina -= 25
        p.restT = 0.6
        p.whirlT = 0
        p.hitSet.clear()
        sfx.swing()
    } else if (item === 'volley') {
        // Up to five arrows rain down on the ground ahead, one after another
        const count = Math.min(5, p.bag.arrows)
        p.bag.arrows -= count
        for (let i = 0; i < count; i++) game.shots.push({ x: p.x + p.dir * (40 + i * 25), y: -40 - i * 30, vx: p.dir * 40, vy: 250, damage: 12 + p.power, life: 3 })
        sfx.shoot()
    } else if (item === 'nova') {
        p.mana -= 40
        for (const e of game.enemies) if (e.hp > 0 && Math.abs(e.x - p.x) < NOVA_REACH) strike(p, e, 14 + p.power + stat(p, 'spell'), Math.sign(e.x - p.x) || 1, game, { freeze: 2.5 })
        for (let i = 0; i < 48; i++) {
            const a = i / 48 * Math.PI * 2
            game.particles.push({ x: p.x, y: p.y - 16, vx: Math.cos(a) * 260, vy: Math.sin(a) * 80, life: 0.35, color: '#bff0ff', size: 2, gravity: 0 })
        }
        game.flash(p.x, p.y - 18, '#8fdcff', 160)
        sfx.shatter()
    }
}

export function updatePlayer(p, dt, game) {
    p.hurtT -= dt
    p.cooldown -= dt
    p.skillT -= dt
    p.restT -= dt
    p.shieldT -= dt
    if (p.restT <= 0) p.stamina = Math.min(100, p.stamina + (30 + stat(p, 'staminaRegen')) * dt)
    p.mana = Math.min(p.maxMana, p.mana + (6 + stat(p, 'manaRegen')) * dt)
    const dot = tickStatuses(p, dt)
    if (dot) loseHp(p, dot, game)

    for (let i = 0; i < 9; i++) if (input.hit('Digit' + (i + 1))) p.slot = i
    p.slot = (((p.slot + input.takeWheel()) % 9) + 9) % 9
    if (SLOTS[p.slot] !== 'bow') p.drawT = -1

    const move = input.held('KeyD', 'ArrowRight') - input.held('KeyA', 'ArrowLeft')
    // A frozen hero can't act at all, a rooted one can't move but still fights
    const stunned = p.hurtT > 0.55 || has(p, 'freeze')
    const rooted = has(p, 'root')
    if (p.rollT >= 0) {
        p.rollT += dt
        p.vx = p.dir * ROLL_SPEED
        if (p.rollT > ROLL_TIME) p.rollT = -1
        // With the ice trail talent the roll leaves frost behind
        if (stat(p, 'trail') && Math.abs((game.trails.at(-1)?.x ?? -100) - p.x) > 8) game.trails.push({ x: p.x, life: 3 })
    } else {
        const target = stunned || rooted || (p.attackT >= 0 && p.onGround) || p.drawT >= 0 ? 0 : move * SPEED * (has(p, 'slow') ? 0.6 : 1)
        // Ice gives little grip, so the hero slides when he starts and stops
        p.vx += (target - p.vx) * Math.min(1, dt * (stunned ? 3 : p.onGround && onIce(game.stage, p.x) ? 1.5 : 14))
        if (!stunned) {
            if (move && p.attackT < 0) p.dir = move
            if (input.hit(...JUMP_KEYS) && p.onGround && !rooted) {
                p.vy = -JUMP
                p.onGround = false
                sfx.jump()
            }
            if (!input.held(...JUMP_KEYS) && p.vy < -120) p.vy = -120
            if (input.hit('ShiftLeft', 'ShiftRight', 'KeyK') && p.onGround && !rooted && p.stamina >= 30) {
                p.stamina -= 30
                p.restT = 0.6
                p.rollT = 0
                p.attackT = p.drawT = p.whirlT = -1
                hint(game, 'Roll')
                if (move) p.dir = move
                sfx.roll()
            }
            if (input.hit(...USE_KEYS)) useItem(p, SLOTS[p.slot], game)
            for (const [key, item] of Object.entries(SKILLS)) if (input.hit(key)) useItem(p, item, game)
            if (input.hit(SKILL_KEY)) useItem(p, p.skill, game)
        }
    }

    if (p.attackT >= 0) {
        p.attackT += dt
        if (p.attackT > 0.06 && p.attackT < 0.2) {
            const reach = p.x + p.dir * 16
            for (const e of game.enemies) {
                if (e.hp <= 0 || p.hitSet.has(e) || Math.abs(e.x - reach) > 30 || p.y < e.y - TYPES[e.type].height) continue
                p.hitSet.add(e)
                strike(p, e, 14 + p.power, p.dir, game, p.chill ? { freeze: 1.6 } : {}, true)
            }
        }
        if (p.attackT > ATTACK_TIME) p.attackT = -1
    }

    // The blade whirl cuts everything around once and leaves it bleeding
    if (p.whirlT >= 0) {
        p.whirlT += dt
        for (const e of game.enemies) {
            if (e.hp <= 0 || p.hitSet.has(e) || Math.abs(e.x - p.x) > WHIRL_REACH || p.y < e.y - TYPES[e.type].height) continue
            p.hitSet.add(e)
            strike(p, e, 16 + p.power, Math.sign(e.x - p.x) || p.dir, game, { bleed: 4 }, true)
        }
        const a = p.whirlT * 40
        game.particles.push({ x: p.x + Math.cos(a) * 24, y: p.y - 16 + Math.sin(a) * 6, vx: 0, vy: 0, life: 0.15, color: '#8ff0e4', size: 2, gravity: 0 })
        if (p.whirlT > WHIRL_TIME) p.whirlT = -1
    }

    // The bow is drawn while the use key is held and shoots on release
    if (p.drawT >= 0) {
        p.drawT += dt
        if (!input.held(...USE_KEYS)) {
            game.shots.push({ ...aimArrow(p), life: 3 })
            p.bag.arrows--
            if (!p.bag.arrows) p.slot = SLOTS.indexOf('sword')
            p.cooldown = 0.3
            p.drawT = -1
            sfx.shoot()
        }
    }

    p.vy += GRAVITY * dt
    p.x = Math.max(10, Math.min(LEVEL_W - 10, p.x + p.vx * dt))
    p.y += p.vy * dt
    if (p.y >= GROUND) {
        if (!p.onGround) game.burst(p.x, GROUND, '#eef7fa', 6, 50)
        p.y = GROUND
        p.vy = 0
        p.onGround = true
    }
    p.walk += Math.abs(p.vx) * dt * 0.1
}

import { input } from './input.js'
import { sfx } from './sound.js'
import { TYPES, hurtEnemy } from './enemies.js'
import { stat, updateStats, noTalents } from './talents.js'
import { ITEMS, GEAR_SLOTS, createItem, worn } from './items.js'
import { areaScale } from './levels.js'
import { moveBody, onIce, onPlatform, isSolid, tileAt, groundBelow, breakTile, box, overlap, bodyBox } from './terrain.js'
import { afflict, has, tickStatuses } from './status.js'
import { t } from './lang.js'
import { settings, DIFFICULTIES } from './settings.js'

export const SLOTS = ['weapon', 'bow', 'frost', 'potion']
// Mana skills have their own keys, touch screens have buttons for them.
// The skill picked in the talent tree has one more key and cools down after use.
export const SKILLS = { KeyX: 'freeze', KeyC: 'shield' }
export const SKILL_KEY = 'KeyQ'
export const COOLDOWNS = { whirl: 6, volley: 8, nova: 10 }
export const ROLL_TIME = 0.35
export const WHIRL_TIME = 0.5
export const WHIRL_REACH = 48
export const XP_PER_LEVEL = 100
export const NOVA_REACH = 100
// How steeply the bow can be aimed, and where it points when nothing is asked of it
export const AIM_RANGE = [-0.85, 1.35]
export const FLAT_AIM = 0.29

const SPEED = 125
const JUMP = 330
const GRAVITY = 960
const MAX_FALL = 600
const ARROW_GRAVITY = 520
const ROLL_SPEED = 250
const STAFF_CHARGE = 0.8
const CLIMB_SPEED = 90
const GRAB_TIME = 1.4
const DROP_KEYS = ['ArrowDown', 'KeyS']
const JUMP_KEYS = ['ArrowUp', 'KeyW']
const USE_KEYS = ['Space', 'KeyJ', 'Mouse0']

export function createPlayer() {
    return {
        x: 0, y: 0, w: 14, h: 34, vx: 0, vy: 0, dir: 1, onGround: true, walk: 0, safe: null, dropT: 0, moving: false,
        combo: 0, landT: 0, castT: 0, drinkT: 0, stepX: 0,
        hp: 100, maxHp: 100, mana: 100, maxMana: 100, stamina: 100, restT: 0,
        xp: 0, level: 1, power: 0, talents: noTalents(), skill: null, resets: 0,
        slot: 0, cooldown: 0, skillT: 0, hits: 0, pity: 0, aim: FLAT_AIM, climbing: false, grabbed: null, grabT: 0,
        bag: { gold: 10, arrows: 10, potion: 3 }, quiver: 'arrows', pack: [],
        gear: { ...Object.fromEntries(GEAR_SLOTS.map(slot => [slot, null])), weapon: createItem('sword'), bow: createItem('bow') },
        attackT: -1, attackTime: 0, chill: false, hitSet: new Set(), rollT: -1, whirlT: -1, hurtT: 0, drawT: -1, shieldT: 0, statuses: {},
    }
}

// What the hero keeps between stages and sessions, everything else starts fresh
export const carried = hero => structuredClone(Object.fromEntries(['bag', 'pack', 'gear', 'quiver', 'xp', 'level', 'talents', 'skill', 'resets', 'pity'].map(key => [key, hero[key]])))

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
        weapon: p.stamina >= worn(p, 'weapon').stamina, bow: p.bag[p.quiver] > 0, frost: p.mana >= 25, freeze: p.mana >= 30, shield: p.mana >= 40 && p.shieldT <= 0, potion: p.bag.potion > 0,
        whirl: ready && p.stamina >= 25, volley: ready && p.bag[p.quiver] > 0, nova: ready && p.mana >= 40,
    }[item]
}

// How far the bow is drawn or the staff charged, from 0 to 1
export const charge = p => Math.min(1, p.drawT / (SLOTS[p.slot] === 'bow' ? worn(p, 'bow').draw : STAFF_CHARGE))

// Arrow leaving the bow, along the angle it was aimed at. The longer the string is drawn, the faster and farther it flies.
export function aimArrow(p) {
    const speed = 180 + 340 * charge(p)
    const bow = worn(p, 'bow')
    return {
        x: p.x + p.dir * 12, y: p.y - 23, vx: p.dir * Math.cos(p.aim) * speed, vy: -Math.sin(p.aim) * speed,
        damage: Math.round((8 + 16 * charge(p)) * bow.might) + p.power, ammo: p.quiver, pull: bow.pull,
    }
}

// Up and down turn the bow while it is drawn, a finger dragged off the attack button aims straight at a spot
function takeAim(p, dt) {
    const drag = input.drag()
    if (drag && Math.hypot(...drag) > 10) {
        p.dir = Math.sign(drag[0]) || p.dir
        p.aim = Math.atan2(-drag[1], Math.abs(drag[0]))
    } else {
        p.aim += (input.held(...JUMP_KEYS) - input.held(...DROP_KEYS)) * 1.9 * dt
    }
    p.aim = Math.max(AIM_RANGE[0], Math.min(AIM_RANGE[1], p.aim))
}

export function flyArrow(a, dt) {
    a.vy += ARROW_GRAVITY * dt
    a.x += a.vx * dt
    a.y += a.vy * dt
}

// Where the swing of the worn weapon and the blade whirl cut, as boxes like bodies
export const swingBox = p => box(p.dir > 0 ? p.x - 14 : p.x - worn(p, 'weapon').reach, p.y - 40, worn(p, 'weapon').reach + 14, 44)
export const whirlBox = p => box(p.x - WHIRL_REACH, p.y - 40, WHIRL_REACH * 2, 44)

// Every blow of the hero lands here: talents and gear add critical hits, life stolen in melee and mana for kills.
// Legendary gear calls a spirit wolf every few hits and raises damage for a while after a kill.
export function strike(p, e, damage, dir, game, statuses = {}, melee = false) {
    const crit = game.random() < stat(p, 'crit')
    const dealt = game.dev?.god ? e.hp : Math.round(damage * (crit ? 2 : 1) * (has(p, 'frenzy') ? 1 + stat(p, 'frenzy') : 1) * DIFFICULTIES[settings.difficulty].dealt)
    hurtEnemy(e, dealt, dir, game, statuses)
    if (crit) {
        game.popup(e.x, e.y - e.h - 30, t('crit'), '#ff9a3c')
        game.impact = Math.max(game.impact, 0.6)
        game.effect('crit', e.x, e.y - e.h / 2, 1, 0.3)
    }
    if (melee) p.hp = Math.min(p.maxHp, p.hp + dealt * stat(p, 'lifesteal'))
    if (stat(p, 'wolf') && ++p.hits % stat(p, 'wolf') === 0) game.spirits.push({ x: p.x, y: p.y, dir: Math.sign(e.x - p.x) || p.dir, life: 1, hitSet: new Set() })
    if (e.hp > 0 || TYPES[e.type].prop) return
    p.mana = Math.min(p.maxMana, p.mana + stat(p, 'killMana'))
    if (stat(p, 'frenzy')) afflict(p, 'frenzy', 4)
}

// A bolt from the frost slot, a charged one blasts every foe around the place it hits
function castBolt(p, game, power) {
    p.cooldown = 0.35
    p.castT = 0.3
    game.bolts.push({ x: p.x + p.dir * 14, y: p.y - 22, vx: p.dir * 340, life: 1.2, damage: Math.round((18 + p.power + stat(p, 'spell')) * (1 + power)), radius: power * 60 })
    sfx.cast()
}

// An empty quiver switches to another kind of arrows, or back to the weapon when none are left
function refill(p) {
    if (p.bag[p.quiver]) return
    const ammo = Object.keys(ITEMS).find(item => ITEMS[item].ammo && p.bag[item])
    if (ammo) p.quiver = ammo
    else p.slot = SLOTS.indexOf('weapon')
}

// Heavy tools shatter what is in front of the hero: an ice block, or the frozen lake into a hole
function crackIce(p, game) {
    const x = p.x + p.dir * 22
    const floor = groundBelow(game.map, x, p.y - 8)
    const broken = breakTile(game.map, x, p.y - 22) ?? breakTile(game.map, x, p.y - 6) ?? (floor !== null && breakTile(game.map, x, floor))
    if (!broken) return
    game.burst(broken.x, broken.y, '#bff0ff', 22, 170)
    game.effect('shatter', broken.x, broken.y - 6, 0.9, 0.4)
    game.shake = 6
    sfx.shatter()
    hint(game, broken.char === 'X' ? 'Block' : 'Hole')
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
    // Scales and yeti fur shrug off the worst of the cold
    for (const [name, time] of Object.entries(statuses)) afflict(p, name, name === 'freeze' ? time / (1 + stat(p, 'thaw')) : time)
    if (statuses.freeze) game.effect('shatter', p.x, p.y - 18, 0.7, 0.35)
    // Foes in higher areas and on harder difficulty hit harder
    loseHp(p, Math.max(1, Math.round(damage * areaScale(game.stage) * DIFFICULTIES[settings.difficulty].taken) - stat(p, 'defense')), game)
    p.hurtT = 0.8
    p.attackT = p.drawT = p.whirlT = -1
    p.vx = dir * 200
    p.vy = -180
    p.onGround = false
    game.shake = 8
    game.impact = Math.max(game.impact, 0.4)
    game.mark(p.x, p.y, 'blood', dir)
    game.flash(p.x, p.y - 18, '#ff5a40', 44)
    sfx.hurt()
    return true
}

function useItem(p, item, game) {
    if (!item || !canUse(p, item) || p.cooldown > 0 || p.attackT >= 0 || p.drawT >= 0 || p.whirlT >= 0) return
    if (COOLDOWNS[item]) p.skillT = COOLDOWNS[item]
    if (item === 'weapon' || item === 'freeze') {
        // The freezing strike is a sword swing paid with mana
        p.chill = item === 'freeze'
        if (p.chill) {
            p.mana -= 30
            game.burst(p.x + p.dir * 14, p.y - 22, '#bff0ff', 12, 80, 1)
            sfx.cast()
            hint(game, 'Freeze')
        } else {
            p.stamina -= worn(p, 'weapon').stamina
            p.restT = 0.6
            if (worn(p, 'weapon').crack) crackIce(p, game)
        }
        p.attackT = 0
        // Swings go through the three blows of the combo in turn
        p.combo = (p.combo + 1) % 3
        p.attackTime = worn(p, 'weapon').time / (1 + stat(p, 'attackSpeed'))
        p.hitSet.clear()
        sfx.swing()
    } else if (item === 'bow') {
        p.drawT = 0
        hint(game, 'Bow')
    } else if (item === 'frost') {
        p.mana -= 25
        // A staff charges the bolt while the use key is held, like drawing a bow
        if (worn(p, 'weapon').charged) {
            p.drawT = 0
            hint(game, 'Staff')
        } else {
            castBolt(p, game, 0)
        }
    } else if (item === 'shield') {
        p.mana -= 40
        p.shieldT = 6
        p.cooldown = 0.3
        p.castT = 0.3
        game.flash(p.x, p.y - 18, '#8fdcff', 64)
        sfx.shield()
        hint(game, 'Shield')
    } else if (item === 'potion') {
        p.bag.potion--
        p.hp = Math.min(p.maxHp, p.hp + 40)
        p.cooldown = 0.5
        p.drinkT = 0.5
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
        const count = Math.min(5, p.bag[p.quiver])
        for (let i = 0; i < count; i++) game.shots.push({ x: p.x + p.dir * (40 + i * 25), y: game.camY - 40 - i * 30, vx: p.dir * 40, vy: 250, damage: 12 + p.power, ammo: p.quiver, life: 3, hitSet: new Set() })
        p.bag[p.quiver] -= count
        refill(p)
        sfx.shoot()
    } else if (item === 'nova') {
        p.mana -= 40
        p.castT = 0.3
        const wide = 1 + (worn(p, 'weapon').nova ?? 0)
        const reach = NOVA_REACH * wide
        for (const e of game.enemies) if (e.hp > 0 && overlap(box(p.x - reach, p.y - 60, reach * 2, 80), bodyBox(e))) strike(p, e, 14 + p.power + stat(p, 'spell'), Math.sign(e.x - p.x) || 1, game, { freeze: 2.5 })
        for (let i = 0; i < 48; i++) {
            const a = i / 48 * Math.PI * 2
            game.spark(p.x, p.y - 16, Math.cos(a) * 260 * wide, Math.sin(a) * 80, 0.35, '#bff0ff', 2)
        }
        game.flash(p.x, p.y - 18, '#8fdcff', 160 * wide)
        game.effect('nova', p.x, p.y - 4, wide, 0.5)
        sfx.shatter()
    }
}

export function updatePlayer(p, dt, game) {
    p.hurtT -= dt
    p.landT -= dt
    p.castT -= dt
    p.drinkT -= dt
    p.cooldown -= dt
    p.skillT -= dt
    p.restT -= dt
    p.shieldT -= dt
    if (p.restT <= 0) p.stamina = Math.min(100, p.stamina + (30 + stat(p, 'staminaRegen')) * dt)
    // The Amulet of the Deep draws mana from the water under the ice
    p.mana = Math.min(p.maxMana, p.mana + (6 + stat(p, 'manaRegen') + (onIce(game.map, p) ? stat(p, 'depths') : 0)) * dt)
    const dot = tickStatuses(p, dt)
    if (dot) loseHp(p, dot, game)

    // A yeti holding the hero shakes him until he rolls free, otherwise it hurls him away
    if (p.grabbed) {
        const holder = p.grabbed
        p.grabT += dt
        Object.assign(p, { x: holder.x + holder.dir * 20, y: holder.y - 22, vx: 0, vy: 0 })
        const freed = input.hit('ShiftLeft', 'ShiftRight', 'KeyK')
        hint(game, 'Grab')
        if (!freed && p.grabT < GRAB_TIME && holder.hp > 0 && !has(holder, 'freeze')) return
        p.grabbed = null
        if (freed || holder.hp <= 0 || has(holder, 'freeze')) {
            game.burst(p.x, p.y - 16, '#eef7fa', 14, 120)
            return sfx.roll()
        }
        p.hurtT = 0
        hurtPlayer(p, 20, -holder.dir, game)
        p.vx = -holder.dir * 320
        p.vy = -280
        return
    }

    const slot = p.slot
    for (let i = 0; i < 9; i++) if (input.hit('Digit' + (i + 1))) p.slot = i
    p.slot = (((p.slot + input.takeWheel()) % 9) + 9) % 9
    if (p.slot !== slot) p.drawT = -1

    const move = input.held('KeyD', 'ArrowRight') - input.held('KeyA', 'ArrowLeft')
    p.moving = move !== 0
    // A frozen hero can't act at all, a rooted one can't move but still fights
    const stunned = p.hurtT > 0.55 || has(p, 'freeze')
    const rooted = has(p, 'root')
    // With the pickaxe in hand the hero hangs on an ice wall and climbs it, held there until he lets go
    const wall = stat(p, 'climb') && !stunned && p.rollT < 0 && [1, -1].find(side => tileAt(game.map, p.x + side * (p.w / 2 + 3), p.y - 16) === 'I')
    const letGo = input.hit('ShiftLeft', 'ShiftRight', 'KeyK') || (p.onGround && input.held(...DROP_KEYS))
    p.climbing = Boolean(wall) && !letGo && (p.climbing || input.held(...JUMP_KEYS))
    if (p.climbing) {
        p.dir = wall
        p.vx = move * 60
        p.vy = (input.held(...DROP_KEYS) - input.held(...JUMP_KEYS)) * CLIMB_SPEED
        hint(game, 'Climb')
    } else if (p.rollT >= 0) {
        p.rollT += dt
        p.vx = p.dir * ROLL_SPEED
        if (p.rollT > ROLL_TIME) p.rollT = -1
        // With the ice trail talent the roll leaves frost behind
        if (stat(p, 'trail') && p.onGround && Math.abs((game.trails.at(-1)?.x ?? -100) - p.x) > 8) game.trails.push({ x: p.x, y: p.y, life: 3 })
    } else {
        const target = stunned || rooted || (p.attackT >= 0 && p.onGround) || p.drawT >= 0 ? 0 : move * SPEED * (1 + stat(p, 'speed')) * (game.dev?.god ? 2 : 1) * (has(p, 'slow') ? 0.6 : 1)
        // Ice gives little grip, so the hero slides when he starts and stops. Good boots grip better.
        p.vx += (target - p.vx) * Math.min(1, dt * (stunned ? 3 : p.onGround && onIce(game.map, p) ? 1.5 + stat(p, 'grip') : 14))
        if (!stunned) {
            if (move && p.attackT < 0) p.dir = move
            // Down drops through the platform under the hero, while the bow is drawn up and down aim it instead
            if (p.drawT >= 0 && SLOTS[p.slot] === 'bow') takeAim(p, dt)
            else if (input.hit(...DROP_KEYS) && p.onGround && !rooted && onPlatform(game.map, p)) p.dropT = 0.25
            if (input.hit(...JUMP_KEYS) && p.onGround && !rooted && p.drawT < 0) {
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
        const swing = p.attackT / p.attackTime
        if (swing > 0.2 && swing < 0.67) {
            const weapon = worn(p, 'weapon')
            for (const e of game.enemies) {
                if (e.hp <= 0 || p.hitSet.has(e) || !overlap(swingBox(p), bodyBox(e))) continue
                p.hitSet.add(e)
                // Pushing weapons knock foes back farther
                strike(p, e, weapon.damage + p.power, p.dir * (1 + (weapon.push ?? 0)), game, { ...weapon.statuses, ...(p.chill && { freeze: 1.6 }) }, true)
            }
        }
        if (swing > 1) p.attackT = -1
    }

    // The blade whirl cuts everything around once and leaves it bleeding
    if (p.whirlT >= 0) {
        p.whirlT += dt
        for (const e of game.enemies) {
            if (e.hp <= 0 || p.hitSet.has(e) || !overlap(whirlBox(p), bodyBox(e))) continue
            p.hitSet.add(e)
            strike(p, e, 16 + p.power, Math.sign(e.x - p.x) || p.dir, game, { bleed: 4 }, true)
        }
        const a = p.whirlT * 40
        game.spark(p.x + Math.cos(a) * 24, p.y - 16 + Math.sin(a) * 6, 0, 0, 0.15, '#8ff0e4', 2)
        if (p.whirlT > WHIRL_TIME) p.whirlT = -1
    }

    // The bow is drawn, or the staff charged, while the use key is held and shoots on release
    if (p.drawT >= 0) {
        p.drawT += dt
        if (!input.held(...USE_KEYS)) {
            if (SLOTS[p.slot] === 'bow') {
                game.shots.push({ ...aimArrow(p), life: 3, hitSet: new Set() })
                p.bag[p.quiver]--
                refill(p)
                p.cooldown = 0.3
                sfx.shoot()
            } else {
                castBolt(p, game, charge(p))
            }
            p.drawT = -1
        }
    }

    p.dropT -= dt
    if (!p.climbing) p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt)
    // The mountain wind leans on the hero in gusts, crampons bite into the ice and hold him where he stands
    if (game.stage.wind && !stat(p, 'anchor') && !p.climbing) p.vx += game.stage.wind * (0.7 + 0.3 * Math.sin(game.time * 0.7)) * dt
    const falling = !p.onGround
    moveBody(p, dt, game.map, { step: true, drop: p.dropT > 0 })
    if (p.onGround && falling) {
        game.burst(p.x, p.y, '#eef7fa', 6, 50)
        p.landT = 0.15
    }
    // Footprints stay in the snow
    if (p.onGround && Math.abs(p.x - p.stepX) > 9 && game.stage.theme !== 'cave' && tileAt(game.map, p.x, p.y + 1) === '#') {
        p.stepX = p.x
        game.mark(p.x, p.y, 'step', p.dir)
    }
    // The last spot with firm ground under both feet, the hero comes back there after falling into a chasm
    if (p.onGround && isSolid(game.map, p.x - p.w / 2, p.y + 1) && isSolid(game.map, p.x + p.w / 2, p.y + 1)) p.safe = { x: p.x, y: p.y }
    if (p.y > game.map.h + 64) {
        Object.assign(p, p.safe, { vx: 0, vy: 0, hurtT: 1 })
        loseHp(p, Math.round(p.maxHp * 0.2), game)
    }
    p.walk += Math.abs(p.vx) * dt * 0.1
}

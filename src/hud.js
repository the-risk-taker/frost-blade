import { view } from './const.js'
import { SLOTS, SKILLS, SKILL_KEY, COOLDOWNS, canUse } from './player.js'
import { TYPES } from './enemies.js'
import { bestiary } from './bestiary.js'
import { ITEMS, OFFERS, GEAR_SLOTS, PACK_SIZE, PERCENT, RARITIES, bonuses, createItem, price, canBuy, buy, sell, equip, unequip } from './items.js'
import { TALENTS, stat, points, pickTalent, resetCost, canReset, resetTalents } from './talents.js'
import { LEVELS } from './levels.js'
import { progress, takeQuest } from './quests.js'
import { LANGUAGES, language, languageName, setLanguage, t } from './lang.js'
import { buildItems, buildFrame, buildPortraits } from './sprites.js'
import { buildBoards } from './art.js'
import { TYPING } from './story.js'
import { settings, saveSettings, QUALITIES, DIFFICULTIES } from './settings.js'
import { makeCanvas } from './pixels.js'
import { devPanel, devClick } from './dev.js'
import { version } from '../package.json'

const touch = matchMedia('(pointer: coarse)').matches
const DRAW_BUDGET = 60

// Stats where less is better, like the time of a swing
const LOWER_BETTER = ['time', 'stamina', 'draw']

const $ = id => document.getElementById(id)

const questName = quest => quest.item
    ? t('questCollect', { item: t(`item.${quest.item}`), count: quest.count })
    : t('questKill', { enemy: t(`enemy.${quest.kill}`), count: quest.count })

const itemName = item => `<span style="color:${RARITIES[item.rarity].color}">${t(`item.${item.base}`)}</span>`

const statText = (key, value) => t(`stat.${key}`, { value: `${value > 0 ? '+' : ''}${PERCENT.includes(key) ? `${Math.round(value * 100)}%` : Math.round(value * 100) / 100}` })

// Stats of a gear piece against the one worn in its slot, better ones green and worse ones red
function compare(p, item) {
    const next = bonuses(item)
    const now = p.gear[ITEMS[item.base].slot] ? bonuses(p.gear[ITEMS[item.base].slot]) : {}
    return Object.keys({ ...now, ...next }).map(key => {
        const diff = (next[key] ?? 0) - (now[key] ?? 0)
        const better = diff > 0 !== LOWER_BETTER.includes(key)
        return diff ? `<p class="${better ? 'better' : 'worse'}">${statText(key, diff)}</p>` : ''
    }).join('')
}

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const summaryLine = game => t('summary', { time: formatTime(game.playTime), kills: game.totalKills, gold: game.player.bag.gold })

// Actions that can be bound to other keys, by the key the game listens for
const ACTIONS = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', down: 'ArrowDown', roll: 'ShiftLeft', use: 'Space', freeze: 'KeyX', shield: 'KeyC', skill: 'KeyQ', bag: 'KeyI', talents: 'KeyT', bestiary: 'KeyB', talk: 'KeyE' }

// Keys pressed for an action: those bound to it plus its own key unless that one was bound elsewhere
const keysFor = code => [...Object.keys(settings.keys).filter(key => settings.keys[key] === code), ...(settings.keys[code] ?? code) === code ? [code] : []]

// A line of a story scene: a board for the narrator and a portrait for everyone else.
// The text itself is typed in by update().
function storyLines(game, art) {
    const { who, mood, board } = game.scene.lines[game.scene.line]
    const name = who === 'narrator' ? '' : `<b>${t(`speaker.${who}`)}</b>`
    const portrait = who === 'narrator' ? '' : `<img src="${art.portraits[who][mood]}">`
    const picture = board ? `<img class="board" src="${art.boards[board]}">` : ''
    return ['', `${picture}<div class="dialog ${who}">${portrait}<div>${name}<p id="line"></p><em id="next">${t('next', { key: touch ? t('tap') : 'ENTER' })}${touch ? '' : ` &nbsp; ${t('skip')}`}</em></div></div>`]
}

function overlayLines(game, art) {
    if (game.state === 'travel') return null
    if (game.state === 'story') return storyLines(game, art)
    const start = touch ? t('tap') : 'ENTER'
    const retry = touch ? t('tap') : 'R'
    const controls = touch ? [t('hintTouch')] : [t('keysMove'), t('keysUse'), t('keysSkills'), t('keysMenu')]
    // An empty data-key keeps a tap on a menu option from also starting a new game
    const languages = LANGUAGES.map(code => `<span data-language="${code}" data-key="" ${code === language() ? 'data-active' : ''}>${languageName(code)}</span>`).join(' ')
    // Starting over and resuming are the same kind of choice, so both are buttons saying where they drop the hero
    const saved = game.progress
    const option = (attribute, label, key, stage, level) =>
        `<span class="option" ${attribute} data-key="">${t(label, { key })}<em>${t(`stage.${stage.theme}`)} &nbsp; ${t('level', { level })}</em></span>`
    const menu = [option('data-start', 'start', start, LEVELS[0], 1)]
    if (saved) menu.push(option('data-continue', 'continueGame', touch ? t('tap') : 'C', LEVELS[saved.stage] ?? LEVELS[0], saved.level))
    return {
        title: [t('title'), t('storyIntro'), ...controls, t('goal'), menu.join(' '), `<span data-open="settings" data-key="">${t('openSettings', { key: touch ? t('tap') : 'O' })}</span>`, `${t('language')}: ${languages}`],
        dead: [t('dead'), t('retry', { key: retry }), summaryLine(game)],
        win: [t('win'), t('winText'), summaryLine(game), t('again', { key: retry })],
    }[game.state]
}

export class Hud {
    constructor(game) {
        $('version').textContent = `v${version}`
        $('stage').style.setProperty('--frame', `url(${buildFrame().toDataURL()})`)
        const urls = canvases => Object.fromEntries(Object.entries(canvases).map(([key, canvas]) => [key, canvas.toDataURL()]))
        this.art = { portraits: Object.fromEntries(Object.entries(buildPortraits()).map(([who, moods]) => [who, urls(moods)])), boards: urls(buildBoards()) }
        this.trails = {}
        this.faces = {}
        this.applySettings()
        this.items = buildItems()
        // Hotbar icons are cut out of the item sheet
        this.icons = Object.fromEntries(Object.entries(this.items.frames).map(([item, [{ x, y }]]) => {
            const canvas = makeCanvas(32, 32)
            canvas.getContext('2d').drawImage(this.items.canvas, x, y, 32, 32, 0, 0, 32, 32)
            return [item, canvas]
        }))
        const addSlot = key => {
            const slot = document.createElement('div')
            slot.className = 'slot'
            slot.dataset.key = key
            $('slots').append(slot)
            return slot
        }
        this.slots = SLOTS.concat(Array(9 - SLOTS.length).fill(null)).map((item, i) => {
            const slot = addSlot(`Digit${i + 1}`)
            slot.append(document.createElement('b'))
            return slot
        })
        // Skill slots show their key. Touch buttons with the same key are greyed out along with them.
        // The last one holds the skill picked in the talent tree.
        this.skills = Object.entries({ ...SKILLS, [SKILL_KEY]: null }).map(([key, item]) => {
            const slot = addSlot(key)
            slot.classList.add('skill')
            slot.append(Object.assign(document.createElement('b'), { textContent: key.slice(3) }))
            return { item, slot, elements: document.querySelectorAll(`[data-key="${key}"]`) }
        })

        $('panel').style.setProperty('--items', `url(${this.items.canvas.toDataURL()})`)
        $('panel').style.setProperty('--items-size', `${this.items.canvas.width / 2}px`)
        const onPanelClick = e => {
            const p = game.player
            const { offer, purchase, sale, gearSale, pick, wear, slot, quiver, quest, talent, node, reset, close, open, setting, value, bind, save } = e.target.closest('[data-offer], [data-purchase], [data-sale], [data-gear-sale], [data-pick], [data-wear], [data-slot], [data-quiver], [data-quest], [data-talent], [data-reset], [data-close], [data-open], [data-setting], [data-bind], [data-save]')?.dataset ?? {}
            // Offers and pack pieces are picked first to see their stats, then bought or put on with a button
            if (offer) this.offer = Number(offer)
            if (purchase) buy(p, OFFERS[this.offer])
            if (sale) sell(p, sale)
            if (gearSale) sell(p, p.pack[gearSale])
            if (pick) this.picked = p.pack[pick]
            if (wear) equip(p, this.picked)
            if (slot) unequip(p, slot)
            if (quiver) p.quiver = quiver
            if (quest) takeQuest(game, game.quests[quest])
            if (talent) pickTalent(p, talent, Number(node))
            if (reset) resetTalents(p)
            if (game.panel === 'dev') devClick(game, e.target)
            if (setting) this.changeSetting(setting, value)
            if (bind) this.binding = bind
            if (save === 'export') exportSave()
            if (save === 'import') $('importFile').click()
            if (open) game.panel = open
            if (close) game.panel = null
        }
        $('panel').addEventListener('click', onPanelClick)
        const onOverlayClick = e => {
            const code = e.target.closest('[data-language]')?.dataset.language
            if (code) setLanguage(code)
            if (e.target.closest('[data-start]')) game.newGame()
            if (e.target.closest('[data-continue]')) game.continueGame()
            if (e.target.closest('[data-open]')) game.panel = 'settings'
        }
        // A key pressed while waiting for a binding goes to that action and never reaches the game
        const onBindKey = e => {
            if (!this.binding || game.panel !== 'settings') return
            e.stopImmediatePropagation()
            if (e.code !== 'Escape') {
                // The old keys of the action stop working, the new one takes over
                for (const key of keysFor(this.binding)) settings.keys[key] = 'None'
                settings.keys[e.code] = this.binding
                saveSettings()
            }
            this.binding = null
        }
        addEventListener('keydown', onBindKey, true)
        $('importFile').addEventListener('change', importSave)
        $('overlay').addEventListener('click', onOverlayClick)
        // Info buttons open their box, taps on them and inside the box never reach the game
        const keepFromGame = e => e.stopPropagation()
        for (const [button, box] of [['credits', 'creditsBanner'], ['changes', 'changelog']]) {
            const toggleBox = () => $(box).hidden = !$(box).hidden
            $(button).addEventListener('pointerdown', keepFromGame)
            $(box).addEventListener('pointerdown', keepFromGame)
            $(button).addEventListener('click', toggleBox)
            $(box).querySelector('.close')?.addEventListener('click', toggleBox)
        }
    }

    icon(item) {
        const { x, y } = this.items.frames[item.base ?? item][0]
        return `<i class="icon" style="background-position: -${x / 2}px -${y / 2}px"></i>`
    }

    // Puts the icon of an item into a hotbar slot when it changes
    showIcon(slot, item) {
        if (slot.dataset.icon === String(item)) return
        slot.dataset.icon = item
        slot.querySelector('canvas')?.remove()
        if (item) slot.prepend(this.icons[item])
    }

    // Stats of a picked gear piece against the worn one, followed by a button that acts on it
    details(p, item, label, attributes) {
        const stats = typeof item === 'string' ? '' : compare(p, item)
        return `<div class="compare"><div>${stats}</div><span class="button" ${attributes}>${label}</span></div>`
    }

    row(item, name, detail, attributes = '') {
        return `<div class="row" ${attributes}>${this.icon(item)}<span>${name}</span><em>${detail}</em></div>`
    }

    cost(items) {
        return Object.entries(items).map(([item, n]) => `${n}${this.icon(item)}`).join(' ')
    }

    // Every foe met so far, with the health it starts with, what hurts it most and how many have fallen
    bestiaryPanel(renderer) {
        const rows = Object.keys(TYPES).filter(type => type in bestiary).map(type => {
            const detail = t('bestiaryEntry', { hp: TYPES[type].hp, weak: t(`weak.${TYPES[type].weak}`), kills: bestiary[type] })
            return `<div class="row beast"><img src="${this.faces[type] ??= portrait(renderer.enemySheet(type))}"><span>${t(`enemy.${type}`)}<em>${detail}</em></span></div>`
        })
        return `<h2>${t('bestiary')}</h2>${rows.join('') || `<p>${t('bestiaryEmpty')}</p>`}<p>${t('bestiaryHint')}</p>`
    }

    // Worn gear, the pack with the picked piece compared, arrows to put in the quiver and the rest of the loot
    bagPanel(p) {
        if (!p.pack.includes(this.picked)) this.picked = null
        const worn = GEAR_SLOTS.filter(slot => p.gear[slot]).map(slot => this.row(p.gear[slot], itemName(p.gear[slot]), t(`slot.${slot}`), `data-slot="${slot}" data-worn`))
        const pack = p.pack.map((item, i) => {
            const picked = item === this.picked
            const row = this.row(item, itemName(item), t(`slot.${ITEMS[item.base].slot}`), `data-pick="${i}" ${picked ? 'data-active' : ''}`)
            return picked ? row + this.details(p, item, t('wear'), 'data-wear="1"') : row
        })
        const ammo = Object.keys(ITEMS).filter(item => ITEMS[item].ammo && p.bag[item])
            .map(item => this.row(item, t(`item.${item}`), p.bag[item], `data-quiver="${item}" ${item === p.quiver ? 'data-active' : ''}`))
        const loot = Object.keys(ITEMS).filter(item => !ITEMS[item].ammo && item !== 'gold' && p.bag[item]).map(item => this.row(item, t(`item.${item}`), p.bag[item]))
        const stats = t('stats', { defense: stat(p, 'defense'), mana: stat(p, 'manaRegen'), stamina: stat(p, 'staminaRegen'), crit: Math.round(stat(p, 'crit') * 100), warmth: stat(p, 'warmth') })
        return `<h2>${t('bag')}</h2>${worn.join('')}<h3>${t('pack')} <em>${p.pack.length}/${PACK_SIZE}</em></h3>${pack.join('') || `<p>${t('packEmpty')}</p>`}` +
            `<h3>${t('quiver')}</h3>${ammo.join('')}<h3>${t('loot')}</h3>${loot.join('')}<p>${stats}</p><p>${t('bagHint')}</p>`
    }

    shopPanel(p) {
        const offers = OFFERS.map((offer, i) => {
            const name = t(`item.${offer.item}`) + (offer.count > 1 ? ` x${offer.count}` : '')
            const off = canBuy(p, offer) ? '' : 'data-off'
            const picked = i === this.offer
            const row = this.row(offer.item, name, this.cost(offer.cost), `data-offer="${i}" ${picked ? 'data-active' : off}`)
            return picked ? row + this.details(p, ITEMS[offer.item].slot ? createItem(offer.item) : offer.item, t('purchase'), `data-purchase="1" ${off}`) : row
        })
        const sales = [
            ...Object.keys(ITEMS).filter(item => !ITEMS[item].slot && ITEMS[item].value && p.bag[item])
                .map(item => this.row(item, `${t(`item.${item}`)} x${p.bag[item]}`, `+${this.cost({ gold: price(item) })}`, `data-sale="${item}"`)),
            ...p.pack.map((item, i) => this.row(item, itemName(item), `+${this.cost({ gold: price(item) })}`, `data-gear-sale="${i}"`)),
        ]
        const reset = `<div class="row" data-reset="1" ${canReset(p) ? '' : 'data-off'}><span>${t('resetTalents')}</span><em>${this.cost({ gold: resetCost(p) })}</em></div>`
        return `<h2>${t('merchant')}</h2><h3>${t('buy')} <em>${this.cost({ gold: p.bag.gold })}</em></h3><div class="grid">${offers.join('')}</div><h3>${t('sell')}</h3>${sales.join('') || `<p>${t('nothingToSell')}</p>`}<h3>${t('talents')}</h3>${reset}`
    }

    // New quests show their reward, taken ones their progress
    questPanel(game) {
        const rows = game.quests.map((quest, i) => {
            const detail = { new: this.cost(quest.reward), taken: `${progress(game, quest)}/${quest.count}`, done: t('done') }[quest.state]
            return `<div class="row" data-quest="${i}" ${quest.state === 'done' ? 'data-done' : ''}><span>${questName(quest)}</span><em>${detail}</em></div>`
        })
        return `<h2>${t('quests')}</h2>${rows.join('')}<p>${t('questHint')}</p>`
    }

    // Learned nodes are marked with the active skill highlighted, nodes out of reach are dimmed
    talentPanel(p) {
        const branches = Object.entries(TALENTS).map(([branch, nodes]) => {
            const cells = nodes.map(({ skill }, i) => {
                const state = i < p.talents[branch] ? `data-learned ${skill && skill === p.skill ? 'data-active' : ''}` : i > p.talents[branch] || !points(p) ? 'data-off' : ''
                return `<div class="talent" data-talent="${branch}" data-node="${i}" ${state}>${t(`talent.${branch}${i}`)}</div>`
            })
            return `<div><h3>${t(`branch.${branch}`)}</h3>${cells.join('')}</div>`
        })
        return `<h2>${t('talents')}<em>${t('points', { points: points(p) })}</em></h2><div class="tree">${branches.join('')}</div><p>${t('talentHint')}</p>`
    }

    pausePanel() {
        return `<h2>${t('paused')}</h2><div class="row" data-open="settings"><span>${t('settings')}</span></div><p>${touch ? t('tap') : 'ESC'} - ${t('resume')}</p>`
    }

    // Options change on a tap: lists step to the next choice, switches flip and volumes move by a tenth
    settingsPanel() {
        const choice = (key, options) => `<div class="row"><span>${t(`set.${key}`)}</span></div><div class="choice">${options.map(option => `<span data-setting="${key}" data-value="${option}" ${settings[key] === option ? 'data-active' : ''}>${t(`set.${option}`)}</span>`).join('')}</div>`
        const flag = key => `<div class="row" data-setting="${key}"><span>${t(`set.${key}`)}</span><em>${t(settings[key] ? 'set.on' : 'set.off')}</em></div>`
        const volume = key => `<div class="row"><span>${t(`set.${key}`)}</span><em><span class="button" data-setting="${key}" data-value="-0.1">-</span><b class="value">${Math.round(settings[key] * 10)}</b><span class="button" data-setting="${key}" data-value="0.1">+</span></em></div>`
        const keys = Object.entries(ACTIONS).map(([action, code]) => `<div class="row" data-bind="${code}"><span>${t(`act.${action}`)}</span><em>${this.binding === code ? '...' : keysFor(code).map(key => key.replace(/^(Key|Digit|Arrow)/, '')).join(' ')}</em></div>`)
        return `<h2>${t('settings')}</h2>` +
            `<h3>${t('set.graphics')}</h3>${choice('quality', ['auto', ...QUALITIES])}` +
            `<h3>${t('set.game')}</h3>${choice('difficulty', Object.keys(DIFFICULTIES))}${volume('music')}${volume('effects')}` +
            `<h3>${t('set.access')}</h3>${flag('shake')}${flag('flashes')}${flag('bigText')}` +
            (touch ? '' : `<h3>${t('set.keys')}</h3>${keys.join('')}<p>${t('set.keysHint')}</p>`) +
            `<h3>${t('set.save')}</h3><div class="choice"><span data-save="export">${t('set.export')}</span><span data-save="import">${t('set.import')}</span></div>`
    }

    changeSetting(key, value) {
        if (typeof settings[key] === 'boolean') settings[key] = !settings[key]
        else if (typeof settings[key] === 'number') settings[key] = Math.round(Math.max(0, Math.min(1, settings[key] + Number(value))) * 10) / 10
        else settings[key] = value
        saveSettings()
        this.applySettings()
    }

    applySettings() {
        $('stage').classList.toggle('big', settings.bigText)
    }

    // A bar shows the value right away, the part just lost stays lit behind it and drains after a moment
    bar(id, fraction) {
        const value = Math.max(0, Math.min(1, fraction))
        const trail = this.trails[id] ??= { value, hold: 0 }
        if (value >= trail.value) Object.assign(trail, { value, hold: 0.4 })
        else if ((trail.hold -= this.dt) < 0) trail.value = Math.max(value, trail.value - this.dt * 0.6)
        $(id).style.width = `${100 * value}%`
        $(`${id}Trail`).style.width = `${100 * trail.value}%`
    }

    update(game, renderer, fps) {
        const camera = renderer.view
        const drawCalls = renderer.gl.info.render.calls
        const p = game.player
        this.dt = Math.min(0.1, game.time - (this.time ?? game.time))
        this.time = game.time
        // The stage name comes up once the story scene before the stage is over
        if (game.state === 'play' && $('stage').dataset.state === 'story') {
            $('banner').textContent = t(`stage.${game.stage.theme}`)
            $('banner').classList.remove('on')
            void $('banner').offsetWidth
            $('banner').classList.add('on')
        }
        $('stage').dataset.state = game.state
        // With a run to lose, the title screen takes no stray taps: starting over has to be picked on purpose
        const stray = game.state === 'title' && game.progress ? '' : 'Enter'
        if ($('stage').dataset.key !== stray) $('stage').dataset.key = stray
        // A new stage comes in through a fade from black
        if (this.stage !== game.stage) {
            this.stage = game.stage
            $('fade').classList.remove('on')
            void $('fade').offsetWidth
            $('fade').classList.add('on')
        }
        this.bar('mana', p.mana / p.maxMana)
        this.bar('hp', p.hp / p.maxHp)
        this.bar('stamina', p.stamina / 100)
        $('hp').classList.toggle('low', p.hp < p.maxHp * 0.3)
        // Weapon slots show the worn weapon, the bow and potion slots how many arrows of the quiver kind and potions are left
        this.slots.forEach((slot, i) => {
            const item = SLOTS[i]
            this.showIcon(slot, p.gear[item]?.base ?? item)
            slot.classList.toggle('selected', i === p.slot)
            slot.classList.toggle('disabled', Boolean(item) && !canUse(p, item))
            slot.querySelector('b').textContent = { bow: p.bag[p.quiver], potion: p.bag.potion }[item] ?? ''
        })
        for (const { item, slot, elements } of this.skills) {
            this.showIcon(slot, item ?? p.skill)
            for (const element of elements) element.classList.toggle('disabled', !canUse(p, item ?? p.skill))
        }
        // The talent tree skill swaps its touch label when picked, a dark cover shrinks while it cools down
        const { elements } = this.skills.at(-1)
        const label = p.skill ? t(`skill.${p.skill}`) : ''
        if ($('skill').textContent !== label) $('skill').textContent = label
        for (const element of elements) {
            element.hidden = !p.skill
            element.style.setProperty('--cooldown', `${p.skill ? 100 * Math.max(0, p.skillT) / COOLDOWNS[p.skill] : 0}%`)
        }

        const foes = game.foes()
        const exit = game.cleared() && game.level < LEVELS.length - 1
        const goal = exit ? t('cleared') : t('foes', { killed: foes.filter(e => e.hp <= 0).length, total: foes.length })
        $('counter').textContent = [t(`stage.${game.stage.theme}`), goal, t('level', { level: p.level }), t('gold', { gold: p.bag.gold })].join(' | ')
        // Unspent talent points pulse over the bars until they are spent, a tap opens the tree
        $('talentAlert').hidden = !points(p) || game.panel === 'talents'
        $('talentAlert').textContent = `${touch ? '' : 'T - '}${t('talentPoints', { points: points(p) })}`
        $('quests').innerHTML = game.quests.filter(quest => quest.state === 'taken').map(quest => `<p>${questName(quest)} ${progress(game, quest)}/${quest.count}</p>`).join('')
        // The dev counter turns red when a frame needs more draw calls than a phone should get
        $('fps').textContent = game.dev ? `${fps} FPS ${drawCalls} DC` : `${fps} FPS`
        $('fps').style.color = game.dev && drawCalls > DRAW_BUDGET ? '#ff6b5a' : ''
        const boss = game.state === 'play' && game.enemies.find(e => TYPES[e.type].boss && e.hp > 0 && Math.abs(e.x - p.x) < TYPES[e.type].engage)
        $('boss').hidden = !boss
        $('boss').classList.toggle('intro', Boolean(game.intro))
        if (boss) {
            $('bossName').textContent = t(`enemy.${boss.type}`)
            $('bossLine').textContent = game.intro ? t(`intro.${boss.type}`) : ''
            this.bar('bossHp', boss.hp / boss.maxHp)
        }

        const near = game.state === 'play' && !game.panel && game.nearby()
        const prompts = []
        if (near && !touch) prompts.push({ x: near.x, y: near.y - 62, value: t(near.panel === 'shop' ? 'shopPrompt' : 'boardPrompt'), color: '#ffe9a8' })
        // A mark over the board while it has quests to take, a sign at the exit once the way is clear
        const board = game.npcs.find(npc => npc.kind === 'board')
        if (!near && game.quests.some(quest => quest.state === 'new')) prompts.push({ x: board.x, y: board.y - 64 + Math.round(Math.sin(game.time * 4) * 2), value: '<b>!</b>', color: '#ffd84a' })
        if (exit) prompts.push({ x: game.map.w - 60, y: p.y - 50, value: t('exitPrompt'), color: '#b8f5a0' })
        // Popups follow the zoomed camera of the renderer
        const { x: left, y: top, w, h } = camera
        $('popups').innerHTML = [...game.popups, ...prompts]
            .map(q => `<span class="popup" style="left:${Math.round((q.x - left) * view.w / w)}px;top:${Math.round((q.y - top) * view.h / h)}px;color:${q.color}">${q.value}</span>`)
            .join('')
        $('trade').hidden = !near
        if (near) $('trade').textContent = t(near.panel === 'shop' ? 'btnShop' : 'btnQuests')

        const panels = { bag: () => this.bagPanel(p), shop: () => this.shopPanel(p), quests: () => this.questPanel(game), talents: () => this.talentPanel(p), bestiary: () => this.bestiaryPanel(renderer), dev: () => devPanel(game), pause: () => this.pausePanel(), settings: () => this.settingsPanel() }
        const panel = panels[game.panel]?.() ?? ''
        if (panel !== this.panel) {
            this.panel = panel
            $('panel').hidden = !panel
            $('panel').dataset.panel = game.panel ?? ''
            $('panel').innerHTML = panel && `<div class="close" data-close="1">X</div>${panel}`
        }

        // Rebuilt when the game state, the story line or the language changes
        const overlay = [game.state, game.level, game.scene?.line, language()].join()
        if (this.overlay !== overlay) {
            this.overlay = overlay
            const lines = overlayLines(game, this.art)
            $('overlay').hidden = !lines
            $('overlay').className = game.state
            if (lines) $('overlay').innerHTML = `<h1>${lines[0]}</h1>` + lines.slice(1).map(line => `<p>${line}</p>`).join('')
        }
        // Story text appears letter by letter, the prompt to go on shows once the line is complete
        if (game.state !== 'story') return
        const text = t(game.scene.lines[game.scene.line].text)
        const shown = Math.floor(game.scene.t * TYPING)
        $('line').textContent = text.slice(0, shown)
        $('next').style.visibility = shown >= text.length ? 'visible' : 'hidden'
    }
}

// The idle pose of a foe shrunk into a portrait for the bestiary
function portrait(sheet) {
    const size = 40
    const canvas = makeCanvas(size, size)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    const scale = Math.min(size / sheet.cellW, size / sheet.cellH)
    const [w, h] = [sheet.cellW * scale, sheet.cellH * scale]
    const [frame] = sheet.frames.idle
    ctx.drawImage(sheet.canvas, frame.x, frame.y, sheet.cellW, sheet.cellH, (size - w) / 2, (size - h) / 2, w, h)
    return canvas.toDataURL()
}

// The save and the settings go to a file and come back from one, the page reloads with the imported state
function exportSave() {
    const data = JSON.stringify({ progress: JSON.parse(localStorage.getItem('progress')), settings })
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: 'frost-blade-save.json' })
    link.click()
    URL.revokeObjectURL(link.href)
}

async function importSave(e) {
    try {
        const { progress, settings: imported } = JSON.parse(await e.target.files[0].text())
        if (progress) localStorage.setItem('progress', JSON.stringify(progress))
        if (imported) localStorage.setItem('settings', JSON.stringify(imported))
        location.reload()
    } catch {
        alert(t('set.importFailed'))
    }
}

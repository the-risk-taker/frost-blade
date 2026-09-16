import { GROUND, H, LEVEL_W, view } from './const.js'
import { SLOTS, SKILLS, SKILL_KEY, COOLDOWNS, canUse } from './player.js'
import { TYPES } from './enemies.js'
import { ITEMS, OFFERS, GEAR_SLOTS, PACK_SIZE, PERCENT, RARITIES, bonuses, createItem, price, canBuy, buy, sell, equip, unequip } from './items.js'
import { TALENTS, stat, points, pickTalent, resetCost, canReset, resetTalents } from './talents.js'
import { LEVELS } from './levels.js'
import { progress, takeQuest } from './quests.js'
import { LANGUAGES, language, languageName, setLanguage, t } from './lang.js'
import { buildIcons, buildItems } from './sprites.js'
import { devPanel, devClick } from './dev.js'
import { version } from '../package.json'

const touch = matchMedia('(pointer: coarse)').matches

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
        return diff ? `<p style="color:${better ? '#b8f5a0' : '#ff6b5a'}">${statText(key, diff)}</p>` : ''
    }).join('')
}

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const summaryLine = game => t('summary', { time: formatTime(game.playTime), kills: game.totalKills, gold: game.player.bag.gold })

function overlayLines(game) {
    if (game.state === 'travel') {
        const stage = LEVELS[game.level + 1]
        return [t(`stage.${stage.theme}`), t(`story.${stage.theme}`), t('loading')]
    }
    const start = touch ? t('tap') : 'ENTER'
    const retry = touch ? t('tap') : 'R'
    const controls = touch ? [t('hintTouch')] : [t('keysMove'), t('keysUse'), t('keysSkills'), t('keysMenu')]
    // An empty data-key keeps a tap on a language (or continue) from also starting a new game
    const languages = LANGUAGES.map(code => `<span data-language="${code}" data-key="" ${code === language() ? 'data-active' : ''}>${languageName(code)}</span>`).join(' ')
    const continueLine = game.progress ? [`<span data-continue data-key="">${t('continueGame', { key: touch ? t('tap') : 'C' })}</span>`] : []
    return {
        title: [t('title'), t('storyIntro'), ...controls, t('goal'), t('start', { key: start }), ...continueLine, `${t('language')}: ${languages}`],
        dead: [t('dead'), t('retry', { key: retry }), summaryLine(game)],
        win: [t('win'), t('winText'), summaryLine(game), t('again', { key: retry })],
    }[game.state]
}

export class Hud {
    constructor(game) {
        $('version').textContent = `v${version}`
        const icons = this.icons = buildIcons()
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

        this.items = buildItems()
        $('panel').style.setProperty('--items', `url(${this.items.canvas.toDataURL()})`)
        const onPanelClick = e => {
            const p = game.player
            const { offer, purchase, sale, gearSale, pick, wear, slot, quiver, quest, talent, node, reset, close } = e.target.closest('[data-offer], [data-purchase], [data-sale], [data-gear-sale], [data-pick], [data-wear], [data-slot], [data-quiver], [data-quest], [data-talent], [data-reset], [data-close]')?.dataset ?? {}
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
            if (close) game.panel = null
        }
        $('panel').addEventListener('click', onPanelClick)
        const onOverlayClick = e => {
            const code = e.target.closest('[data-language]')?.dataset.language
            if (code) setLanguage(code)
            if (e.target.closest('[data-continue]')) game.continueGame()
        }
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
        return `<i class="icon" style="background-position: -${x}px -${y}px"></i>`
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
        return `<h2>${t('merchant')}</h2><h3>${t('buy')} <em>${this.cost({ gold: p.bag.gold })}</em></h3>${offers.join('')}<h3>${t('sell')}</h3>${sales.join('') || `<p>${t('nothingToSell')}</p>`}<h3>${t('talents')}</h3>${reset}`
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
        return `<h2>${t('paused')}</h2><p>${touch ? t('tap') : 'ESC'} - ${t('resume')}</p>`
    }

    update(game, fps, drawCalls) {
        const p = game.player
        $('mana').style.width = `${100 * p.mana / p.maxMana}%`
        $('hp').style.width = `${Math.max(0, 100 * p.hp / p.maxHp)}%`
        $('stamina').style.width = `${p.stamina}%`
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
        $('fps').textContent = game.dev ? `${fps} FPS ${drawCalls} DC` : `${fps} FPS`
        const boss = game.state === 'play' && game.enemies.find(e => TYPES[e.type].boss && e.hp > 0 && Math.abs(e.x - p.x) < TYPES[e.type].engage)
        $('boss').hidden = !boss
        if (boss) {
            $('bossName').textContent = t(`enemy.${boss.type}`)
            $('bossHp').style.width = `${100 * boss.hp / boss.maxHp}%`
        }

        const cam = Math.round(game.camX), top = view.h - H
        const near = game.state === 'play' && !game.panel && game.nearby()
        const prompts = []
        if (near && !touch) prompts.push({ x: near.x, y: GROUND - 62, value: t(near.panel === 'shop' ? 'shopPrompt' : 'boardPrompt'), color: '#ffe9a8' })
        // A mark over the board while it has quests to take, a sign at the exit once the way is clear
        if (!near && game.quests.some(quest => quest.state === 'new')) prompts.push({ x: game.stage.board, y: GROUND - 64 + Math.round(Math.sin(game.time * 4) * 2), value: '<b>!</b>', color: '#ffd84a' })
        if (exit) prompts.push({ x: LEVEL_W - 60, y: GROUND - 50, value: t('exitPrompt'), color: '#b8f5a0' })
        $('popups').innerHTML = [...game.popups, ...prompts]
            .map(q => `<span class="popup" style="left:${Math.round(q.x - cam)}px;top:${Math.round(q.y + top)}px;color:${q.color}">${q.value}</span>`)
            .join('')
        $('trade').hidden = !near
        if (near) $('trade').textContent = t(near.panel === 'shop' ? 'btnShop' : 'btnQuests')

        const panels = { bag: () => this.bagPanel(p), shop: () => this.shopPanel(p), quests: () => this.questPanel(game), talents: () => this.talentPanel(p), dev: () => devPanel(game), pause: () => this.pausePanel() }
        const panel = panels[game.panel]?.() ?? ''
        if (panel !== this.panel) {
            this.panel = panel
            $('panel').hidden = !panel
            $('panel').innerHTML = panel && `<div class="close" data-close="1">X</div>${panel}`
        }

        // Rebuilt when the game state or the language changes
        const overlay = game.state + language()
        if (this.overlay === overlay) return
        this.overlay = overlay
        const lines = overlayLines(game)
        $('overlay').hidden = !lines
        if (lines) $('overlay').innerHTML = `<h1>${lines[0]}</h1>` + lines.slice(1).map(line => `<p>${line}</p>`).join('')
    }
}

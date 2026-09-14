import { GROUND, H, LEVEL_W, view } from './const.js'
import { SLOTS, SKILLS, canUse } from './player.js'
import { TYPES } from './enemies.js'
import { ITEMS, OFFERS, canBuy, buy, sell, equip, stat } from './items.js'
import { LEVELS } from './levels.js'
import { progress, takeQuest } from './quests.js'
import { LANGUAGES, language, languageName, setLanguage, t } from './lang.js'
import { buildIcons, buildItems } from './sprites.js'
import { version } from '../package.json'

const touch = matchMedia('(pointer: coarse)').matches

// Hotbar items that show how many are left in the bag
const COUNTED = { bow: 'arrows', potion: 'potion' }

const $ = id => document.getElementById(id)

const questName = quest => quest.item
    ? t('questCollect', { item: t(`item.${quest.item}`), count: quest.count })
    : t('questKill', { enemy: t(`enemy.${quest.kill}`), count: quest.count })

function overlayLines(game) {
    if (game.state === 'travel') {
        const stage = LEVELS[game.level + 1]
        return [t(`stage.${stage.theme}`), t(`story.${stage.theme}`), t('loading')]
    }
    const start = touch ? t('tap') : 'ENTER'
    const retry = touch ? t('tap') : 'R'
    const controls = touch ? [t('hintTouch')] : [t('keysMove'), t('keysUse'), t('keysSkills'), t('keysMenu')]
    // An empty data-key keeps a tap on a language from also starting the game
    const languages = LANGUAGES.map(code => `<span data-language="${code}" data-key="" ${code === language() ? 'data-active' : ''}>${languageName(code)}</span>`).join(' ')
    return {
        title: [t('title'), t('storyIntro'), ...controls, t('goal'), t('start', { key: start }), `${t('language')}: ${languages}`],
        dead: [t('dead'), t('retry', { key: retry })],
        win: [t('win'), t('winText'), t('again', { key: retry })],
    }[game.state]
}

export class Hud {
    constructor(game) {
        $('version').textContent = `v${version}`
        const icons = buildIcons()
        const addSlot = (key, item) => {
            const slot = document.createElement('div')
            slot.className = 'slot'
            slot.dataset.key = key
            if (item) slot.append(icons[item])
            $('slots').append(slot)
            return slot
        }
        this.slots = SLOTS.concat(Array(9 - SLOTS.length).fill(null)).map((item, i) => {
            const slot = addSlot(`Digit${i + 1}`, item)
            if (COUNTED[item]) slot.append(document.createElement('b'))
            return slot
        })
        // Skill slots show their key. Touch buttons with the same key are greyed out along with them.
        this.skills = Object.entries(SKILLS).map(([key, item]) => {
            const slot = addSlot(key, item)
            slot.classList.add('skill')
            slot.append(Object.assign(document.createElement('b'), { textContent: key.slice(3) }))
            return { item, elements: document.querySelectorAll(`[data-key="${key}"]`) }
        })

        this.items = buildItems()
        $('panel').style.setProperty('--items', `url(${this.items.canvas.toDataURL()})`)
        const onPanelClick = e => {
            const p = game.player
            const { offer, sale, gear, quest, close } = e.target.closest('[data-offer], [data-sale], [data-gear], [data-quest], [data-close]')?.dataset ?? {}
            if (offer) buy(p, OFFERS[offer])
            if (sale) sell(p, sale)
            if (gear) equip(p, gear)
            if (quest) takeQuest(game, game.quests[quest])
            if (close) game.panel = null
        }
        $('panel').addEventListener('click', onPanelClick)
        const onOverlayClick = e => {
            const code = e.target.closest('[data-language]')?.dataset.language
            if (code) setLanguage(code)
        }
        $('overlay').addEventListener('click', onOverlayClick)
    }

    icon(item) {
        const { x, y } = this.items.frames[item][0]
        return `<i class="icon" style="background-position: -${x}px -${y}px"></i>`
    }

    row(item, name, detail, attributes = '') {
        return `<div class="row" ${attributes}>${this.icon(item)}<span>${name}</span><em>${detail}</em></div>`
    }

    cost(items) {
        return Object.entries(items).map(([item, n]) => `${n}${this.icon(item)}`).join(' ')
    }

    bagPanel(p) {
        const rows = Object.keys(ITEMS).filter(item => p.bag[item]).map(item => {
            if (!ITEMS[item].slot) return this.row(item, t(`item.${item}`), p.bag[item])
            const worn = p.gear[ITEMS[item].slot] === item
            return this.row(item, t(`item.${item}`), t(worn ? 'worn' : 'wear'), `data-gear="${item}" ${worn ? 'data-worn' : ''}`)
        })
        const stats = t('stats', { defense: stat(p, 'defense'), mana: stat(p, 'manaRegen'), stamina: stat(p, 'staminaRegen') })
        return `<h2>${t('bag')}</h2>${rows.join('')}<p>${stats}</p>`
    }

    shopPanel(p) {
        const offers = OFFERS.map((offer, i) => {
            const name = t(`item.${offer.item}`) + (offer.count > 1 ? ` x${offer.count}` : '')
            return this.row(offer.item, name, this.cost(offer.cost), `data-offer="${i}" ${canBuy(p, offer) ? '' : 'data-off'}`)
        })
        const sales = Object.keys(ITEMS).filter(item => ITEMS[item].value && p.bag[item])
            .map(item => this.row(item, `${t(`item.${item}`)} x${p.bag[item]}`, `+${this.cost({ gold: ITEMS[item].value })}`, `data-sale="${item}"`))
        return `<h2>${t('merchant')}</h2><h3>${t('buy')} <em>${this.cost({ gold: p.bag.gold })}</em></h3>${offers.join('')}<h3>${t('sell')}</h3>${sales.join('') || `<p>${t('nothingToSell')}</p>`}`
    }

    // New quests show their reward, taken ones their progress
    questPanel(game) {
        const rows = game.quests.map((quest, i) => {
            const detail = { new: this.cost(quest.reward), taken: `${progress(game, quest)}/${quest.count}`, done: t('done') }[quest.state]
            return `<div class="row" data-quest="${i}" ${quest.state === 'done' ? 'data-done' : ''}><span>${questName(quest)}</span><em>${detail}</em></div>`
        })
        return `<h2>${t('quests')}</h2>${rows.join('')}<p>${t('questHint')}</p>`
    }

    update(game, fps) {
        const p = game.player
        $('mana').style.width = `${100 * p.mana / p.maxMana}%`
        $('hp').style.width = `${Math.max(0, 100 * p.hp / p.maxHp)}%`
        $('stamina').style.width = `${p.stamina}%`
        this.slots.forEach((slot, i) => {
            const item = SLOTS[i]
            slot.classList.toggle('selected', i === p.slot)
            slot.classList.toggle('disabled', Boolean(item) && !canUse(p, item))
            if (COUNTED[item]) slot.querySelector('b').textContent = p.bag[COUNTED[item]]
        })
        for (const { item, elements } of this.skills) for (const element of elements) element.classList.toggle('disabled', !canUse(p, item))

        const foes = game.enemies.filter(e => !TYPES[e.type].prop)
        const exit = game.cleared() && game.level < LEVELS.length - 1
        const goal = exit ? t('cleared') : t('foes', { killed: foes.filter(e => e.hp <= 0).length, total: foes.length })
        $('counter').textContent = [t(`stage.${game.stage.theme}`), goal, t('level', { level: p.level }), t('gold', { gold: p.bag.gold })].join(' | ')
        $('quests').innerHTML = game.quests.filter(quest => quest.state === 'taken').map(quest => `<p>${questName(quest)} ${progress(game, quest)}/${quest.count}</p>`).join('')
        $('fps').textContent = `${fps} FPS`
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

        const panel = game.panel === 'bag' ? this.bagPanel(p) : game.panel === 'shop' ? this.shopPanel(p) : game.panel === 'quests' ? this.questPanel(game) : ''
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

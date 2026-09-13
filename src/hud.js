import { GROUND, H, view } from './const.js'
import { SLOTS, canUse } from './player.js'
import { ITEMS, OFFERS, canBuy, buy, sell, equip, stat } from './items.js'
import { LANGUAGES, language, languageName, setLanguage, t } from './lang.js'
import { buildIcons, buildItems } from './sprites.js'
import { version } from '../package.json'

const touch = matchMedia('(pointer: coarse)').matches

// Hotbar items that show how many are left in the bag
const COUNTED = { bow: 'arrows', potion: 'potion' }

const $ = id => document.getElementById(id)

function overlayLines(state) {
  const start = touch ? t('tap') : 'ENTER'
  const retry = touch ? t('tap') : 'R'
  const controls = touch ? [t('hintTouch')] : [t('keysMove'), t('keysUse'), t('keysMenu')]
  // An empty data-key keeps a tap on a language from also starting the game
  const languages = LANGUAGES.map(code => `<span data-language="${code}" data-key="" ${code === language() ? 'data-active' : ''}>${languageName(code)}</span>`).join(' ')
  return {
    title: [t('title'), ...controls, t('goal'), t('start', { key: start }), `${t('language')}: ${languages}`],
    dead: [t('dead'), t('retry', { key: retry })],
    win: [t('win'), t('winText'), t('again', { key: retry })],
  }[state]
}

export class Hud {
  constructor(game) {
    $('version').textContent = `v${version}`
    const icons = buildIcons()
    this.slots = SLOTS.concat(Array(9 - SLOTS.length).fill(null)).map((item, i) => {
      const slot = document.createElement('div')
      slot.className = 'slot'
      slot.dataset.key = `Digit${i + 1}`
      if (item) slot.append(icons[item])
      if (COUNTED[item]) slot.append(document.createElement('b'))
      $('slots').append(slot)
      return slot
    })

    this.items = buildItems()
    $('panel').style.setProperty('--items', `url(${this.items.canvas.toDataURL()})`)
    const onPanelClick = e => {
      const p = game.player
      const { offer, sale, gear, close } = e.target.closest('[data-offer], [data-sale], [data-gear], [data-close]')?.dataset ?? {}
      if (offer) buy(p, OFFERS[offer])
      if (sale) sell(p, sale)
      if (gear) equip(p, gear)
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

  update(game, fps) {
    const p = game.player
    $('mana').style.width = `${p.mana}%`
    $('hp').style.width = `${Math.max(0, p.hp)}%`
    $('stamina').style.width = `${p.stamina}%`
    this.slots.forEach((slot, i) => {
      const item = SLOTS[i]
      slot.classList.toggle('selected', i === p.slot)
      slot.classList.toggle('disabled', Boolean(item) && !canUse(p, item))
      if (COUNTED[item]) slot.querySelector('b').textContent = p.bag[COUNTED[item]]
    })
    $('counter').textContent = t('counter', { killed: game.enemies.filter(e => e.hp <= 0).length, total: game.enemies.length, gold: p.bag.gold })
    $('fps').textContent = `${fps} FPS`

    const cam = Math.round(game.camX), top = view.h - H
    const merchant = game.state === 'play' && !game.panel && game.merchantNear()
    const prompts = merchant && !touch ? [{ x: merchant, y: GROUND - 62, value: t('shopPrompt'), color: '#ffe9a8' }] : []
    $('popups').innerHTML = [...game.popups, ...prompts]
      .map(q => `<span class="popup" style="left:${Math.round(q.x - cam)}px;top:${Math.round(q.y + top)}px;color:${q.color}">${q.value}</span>`)
      .join('')
    $('trade').hidden = !merchant

    const panel = game.panel === 'bag' ? this.bagPanel(p) : game.panel === 'shop' ? this.shopPanel(p) : ''
    if (panel !== this.panel) {
      this.panel = panel
      $('panel').hidden = !panel
      $('panel').innerHTML = panel && `<div class="close" data-close="1">X</div>${panel}`
    }

    // Rebuilt when the game state or the language changes
    const overlay = game.state + language()
    if (this.overlay === overlay) return
    this.overlay = overlay
    const lines = overlayLines(game.state)
    $('overlay').hidden = !lines
    if (lines) $('overlay').innerHTML = `<h1>${lines[0]}</h1>` + lines.slice(1).map(line => `<p>${line}</p>`).join('')
  }
}

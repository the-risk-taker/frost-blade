import { H, view } from './const.js'
import { SLOTS, canUse } from './player.js'
import { buildIcons } from './sprites.js'
import { version } from '../package.json'

const touch = matchMedia('(pointer: coarse)').matches
const START = touch ? 'DOTKNIJ' : 'ENTER'
const RETRY = touch ? 'DOTKNIJ' : 'R'
const CONTROLS = touch ? [] : ['A/D - ruch &nbsp; SPACJA - skok &nbsp; SHIFT - unik', 'J / LPM - użyj przedmiotu &nbsp; 1-9 - wybór', 'F - pełny ekran']

const OVERLAYS = {
  title: ['MROŹNE OSTRZE', ...CONTROLS, 'Pokonaj wszystkich wrogów', `${START} - start`],
  dead: ['KONIEC GRY', `${RETRY} - spróbuj ponownie`],
  win: ['ZWYCIĘSTWO!', 'Wszyscy wrogowie pokonani', `${RETRY} - zagraj ponownie`],
}

const $ = id => document.getElementById(id)

export class Hud {
  constructor() {
    $('version').textContent = `v${version}`
    const icons = buildIcons()
    this.slots = SLOTS.concat(Array(9 - SLOTS.length).fill(null)).map((item, i) => {
      const slot = document.createElement('div')
      slot.className = 'slot'
      slot.dataset.key = `Digit${i + 1}`
      if (item) slot.append(icons[item])
      $('slots').append(slot)
      return slot
    })
    this.potions = document.createElement('b')
    this.slots[SLOTS.indexOf('potion')].append(this.potions)
  }

  update(game, fps) {
    const p = game.player
    $('mana').style.width = `${p.mana}%`
    $('hp').style.width = `${Math.max(0, p.hp)}%`
    $('stamina').style.width = `${p.stamina}%`
    this.slots.forEach((slot, i) => {
      slot.classList.toggle('selected', i === p.slot)
      slot.classList.toggle('disabled', Boolean(SLOTS[i]) && !canUse(p, SLOTS[i]))
    })
    this.potions.textContent = p.potions
    $('counter').textContent = `Wrogowie: ${game.enemies.filter(e => e.hp <= 0).length}/${game.enemies.length}`
    $('fps').textContent = `${fps} FPS`

    const cam = Math.round(game.camX), top = view.h - H
    $('popups').innerHTML = game.popups
      .map(q => `<span class="popup" style="left:${Math.round(q.x - cam)}px;top:${Math.round(q.y + top)}px;color:${q.color}">${q.value}</span>`)
      .join('')

    if (this.state === game.state) return
    this.state = game.state
    const lines = OVERLAYS[game.state]
    $('overlay').hidden = !lines
    if (lines) $('overlay').innerHTML = `<h1>${lines[0]}</h1>` + lines.slice(1).map(line => `<p>${line}</p>`).join('')
  }
}

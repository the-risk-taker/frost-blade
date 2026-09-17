import { settings } from './settings.js'

const down = new Set()
const pressed = new Set()
const pointers = new Map()
let wheel = 0

function press(code) {
    if (!down.has(code)) pressed.add(code)
    down.add(code)
}

const release = code => down.delete(code)

// A pointer on an element with data-key works like that key while held.
// The mouse only uses the HUD this way and never attacks through it, elsewhere it is Mouse<button>.
function keyOf(e) {
    if (e.pointerType !== 'mouse') return e.target.closest('[data-key]')?.dataset.key
    return e.target.closest('#hud') ? e.target.closest('#hud [data-key]')?.dataset.key : 'Mouse' + e.button
}

// The key is remembered, so releasing the pointer over another element lets go of it
function lift(e) {
    release(pointers.get(e.pointerId))
    pointers.delete(e.pointerId)
}

addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    press(settings.keys[e.code] ?? e.code)
})
addEventListener('keyup', e => release(settings.keys[e.code] ?? e.code))
addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') e.preventDefault()
    const key = keyOf(e)
    pointers.set(e.pointerId, key)
    if (key) press(key)
})
addEventListener('pointerup', lift)
addEventListener('pointercancel', lift)
addEventListener('contextmenu', e => e.preventDefault())
// The wheel scrolls boxes with long content instead of switching hotbar slots
addEventListener('wheel', e => {
    if (!e.target.closest('#panel, #changelog')) wheel += Math.sign(e.deltaY)
})
addEventListener('blur', () => down.clear())

// Gamepad buttons in the standard layout and the left stick work like keys. Start also confirms menus.
const PAD = { 0: ['ArrowUp'], 1: ['ShiftLeft'], 2: ['Space'], 3: ['KeyQ'], 4: ['KeyX'], 5: ['KeyC'], 6: ['KeyT'], 7: ['KeyE'], 8: ['KeyI'], 9: ['Enter', 'Escape'], 12: ['ArrowUp'], 13: ['ArrowDown'], 14: ['ArrowLeft'], 15: ['ArrowRight'] }
let padDown = new Set()

function pollPad() {
    const pad = [...navigator.getGamepads?.() ?? []].find(Boolean)
    const now = new Set()
    for (const [button, codes] of Object.entries(PAD)) if (pad?.buttons[button]?.pressed) codes.forEach(code => now.add(code))
    if (pad?.axes[0] < -0.5) now.add('ArrowLeft')
    if (pad?.axes[0] > 0.5) now.add('ArrowRight')
    if (pad?.axes[1] > 0.7) now.add('ArrowDown')
    for (const code of now) if (!padDown.has(code)) press(code)
    for (const code of padDown) if (!now.has(code)) release(code)
    padDown = now
}

export const input = {
    poll: pollPad,
    held: (...codes) => codes.some(c => down.has(c)),
    hit: (...codes) => codes.some(c => pressed.has(c)),
    takeWheel() {
        const w = wheel
        wheel = 0
        return w
    },
    endFrame: () => pressed.clear(),
}

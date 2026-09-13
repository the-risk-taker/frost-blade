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
    press(e.code)
})
addEventListener('keyup', e => release(e.code))
addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') e.preventDefault()
    const key = keyOf(e)
    pointers.set(e.pointerId, key)
    if (key) press(key)
})
addEventListener('pointerup', lift)
addEventListener('pointercancel', lift)
addEventListener('contextmenu', e => e.preventDefault())
addEventListener('wheel', e => { wheel += Math.sign(e.deltaY) })
addEventListener('blur', () => down.clear())

export const input = {
    held: (...codes) => codes.some(c => down.has(c)),
    hit: (...codes) => codes.some(c => pressed.has(c)),
    takeWheel() {
        const w = wheel
        wheel = 0
        return w
    },
    endFrame: () => pressed.clear(),
}

const down = new Set()
const pressed = new Set()
let wheel = 0

function press(code) {
  if (!down.has(code)) pressed.add(code)
  down.add(code)
}

const release = code => down.delete(code)

// On touch screens an element with data-key works like that key while held
function touch(e, action) {
  if (e.pointerType === 'mouse') return
  e.preventDefault()
  const key = e.target.closest('[data-key]')?.dataset.key
  if (key) action(key)
}

addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
  press(e.code)
})
addEventListener('keyup', e => release(e.code))
addEventListener('mousedown', e => press('Mouse' + e.button))
addEventListener('mouseup', e => release('Mouse' + e.button))
addEventListener('pointerdown', e => touch(e, press))
addEventListener('pointerup', e => touch(e, release))
addEventListener('pointercancel', e => touch(e, release))
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

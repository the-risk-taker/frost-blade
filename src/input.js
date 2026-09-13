const down = new Set()
const pressed = new Set()
let wheel = 0

addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
  if (!e.repeat) pressed.add(e.code)
  down.add(e.code)
})
addEventListener('keyup', e => down.delete(e.code))
addEventListener('mousedown', e => pressed.add('Mouse' + e.button))
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

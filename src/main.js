import { view } from './const.js'
import { Game } from './game.js'
import { Renderer } from './render.js'
import { Hud } from './hud.js'
import { input } from './input.js'
import { unlockAudio } from './sound.js'
import { translatePage } from './lang.js'

const stage = document.getElementById('stage')
let renderer

// Integer pixel scale keeps pixels sharp, the visible area grows or shrinks to fill the window.
function resize() {
  const scale = Math.max(1, Math.floor(innerHeight / 300))
  view.w = Math.ceil(innerWidth / scale)
  view.h = Math.ceil(innerHeight / scale)
  stage.style.width = `${view.w}px`
  stage.style.height = `${view.h}px`
  stage.style.transform = `scale(${scale})`
  renderer?.resize()
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen()
}

addEventListener('resize', resize)
addEventListener('keydown', unlockAudio)
addEventListener('mousedown', unlockAudio)
addEventListener('touchend', unlockAudio)
document.getElementById('fullscreen').hidden = !document.fullscreenEnabled
translatePage()
resize()

// Let the loading message paint before the world is generated
await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))

const game = new Game()
renderer = new Renderer(document.getElementById('game'), game.stage)
const hud = new Hud(game)
stage.classList.remove('loading')

let last = performance.now()
let fps = 0
let fpsFrames = 0
let fpsTime = 0

function frame(now) {
  const elapsed = Math.max(0, (now - last) / 1000)
  last = now
  fpsFrames++
  fpsTime += elapsed
  if (fpsTime >= 0.5) {
    fps = Math.round(fpsFrames / fpsTime)
    fpsFrames = fpsTime = 0
  }
  const dt = Math.min(0.05, elapsed)
  game.update(dt)
  if (input.hit('KeyF') && document.fullscreenEnabled) toggleFullscreen()
  if (input.hit('KeyH')) stage.classList.toggle('photo')
  input.endFrame()
  renderer.render(game, dt)
  hud.update(game, fps, renderer.gl.info.render.calls)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

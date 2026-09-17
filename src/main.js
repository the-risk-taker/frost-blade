import { view } from './const.js'
import { Game } from './game.js'
import { Renderer } from './render.js'
import { Hud } from './hud.js'
import { input } from './input.js'
import { unlockAudio } from './sound.js'
import { translatePage } from './lang.js'
import { settings } from './settings.js'

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

// Installed and offline play in production, a persistent storage request so the browser keeps the save
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
  navigator.serviceWorker.ready.then(registration => registration.active.postMessage(performance.getEntriesByType('resource').map(entry => entry.name)))
}
navigator.storage?.persist?.()

// The screen stays on while playing, the lock is taken again when the page comes back into view
let wakeLock = null
async function keepAwake() {
  if (wakeLock || document.visibilityState !== 'visible' || !navigator.wakeLock) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => wakeLock = null)
  } catch { }
}
addEventListener('pointerdown', keepAwake)
addEventListener('keydown', keepAwake)
document.addEventListener('visibilitychange', keepAwake)

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
renderer = new Renderer(document.getElementById('game'))
const hud = new Hud(game)
// Lets tests in a browser drive the game
if (import.meta.env.DEV) Object.assign(window, { game, renderer })

// With automatic quality the frame rate is measured during play: a few slow seconds lower the quality,
// a long smooth stretch raises it again
const QUALITY_STEPS = ['low', 'mid', 'high']
let slowTime = 0
let smoothTime = 0

function adjustQuality(elapsed) {
  if (settings.quality !== 'auto') return renderer.setQuality(settings.quality)
  if (game.state !== 'play' || game.panel) return
  slowTime = fps < 45 ? slowTime + elapsed : 0
  smoothTime = fps >= 58 ? smoothTime + elapsed : 0
  const step = QUALITY_STEPS.indexOf(renderer.quality)
  if (slowTime > 4 && step > 0) renderer.setQuality(QUALITY_STEPS[step - 1])
  else if (smoothTime > 15 && step < QUALITY_STEPS.length - 1) renderer.setQuality(QUALITY_STEPS[step + 1])
  else return
  slowTime = smoothTime = 0
}

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
  adjustQuality(elapsed)
  input.poll()
  const dt = Math.min(0.05, elapsed)
  game.update(dt)
  if (input.hit('KeyF') && document.fullscreenEnabled) toggleFullscreen()
  if (input.hit('KeyH')) stage.classList.toggle('photo')
  input.endFrame()
  renderer.render(game, dt)
  hud.update(game, fps, renderer.gl.info.render.calls, renderer.view)
  // The loading screen stays until the first frame with the stage art and the HUD in its state is ready
  stage.classList.remove('loading')
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

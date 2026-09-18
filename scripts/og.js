// Renders public/og.png, the picture shown when a link to the game is shared.
// A staged moment of a fight with the dev build of the game: the hero in legendary gear striking at the Alpha Wolf and an ogre.
// Run with `npm run og`. Uses the Chrome given in CHROME, or any Chromium Playwright has downloaded (`npx playwright install chromium`).
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { findChrome } from './chrome.js'

const browser = await chromium.launch({ executablePath: findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const server = await createServer({ server: { port: 5198 }, logLevel: 'warn' })
await server.listen()
try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
    page.on('pageerror', e => console.log('PAGEERROR:', e.message))
    await page.goto(server.resolvedUrls.local[0])
    await page.waitForTimeout(3000)
    const key = async (code, ms = 60) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code) }
    await key('Enter')
    await page.waitForTimeout(2500)
    await key('Escape')
    await page.waitForTimeout(500)
    await page.evaluate(async ({ x }) => {
        const items = await import('/src/items.js')
        const enemies = await import('/src/enemies.js')
        const settings = await import('/src/settings.js')
        settings.settings.quality = 'high'
        const p = game.player
        game.dev = { god: true }
        for (const [base, rarity] of [['crown', 3], ['armor', 2], ['cloak', 1], ['gloves', 2], ['boots', 1], ['alphaFang', 3], ['sword', 3]]) {
            items.collect(p, items.createItem(base, rarity, Math.random), 1)
            items.equip(p, p.pack.at(-1))
        }
        Object.assign(p, { x, y: 384, dir: 1, level: 8, mana: 999, maxMana: 999 })
        game.enemies = []
        game.roamers = 99
        for (const [type, dx] of [['alpha', 105], ['ogre', 185]]) game.enemies.push({ ...enemies.createEnemy(type, x + dx, 384, game.stage), hp: 999, maxHp: 999 })
        // A close up camera for the picture, the game zoom is held fixed
        Object.defineProperty(renderer, 'zoom', { get: () => 2.1, set() { } })
    }, { x: 1440 })
    await page.waitForTimeout(2500)
    await key('KeyH')
    // A frost bolt first, then a sword swing
    await key('Digit3')
    await key('Space')
    await page.waitForTimeout(250)
    await key('Digit1')
    await page.keyboard.down('Space')
    await page.waitForTimeout(90)
    // Everything stops at the moment of the blow
    await page.evaluate(() => { game.freeze = 999 })
    await page.waitForTimeout(200)
    await page.evaluate(async () => {
        const items = await import('/src/items.js')
        const p = game.player
        game.freeze = 999
        game.shake = 0
        p.x = 1440
        // The hero holds the blade raised high, ready to strike
        Object.assign(p, { combo: 0, attackT: 0.02, attackTime: 0.3, drawT: -1, hurtT: 0 })
        // Foes are put back on the ice in front of the hero, they may have walked during the setup
        game.enemies.forEach((e, i) => Object.assign(e, { x: p.x + [42, 118][i], y: 384, dir: -1, vx: 0, hp: e.maxHp, statuses: {}, flashT: 0, state: 'windup', t: 0.3, pattern: e.type === 'alpha' ? { windup: 0.4, attack: 0.45, recover: 0.5 } : e.pattern }))
        // Ice shattering on the ogre, caught halfway
        game.effects = []
        const effect = (kind, x, y, scale, progress) => game.effects.push({ kind, x, y, scale, life: 1 - progress, duration: 1 })
        effect('shatter', p.x + 118, p.y - 40, 1.2, 0.3)
        game.impact = 0
        // The hero and the Alpha stand in the middle of the picture
        const { view } = await import('/src/const.js')
        game.camX = p.x + 36 - view.w / 2
    })
    await page.waitForTimeout(300)
    await page.evaluate(() => {
        const title = document.createElement('div')
        title.innerHTML = '<h1>FROST BLADE</h1>'
        title.id = 'ogTitle'
        title.className = 'title'
        title.style.cssText = 'position:absolute;left:0;right:0;top:3%;text-align:center'
        const style = document.createElement('style')
        // Bright letters with a thick dark outline over a dark band, readable over the snowy sky
        style.textContent = '#ogTitle { padding: 10px 0 14px; background: linear-gradient(transparent, #0a1622d0 20%, #0a1622d0 80%, transparent) } #ogTitle h1 { margin: 0; font-size: 60px; line-height: 1; font-weight: normal; color: #e8f8ff; text-shadow: 3px 0 #0a1622, -3px 0 #0a1622, 0 3px #0a1622, 0 -3px #0a1622, 3px 3px #0a1622, -3px -3px #0a1622, 3px -3px #0a1622, -3px 3px #0a1622, 6px 6px 0 #1f5f8a, 0 0 18px #4fc3f7 }'
        document.head.append(style)
        document.getElementById('stage').append(title)
    })
    await page.screenshot({ path: 'public/og.png' })
} finally {
    await browser.close()
    await server.close()
}

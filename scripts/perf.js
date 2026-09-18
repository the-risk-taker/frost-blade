// Measures how long the game makes a player wait and where that time goes.
// Every sprite, tile and background is drawn pixel by pixel when the game starts, so loading is almost all
// canvas work: this reports the wait until the game is playable, the cost of walking into each stage and the
// cost of every sheet the game bakes, worst first.
// Run with `npm run perf`, or `npm run perf -- 4` for more runs. Uses the Chrome given in CHROME, or any
// Chromium Playwright has downloaded (`npx playwright install chromium`).
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { findChrome } from './chrome.js'

const RUNS = Number(process.argv[2]) || 2

const table = (title, rows) => {
    console.log(`\n${title}`)
    for (const { name, ms } of rows) console.log(`  ${String(ms).padStart(6)} ms  ${name}`)
}

// Web fonts come from a CDN and say nothing about the game's own work, so they are left out of every number
async function open(browser, url) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    page.on('pageerror', e => console.log('PAGEERROR:', e.message))
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort())
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const ready = await page.waitForFunction(() => !document.getElementById('stage').classList.contains('loading') && performance.now(),
        null, { timeout: 120000, polling: 50 })
    return { page, ready: Math.round(await ready.jsonValue()) }
}

// Walking into a stage bakes its backgrounds, its tiles and a sheet for every foe that can appear there.
// Only the first visit pays, and the stage the game opens in was already built during loading.
const enterStages = page => page.evaluate(async () => {
    const { LEVELS } = await import('/src/levels.js')
    return LEVELS.map((stage, index) => {
        const at = performance.now()
        game.startLevel(index, game.player)
        renderer.showStage(game)
        return { name: stage.theme, ms: Math.round(performance.now() - at) }
    })
})

// Each sheet baked once more, on its own, to see what the load and the stage entries are actually made of
const bakeSheets = page => page.evaluate(async () => {
    const sprites = await import('/src/sprites.js')
    const art = await import('/src/art.js')
    const { LEVELS } = await import('/src/levels.js')
    const { parseMap } = await import('/src/terrain.js')
    const took = (name, bake) => {
        const at = performance.now()
        bake()
        return { name, ms: Math.round(performance.now() - at) }
    }
    return [
        took('hero', sprites.buildHero),
        took('portraits', sprites.buildPortraits),
        took('items', sprites.buildItems),
        took('spells', sprites.buildSpells),
        took('merchant', sprites.buildMerchant),
        took('projectiles', sprites.buildProjectiles),
        took('story boards', art.buildBoards),
        took('props', art.buildProps),
        took('trees', art.buildTrees),
        took('gear: sword', () => sprites.buildGear('sword')),
        took('gear: bow', () => sprites.buildGear('bow')),
        // Stage art is painted per theme, the foes have a sheet each and the renderer knows them all
        ...LEVELS.map(stage => took(`stage art: ${stage.theme}`, () => art.buildStage(stage, stage.grid ??= parseMap(stage.map)))),
        ...Object.entries(renderer.builders).map(([type, bake]) => took(`foe: ${type}`, bake)),
    ].sort((a, b) => b.ms - a.ms)
})

const browser = await chromium.launch({ executablePath: findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const server = await createServer({ server: { port: 5199 }, logLevel: 'warn' })
await server.listen()
try {
    const waits = []
    let stages, sheets
    for (let run = 0; run < RUNS; run++) {
        const { page, ready } = await open(browser, server.resolvedUrls.local[0])
        waits.push(ready)
        // The breakdown comes from the last run, on a page that has done nothing else yet
        if (run === RUNS - 1) {
            stages = await enterStages(page)
            sheets = await bakeSheets(page)
        }
        await page.context().close()
    }
    console.log(`\nWAIT UNTIL PLAYABLE   ${waits.map(ms => `${ms} ms`).join('   ')}`)
    table('WALKING INTO A STAGE', stages)
    table('BAKING EACH SHEET', sheets)
    console.log(`\n  ${sheets.reduce((sum, row) => sum + row.ms, 0)} ms of sheets in total`)
    console.log('\nThe browser here renders in software, so drawing and uploading cost more than on a real machine.')
    console.log('Baking numbers are plain canvas work and do carry over.\n')
} finally {
    await browser.close()
    await server.close()
}

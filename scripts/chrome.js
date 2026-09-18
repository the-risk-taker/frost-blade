// The Chromium the scripts drive: the one named in CHROME, the one Playwright expects, or the newest in its cache.
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

export function findChrome() {
    if (process.env.CHROME) return process.env.CHROME
    if (existsSync(chromium.executablePath())) return chromium.executablePath()
    const cache = join(homedir(), '.cache', 'ms-playwright')
    const builds = existsSync(cache) ? readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse() : []
    const found = builds.map(name => join(cache, name, 'chrome-linux64', 'chrome')).find(existsSync)
    if (!found) throw new Error('No Chromium found, run `npx playwright install chromium` or set CHROME')
    return found
}

// Every foe the hero has met and how many of them he has put down, kept in the browser like the settings
const KEY = 'bestiary'

function load() {
    try {
        return JSON.parse(localStorage.getItem(KEY)) ?? {}
    } catch {
        return {}
    }
}

export const bestiary = load()

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(bestiary))
    } catch { }
}

export function met(type) {
    if (bestiary[type]) return
    bestiary[type] = 0
    save()
}

export function slain(type) {
    bestiary[type] = (bestiary[type] ?? 0) + 1
    save()
}

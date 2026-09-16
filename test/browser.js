// Browser globals the game modules touch, so they load and run in Node. Import it before any game module.
const listeners = {}
globalThis.addEventListener = (type, listener) => (listeners[type] ??= []).push(listener)

const storage = new Map()
globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
}

// Sends a window event the way the input module sees it
export function emit(type, event) {
    for (const listener of listeners[type]) listener({ preventDefault() { }, ...event })
}

export const key = (code, down = true) => emit(down ? 'keydown' : 'keyup', { code })

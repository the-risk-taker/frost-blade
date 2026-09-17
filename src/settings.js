// Player preferences kept apart from the save, so resetting progress keeps them
const KEY = 'settings'

const DEFAULTS = {
    // auto measures the frame rate and lowers or raises the quality to keep the game smooth
    quality: 'auto',
    difficulty: 'normal',
    music: 0.7,
    effects: 0.8,
    shake: true,
    flashes: true,
    bigText: false,
    // Pressed key code to the key code the game listens for
    keys: {},
}

function load() {
    try {
        return JSON.parse(localStorage.getItem(KEY)) ?? {}
    } catch {
        return {}
    }
}

export const settings = { ...DEFAULTS, ...load() }

export const QUALITIES = ['low', 'mid', 'high']
export const DIFFICULTIES = { easy: { taken: 0.6, dealt: 1.25 }, normal: { taken: 1, dealt: 1 }, hard: { taken: 1.5, dealt: 0.85 } }

export function saveSettings() {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings))
    } catch { }
}

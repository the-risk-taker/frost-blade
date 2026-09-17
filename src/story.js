// Story scenes as lines of dialog: who speaks, in what mood and an optional illustrated board shown above the text.
// The narrator has no portrait. Texts are in lang.js under story.<scene>.<line>.
export const SCENES = {
    intro: [
        { who: 'narrator', board: 'valley' },
        { who: 'narrator', board: 'seekers' },
        { who: 'hero', mood: 'calm' },
        { who: 'hero', mood: 'angry' },
    ],
    forest: [
        { who: 'merchant', mood: 'worried' },
        { who: 'hero', mood: 'calm' },
        { who: 'merchant', mood: 'worried' },
        { who: 'merchant', mood: 'calm' },
    ],
    cave: [
        { who: 'narrator', board: 'crystals' },
        { who: 'hero', mood: 'worried' },
        { who: 'merchant', mood: 'calm' },
        { who: 'hero', mood: 'angry' },
    ],
    ruins: [
        { who: 'hero', mood: 'worried', board: 'castle' },
        { who: 'chief', mood: 'angry' },
        { who: 'hero', mood: 'angry' },
        { who: 'chief', mood: 'angry' },
    ],
    end: [
        { who: 'hero', mood: 'worried' },
        { who: 'narrator', board: 'queen' },
        { who: 'hero', mood: 'calm' },
    ],
}

// How many letters of a line appear per second
export const TYPING = 45

export const sceneLines = (...names) => names.flatMap(name => SCENES[name].map((line, i) => ({ ...line, text: `story.${name}.${i}` })))

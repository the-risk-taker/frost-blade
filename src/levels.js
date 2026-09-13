// Stages played one after another, each with its own look, foes, hazards and quests.
// Chests are props that break and drop loot. Traps are icicles hanging from the cave ceiling.
export const LEVELS = [
    {
        theme: 'forest',
        board: 180,
        merchants: [1100, 3000],
        ice: [[1380, 1520], [2450, 2580]],
        traps: [],
        enemies: [
            ['wolf', 520], ['wolf', 590], ['chest', 700], ['ogre', 900], ['archer', 1250],
            ['ogre', 1600], ['wolf', 1700], ['chest', 1900], ['archer', 2050], ['ogre', 2200],
            ['shaman', 2350], ['wolf', 2600], ['wolf', 2670], ['archer', 2850], ['chest', 3300],
            ['archer', 3450], ['alpha', 3950],
        ],
        quests: [
            { item: 'fur', count: 4, reward: { gold: 30 } },
            { kill: 'wolf', count: 6, reward: { potion: 2 } },
        ],
    },
    {
        theme: 'cave',
        board: 180,
        merchants: [1200, 3050],
        ice: [[600, 800], [1300, 1500], [2150, 2450], [3150, 3350], [3600, 3900]],
        traps: [950, 1550, 1900, 2350, 2650, 3450, 3750],
        enemies: [
            ['wolf', 500], ['shaman', 700], ['chest', 850], ['ogre', 1000], ['wolf', 1400],
            ['wolf', 1460], ['shaman', 1650], ['chest', 1800], ['archer', 2000], ['ogre', 2300],
            ['shaman', 2500], ['wolf', 2800], ['chest', 2950], ['ogre', 3250], ['shaman', 3400],
            ['ogre', 3700], ['shaman', 3850], ['chest', 4000],
        ],
        quests: [
            { kill: 'shaman', count: 4, reward: { gold: 40 } },
            { item: 'fang', count: 3, reward: { arrows: 20 } },
        ],
    },
    {
        theme: 'ruins',
        board: 180,
        merchants: [1150, 3000],
        ice: [[1850, 1950], [3300, 3400]],
        traps: [],
        enemies: [
            ['archer', 550], ['archer', 620], ['chest', 800], ['ogre', 1000], ['shaman', 1300],
            ['archer', 1500], ['ogre', 1700], ['chest', 1900], ['wolf', 2100], ['wolf', 2160],
            ['ogre', 2400], ['shaman', 2600], ['archer', 2800], ['ogre', 3100], ['chest', 3250],
            ['shaman', 3400], ['archer', 3500], ['chief', 3950],
        ],
        quests: [
            { kill: 'ogre', count: 4, reward: { gold: 50 } },
            { kill: 'archer', count: 5, reward: { potion: 2 } },
        ],
    },
]

export const onIce = (stage, x) => stage.ice.some(([from, to]) => x >= from && x <= to)

// Stages played one after another, each with its own look, foes, hazards and quests.
// Chests are props that break and drop loot. Traps are icicles hanging from the cave ceiling.
// ['pool', x, budget] draws a random group from the stage pool, bosses and foes needed by quests are placed by hand.
// Roamers are wandering groups from the same pool coming in from a screen edge.
// The area level makes foes tougher and gives more XP and loot.
export const LEVELS = [
    {
        theme: 'forest',
        area: 1,
        board: 180,
        merchants: [1100, 3000],
        ice: [[1380, 1520], [2450, 2580]],
        traps: [],
        pool: { wolf: 3, archer: 2, shaman: 1, ogre: 1 },
        roamers: { count: 2, budget: 2 },
        enemies: [
            ['wolf', 520], ['wolf', 590], ['chest', 700], ['pool', 900, 3], ['archer', 1250],
            ['ogre', 1600], ['wolf', 1700], ['chest', 1900], ['pool', 2050, 2], ['ogre', 2200],
            ['pool', 2350, 2], ['wolf', 2600], ['wolf', 2670], ['archer', 2850], ['chest', 3300],
            ['pool', 3450, 2], ['alpha', 3950],
        ],
        quests: [
            { item: 'fur', count: 4, reward: { gold: 30 } },
            { kill: 'wolf', count: 6, reward: { potion: 2 } },
        ],
    },
    {
        theme: 'cave',
        area: 2,
        board: 180,
        merchants: [1200, 3050],
        ice: [[600, 800], [1300, 1500], [2150, 2450], [3150, 3350], [3600, 3900]],
        traps: [950, 1550, 1900, 2350, 2650, 3450, 3750],
        pool: { wolf: 3, ogre: 2, shaman: 1, archer: 1 },
        roamers: { count: 3, budget: 3 },
        enemies: [
            ['wolf', 500], ['shaman', 700], ['chest', 850], ['pool', 1000, 3], ['wolf', 1400],
            ['wolf', 1460], ['shaman', 1650], ['chest', 1800], ['pool', 2000, 2], ['ogre', 2300],
            ['shaman', 2500], ['pool', 2800, 2], ['chest', 2950], ['ogre', 3250], ['shaman', 3400],
            ['pool', 3700, 3], ['shaman', 3850], ['chest', 4000],
        ],
        quests: [
            { kill: 'shaman', count: 4, reward: { gold: 40 } },
            { item: 'fang', count: 3, reward: { arrows: 20 } },
        ],
    },
    {
        theme: 'ruins',
        area: 3,
        board: 180,
        merchants: [1150, 3000],
        ice: [[1850, 1950], [3300, 3400]],
        traps: [],
        pool: { archer: 3, shaman: 2, ogre: 1, wolf: 1 },
        roamers: { count: 3, budget: 3 },
        enemies: [
            ['archer', 550], ['archer', 620], ['chest', 800], ['ogre', 1000], ['pool', 1300, 2],
            ['archer', 1500], ['ogre', 1700], ['chest', 1900], ['pool', 2100, 2],
            ['ogre', 2400], ['pool', 2600, 2], ['archer', 2800], ['ogre', 3100], ['chest', 3250],
            ['pool', 3400, 2], ['archer', 3500], ['chief', 3950],
        ],
        quests: [
            { kill: 'ogre', count: 4, reward: { gold: 50 } },
            { kill: 'archer', count: 5, reward: { potion: 2 } },
        ],
    },
]

export const onIce = (stage, x) => stage.ice.some(([from, to]) => x >= from && x <= to)

export const areaScale = stage => 1 + 0.25 * (stage.area - 1)

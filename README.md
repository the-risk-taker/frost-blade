# Frost Blade

A pixel-art 2D action game built on three.js. The hero travels through successive stages (forest, cave, ruins...), fights wolves, ogres, shamans and archers, collects loot from smashed chests and dodges traps.

Along the way the character grows by leveling up and learning talents with active skills, completes quests for merchants, hunts for gear of rising rarity (axes, spears, daggers, staves, bows, armor, rings, legendary uniques), and progress is saved locally in the browser.

![Frost Blade](public/og.png)

## Setup

Requires Node.js.

Install dependencies:

```bash
npm install
```

Dev server with hot reload at <http://localhost:5173>:

```bash
npm run dev
```

Production build to the `dist` directory, `npm run preview` lets you check it locally:

```bash
npm run build
npm run preview
```

Headless tests of the game logic, run in Node without a browser:

```bash
npm run test
```

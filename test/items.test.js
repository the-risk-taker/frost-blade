import './browser.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rng } from '../src/pixels.js'
import { ITEMS, OFFERS, PACK_SIZE, RARITIES, createItem, rollUnique, collect, buy, sell, equip, unequip, price } from '../src/items.js'
import { createPlayer } from '../src/player.js'
import { stat, updateStats } from '../src/talents.js'
import { migrate } from '../src/save.js'

test('higher rarity rolls more bonuses and sells for more', () => {
    const random = rng(1)
    RARITIES.forEach((rarity, i) => {
        const item = createItem('axe', i, random)
        assert.ok(Object.keys(item.bonus).length <= rarity.bonuses)
        assert.ok(Object.values(item.bonus).reduce((sum, value) => sum + value, 0) > 0 || !rarity.bonuses)
    })
    assert.ok(price(createItem('axe', 2, random)) > price(createItem('axe')))
})

test('worn gear adds its base stats and bonuses', () => {
    const p = createPlayer()
    collect(p, { base: 'ring', rarity: 1, bonus: { maxHp: 20 } }, 1)
    equip(p, p.pack[0])
    assert.equal(stat(p, 'crit'), ITEMS.ring.crit)
    assert.equal(p.maxHp, 120)
    assert.equal(p.pack.length, 0)
})

test('equipping swaps with the worn piece, weapons cannot be taken off', () => {
    const p = createPlayer()
    collect(p, createItem('axe'), 1)
    equip(p, p.pack[0])
    assert.equal(p.gear.weapon.base, 'axe')
    assert.deepEqual(p.pack.map(item => item.base), ['sword'])
    unequip(p, 'weapon')
    assert.equal(p.gear.weapon.base, 'axe')
    collect(p, createItem('helmet'), 1)
    equip(p, p.pack[1])
    unequip(p, 'head')
    assert.equal(p.gear.head, null)
    assert.equal(p.pack.length, 2)
})

test('a full pack refuses gear but not counted loot', () => {
    const p = createPlayer()
    for (let i = 0; i < PACK_SIZE; i++) assert.ok(collect(p, createItem('boots'), 1))
    assert.equal(collect(p, createItem('boots'), 1), false)
    assert.ok(collect(p, 'fur', 3))
    p.bag.gold = 1000
    const helmet = OFFERS.find(offer => offer.item === 'helmet')
    buy(p, helmet)
    assert.equal(p.bag.gold, 1000)
    sell(p, p.pack[0])
    buy(p, helmet)
    assert.equal(p.pack.at(-1).base, 'helmet')
})

test('a unique is certain after a few misses', () => {
    const p = createPlayer()
    const never = () => 0.99
    assert.equal(rollUnique(p, 0, never), null)
    assert.equal(rollUnique(p, 0, never), null)
    const unique = rollUnique(p, 0, never)
    assert.ok(ITEMS[unique.base].unique)
    assert.equal(unique.rarity, 3)
    assert.equal(p.pity, 0)
})

test('old saves get their gear as items', () => {
    const v1 = { stage: 1, bag: { gold: 5, helmet: 1, cloak: 1, fur: 2 }, gear: { head: 'helmet', body: null, back: null }, xp: 0, level: 3, maxHp: 120, maxMana: 110, power: 2 }
    const save = migrate(v1)
    assert.equal(save.gear.head.base, 'helmet')
    assert.equal(save.gear.weapon.base, 'sword')
    assert.deepEqual(save.pack.map(item => item.base), ['cloak'])
    assert.deepEqual(save.bag, { gold: 5, fur: 2 })
    assert.equal(save.quiver, 'arrows')
    assert.equal(save.maxHp, undefined)
    const p = Object.assign(createPlayer(), save)
    updateStats(p)
    assert.equal(stat(p, 'defense'), ITEMS.helmet.defense)
})

import { give } from './items.js'
import { sfx } from './sound.js'
import { t } from './lang.js'

// Collect quests count items in the bag, kill quests count foes defeated since the quest was taken
export const progress = (game, quest) => Math.min(quest.count, quest.item ? game.player.bag[quest.item] ?? 0 : (game.kills[quest.kill] ?? 0) - quest.start)

export function takeQuest(game, quest) {
    if (quest.state !== 'new') return
    quest.state = 'taken'
    quest.start = game.kills[quest.kill] ?? 0
    sfx.pickup()
}

// A finished quest pays out right away, collected items are handed over
export function updateQuests(game) {
    const p = game.player
    for (const quest of game.quests) {
        if (quest.state !== 'taken' || progress(game, quest) < quest.count) continue
        quest.state = 'done'
        if (quest.item) give(p, quest.item, -quest.count)
        for (const [item, count] of Object.entries(quest.reward)) give(p, item, count)
        game.popup(p.x, p.y - 60, t('questDone'), '#b8f5a0')
        sfx.coin()
    }
}

// Timed effects shared by the hero and enemies. Another hit refreshes the time and adds a stack up to the cap.
// Effects with damage hurt for every stack each half second.
export const STATUSES = {
    slow: { stacks: 1 },
    freeze: { stacks: 1 },
    bleed: { stacks: 5, damage: 2 },
    burn: { stacks: 3, damage: 4 },
    root: { stacks: 1 },
    // Raised damage after a kill, given by the Chief's Crown
    frenzy: { stacks: 1 },
}

const TICK = 0.5

export function afflict(target, name, time) {
    const status = target.statuses[name] ??= { t: 0, stacks: 0 }
    status.t = Math.max(status.t, time)
    status.stacks = Math.min(STATUSES[name].stacks, status.stacks + 1)
}

export const has = (target, name) => name in target.statuses

// Runs the clocks down and returns the damage dealt this frame
export function tickStatuses(target, dt) {
    let damage = 0
    for (const [name, status] of Object.entries(target.statuses)) {
        const ticks = Math.ceil(status.t / TICK) - Math.ceil((status.t - dt) / TICK)
        damage += (STATUSES[name].damage ?? 0) * status.stacks * ticks
        status.t -= dt
        if (status.t <= 0) delete target.statuses[name]
    }
    return damage
}

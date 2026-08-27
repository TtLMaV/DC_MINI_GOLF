import { engine } from '@dcl/sdk/ecs'

/**
 * The level-up banner, and how long it stays up.
 *
 * A separate thing from the toast on purpose. The toast is a running
 * commentary — a hole named, a payment made, a hand-over refused — and it
 * comes and goes several times a round. Levelling up happens a handful of
 * times in a scene's whole life for any one player, and putting it through the
 * same channel would let it be overwritten a second later by "Shellman will not
 * take any more today".
 *
 * So it gets its own slot, its own clock, and the middle of the screen.
 *
 * Nothing is decided here. The server notices the level, prices the bonus and
 * sends the whole announcement; this holds the last one and counts it down.
 */

export type LevelUp = {
  level: number
  /** How many rungs were crossed at once. Usually one. */
  gained: number
  bonus: number
  rank: string
  /** True when the new level crossed into a band they were not in before. */
  newRank: boolean
  /** The club that rank puts on the shelf, or empty. */
  unlocked: string
}

let showing: LevelUp | undefined
let ttl = 0
let running = false

/** How long the banner holds. Long enough to read twice. */
const SECONDS = 7

/** The banner to draw, or nothing. */
export function levelUpBanner(): LevelUp | undefined {
  return showing
}

/**
 * Takes the server's announcement.
 *
 * Replaces whatever was up rather than queueing behind it. Two level-ups
 * inside seven seconds means the second is the true one, and a queue would
 * show the stale number first.
 */
export function showLevelUp(next: LevelUp): void {
  showing = next
  ttl = SECONDS
}

function levelUpSystem(dt: number): void {
  if (!showing) return
  ttl -= dt
  if (ttl <= 0) {
    ttl = 0
    showing = undefined
  }
}

export function setupLevelUp(): void {
  if (running) return
  running = true
  engine.addSystem(levelUpSystem)
}

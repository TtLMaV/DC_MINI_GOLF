/**
 * Levels and ranks.
 *
 * A level is a read of one number — the Pixel Points a player has earned in
 * their whole time here — and nothing else is stored. There is no XP field to
 * keep in step with the balance, no way for the two to disagree, and no
 * migration to write when the curve is retuned: change the constants below and
 * everybody's level moves that evening.
 *
 * That is the whole reason lifetime is separate from balance. Spending is
 * supposed to be the point of earning, so a ladder that fell every time you
 * bought a club would quietly teach people not to buy clubs.
 *
 * Nothing here imports the SDK. It is arithmetic, so the server runs the same
 * code to decide whether a purchase is allowed as the HUD runs to draw the
 * progress bar, and the two cannot drift.
 */

// ---------------------------------------------------------------------------
// The curve
// ---------------------------------------------------------------------------

/**
 * Cumulative points to reach a level: base * (level - 1) ^ exponent.
 *
 * Two dials. `base` is what level 2 costs, so it sets how quickly the ladder
 * starts moving — at 90 that is most of one round. `exponent` is the burn: it
 * is the ratio between what the last level costs and what the first one did.
 * At 1.45 the step from 99 to 100 is about ten times the step from 1 to 2.
 *
 * Where that lands, in rounds, taking a round as roughly 120 points:
 *
 *     Lv   2  Cabin Boy            90     ~1 round
 *     Lv   6  Deckhand            900     ~8 rounds
 *     Lv  11  Buccaneer         2,538    ~21 rounds
 *     Lv  16  First Mate        4,545    ~38 rounds
 *     Lv  25  Captain           8,874    ~74 rounds
 *     Lv  30  (Master Ball)    11,430    ~95 rounds
 *     Lv  50                   24,120   ~200 rounds
 *     Lv 100  Pirate Lord      70,470   ~590 rounds
 *
 * Those are floors, not forecasts — quests, the secret hole, first-of-day and
 * personal bests all pay on top, so real players arrive sooner. Pirate Lord is
 * meant to be rare. If it should be less rare, `exponent` is the number to
 * lower; leave `base` alone unless the opening feels wrong, because it is what
 * a new player meets first.
 */
export const CURVE = {
  base: 90,
  exponent: 1.45,
  maxLevel: 100
}

/** Lifetime points needed to be this level. Level 1 is free. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  const capped = Math.min(level, CURVE.maxLevel)
  return Math.round(CURVE.base * Math.pow(capped - 1, CURVE.exponent))
}

/**
 * The level a lifetime total buys.
 *
 * Closed-form guess plus a correction step, rather than counting up from level
 * 1, so it costs the same whether somebody is level 3 or level 100 — it is
 * called on every ledger and every frame the HUD draws a progress bar.
 */
export function levelFor(lifetime: number): number {
  if (lifetime < CURVE.base) return 1

  // Invert the curve for a starting guess, then walk it onto the exact answer.
  //
  // The walk is not belt and braces. xpForLevel rounds its result, so the
  // stored threshold is not the curve's own value, and inverting the unrounded
  // curve lands a level short at exactly the wrong moment: 90 * 5^1.45 is
  // 927.6, the threshold shows as 928, and a player sitting on 928 was coming
  // back as level 5. Correcting against xpForLevel makes this its exact
  // inverse by construction rather than by luck, whatever base and exponent
  // are set to.
  let level = Math.max(1, Math.min(CURVE.maxLevel, Math.floor(1 + Math.pow(lifetime / CURVE.base, 1 / CURVE.exponent))))
  while (level < CURVE.maxLevel && xpForLevel(level + 1) <= lifetime) level++
  while (level > 1 && xpForLevel(level) > lifetime) level--
  return level
}

// ---------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------

export type Rank = {
  name: string
  /** First level in the band. */
  from: number
  /** Last level in the band, inclusive. */
  to: number
  /** Catalogue id of the club this rank puts on the shelf. */
  club: string
}

/**
 * The six bands.
 *
 * Captain runs 25 to 99 rather than 25 to 50 as first written, because the
 * spec left 51 to 98 with no rank at all and there is no twelfth club .glb to
 * give a seventh band. It also makes Pirate Lord mean something: one level,
 * right at the top, holding the Cutlass and the Crown Ball.
 *
 * A rank does not hand you its club. It puts it on the shelf — you still pay
 * for it. Reaching First Mate and finding the Ruby Club merely *available* is
 * a smaller moment than being handed it, but it keeps points worth earning
 * after the ladder stops being the thing you are chasing.
 */
export const RANKS: Rank[] = [
  { name: 'Cabin Boy', from: 1, to: 5, club: 'club-stick' },
  { name: 'Deckhand', from: 6, to: 10, club: 'club-standard' },
  { name: 'Buccaneer', from: 11, to: 15, club: 'club-golden' },
  { name: 'First Mate', from: 16, to: 24, club: 'club-ruby' },
  { name: 'Captain', from: 25, to: 99, club: 'club-master' },
  { name: 'Pirate Lord', from: 100, to: 100, club: 'club-cutlass' }
]

export function rankFor(level: number): Rank {
  // Walk backwards so the highest band whose floor has been reached wins. A
  // level above every band still returns the last one rather than undefined.
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (level >= RANKS[i].from) return RANKS[i]
  }
  return RANKS[0]
}

// ---------------------------------------------------------------------------
// What the HUD needs
// ---------------------------------------------------------------------------

export type Standing = {
  level: number
  rank: Rank
  /** Points earned since this level began. */
  into: number
  /** Points this level costs in total. Zero at the cap. */
  needed: number
  /** 0..1 across the current level. 1 at the cap. */
  fraction: number
  /** True at maxLevel, where there is no next level to fill. */
  capped: boolean
}

/**
 * Everything about where a player stands, from the one stored number.
 *
 * The bar measures the level you are *in*, not the whole ladder — a bar that
 * showed progress to 100 would sit visibly still for weeks, which is the
 * opposite of what a progress bar is for.
 */
export function standing(lifetime: number): Standing {
  const level = levelFor(lifetime)
  const rank = rankFor(level)

  if (level >= CURVE.maxLevel) {
    return { level, rank, into: 0, needed: 0, fraction: 1, capped: true }
  }

  const floor = xpForLevel(level)
  const ceiling = xpForLevel(level + 1)
  const needed = Math.max(1, ceiling - floor)
  const into = Math.max(0, Math.min(needed, lifetime - floor))

  return { level, rank, into, needed, fraction: into / needed, capped: false }
}

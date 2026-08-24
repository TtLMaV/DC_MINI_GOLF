import { Vector3 } from '@dcl/sdk/math'

/**
 * The nine holes.
 *
 * Coordinates are in the same space the physics runs in, i.e. the space
 * src/collisionData/course_collision.ts is exported in. Every tee and cup below
 * was read out of the hole .glb files (the "Ball Start" plaque and the white cup
 * lining modelled into each green) and then checked against the collision mesh:
 * casting down at each point lands exactly on the expected surface height, so
 * these line up with what the ball actually rolls on.
 *
 * If the export frame ever changes, re-derive rather than nudging by hand.
 */

const v = (x: number, y: number, z: number) => Vector3.create(x, y, z)

export type Cup =
  | {
      kind: 'cup'
      /** Centre of the cup, at green level. */
      centre: Vector3
      /** Floor of the cup — the ball settles about a radius above this. */
      floorY: number
    }
  | {
      kind: 'volume'
      /** Anything entering this box is holed. Hole 9 finishes in the chest. */
      min: Vector3
      max: Vector3
      centre: Vector3
    }

export type Hole = {
  number: number
  name: string
  par: number
  tee: Vector3
  cup: Cup
  hint: string
  /**
   * Shots before the ball is picked up, if this hole wants its own limit.
   * Left off, RULES.maxStrokes applies. Left off on a hole that is never
   * scored, nothing picks you up at all.
   */
  maxStrokes?: number
}

/**
 * The practice hole, in the Shack where players arrive.
 *
 * Read out of Practice Hole Base.glb the same way the nine were read out of
 * theirs, then mapped into play space: the green is a flat 2m x 8m strip at
 * y 0.601, the cup is the white lining at (-7.19, 17.74) with its floor at
 * 0.51, and the tee is the "Ball Start" plaque at (-7.19, 11.24). Tee to pin
 * is 6.5m dead straight — long enough to be worth practising the meter on,
 * short enough to hole out.
 *
 * It carries a par so the aim code, the cup test and the HUD can treat it like
 * any other hole and nothing needs a special case. Nothing about it is ever
 * scored.
 */
export const PRACTICE: Hole = {
  number: 0,
  name: 'Practice',
  par: 2,
  tee: v(-7.175, 0.6023, 11.225),
  cup: { kind: 'cup', centre: v(-7.175, 0.601, 17.725), floorY: 0.51 },
  hint: 'Warm up. Hole it and the ball comes straight back.'
}

/**
 * The secret hole, out past the end of the course.
 *
 * Read out of Secret Hole Base.glb the same way the others were — the "Ball
 * Start" plaque for the tee, the white cup lining for the cup — and checked
 * against course_collision.ts, which does carry this one: casting down at the
 * tee lands on 3.600 and the green beside the cup on 0.211.
 *
 * It is a gauntlet rather than a hole. The tee sits on a platform at 3.60 and
 * the route away from it is a chain of islands with real voids between them,
 * dropping about three and a half metres over roughly thirty of travel before
 * the green at the far side. Almost nothing about it is fair, which is why it
 * carries a limit of its own rather than the ordinary ten.
 *
 * Never scored: it is not one of the nine and it is not on the card.
 */
export const SECRET: Hole = {
  number: 10,
  name: 'The Secret Hole',
  par: 8,
  tee: v(17.551, 3.6, 93.249),
  cup: { kind: 'cup', centre: v(37.251, 0.21, 92.249), floorY: 0.079 },
  hint: 'Nobody has to play this. Twenty shots, then it takes the ball off you.',
  maxStrokes: 20
}

export const HOLES: Hole[] = [
  {
    number: 1,
    name: "The Jetty",
    par: 2,
    tee: v(5.05, 0.2, 14.89),
    cup: { kind: 'cup', centre: v(8.55, 0.2, 10.45), floorY: 0.118 },
    hint: 'A gentle dog-leg. Play it off the rail.'
  },
  {
    number: 2,
    name: "Anchor's Rest",
    par: 3,
    tee: v(21.05, 0.4, 17.89),
    cup: { kind: 'cup', centre: v(21.05, 1.0, 12.45), floorY: 0.7 },
    hint: 'Up the ramp, past the anchor. Give it some legs.'
  },
  {
    number: 3,
    name: "Triple Bridge",
    par: 4,
    tee: v(32.05, 2.0, 16.89),
    cup: { kind: 'cup', centre: v(28.05, 1.0, 16.45), floorY: 0.7 },
    hint: 'Down the slope, then thread the gaps.'
  },
  {
    number: 4,
    name: "The Blockade",
    par: 4,
    tee: v(32.05, 0.2, 30.49),
    cup: { kind: 'cup', centre: v(26.05, 1.0, 30.05), floorY: 0.7 },
    hint: 'Two open trenches between you and the pin.'
  },
  {
    number: 5,
    name: "Barrel Run",
    par: 3,
    tee: v(37.05, 2.4, 34.61),
    cup: { kind: 'cup', centre: v(33.05, 0.8, 41.55), floorY: 0.5 },
    hint: 'Time the barrel, then stay dry.'
  },
  {
    number: 6,
    name: "The Lighthouse",
    par: 5,
    tee: v(38.45, 3.2, 57.61),
    cup: { kind: 'cup', centre: v(41.45, 4.52, 62.05), floorY: 4.213 },
    hint: 'Around the light, then up onto the deck.'
  },
  {
    number: 7,
    name: "Ship's Passing",
    par: 6,
    tee: v(10.05, 0.2, 50.89),
    cup: { kind: 'cup', centre: v(10.02, 1.6, 42.45), floorY: 1.3 },
    hint: 'The galleon ferries you across. Wait for your gap.'
  },
  {
    number: 8,
    name: "Dead Man's Arch",
    par: 3,
    tee: v(18.948, 0.4, 25.608),
    cup: { kind: 'cup', centre: v(4.948, 0.4, 26.548), floorY: 0.119 },
    hint: 'Two big rollers. Hit it firm or the hill sends it back.'
  },
  {
    number: 9,
    name: "Treasure Run",
    par: 8,
    tee: v(4.749, 2.0, 59.81),
    cup: {
      kind: 'volume',
      // The open treasure chest at the very end of the course.
      min: v(34.1, 0.35, 73.85),
      max: v(35.35, 1.75, 76.65),
      centre: v(34.7, 1.0, 75.25)
    },
    hint: 'The whole island, two swinging bridges, and a chest at the end.'
  }
]

export const TOTAL_PAR = HOLES.reduce((n, h) => n + h.par, 0)

export function cupCentre(hole: Hole): Vector3 {
  return hole.cup.centre
}

/**
 * Where to set the player down when a hole starts: a short step behind the tee,
 * on the far side from the pin, so they are already looking down the hole.
 */
export function teeStand(hole: Hole): Vector3 {
  const cup = cupCentre(hole)
  const dx = hole.tee.x - cup.x
  const dz = hole.tee.z - cup.z
  const l = Math.sqrt(dx * dx + dz * dz) || 1
  return Vector3.create(hole.tee.x + (dx / l) * 1.7, hole.tee.y + 0.15, hole.tee.z + (dz / l) * 1.7)
}

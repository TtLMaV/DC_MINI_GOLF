import { engine, Entity, Transform } from '@dcl/sdk/ecs'
import { RAMP } from './config'

/**
 * Hole 9's moving ramp.
 *
 * The .glb ships a 20.8s animation, 'CubeAction', that lifts the ramp and
 * lowers it again. We do not play it. An Animator clip is evaluated by the
 * renderer and the scene cannot read the result back, so a ramp that moved only
 * in the renderer would leave the cannon world none the wiser and the ball
 * would drop straight through a ramp it could plainly see.
 *
 * So the motion is generated here and the physics body reads the same number
 * every frame, which is what makes the two agree. The curve is described as a
 * shape — hold, ease up, hold, ease down — rather than baked samples, so the
 * heights and timings are all adjustable from config.
 */

/** The node's rest height in the .glb. The entity moves by the delta from this. */
export const REST_Y = 0.5

/** One full cycle: sit at the bottom, climb, sit at the top, come back down. */
export const LOOP_SECONDS =
  RAMP.bottomDwellSeconds + RAMP.riseSeconds + RAMP.topDwellSeconds + RAMP.fallSeconds

export const RAMP_BOX = {
  /**
   * Where the ramp body is anchored. The shape itself comes from
   * collisionData/ramp_collision.ts, exported from the .glb's own collider mesh
   * and mirrored in x to match play space, so the body is the wedge the player
   * can see rather than a box drawn round it.
   *
   * A box was the original approximation and it was wrong in the way that
   * matters: a flat top where the model has a 24-degree slope, so the ball sat
   * on an invisible level shelf instead of running down the visible incline.
   */
  centreX: 22.15,
  centreZ: 75.25
}

const NAME = 'Moving Ramp.glb'

let entity: Entity | undefined
let clock = 0
let height = RAMP.bottomY
let rise = 0

export function setupRamp(): void {
  entity = engine.getEntityOrNullByName(NAME) ?? undefined
  if (!entity) console.log(`[golf] no entity named "${NAME}" — the moving ramp will not run`)
}

/** Slow at both ends, quick through the middle — matches the authored easing. */
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Height at a point in the cycle. */
function heightAt(t: number): number {
  const { bottomY, topY, bottomDwellSeconds, riseSeconds, topDwellSeconds } = RAMP

  if (t < bottomDwellSeconds) return bottomY
  t -= bottomDwellSeconds

  if (t < riseSeconds) return bottomY + (topY - bottomY) * smooth(t / riseSeconds)
  t -= riseSeconds

  if (t < topDwellSeconds) return topY
  t -= topDwellSeconds

  return topY - (topY - bottomY) * smooth(Math.min(1, t / RAMP.fallSeconds))
}

export function updateRamp(dt: number): void {
  if (!entity) return
  const was = height
  clock = (clock + dt) % LOOP_SECONDS
  height = heightAt(clock)
  // Kept so the physics body can be given a matching velocity rather than being
  // teleported, which is what stops the ball popping through it.
  rise = dt > 0 ? (height - was) / dt : 0

  const t = Transform.getMutableOrNull(entity)
  if (t) t.position.y = height - REST_Y
}

/** Current height of the ramp node, in .glb local terms. */
export function rampHeight(): number {
  return height
}

/** How fast it is climbing right now, metres per second. */
export function rampRise(): number {
  return rise
}

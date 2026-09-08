import { engine, SkyboxTime, Transform } from '@dcl/sdk/ecs'
import { SKY } from './config'
import { inCave } from './detector'

/**
 * Pins the time of day for everyone in the scene, and answers whether the
 * player is somewhere that should be dark.
 *
 * SkyboxTime is a scene-global component and the engine only honours it on
 * engine.RootEntity — putting it anywhere else does nothing. fixedTime is
 * seconds since midnight; the number lives in SKY.fixedTime.
 *
 * The cave used to be done by winding this forward to night. It is not any
 * more, and the reason is worth writing down so nobody puts it back: the
 * skybox always eases to a new time over a couple of seconds. That is stated
 * in the docs and there is no switch for it — transitionMode only chooses
 * whether the sun runs forwards or backwards to get there. So walking into a
 * cave started a sunset rather than turning the lights off. The darkness is a
 * screen overlay in the HUD now, and this file only says where it applies.
 *
 * Note also that while SkyboxTime is set, players lose the UI control for
 * changing time of day. The scene owns it, which is the point, but it does
 * take a toy off them.
 */
export function setupSky(): void {
  SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: SKY.fixedTime })
}

/**
 * Whether this spot is one of the open bits.
 *
 * The cave route is a loop and the mouth is on it, so being in the zone does
 * not mean being underground. These are the patches that stay in daylight
 * regardless, and they win over the corridor rather than the other way round.
 */
function inDaylight(at: { x: number; z: number }): boolean {
  for (const spot of SKY.daylight) {
    const dx = at.x - spot.x
    const dz = at.z - spot.z
    if (dx * dx + dz * dz <= spot.radius * spot.radius) return true
  }
  return false
}

/**
 * Underground, and therefore dark.
 *
 * Deliberately not tied to the detector: somebody wandering the cave without
 * one should still find it dark. The detector reads the same corridor for its
 * own reasons; this is the other thing that reads it.
 *
 * Asked once a frame by the HUD rather than pushed, so there is no state to
 * get stuck and nothing to reset when a player is teleported across the map.
 */
export function inDarkness(): boolean {
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!player) return false
  return inCave(player.position) && !inDaylight(player.position)
}

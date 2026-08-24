import { engine, SkyboxTime } from '@dcl/sdk/ecs'
import { SKY } from './config'

/**
 * Pins the time of day for everyone in the scene.
 *
 * SkyboxTime is a scene-global component and the engine only honours it on
 * engine.RootEntity — putting it anywhere else does nothing. fixedTime is
 * seconds since midnight; the number itself lives in SKY.fixedTime.
 *
 * Two things worth knowing. The skybox eases to the new time over a couple of
 * seconds rather than snapping, so the light shifts as you arrive rather than
 * cutting. And while it is set, players lose the UI control for changing time
 * of day — the scene owns it, which is the point, but it does take a toy off
 * them.
 */
export function setupSky(): void {
  SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: SKY.fixedTime })
}

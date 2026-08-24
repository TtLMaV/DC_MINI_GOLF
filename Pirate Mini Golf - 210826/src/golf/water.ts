import { Animator, engine, GltfContainer, Name } from '@dcl/sdk/ecs'

/**
 * Plays the baked animations on scene props — currently the ocean.
 *
 * A GltfContainer does not play anything on its own: an embedded clip sits
 * inert until an Animator asks for it *by name*. That is true of shape keys,
 * skeletal and transform animation alike, and the name is a plain string, so a
 * re-export under a different action name silently plays nothing.
 *
 * Which is exactly what happened when Ocean V2 landed. Both halves of the match
 * moved at once: the entity is now called "Ocean V2.glb" rather than
 * "Ocean.glb", and the animation changed from a single shape key action called
 * 'Cube.088Action' to four transform actions called 'Flow*'. So props are now
 * matched on the model path as well as the entity name, and a miss logs what it
 * did find instead of failing quietly.
 */

type AnimatedProp = {
  /** Entity name as authored, or a fragment of the .glb path. Either matches. */
  match: string
  /** Action names exactly as exported into the .glb. */
  clips: string[]
  speed: number
}

/**
 * Ocean V2 ships four actions — Flow, Flow.001, Flow.002 and Flow.003 — and all
 * four drive the same 41 'belt_*' nodes, so they are speed variants of one
 * animation rather than four separate things. Playing more than one would have
 * them fighting over the same transforms. The cycle times are:
 *
 *   Flow      1.6s    a rushing conveyor
 *   Flow.001  1.6s
 *   Flow.002  3.3s
 *   Flow.003  33.3s   a slow ocean drift
 *
 * Flow.003 is the one that reads as sea rather than a mill race, and `speed`
 * scales it from here without touching the file: 0.5 halves it, 2 doubles it.
 * At 0.5 against a 66.6s clip the belts take about 133s to come round.
 */
const PROPS: AnimatedProp[] = [{ match: 'Ocean', clips: ['Flow.003'], speed: 0.5 }]

export function setupWater(): void {
  const matched = new Set<string>()
  const seen: string[] = []

  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    const src = GltfContainer.getOrNull(entity)?.src ?? ''
    if (src) seen.push(`${name.value} (${src})`)

    for (const prop of PROPS) {
      const hit = name.value.includes(prop.match) || src.includes(prop.match)
      if (!hit) continue
      matched.add(prop.match)

      Animator.createOrReplace(entity, {
        states: prop.clips.map((clip) => ({
          clip,
          playing: true,
          loop: true,
          speed: prop.speed,
          weight: 1
        }))
      })
      console.log(`[golf] animating "${name.value}" with ${prop.clips.join(', ')}`)
    }
  }

  for (const prop of PROPS) {
    if (matched.has(prop.match)) continue
    console.log(
      `[golf] nothing in the scene matches "${prop.match}" — models present: ${seen.join(' | ')}`
    )
  }
}

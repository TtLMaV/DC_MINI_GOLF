import { Animator, engine, GltfContainer, Name } from '@dcl/sdk/ecs'

/**
 * Plays the baked animations on scene props — the ocean and the waterfalls.
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
 * Every water model is the same rig: 41 'belt_*' nodes driven by a set of
 * 'Flow*' actions that are speed variants of one another, not separate
 * animations. Playing more than one has them fighting over the same
 * transforms, so each prop picks exactly one.
 *
 * Clip names are matched as plain strings and mean nothing outside the file
 * they came from. The three models disagree about them right now, read out of
 * the .glb files as they stand:
 *
 *   Vertical Waterfall    Flow 2.00s  Flow.001 3.33s  Flow.002 0.25s
 *                         Flow.003 41.67s  Flow.004 4.17s
 *   Horizontal Waterfall  Flow.002 4.17s  Flow.003 41.67s  Flow.004 4.17s
 *   Ocean V2              Flow.002 4.17s  Flow.003 41.67s  Flow.004 4.17s
 *
 * So 'Flow.002' is a four-second flow on two of them and a quarter-second
 * strobe on the third. That is why each prop names its own clip below rather
 * than sharing one, and why a re-export is always worth re-reading: the code
 * cannot tell a renamed action from a missing one.
 *
 * The ocean wants the long drift, halved again, or it reads as a mill race.
 * The waterfalls want a fast cycle — they are falling, not lapping.
 */
const PROPS: AnimatedProp[] = [
  { match: 'Ocean', clips: ['Flow.003'], speed: 0.5 },
  // Still the old export: 4.17s, so it needs the speed multiplier to keep up.
  { match: 'Horizontal Waterfall', clips: ['Flow.002'], speed: 1.5 },
  // Re-exported with five actions where the others have three. Flow.004 is
  // the one name present in every version of this model — 4.17s — so the
  // speed comes from the multiplier rather than from a newly-added action the
  // rest of the pipeline has not caught up with.
  //
  // 20x against a 4.17s clip is a belt cycle every fifth of a second, or about
  // 0.21s. That is very close to the 0.25s 'Flow.002' action baked into this
  // model's re-export, which is presumably the rate it was authored to run at
  // — so this is the number the file itself is pointing at, arrived at from
  // the other direction. 40 was the literal 20x of what it had been running
  // at and read as a strobe; halving it is this.
  //
  // Not 'Flow' (2.00s): it exists in the file but not in the Animator that
  // Creator Hub wrote, and not in the older exports either.
  { match: 'Vertical Waterfall', clips: ['Flow.004'], speed: 20 }
]

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
      console.log(
        `[golf] animating "${name.value}" with ${prop.clips.join(', ')} at ${prop.speed}x`
      )
    }
  }

  for (const prop of PROPS) {
    if (matched.has(prop.match)) continue
    console.log(
      `[golf] WATER MISS: nothing matches "${prop.match}", so it will not move. ` +
        `Models present: ${seen.join(' | ')}`
    )
  }
}

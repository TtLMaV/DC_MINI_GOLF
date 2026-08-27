import { Animator, engine, Entity, Name } from '@dcl/sdk/ecs'

import { SKELETONS } from './config'

/**
 * The hanging cages, swaying.
 *
 * The motion is baked into Skeletons.glb rather than driven from here, and
 * that is the whole design. All this file does is find the entity Creator Hub
 * built and tell it to play the clip.
 *
 * ---------------------------------------------------------------------------
 * Why the model had to be rebuilt for this
 * ---------------------------------------------------------------------------
 * The .glb arrived as one merged mesh called 'Skeleton Cages' with no node per
 * cage, which is the same shape of problem the palm trees had. A scene cannot
 * reach inside a GltfContainer, so there was nothing to rotate: turning the
 * whole entity would have swung all three about a single point somewhere off
 * to one side, and cages describing a shared arc read as a camera move rather
 * than as three things hanging.
 *
 * So it was split. The mesh divides into exactly three equal groups of 9,709
 * triangles, and each was re-origined on its own hook — the centre of the ring
 * it hangs from — and given a node whose translation puts it back exactly
 * where it was. Rotating that node is then a real pendulum about a real pivot.
 *
 * The one that bit: the original 'Skeleton Cages' node carried a 45 degree
 * rotation about Y, and the first rebuild dropped it. Mesh bounds say nothing
 * about a node's own transform, and the cages came out swinging happily in
 * completely the wrong part of the island. The rotation is now baked into the
 * geometry — positions and normals both — before the hooks are worked out, so
 * the node transform is free to carry the sway and nothing else.
 *
 * It is the same lesson the first-tee sign cost four attempts: read the node,
 * not just the mesh. Checking the rebuild against mesh-space bounds passes
 * either way, which is why that check proved nothing. The check that matters
 * is against world space with the node transform applied, and against that one
 * the rebuilt cages land within zero of the originals.
 *
 * The animation is three rotation channels, one per node, 120 degrees apart in
 * phase so the three never line up. Baking it into the file rather than
 * running a system here means it survives the entity being moved, costs no
 * per-frame work, and can be re-authored in Blender later without touching
 * any code.
 *
 * The rebuild also dropped a stray 'Hole 8 Base_Collider' node, 12,008
 * triangles that had been riding along inside the file. Worth being accurate
 * about it: it sat in a second glTF scene rather than the default one, so
 * unlike the copy in the shell models it was never actually drawn or collided
 * with — dead weight in the download, not a wall in the world. That is why the
 * file came out smaller despite gaining an animation.
 */

/**
 * Finds the entity, without being fussy about exactly what it is called.
 *
 * The same tolerance the quest board and the leaderboard use: exact match
 * first, then a case-insensitive scan that ignores a .glb suffix, because the
 * difference between "Skeletons", "skeletons" and "Skeletons.glb" is not a
 * difference anybody means.
 */
function findCages(): Entity | null {
  const exact = engine.getEntityOrNullByName(SKELETONS.entityName)
  if (exact !== null) return exact

  const want = SKELETONS.entityName.toLowerCase().replace(/\.glb$/, '')
  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    if (name.value.toLowerCase().replace(/\.glb$/, '') === want) return entity
  }
  return null
}

export function setupSkeletons(): void {
  if (!SKELETONS.sway) return

  const cages = findCages()
  if (cages === null) {
    console.log(
      `[golf] SKELETONS: no entity named "${SKELETONS.entityName}" in the scene, so nothing to ` +
        'sway. Rename it in Creator Hub or change SKELETONS.entityName in config.ts.'
    )
    return
  }

  Animator.createOrReplace(cages, {
    states: [
      {
        clip: SKELETONS.clip,
        playing: true,
        loop: true,
        weight: 1,
        speed: SKELETONS.speed
      }
    ]
  })

  console.log(`[golf] skeleton cages swaying on "${SKELETONS.entityName}" (clip ${SKELETONS.clip})`)
}

import {
  ColliderLayer,
  engine,
  Entity,
  GltfContainer,
  Name,
  VisibilityComponent
} from '@dcl/sdk/ecs'

import { BAR } from './config'
import { blenderIsBuilt } from './points'

/**
 * Coconutty's bar, which does not exist until somebody builds it.
 *
 * The table, the blender and the colada on it are authored in Creator Hub like
 * any other prop, so they are in the scene from the moment it loads. This
 * takes them back out again and puts them there when the player has finished
 * the blender chain — so the corner of the deck is empty until the day you
 * hand him the last part, and then there is a bar in it.
 *
 * Per player, not per world. blenderIsBuilt() reads this player's wallet, so
 * somebody who has not done the quest sees an empty corner while somebody
 * standing next to them who has sees a bar. That is the same bargain the
 * shells make, and the alternative is worse: a bar that appears because a
 * stranger finished a quest tells you nothing about your own.
 *
 * ---------------------------------------------------------------------------
 * Hidden means gone, not just invisible
 * ---------------------------------------------------------------------------
 * VisibilityComponent stops it drawing and does nothing else. A .glb brings
 * its own colliders, so an invisible table is still a table you walk into and
 * still something a putt bounces off, which is a worse bug than a visible one
 * because there is nothing on screen to explain it. So the collision masks go
 * with the visibility, and the authored ones are read at startup and put back
 * rather than guessed at — Creator Hub decides what a prop collides with and
 * this has no business overruling it.
 */

type Prop = {
  entity: Entity
  name: string
  /** What Creator Hub set, so showing it again restores exactly that. */
  visibleMask: number | undefined
  invisibleMask: number | undefined
}

const props: Prop[] = []

/** What the bar is currently doing, so nothing is written on a frame it need not be. */
let showing: boolean | null = null
let clock = 0

function apply(show: boolean): void {
  for (const prop of props) {
    VisibilityComponent.createOrReplace(prop.entity, { visible: show })

    const gltf = GltfContainer.getMutableOrNull(prop.entity)
    if (!gltf) continue
    gltf.visibleMeshesCollisionMask = show ? prop.visibleMask : ColliderLayer.CL_NONE
    gltf.invisibleMeshesCollisionMask = show ? prop.invisibleMask : ColliderLayer.CL_NONE
  }
  showing = show
}

/**
 * Asked on a slow clock rather than every frame.
 *
 * It is a question about a wallet, and a wallet changes once in a session at
 * most. A second late is a second nobody will catch, and it saves asking sixty
 * times a second for the whole of a round.
 */
function barSystem(dt: number): void {
  if (props.length === 0) return
  clock -= dt
  if (clock > 0) return
  clock = BAR.checkInterval

  const built = blenderIsBuilt()
  if (built !== showing) apply(built)
}

export function setupBar(): void {
  // Matched without regard to case. The scene lost an afternoon to an entity
  // called Ball that the code was looking for as ball, and a prop that quietly
  // fails to be found here would be a bar that never appears with nothing
  // anywhere saying why.
  const wanted = BAR.props.map((n) => n.toLowerCase())

  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    const i = wanted.indexOf(name.value.toLowerCase())
    if (i < 0) continue
    const gltf = GltfContainer.getOrNull(entity)
    props.push({
      entity,
      name: name.value,
      visibleMask: gltf?.visibleMeshesCollisionMask,
      invisibleMask: gltf?.invisibleMeshesCollisionMask
    })
  }

  // Hidden to begin with, whoever they are. The ledger has not arrived yet at
  // this point, so blenderIsBuilt() is false for everybody including the
  // people who built it — they get their bar a moment later when the wallet
  // lands, which is the right way round. Starting it visible would show a bar
  // to everyone for a second and take it away from most of them.
  apply(false)
  engine.addSystem(barSystem)

  const found = props.map((p) => p.name)
  const missing = BAR.props.filter((n) => !found.some((f) => f.toLowerCase() === n.toLowerCase()))
  console.log(`[golf] bar: ${found.length} of ${BAR.props.length} props found (${found.join(', ')})`)
  if (missing.length > 0) {
    console.log(`[golf] bar: NOT FOUND in the scene — ${missing.join(', ')}. Check the names in Creator Hub.`)
  }
}

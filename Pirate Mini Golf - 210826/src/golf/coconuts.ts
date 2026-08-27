import {
  ColliderLayer,
  engine,
  Entity,
  GltfContainer,
  InputAction,
  MeshCollider,
  pointerEventsSystem,
  Transform,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { COCONUTS, PICKUP_SOUND } from './config'
import { room } from './room'
import { play } from './sfx'

/**
 * Fallen coconuts, under the palms.
 *
 * Deliberately the same machine as the shells, down to the three-entity split
 * and the fire-and-forget message, because the two are the same problem: a
 * thing on the ground that one player takes and the server counts. Where they
 * differ is the map. Shells are strewn along open beach and read as scenery
 * you happen to walk through; coconuts only exist in rings around six palms,
 * so finding them means going and standing under a tree.
 *
 * Every player sees their own. Nothing here is shared or synced — two people
 * under the same palm both find it full, and neither can take one out from
 * under the other. A shared set would mean whoever arrived first cleared it
 * and everyone after found bare sand, which is a worse scene than one that is
 * slightly untrue about which coconut is which.
 *
 * What is shared is the count, and that lives on the server. Picking one up
 * sends a message and nothing else — no total, no position, no claim about how
 * many are held.
 */

type Spot = {
  /** Unscaled anchor. Position and rotation only. */
  entity: Entity
  /** Draws the coconut. Carries no collider of any kind. */
  model: Entity
  /** Takes the click. A plain box, invisible, pointer-only. */
  hit: Entity
  /** Index into COCONUTS.spots, or -1 while this one is waiting to come back. */
  at: number
  /** Seconds until it comes back. Zero while it is on the ground. */
  cooling: number
}

/** One entity per coconut on the ground, moved around rather than recreated. */
const nuts: Spot[] = []

/** Which spots are in use, so two never land on the same one. */
const taken = new Set<number>()

let carried = 0
let onPickUp: ((total: number) => void) | undefined

/** How many are being carried, as far as this client knows. */
export function coconutsCarried(): number {
  return carried
}

/** The server's count, once it answers. Overrides the local guess. */
export function setCoconutsCarried(n: number): void {
  carried = Math.max(0, n)
}

export function onCoconutPickedUp(callback: (total: number) => void): void {
  onPickUp = callback
}

// ---------------------------------------------------------------------------
// Placing
// ---------------------------------------------------------------------------

/** A spare spot, chosen at random. -1 when every one is occupied. */
function freeSpot(): number {
  const spare: number[] = []
  for (let i = 0; i < COCONUTS.spots.length; i++) if (!taken.has(i)) spare.push(i)
  if (spare.length === 0) return -1
  return spare[Math.floor(Math.random() * spare.length)]
}

function place(nut: Spot): void {
  const index = freeSpot()
  if (index < 0) return

  taken.add(index)
  nut.at = index
  nut.cooling = 0

  const spot = COCONUTS.spots[index]
  // Written into the existing Transform rather than replacing the component.
  // createOrReplace here would drop and remake the parent of two children
  // already hanging off it, which is a good way to lose them.
  const t = Transform.getMutable(nut.entity)
  // Half-buried, so it reads as having landed rather than been set down. The
  // model is 20cm and its origin is its centre, so a fifth of the scaled
  // height is about as much as sits in the sand.
  t.position = Vector3.create(spot.x, spot.y - 0.2 * COCONUTS.scale * 0.2, spot.z)
  // Turned at random, and tipped a little. One model on twenty-two spots would
  // otherwise be twenty-two identical objects in a row.
  t.rotation = Quaternion.fromEulerDegrees(
    (Math.random() - 0.5) * 40,
    Math.random() * 360,
    (Math.random() - 0.5) * 40
  )

  GltfContainer.createOrReplace(nut.model, {
    src: COCONUTS.models[Math.floor(Math.random() * COCONUTS.models.length)],
    // Both masks off, explicitly. A .glb arrives with whatever colliders it was
    // exported with, and a coconut you can walk into is a coconut people trip
    // over on the way to the tee.
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  VisibilityComponent.createOrReplace(nut.model, { visible: true })
}

function collect(nut: Spot): void {
  if (nut.at < 0) return

  // Read before the index is cleared — the sound wants to come from where the
  // thing was, and a moment later there is no longer a record of that.
  const spot = COCONUTS.spots[nut.at]

  taken.delete(nut.at)
  nut.at = -1
  nut.cooling = COCONUTS.respawnSeconds
  VisibilityComponent.createOrReplace(nut.model, { visible: false })
  // Out of reach as well as out of sight: an invisible collider still answers
  // a click, and one you cannot see that still pays would be a fine way to
  // collect without walking anywhere.
  Transform.getMutable(nut.entity).position = Vector3.create(0, -50, 0)

  // At the spot rather than on the player, so one you took by brushing past
  // comes from the side you brushed. Pitched a little differently every time:
  // a run along the beach is a dozen of these in twenty seconds, and a dozen
  // identical pings is a smoke alarm.
  play(
    'coconut',
    spot.x,
    spot.y,
    spot.z,
    PICKUP_SOUND.volume,
    1 + (Math.random() * 2 - 1) * PICKUP_SOUND.wobble
  )

  // Counted here so the number moves the instant it is picked up, then
  // corrected by the server's answer. It is a guess either way; being a
  // slightly early guess is what makes it feel responsive.
  carried++
  onPickUp?.(carried)
  void room.send('coconut', { one: 1 })
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

/**
 * Collects anything you walk over. The shells' twin — see shells.ts for why
 * the test is horizontal with a tall window, and why it takes one per frame.
 */
function walkOverSystem(): void {
  if (!COCONUTS.walkOver) return
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!player) return

  for (const nut of nuts) {
    if (nut.at < 0) continue
    const spot = COCONUTS.spots[nut.at]
    if (Math.abs(player.position.y - spot.y) > COCONUTS.walkOverHeight) continue
    const dx = player.position.x - spot.x
    const dz = player.position.z - spot.z
    if (dx * dx + dz * dz > COCONUTS.walkOverRadius * COCONUTS.walkOverRadius) continue
    collect(nut)
    return
  }
}

function respawnSystem(dt: number): void {
  walkOverSystem()
  for (const nut of nuts) {
    if (nut.at >= 0) continue
    nut.cooling -= dt
    if (nut.cooling <= 0) place(nut)
  }
}

export function setupCoconuts(): void {
  const wanted = Math.min(COCONUTS.onGround, COCONUTS.spots.length)
  if (COCONUTS.onGround > COCONUTS.spots.length) {
    console.log(
      `[golf] only ${COCONUTS.spots.length} coconut spots for ${COCONUTS.onGround} coconuts — showing ${wanted}`
    )
  }

  for (let i = 0; i < wanted; i++) {
    // Three entities, not one. The anchor is unscaled so the model and the
    // hitbox are each sized on their own terms — the click target wants to be
    // a comfortable size whatever the model happens to be.
    const entity = engine.addEntity()
    // Its own Transform first, before anything is parented to it. A child
    // pointed at an entity with no Transform yet has no hierarchy to join and
    // does not reliably get one later, which is the difference between palms
    // with coconuts under them and palms without.
    Transform.create(entity, { position: Vector3.create(0, -50, 0) })

    const model = engine.addEntity()
    Transform.create(model, {
      scale: Vector3.create(COCONUTS.scale, COCONUTS.scale, COCONUTS.scale),
      parent: entity
    })

    // A GltfContainer draws but does not take a raycast, and a coconut is a
    // small round thing in long grass. CL_POINTER makes the box clickable
    // without making it something you walk into.
    const hit = engine.addEntity()
    MeshCollider.setBox(hit, ColliderLayer.CL_POINTER)
    Transform.create(hit, {
      position: Vector3.create(0, COCONUTS.hitbox / 2, 0),
      scale: Vector3.create(COCONUTS.hitbox, COCONUTS.hitbox, COCONUTS.hitbox),
      parent: entity
    })

    const nut: Spot = { entity, model, hit, at: -1, cooling: 0 }
    nuts.push(nut)
    place(nut)

    pointerEventsSystem.onPointerDown(
      {
        entity: hit,
        opts: {
          button: InputAction.IA_PRIMARY,
          hoverText: 'Pick up the coconut',
          maxDistance: COCONUTS.reach
        }
      },
      () => collect(nut)
    )
  }

  engine.addSystem(respawnSystem)

  const out = nuts.filter((n) => n.at >= 0)
  console.log(
    `[golf] ${out.length} of ${wanted} coconuts placed across ${COCONUTS.spots.length} spots under the palms`
  )
  if (out.length > 0) {
    // The first few, so "are they spawning" is answerable by walking to a
    // coordinate rather than by circling six trees.
    const where = out
      .slice(0, 3)
      .map((n) => {
        const p = COCONUTS.spots[n.at]
        return `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`
      })
      .join('  ')
    console.log(`[golf] first coconuts at ${where}`)
  } else {
    console.log('[golf] COCONUTS: none were placed. COCONUTS.spots is empty or every spot was taken.')
  }
}

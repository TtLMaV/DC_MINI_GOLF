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

import { BONES, PICKUP_SOUND } from './config'
import { questIsRunning, report } from './quests'
import { play } from './sfx'

/**
 * Bones, in the cave and around the island, while Sally is asking about them.
 *
 * Built on the same bones as shells.ts — a pool of entities moved between a
 * longer list of spots, rather than entities created and destroyed — and the
 * comments there explain why that shape. Two things are different, and both
 * are the point of this file.
 *
 * ---------------------------------------------------------------------------
 * They come and go with the quest
 * ---------------------------------------------------------------------------
 * A bone exists only while BONES.questId is running. Take the quest and the
 * island has bones on it within a second; finish it, hand it in, or never take
 * it, and there is not a bone anywhere. Scenery that is always there says
 * nothing. Scenery that appears the day somebody asks you about it is the
 * quest telling you where to look, without a marker or an arrow.
 *
 * The check is a flag read once a second rather than every frame, because it
 * is a question about a quest rather than about the world and the answer
 * changes about twice in a session.
 *
 * ---------------------------------------------------------------------------
 * Finding one is the progress
 * ---------------------------------------------------------------------------
 * There is no carrying and no handing over. Picking a bone up reports it, the
 * quest counts it, and the count goes to the server on the message quest
 * progress already uses. Nothing new travels on the wire for this — no new
 * field on an existing message, and no new counter in the wallet — which after
 * today is a deliberate choice rather than a convenient one.
 *
 * Sally still has to be spoken to at the end. That is the existing complete
 * and claim path, unchanged.
 */

type Spot = {
  /** Unscaled anchor. Position and rotation only. */
  entity: Entity
  /** Draws the bone. Carries no collider of any kind. */
  model: Entity
  /** Takes the click. A plain box, invisible, pointer-only. */
  hit: Entity
  /** Index into BONES.spots, or -1 while this one is away. */
  at: number
  /** Seconds until it comes back. Zero while it is out. */
  cooling: number
}

const bones: Spot[] = []
const taken = new Set<number>()

/** Whether the quest is running, refreshed on a slow timer rather than read every frame. */
let running = false
let checkClock = 0

/** True once setupBones has built the pool, so the systems have something to do. */
let ready = false

// ---------------------------------------------------------------------------
// Placing
// ---------------------------------------------------------------------------

function freeSpot(): number {
  const spare: number[] = []
  for (let i = 0; i < BONES.spots.length; i++) if (!taken.has(i)) spare.push(i)
  if (spare.length === 0) return -1
  return spare[Math.floor(Math.random() * spare.length)]
}

function place(bone: Spot): void {
  const index = freeSpot()
  if (index < 0) return

  taken.add(index)
  bone.at = index
  bone.cooling = 0

  const spot = BONES.spots[index]
  // Written into the existing Transform rather than replacing the component:
  // createOrReplace would drop and remake the parent of two children already
  // hanging off it, which is a good way to lose them.
  const t = Transform.getMutable(bone.entity)
  t.position = Vector3.create(spot.x, spot.y, spot.z)
  // Turned at random, so two models over forty-odd spots do not read as a
  // repeating pattern from anywhere with a view down the beach.
  t.rotation = Quaternion.fromEulerDegrees(0, Math.random() * 360, 0)

  GltfContainer.createOrReplace(bone.model, {
    src: BONES.models[Math.floor(Math.random() * BONES.models.length)],
    // Both masks off, explicitly. A .glb brings whatever colliders it was
    // exported with, and a bone you cannot walk through is a bone that stops
    // a putt.
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  VisibilityComponent.createOrReplace(bone.model, { visible: true })
}

/** Takes one off the island, either because it was collected or because the quest ended. */
function withdraw(bone: Spot, cooling: number): void {
  if (bone.at >= 0) taken.delete(bone.at)
  bone.at = -1
  bone.cooling = cooling
  VisibilityComponent.createOrReplace(bone.model, { visible: false })
  // Out of reach as well as out of sight. An invisible collider still answers
  // a click, and one you cannot see that still counts would be a fine way to
  // finish the quest without walking anywhere.
  Transform.getMutable(bone.entity).position = Vector3.create(0, -50, 0)
}

function collect(bone: Spot): void {
  if (bone.at < 0 || !running) return

  // Read before the index is cleared: the sound wants to come from where the
  // thing was, and a moment later there is no record of that.
  const spot = BONES.spots[bone.at]
  withdraw(bone, BONES.respawnSeconds)

  play(
    'shell',
    spot.x,
    spot.y,
    spot.z,
    PICKUP_SOUND.volume,
    // Pitched down a little from the shell it borrows, and wobbled, so a bone
    // and a shell are not the same noise and neither is the same noise twice.
    0.82 + (Math.random() * 2 - 1) * PICKUP_SOUND.wobble
  )

  report({ kind: 'bone' })
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

/**
 * Collects anything you walk over.
 *
 * Horizontal distance with a wide vertical window rather than a plain 3D one:
 * the player transform sits at their feet, the cave floor is not flat, and a
 * sphere would refuse a bone you are standing right beside on a slope.
 *
 * One per frame, the same as the shells. Two inside one radius is possible and
 * taking both in a frame would put two quest reports on the wire back to back.
 */
function walkOverSystem(): void {
  if (!BONES.walkOver) return
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!player) return

  for (const bone of bones) {
    if (bone.at < 0) continue
    const spot = BONES.spots[bone.at]
    if (Math.abs(player.position.y - spot.y) > BONES.walkOverHeight) continue
    const dx = player.position.x - spot.x
    const dz = player.position.z - spot.z
    if (dx * dx + dz * dz > BONES.walkOverRadius * BONES.walkOverRadius) continue
    collect(bone)
    return
  }
}

function bonesSystem(dt: number): void {
  if (!ready) return

  // The quest question, once a second. It changes about twice in a session.
  checkClock -= dt
  if (checkClock <= 0) {
    checkClock = 1
    const now = questIsRunning(BONES.questId)
    if (now !== running) {
      running = now
      if (!running) for (const bone of bones) withdraw(bone, 0)
      // Coming back on is left to the respawn loop below, so they arrive over
      // the next frame rather than all inside this one.
      else for (const bone of bones) bone.cooling = 0
    }
  }

  if (!running) return

  walkOverSystem()
  for (const bone of bones) {
    if (bone.at >= 0) continue
    bone.cooling -= dt
    if (bone.cooling <= 0) place(bone)
  }
}

export function setupBones(): void {
  const wanted = Math.min(BONES.outAtOnce, BONES.spots.length)
  if (BONES.outAtOnce > BONES.spots.length) {
    console.log(
      `[golf] only ${BONES.spots.length} bone spots for ${BONES.outAtOnce} bones — showing ${wanted}`
    )
  }

  for (let i = 0; i < wanted; i++) {
    // Three entities rather than one, so the model and the click box are each
    // sized on their own terms instead of one inheriting the other's scale.
    const entity = engine.addEntity()
    // Its own Transform before anything is parented to it: a child pointed at
    // an entity with no Transform has no hierarchy to join, and does not
    // reliably get one when the parent acquires one later.
    Transform.create(entity, { position: Vector3.create(0, -50, 0) })

    const model = engine.addEntity()
    Transform.create(model, {
      scale: Vector3.create(BONES.scale, BONES.scale, BONES.scale),
      parent: entity
    })

    const hit = engine.addEntity()
    MeshCollider.setBox(hit, ColliderLayer.CL_POINTER)
    Transform.create(hit, {
      position: Vector3.create(0, BONES.hitbox / 2, 0),
      scale: Vector3.create(BONES.hitbox, BONES.hitbox, BONES.hitbox),
      parent: entity
    })

    const bone: Spot = { entity, model, hit, at: -1, cooling: 0 }
    bones.push(bone)

    pointerEventsSystem.onPointerDown(
      {
        entity: hit,
        opts: {
          button: InputAction.IA_PRIMARY,
          hoverText: 'Take the bone',
          maxDistance: BONES.reach
        }
      },
      () => collect(bone)
    )
  }

  ready = true
  engine.addSystem(bonesSystem)

  console.log(
    `[golf] ${wanted} bones built across ${BONES.spots.length} spots, ` +
      `waiting on quest "${BONES.questId}"`
  )
}

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

import { SHELLS, PICKUP_SOUND } from './config'
import { room } from './room'
import { play } from './sfx'

/**
 * Shells on the beach.
 *
 * Every player sees their own. Nothing about a shell is shared or synced: two
 * people on the sand at the same time both find a full beach, and neither can
 * take one out from under the other. A shared beach would mean whoever arrived
 * first cleared it and everyone after found nothing, which is a worse scene
 * than one that is slightly untrue about where the shells are.
 *
 * What *is* shared is the count, and that lives on the server. Picking one up
 * sends a message and nothing else — no total, no position, no claim about how
 * many are held. The server keeps the tally and rate-limits it, so the worst a
 * rewritten client can do is press the button as fast as the limit allows.
 *
 * ---------------------------------------------------------------------------
 * How a spot works
 * ---------------------------------------------------------------------------
 * There are more spots in config than shells on the beach. At any moment some
 * are occupied and the rest are spare, so a collected shell reappears somewhere
 * you are not standing — which is the difference between a beach to walk along
 * and a bush to farm.
 */

type Spot = {
  /** Unscaled anchor. Position and rotation only. */
  entity: Entity
  /** Draws the shell. Carries no collider of any kind. */
  model: Entity
  /** Takes the click. A plain box, invisible, pointer-only. */
  hit: Entity
  /** Index into SHELLS.spots, or -1 while this shell is waiting to reappear. */
  at: number
  /** Seconds until it comes back. Zero when it is out on the sand. */
  cooling: number
}

/** One entity per shell on the beach, moved around rather than recreated. */
const shells: Spot[] = []

/** Which spots are in use, so two shells never land on the same one. */
const taken = new Set<number>()

let carried = 0
let onPickUp: ((total: number) => void) | undefined

/** How many are being carried, as far as this client knows. */
export function shellsCarried(): number {
  return carried
}

/** The server's count, once it answers. Overrides the local guess. */
export function setShellsCarried(n: number): void {
  carried = Math.max(0, n)
}

export function onShellPickedUp(callback: (total: number) => void): void {
  onPickUp = callback
}

// ---------------------------------------------------------------------------
// Placing
// ---------------------------------------------------------------------------

/**
 * A spare spot, chosen at random.
 *
 * Returns -1 if every spot is occupied, which only happens if onBeach is set to
 * more than there are spots — worth not crashing over.
 */
function freeSpot(): number {
  const spare: number[] = []
  for (let i = 0; i < SHELLS.spots.length; i++) if (!taken.has(i)) spare.push(i)
  if (spare.length === 0) return -1
  return spare[Math.floor(Math.random() * spare.length)]
}

function place(shell: Spot): void {
  const index = freeSpot()
  if (index < 0) return

  taken.add(index)
  shell.at = index
  shell.cooling = 0

  // The test ring overrides where, and nothing else. Everything below — the
  // model, the scale, the hitbox, the pointer handler — runs exactly as it
  // does on the beach, so if a shell shows up here it proves the whole path
  // works and only the coordinates are wrong.
  const spot = SHELLS.testRing
    ? ringSpot(index)
    : SHELLS.spots[index]
  // Written into the existing Transform rather than replacing the component.
  // createOrReplace here would drop and remake the parent of two children that
  // are already hanging off it, which is a good way to lose them.
  const t = Transform.getMutable(shell.entity)
  t.position = Vector3.create(spot.x, spot.y, spot.z)
  // Turned at random. The same five models on thirty-nine spots would
  // otherwise read as a repeating pattern from anywhere with a view of the
  // beach.
  t.rotation = Quaternion.fromEulerDegrees(0, Math.random() * 360, 0)

  GltfContainer.createOrReplace(shell.model, {
    src: SHELLS.models[Math.floor(Math.random() * SHELLS.models.length)],
    // Both masks off, explicitly. A .glb brings whatever colliders it was
    // exported with, and these were exported with an entire hole's collider
    // in them — 95 metres of invisible wall per shell. That has been stripped
    // out of the models, but saying it here as well means a re-export cannot
    // quietly put it back.
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  VisibilityComponent.createOrReplace(shell.model, { visible: true })
}

/** Evenly spaced around the ring, by spot index so each shell gets its own. */
function ringSpot(index: number): { x: number; y: number; z: number } {
  const count = Math.max(1, Math.min(SHELLS.onBeach, SHELLS.spots.length))
  const angle = (index / count) * Math.PI * 2
  return {
    x: SHELLS.testRingAt.x + Math.cos(angle) * SHELLS.testRingRadius,
    y: SHELLS.testRingAt.y,
    z: SHELLS.testRingAt.z + Math.sin(angle) * SHELLS.testRingRadius
  }
}

function collect(shell: Spot): void {
  if (shell.at < 0) return

  // Read before the index is cleared — the sound wants to come from where the
  // thing was, and a moment later there is no longer a record of that.
  const spot = SHELLS.spots[shell.at]

  taken.delete(shell.at)
  shell.at = -1
  shell.cooling = SHELLS.respawnSeconds
  VisibilityComponent.createOrReplace(shell.model, { visible: false })
  // Out of reach as well as out of sight: an invisible collider still answers
  // a click, and one you cannot see that still pays would be a fine way to
  // collect without walking anywhere.
  Transform.getMutable(shell.entity).position = Vector3.create(0, -50, 0)

  // At the spot rather than on the player, so one you took by brushing past
  // comes from the side you brushed. Pitched a little differently every time:
  // a run along the beach is a dozen of these in twenty seconds, and a dozen
  // identical pings is a smoke alarm.
  play(
    'shell',
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
  void room.send('shell', { one: 1 })
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

/**
 * Collects anything you walk over.
 *
 * Runs alongside the click rather than instead of it. Clicking a 20cm object
 * is a fair ask with a mouse and an unfair one with a thumb, so on a phone
 * this is the only sane way to pick a shell up — but there is no reason to
 * take the click away from a desktop, where it still reaches four metres.
 *
 * Horizontal distance with a wide vertical window, not a plain 3D distance.
 * The player transform sits at their feet and the beach is not flat, so a
 * sphere would refuse a shell you are standing right beside on a slope.
 *
 * Collecting the first match and stopping is deliberate. Two shells inside the
 * same radius is possible where spots are 1.7m apart, and taking both in one
 * frame would put two messages on the wire inside the server's rate limit —
 * so the second would be dropped, the local count would drift above the real
 * one, and the next ledger would appear to take a shell away. One per frame is
 * still twenty a second; nobody will notice the queue.
 */
function walkOverSystem(): void {
  if (!SHELLS.walkOver) return
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!player) return

  for (const shell of shells) {
    if (shell.at < 0) continue
    const spot = SHELLS.spots[shell.at]
    if (Math.abs(player.position.y - spot.y) > SHELLS.walkOverHeight) continue
    const dx = player.position.x - spot.x
    const dz = player.position.z - spot.z
    if (dx * dx + dz * dz > SHELLS.walkOverRadius * SHELLS.walkOverRadius) continue
    collect(shell)
    return
  }
}

function respawnSystem(dt: number): void {
  walkOverSystem()
  for (const shell of shells) {
    if (shell.at >= 0) continue
    shell.cooling -= dt
    if (shell.cooling <= 0) place(shell)
  }
}

export function setupShells(): void {
  const wanted = Math.min(SHELLS.onBeach, SHELLS.spots.length)
  if (SHELLS.onBeach > SHELLS.spots.length) {
    console.log(
      `[golf] only ${SHELLS.spots.length} shell spots for ${SHELLS.onBeach} shells — showing ${wanted}`
    )
  }

  for (let i = 0; i < wanted; i++) {
    // Three entities, not one, and the split is what keeps the two jobs from
    // interfering. The anchor is unscaled, so the model and the hitbox are
    // each sized on their own terms rather than one inheriting the other's
    // scale — the shells are between 6cm and 27cm as modelled, and the box you
    // click wants to be the same size whichever of the five turns up.
    const entity = engine.addEntity()
    // Its own Transform first, before anything is parented to it. A child
    // pointed at an entity that has no Transform yet has no hierarchy to join,
    // and does not reliably get one when the parent acquires one later — which
    // is the difference between a beach full of shells and an empty one.
    Transform.create(entity, { position: Vector3.create(0, -50, 0) })

    const model = engine.addEntity()
    Transform.create(model, {
      scale: Vector3.create(SHELLS.scale, SHELLS.scale, SHELLS.scale),
      parent: entity
    })

    // A GltfContainer draws but does not take a raycast, and the shell models
    // are small and awkwardly shaped. A plain box is what you actually click,
    // and CL_POINTER makes it clickable without making it something you walk
    // into on the sand.
    const hit = engine.addEntity()
    MeshCollider.setBox(hit, ColliderLayer.CL_POINTER)
    Transform.create(hit, {
      position: Vector3.create(0, SHELLS.hitbox / 2, 0),
      scale: Vector3.create(SHELLS.hitbox, SHELLS.hitbox, SHELLS.hitbox),
      parent: entity
    })

    const shell: Spot = { entity, model, hit, at: -1, cooling: 0 }
    shells.push(shell)
    place(shell)

    pointerEventsSystem.onPointerDown(
      {
        entity: hit,
        opts: {
          button: InputAction.IA_PRIMARY,
          hoverText: 'Take the shell',
          maxDistance: SHELLS.reach
        }
      },
      () => collect(shell)
    )
  }

  engine.addSystem(respawnSystem)

  const out = shells.filter((s) => s.at >= 0)
  console.log(
    `[golf] ${out.length} of ${wanted} shells placed` +
      (SHELLS.testRing
        ? ` in the TEST RING at ${SHELLS.testRingAt.x}, ${SHELLS.testRingAt.y}, ${SHELLS.testRingAt.z}`
        : ` across ${SHELLS.spots.length} beach spots`)
  )
  if (out.length > 0) {
    // The first few, so "are they spawning" is answerable by walking to a
    // coordinate rather than by searching two beaches.
    const where = out
      .slice(0, 3)
      .map((s) => {
        const p = SHELLS.testRing ? ringSpot(s.at) : SHELLS.spots[s.at]
        return `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`
      })
      .join('  ')
    console.log(`[golf] first shells at ${where}`)
  } else {
    console.log('[golf] SHELLS: none were placed. SHELLS.spots is empty or every spot was taken.')
  }
}

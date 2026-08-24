import {
  ColliderLayer,
  engine,
  Entity,
  InputAction,
  Material,
  MeshCollider,
  MeshRenderer,
  pointerEventsSystem,
  TextShape,
  Transform
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { BOARD } from './config'
import { cupCentre, HOLES } from './course'
import { present, roster } from './net'

/**
 * The sign-up board by the first tee.
 *
 * Joining is deliberately an explicit act rather than something that happens to
 * you when you wander in. Decentraland scenes get passers-by, and a leaderboard
 * that fills with people who are cutting through on their way somewhere else is
 * noise — worse, under the group hole gate an accidental player would hold up
 * everyone else forever.
 *
 * The board holds no shared state of its own. Every client renders it from the
 * synced player rows, so there is nothing to contest and nothing to lose when
 * whoever put it up walks away.
 */

let panel: Entity | undefined
let title: Entity | undefined
let list: Entity | undefined
let onJoin: (() => void) | undefined
let joined = false
let where = Vector3.Zero()

/** Where the board ended up, so the game can offer E as a fallback nearby. */
export function boardPosition(): Vector3 {
  return where
}

export function boardTaken(): boolean {
  return joined
}

/** Fallback path: pressing E while stood near the board. */
export function requestJoin(): void {
  if (joined) return
  onJoin?.()
}

export function setupBoard(join: () => void): void {
  onJoin = join

  const hole = HOLES[0]
  const cup = cupCentre(hole)
  // Stand it just behind the tee, turned to face back down the hole so you read
  // it as you walk up rather than after you have gone past.
  const dx = hole.tee.x - cup.x
  const dz = hole.tee.z - cup.z
  const l = Math.sqrt(dx * dx + dz * dz) || 1
  const px = hole.tee.x + (dx / l) * BOARD.behindTee + BOARD.sideOffset * (dz / l)
  const pz = hole.tee.z + (dz / l) * BOARD.behindTee - BOARD.sideOffset * (dx / l)

  where = Vector3.create(px, hole.tee.y + BOARD.height, pz)
  console.log(`[golf] sign-up board at ${px.toFixed(2)}, ${(hole.tee.y + BOARD.height).toFixed(2)}, ${pz.toFixed(2)}`)

  panel = engine.addEntity()
  MeshRenderer.setBox(panel)
  // Without this the board is invisible to the pointer and E does nothing:
  // MeshRenderer only draws, it does not take raycasts. CL_POINTER makes it
  // clickable without also making it something you bump into.
  MeshCollider.setBox(panel, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(panel, {
    albedoColor: Color4.create(0.05, 0.07, 0.1, 0.92),
    emissiveColor: Color3.create(0.06, 0.09, 0.13),
    emissiveIntensity: 0.5,
    roughness: 0.9
  })
  Transform.create(panel, {
    position: Vector3.create(px, hole.tee.y + BOARD.height, pz),
    rotation: Quaternion.fromToRotation(Vector3.Forward(), Vector3.create(-dx / l, 0, -dz / l)),
    scale: Vector3.create(BOARD.width, BOARD.tall, 0.08)
  })

  title = engine.addEntity()
  Transform.create(title, {
    position: Vector3.create(0, BOARD.titleY, -0.6),
    // The panel is scaled, and children inherit that, so undo it or the text
    // comes out stretched to match the box.
    scale: Vector3.create(1 / BOARD.width, 1 / BOARD.tall, 1),
    parent: panel
  })
  TextShape.create(title, {
    text: 'PIRATE MINI GOLF',
    fontSize: 3,
    textColor: Color4.create(0.95, 0.78, 0.33, 1),
    outlineWidth: 0.15,
    outlineColor: Color3.Black()
  })

  list = engine.addEntity()
  Transform.create(list, {
    position: Vector3.create(0, -0.05, -0.6),
    scale: Vector3.create(1 / BOARD.width, 1 / BOARD.tall, 1),
    parent: panel
  })
  TextShape.create(list, {
    text: 'Nobody playing yet',
    fontSize: 2,
    textColor: Color4.create(0.9, 0.92, 0.96, 1),
    outlineWidth: 0.12,
    outlineColor: Color3.Black()
  })

  pointerEventsSystem.onPointerDown(
    {
      entity: panel,
      opts: { button: InputAction.IA_PRIMARY, hoverText: 'Join the round', maxDistance: BOARD.reach }
    },
    () => {
      if (joined) return
      onJoin?.()
    }
  )
}

/** Called once the local player is in, so the board stops offering. */
export function markJoined(): void {
  joined = true
  if (!panel) return
  pointerEventsSystem.removeOnPointerDown(panel)
}

/**
 * Called when the round ends and the player is back out on the practice green,
 * so the board offers again.
 *
 * The pointer handler has to be put back, not just the flag: markJoined took
 * it off the panel, and an entity with no handler has no hover text and does
 * not answer a click, however willing the flag is.
 */
export function markLeft(): void {
  joined = false
  if (!panel) return
  pointerEventsSystem.onPointerDown(
    {
      entity: panel,
      opts: { button: InputAction.IA_PRIMARY, hoverText: 'Join the round', maxDistance: BOARD.reach }
    },
    () => {
      if (joined) return
      onJoin?.()
    }
  )
}

let refresh = 0

export function updateBoard(dt: number): void {
  if (!list) return
  refresh -= dt
  if (refresh > 0) return
  refresh = BOARD.refreshInterval

  const playing = roster()
  const text = TextShape.getMutableOrNull(list)
  if (!text) return

  if (playing.length === 0) {
    const watching = present().length - 1
    text.text =
      (joined ? 'You are in. Walk to the tee.\n' : 'Press E to join\n') +
      (watching > 0 ? `${watching} ${watching === 1 ? 'person' : 'people'} nearby` : '')
    return
  }

  const lines = playing
    .slice(0, BOARD.maxNames)
    .map((p) => {
      const played = p.card.filter((s) => s >= 0).length
      const total = p.card.reduce((n, s) => (s >= 0 ? n + s : n), 0)
      return `${p.name}   thru ${played}   ${total}`
    })
    .join('\n')

  const more = playing.length > BOARD.maxNames ? `\n+${playing.length - BOARD.maxNames} more` : ''
  text.text = (joined ? '' : 'Press E to join\n\n') + lines + more
}

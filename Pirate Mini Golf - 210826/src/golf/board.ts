import {
  ColliderLayer,
  engine,
  Entity,
  InputAction,
  MeshCollider,
  pointerEventsSystem,
  TextShape,
  Transform
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { BOARD } from './config'
import { present, roster } from './net'

/**
 * The sign-up board by the first tee.
 *
 * The board itself is not ours — it is part of Decking.glb. This module only
 * paints lettering onto it and puts an invisible collider in front so it can be
 * clicked. It used to draw its own translucent box and work out where to stand
 * it from the first tee, which is why it ended up floating in front of the real
 * board with the title hanging off both ends. The spot now comes from the
 * 'Artwork Info' marker in Creator Hub, written into BOARD.position.
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
let hit: Entity | undefined
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

  const at = BOARD.position
  where = Vector3.create(at.x, at.y, at.z)
  console.log(`[golf] sign-up board at ${at.x}, ${at.y}, ${at.z} facing ${BOARD.facingDegrees}`)

  // An unscaled anchor at the marker. Everything else hangs off it at its own
  // size, which is why there is no inverse-scale on the text any more: the old
  // panel was a stretched box, children inherited the stretch, and every child
  // had to divide it back out.
  panel = engine.addEntity()
  Transform.create(panel, {
    position: Vector3.create(at.x, at.y, at.z),
    rotation: Quaternion.fromEulerDegrees(0, BOARD.facingDegrees, 0)
  })

  // The clickable area, invisible. MeshCollider takes the raycast; there is no
  // MeshRenderer because the board it sits on is the decking model now, and
  // drawing a box over it is the thing we are getting rid of. CL_POINTER makes
  // it clickable without also making it something you walk into.
  hit = engine.addEntity()
  MeshCollider.setBox(hit, ColliderLayer.CL_POINTER)
  Transform.create(hit, {
    position: Vector3.create(0, 0, -0.02),
    scale: Vector3.create(BOARD.width, BOARD.tall, 0.04),
    parent: panel
  })

  title = engine.addEntity()
  Transform.create(title, {
    position: Vector3.create(BOARD.textX, BOARD.titleY, BOARD.standoff),
    rotation: Quaternion.fromEulerDegrees(0, BOARD.textYaw, 0),
    parent: panel
  })
  TextShape.create(title, {
    text: 'PIRATE MINI GOLF',
    fontSize: BOARD.titleSize,
    // width and height are the box the text is *aligned* in. They do not scale
    // the lettering down to fit — nothing in SDK7 does — so the size that
    // stops the title running off the ends is BOARD.titleSize, worked out by
    // hand in config.ts. These two are here so centring has something to
    // centre against.
    width: BOARD.width,
    height: BOARD.tall,
    textWrapping: false,
    textColor: Color4.create(0.95, 0.78, 0.33, 1),
    outlineWidth: 0.15,
    outlineColor: Color3.Black()
  })

  list = engine.addEntity()
  Transform.create(list, {
    position: Vector3.create(BOARD.textX, BOARD.listY, BOARD.standoff),
    rotation: Quaternion.fromEulerDegrees(0, BOARD.textYaw, 0),
    parent: panel
  })
  TextShape.create(list, {
    text: 'Nobody playing yet',
    fontSize: BOARD.listSize,
    width: BOARD.width,
    height: BOARD.tall,
    textWrapping: false,
    textColor: Color4.create(0.9, 0.92, 0.96, 1),
    outlineWidth: 0.12,
    outlineColor: Color3.Black()
  })

  pointerEventsSystem.onPointerDown(
    {
      entity: hit,
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
  if (!hit) return
  pointerEventsSystem.removeOnPointerDown(hit)
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
  if (!hit) return
  pointerEventsSystem.onPointerDown(
    {
      entity: hit,
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

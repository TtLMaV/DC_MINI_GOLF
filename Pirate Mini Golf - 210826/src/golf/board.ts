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
import { t } from './strings'
import { present, roster } from './net'
import { onPhone } from './npc'

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
let prompt: Entity | undefined
let count: Entity | undefined
let putter: Entity | undefined
let onJoin: (() => void) | undefined
let joined = false
let where = Vector3.Zero()

/**
 * The join line, in the controls the player actually has.
 *
 * On a phone there is no E to press. There is a button down the right-hand
 * side wearing the scene's putter art, and the sign says so by wearing the
 * same picture: the letter comes out, the icon goes in, and the wording drops
 * to what is left. The leading spaces are the icon's seat — a TextShape holds
 * no pictures, so the only way to make room inside a centred line is to make
 * the line longer and leave the extra empty.
 */
const joinWords = () => t('sign.toJoin')

function joinLine(): string {
  if (!onPhone()) return t('sign.toJoinKey')
  return ' '.repeat(BOARD.joinIcon.pad) + joinWords()
}

/**
 * Show or hide the putter that stands in for E on a phone.
 *
 * Where it goes is worked out once, at setup, and never again: the prompt is a
 * single line at a fixed height now, so nothing that happens in the game can
 * move it. This used to compute a vertical offset from how many lines the sign
 * was printing, which is exactly the coupling that made a sign full of names
 * shift its own instructions about.
 *
 * The horizontal sum is still the padding: the line is centred as a whole, so
 * the empty half of it sits left of centre by half the wording, and the icon
 * goes in the middle of that.
 *
 * Hidden by scaling to nothing rather than by deleting and rebuilding. The
 * board refreshes twice a second and an entity churned at that rate for the
 * length of a round is a lot of work to avoid drawing one square.
 */
function showPutter(show: boolean): void {
  if (!putter) return
  const t = Transform.getMutableOrNull(putter)
  if (!t) return
  t.scale = show
    ? Vector3.create(BOARD.joinIcon.size, BOARD.joinIcon.size, 1)
    : Vector3.Zero()
}

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
    text: t('sign.title'),
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

  prompt = engine.addEntity()
  Transform.create(prompt, {
    position: Vector3.create(BOARD.textX, BOARD.promptY, BOARD.standoff),
    rotation: Quaternion.fromEulerDegrees(0, BOARD.textYaw, 0),
    parent: panel
  })
  TextShape.create(prompt, {
    text: joinLine(),
    fontSize: BOARD.promptSize,
    width: BOARD.width,
    height: BOARD.tall,
    textWrapping: false,
    textColor: Color4.create(0.9, 0.92, 0.96, 1),
    outlineWidth: 0.12,
    outlineColor: Color3.Black()
  })

  count = engine.addEntity()
  Transform.create(count, {
    position: Vector3.create(BOARD.textX, BOARD.countY, BOARD.standoff),
    rotation: Quaternion.fromEulerDegrees(0, BOARD.textYaw, 0),
    parent: panel
  })
  TextShape.create(count, {
    text: '',
    fontSize: BOARD.countSize,
    width: BOARD.width,
    height: BOARD.tall,
    textWrapping: false,
    textColor: Color4.create(0.78, 0.82, 0.88, 1),
    outlineWidth: 0.1,
    outlineColor: Color3.Black()
  })

  // The putter that stands in for E on a phone. Built on every platform and
  // left at zero scale on desktop, so there is one code path and no branch on
  // the platform at setup time — updateBoard is the only thing that decides
  // whether it is seen.
  putter = engine.addEntity()
  const icon = BOARD.joinIcon
  const chars = icon.pad + joinWords().length
  Transform.create(putter, {
    position: Vector3.create(
      BOARD.textX + (icon.pad / 2 - chars / 2) * icon.charWidth,
      BOARD.promptY,
      // A hair in front of the lettering, for the same reason the lettering
      // stands off the timber: two surfaces at one depth flicker.
      BOARD.standoff + 0.002
    ),
    rotation: Quaternion.fromEulerDegrees(0, BOARD.textYaw, 0),
    scale: Vector3.Zero(),
    parent: panel
  })
  MeshRenderer.setPlane(putter)
  // Unlit, so it reads at the same strength as the lettering beside it at any
  // time of day. alphaTest rather than blending: the art is a solid shape on
  // a clear background, and a cut-out needs no sorting.
  Material.setBasicMaterial(putter, {
    texture: Material.Texture.Common({ src: BOARD.joinIcon.src }),
    alphaTest: 0.5
  })

  pointerEventsSystem.onPointerDown(
    {
      entity: hit,
      opts: { button: InputAction.IA_PRIMARY, hoverText: t('sign.join'), maxDistance: BOARD.reach }
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
  // Straight away rather than on the next refresh. The board is what you are
  // looking at when you join, so half a second of a sign still asking you to
  // is half a second of wondering whether it took.
  showPutter(false)
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
      opts: { button: InputAction.IA_PRIMARY, hoverText: t('sign.join'), maxDistance: BOARD.reach }
    },
    () => {
      if (joined) return
      onJoin?.()
    }
  )
}

let refresh = 0

/**
 * A count, not a cast list.
 *
 * How many are on the course, and how many are stood about not playing. Names
 * and scores are the standings panel's job: it is on screen, it has room for
 * six rows and a place each, and it is legible from anywhere on the island
 * rather than only from in front of a 2.4 metre sign.
 *
 * Always one line, whatever the numbers are, which is the property that
 * matters. The sign cannot overflow because there is nothing on it that grows.
 */
function countLine(playing: number, watching: number): string {
  const out: string[] = []
  if (playing > 0) out.push(t('sign.playing', { n: playing }))
  if (watching > 0) out.push(t('sign.watching', { n: watching }))
  return out.join('   ·   ')
}

export function updateBoard(dt: number): void {
  if (!prompt || !count) return
  refresh -= dt
  if (refresh > 0) return
  refresh = BOARD.refreshInterval

  const playing = roster().length
  const watching = Math.max(0, present().length - playing - 1)

  const promptText = TextShape.getMutableOrNull(prompt)
  if (promptText) {
    promptText.text = joined ? t('sign.youAreIn') : joinLine()
  }

  const countText = TextShape.getMutableOrNull(count)
  if (countText) countText.text = countLine(playing, watching)

  showPutter(!joined && onPhone())
}

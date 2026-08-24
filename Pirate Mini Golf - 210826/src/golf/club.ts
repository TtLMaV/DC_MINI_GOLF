import {
  AvatarAnchorPointType,
  AvatarAttach,
  AvatarMask,
  engine,
  Entity,
  GltfContainer,
  Transform,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { triggerEmote } from '~system/RestrictedActions'
import { CLUB } from './config'

/**
 * The player's putter.
 *
 * There is one club, and it gets re-parented between two anchors, because no
 * single anchor does both jobs.
 *
 * The hand anchor looks right while walking — AvatarAttach hangs it off the
 * right hand bone so it moves with the arm. But AvatarAttach owns the transform
 * of the entity it is on, and the scene cannot read the resolved wrist angle
 * back, so the face cannot be squared and the swing cannot follow a known arc.
 *
 * The player anchor is the opposite: it does not track the hand, but every
 * degree of it is ours, so the club can address the ball square and swing
 * through an arc we control frame by frame.
 *
 * So: carried in the hand, swung off the player, swapped the moment you address
 * the ball. The swap is a re-parent rather than a second copy of the model
 * being shown and hidden — the previous version built two rigs and toggled
 * VisibilityComponent between them, and a GltfContainer created hidden does not
 * reliably come back, which is why the club vanished entirely.
 *
 *   handAnchor / playAnchor   the two places the club can hang from
 *   grip                      re-parented between them; how the club is held
 *   pivot                     all swing rotation, about the grip
 *   model                     the .glb and its model-space correction
 */

const MODEL = 'assets/scene/Golf/Pirate Putter.glb'

const v3 = (p: { x: number; y: number; z: number }) => Vector3.create(p.x, p.y, p.z)

export type Club = {
  handAnchor: Entity
  playAnchor: Entity
  grip: Entity
  pivot: Entity
  model: Entity
  /** Which anchor the grip is currently parented to. */
  held: 'hand' | 'play'
  strikeTimer: number
  strikePower: number
  /** Angle the club was at when the strike began, so the downswing starts there. */
  strikeFrom: number
  /** True while the avatar's own emote is driving the swing. */
  emoting: boolean
  visible: boolean
}

const STRIKE_TIME = CLUB.downswingTime + CLUB.followTime + CLUB.recoverTime

const HAND_GRIP_POS = v3(CLUB.gripOffset)
const HAND_GRIP_ROT = Quaternion.fromEulerDegrees(
  CLUB.gripRotation.x,
  CLUB.gripRotation.y,
  CLUB.gripRotation.z
)
const PLAY_GRIP_POS = Vector3.Zero()
const PLAY_GRIP_ROT = Quaternion.fromEulerDegrees(CLUB.address.tilt, CLUB.address.yaw, 0)

export function createClub(): Club {
  // Hand anchor. No avatarId: attaches to the local player.
  const handAnchor = engine.addEntity()
  if (CLUB.carryAnchor === 'hand') {
    AvatarAttach.create(handAnchor, { anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND })
  } else {
    Transform.create(handAnchor, {
      position: v3(CLUB.carry.position),
      rotation: Quaternion.fromEulerDegrees(CLUB.carry.tilt, CLUB.carry.yaw, 0),
      parent: engine.PlayerEntity
    })
  }

  // Player anchor, out in front at address height.
  const playAnchor = engine.addEntity()
  Transform.create(playAnchor, {
    position: v3(CLUB.address.position),
    parent: engine.PlayerEntity
  })

  const grip = engine.addEntity()
  Transform.create(grip, {
    position: CLUB.carryAnchor === 'hand' ? HAND_GRIP_POS : PLAY_GRIP_POS,
    rotation: CLUB.carryAnchor === 'hand' ? HAND_GRIP_ROT : PLAY_GRIP_ROT,
    scale: Vector3.create(CLUB.scale, CLUB.scale, CLUB.scale),
    parent: handAnchor
  })

  const pivot = engine.addEntity()
  Transform.create(pivot, { parent: grip })

  const model = engine.addEntity()
  Transform.create(model, {
    // The .glb models the face on -Z with the head extending along +X, so it
    // gets turned to face the way the player is looking.
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    parent: pivot
  })
  GltfContainer.create(model, { src: MODEL })
  // Created visible and left that way. Nothing hides the club during play.
  VisibilityComponent.create(model, { visible: true })

  return {
    handAnchor,
    playAnchor,
    grip,
    pivot,
    model,
    held: 'hand',
    strikeTimer: 0,
    strikePower: 0,
    strikeFrom: 0,
    emoting: false,
    visible: true
  }
}

/**
 * Swaps the club model.
 *
 * The entity and every anchor above it stay put — only the .glb changes — so
 * the grip, the swing and the emote carry on working without being rebuilt.
 * Every club in the catalogue currently points at the same putter, so this
 * does nothing visible yet; it is the line that will matter when the real art
 * lands.
 */
export function setClubModel(club: Club, src: string): void {
  const gltf = GltfContainer.getMutableOrNull(club.model)
  if (gltf && gltf.src !== src) gltf.src = src
}

export function setClubVisible(club: Club, visible: boolean): void {
  if (club.visible === visible) return
  club.visible = visible
  const v = VisibilityComponent.getMutableOrNull(club.model)
  if (v) v.visible = visible
}

/** Moves the club between the hand and the address position. */
function hold(club: Club, where: 'hand' | 'play'): void {
  if (club.held === where) return
  club.held = where

  const t = Transform.getMutableOrNull(club.grip)
  if (!t) return

  const toHand = where === 'hand'
  t.parent = toHand ? club.handAnchor : club.playAnchor

  // The carried grip offset only applies to the hand bone; on the player anchor
  // the address pose is already baked into the anchor's own position.
  const useHandPose = toHand && CLUB.carryAnchor === 'hand'
  const pos = useHandPose ? HAND_GRIP_POS : PLAY_GRIP_POS
  const rot = useHandPose
    ? HAND_GRIP_ROT
    : toHand
    ? Quaternion.fromEulerDegrees(CLUB.carry.tilt, CLUB.carry.yaw, 0)
    : PLAY_GRIP_ROT

  t.position = Vector3.create(pos.x, pos.y, pos.z)
  t.rotation = Quaternion.create(rot.x, rot.y, rot.z, rot.w)
}

/**
 * Called on release.
 *
 * With an emote configured, the avatar swings and the club rides its hand
 * through the motion — the emote is the animation, so the club stops being
 * driven and goes back to the fist to be carried along by it. The scene has no
 * way to pose an arm directly; the built-in emote list is the only handle on
 * avatar animation there is, and the upper-body mask keeps it from locking the
 * player's legs or yanking them back to a standing idle.
 *
 * With emotes off it falls back to the hand-authored club arc: downswing,
 * contact, follow-through, back to address, with the body left standing still.
 */
export function playStrike(club: Club, power: number): void {
  club.strikeTimer = STRIKE_TIME
  club.strikePower = Math.max(0.2, power)
  club.strikeFrom = backswingAngle(club.strikePower)

  if (CLUB.emote !== 'none') {
    club.emoting = true
    void triggerEmote({
      predefinedEmote: CLUB.emote,
      ...(CLUB.emoteUpperBodyOnly ? { mask: AvatarMask.AM_UPPER_BODY } : {})
    })
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Slow at the ends, quick through the middle. */
const smooth = (t: number) => t * t * (3 - 2 * t)

function backswingAngle(charge: number): number {
  return charge * (CLUB.backswingBase + charge * CLUB.backswingRange)
}

/**
 * `charge` is 0..1 and drives the backswing, so the club is literally showing
 * how hard the shot is going to be hit.
 */
export function updateClub(club: Club, dt: number, addressing: boolean, charge: number): void {
  // While the avatar is emoting, the club belongs in the fist so it travels
  // with the arm. Otherwise stay on the swinging anchor until the
  // follow-through has finished, so the club does not snap away mid-strike.
  const onPlayAnchor = club.emoting ? addressing : addressing || club.strikeTimer > 0
  hold(club, onPlayAnchor ? 'play' : 'hand')

  let swingDeg: number
  if (club.emoting) {
    // The emote owns the motion. Just relax the club back to neutral in the
    // fist and stop when the strike window is over.
    club.strikeTimer = Math.max(0, club.strikeTimer - dt)
    if (club.strikeTimer === 0) club.emoting = false
    swingDeg = 0
  } else if (club.strikeTimer > 0) {
    club.strikeTimer = Math.max(0, club.strikeTimer - dt)
    const elapsed = STRIKE_TIME - club.strikeTimer
    const through = CLUB.throughBase + club.strikePower * CLUB.throughRange

    if (elapsed < CLUB.downswingTime) {
      // Accelerating down out of the top of the backswing into the ball.
      const k = elapsed / CLUB.downswingTime
      swingDeg = lerp(club.strikeFrom, through, k * k)
    } else if (elapsed < CLUB.downswingTime + CLUB.followTime) {
      // Carrying on past the ball, slowing as it goes.
      const k = (elapsed - CLUB.downswingTime) / CLUB.followTime
      swingDeg = lerp(through, through * 1.2, smooth(k))
    } else {
      // Floating back to address.
      const k = Math.min(1, (elapsed - CLUB.downswingTime - CLUB.followTime) / CLUB.recoverTime)
      swingDeg = lerp(through * 1.2, 0, smooth(k))
    }
  } else {
    // Not swinging: the club sits back exactly as far as the meter is charged.
    swingDeg = club.held === 'play' ? backswingAngle(charge) : 0
  }

  const pivot = Transform.getMutableOrNull(club.pivot)
  if (pivot) pivot.rotation = Quaternion.fromEulerDegrees(swingDeg * CLUB.swingSign, 0, 0)
}

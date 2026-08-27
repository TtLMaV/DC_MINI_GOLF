import {
  AvatarShape,
  ColliderLayer,
  engine,
  Entity,
  InputAction,
  MainCamera,
  MeshCollider,
  pointerEventsSystem,
  Transform,
  VirtualCamera
} from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import { NPC_LOOK } from './config'
import { giveVoice, setupVoice, startTalking, stopTalking } from './voice'

/**
 * Characters you can talk to.
 *
 * They are AvatarShapes rather than modelled .glbs, so they are real
 * Decentraland avatars with wearables, skin and hair — no art needed and they
 * read as people rather than props.
 *
 * Talking goes through the pointer rather than a bare proximity check on E. E
 * is already the golf key, so a proximity trigger would have people addressing
 * the ball and starting a conversation with the same press. Requiring the
 * crosshair on them is the disambiguation, and it still reads as "walk up and
 * press E" because that is what the hover prompt says.
 *
 * AvatarShape has no collider of its own, which is what we want: nobody can
 * block a wayward putt. The clickable box is a separate entity parented to them
 * so it turns and moves when they do.
 *
 * Only one conversation runs at a time — `active` is the whole of that rule.
 */

export type DialogChoice = {
  label: string
  /** Node to jump to. Empty string closes the conversation. */
  goto: string
  /** Optional side effect, e.g. signing the player up for a round. */
  act?: () => void
}

export type DialogNode = {
  /**
   * What the character says.
   *
   * A function is evaluated every frame the node is on screen, which is the
   * only way a line can mention anything that changes. The dialog object is
   * built once when the character is created, so a plain template string is
   * baked in at start-up — the Quartermaster's score line used to report
   * whatever was true the moment the scene loaded, forever.
   */
  text: string | (() => string)
  /**
   * The replies. A function here lets choices come and go — a quest that can
   * be handed in only once it is done, say — without a node for every state.
   */
  choices: DialogChoice[] | (() => DialogChoice[])
}

/** Resolves a node's text, whether it is a string or a function. */
export function nodeText(node: DialogNode): string {
  return typeof node.text === 'function' ? node.text() : node.text
}

/** Resolves a node's choices, whether they are an array or a function. */
export function nodeChoices(node: DialogNode): DialogChoice[] {
  return typeof node.choices === 'function' ? node.choices() : node.choices
}

export type Dialog = Record<string, DialogNode>

export type NpcSpec = {
  id: string
  name: string
  position: { x: number; y: number; z: number }
  /** Facing when nobody is close enough to look at. */
  facingDegrees: number
  bodyShape: string
  wearables: string[]
  idleEmote: string
  idleEmoteInterval: number
  talkEmote: string
  talkEmoteInterval: number
  /**
   * How this character sounds.
   *
   * pitch: 1 is the clip as recorded. Below is bigger and slower, above is
   * smaller and quicker — pitch and speed are the same knob, so a low voice is
   * also an unhurried one.
   *
   * wobble: how far the pitch moves from clip to clip. This is what separates
   * a flat character from an animated one, and it does more work than the
   * pitch does: Shellman at 0.015 sounds like somebody reciting, Sally at 0.13
   * sounds like somebody who cannot get it out fast enough.
   *
   * gapMin/gapMax: the breath between clips. A character who barely pauses and
   * one who leaves half a second between every phrase read as different people
   * before you have noticed either of their pitches.
   */
  voice: {
    pitch: number
    wobble: number
    gapMin: number
    gapMax: number
  }
}

type Npc = {
  spec: NpcSpec
  avatar: Entity
  dialog: Dialog
  yaw: number
  emoteClock: number
  emoteStamp: number
  /**
   * Ended this conversation while still stood next to them.
   *
   * Without it, walking up opens the dialogue, closing it opens it again on the
   * very next frame, and you cannot get away from the poor man without running.
   * Cleared when you leave, so coming back starts a fresh conversation.
   */
  dismissed: boolean
}

const npcs: Npc[] = []

/** Whoever is currently being talked to, and which node is on screen. */
let active: Npc | null = null

/**
 * The camera that holds the view still. One, reused — creating one per
 * conversation would mean the explorer blending from a camera that no longer
 * exists when one ends.
 */
let convoCamera: Entity | undefined
let node: string | null = null

/**
 * Builds the conversation camera. Called once, before any character exists.
 */
export function setupNpcCamera(): void {
  if (!NPC_LOOK.camera.enabled) return
  convoCamera = engine.addEntity()
  Transform.create(convoCamera, { position: Vector3.Zero() })
}

export function createNpc(spec: NpcSpec, dialog: Dialog): void {
  if (!convoCamera) setupNpcCamera()
  const avatar = engine.addEntity()
  Transform.create(avatar, {
    position: Vector3.create(spec.position.x, spec.position.y, spec.position.z),
    rotation: Quaternion.fromEulerDegrees(0, spec.facingDegrees + NPC_LOOK.modelYawOffset, 0)
  })
  AvatarShape.create(avatar, {
    id: spec.id,
    name: spec.name,
    bodyShape: spec.bodyShape,
    wearables: spec.wearables,
    emotes: [],
    eyeColor: Color3.create(0.24, 0.18, 0.12),
    skinColor: Color3.create(0.76, 0.57, 0.42),
    hairColor: Color3.create(0.18, 0.13, 0.09),
    talking: false,
    expressionTriggerId: spec.idleEmote,
    expressionTriggerTimestamp: 0
  })

  setupVoice()
  giveVoice(spec.id, spec.position)

  const hitbox = engine.addEntity()
  MeshCollider.setBox(hitbox, ColliderLayer.CL_POINTER)
  Transform.create(hitbox, {
    position: Vector3.create(0, NPC_LOOK.hitboxHeight / 2, 0),
    scale: Vector3.create(NPC_LOOK.hitboxWidth, NPC_LOOK.hitboxHeight, NPC_LOOK.hitboxWidth),
    parent: avatar
  })

  const npc: Npc = {
    spec,
    avatar,
    dialog,
    yaw: spec.facingDegrees,
    emoteClock: 0,
    emoteStamp: 0,
    dismissed: false
  }
  npcs.push(npc)

  pointerEventsSystem.onPointerDown(
    {
      entity: hitbox,
      opts: {
        button: InputAction.IA_PRIMARY,
        hoverText: `Talk to ${spec.name}`,
        maxDistance: NPC_LOOK.reach
      }
    },
    () => {
      // Walking up already opens this. The click is only still here for the
      // case where somebody is stood just outside talkRange and reaches in —
      // and it must not restart a conversation that is already running, or a
      // stray click sends you back to the top of the tree.
      if (active !== npc) openWith(npc, 'start')
    }
  )
}

// --- conversation ----------------------------------------------------------

export function currentNode(): DialogNode | null {
  if (!active || !node) return null
  return active.dialog[node] ?? null
}

export function talking(): boolean {
  return active !== null && node !== null
}

export function speakerName(): string {
  return active?.spec.name ?? ''
}

/**
 * How far the player is from a given character, by id.
 *
 * Exported so things that are anchored to a character but are not the
 * conversation — Salt's shop, most obviously — can close themselves when you
 * walk off. The shop cannot rely on the dialogue for that: it is opened by a
 * choice that ends the conversation, so by the time you leave there is nothing
 * left to close.
 *
 * Infinity for an id that does not exist, so a caller that mistypes one gets
 * "far away" rather than "right here".
 */
export function distanceToNpc(id: string): number {
  const npc = npcs.find((n) => n.spec.id === id)
  if (!npc) return Number.POSITIVE_INFINITY
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!player) return Number.POSITIVE_INFINITY
  const dx = player.position.x - npc.spec.position.x
  const dz = player.position.z - npc.spec.position.z
  return Math.sqrt(dx * dx + dz * dz)
}

function openWith(npc: Npc, at: string): void {
  if (!npc.dialog[at]) return
  // Whoever was mid-sentence stops being mid-sentence. Walking from one
  // character straight to another otherwise leaves the first one burbling over
  // the top of the second.
  if (active && active !== npc) setTalking(active, false)
  active = npc
  node = at
  setTalking(npc, true)
  // Starts them talking and keeps them talking. startTalking silences whoever
  // was mid-clip first, so walking from one character straight to another does
  // not leave the first one burbling over the second.
  startTalking(npc.spec.id, npc.spec.voice)
  lockView()
}

/**
 * Holds the view still for the length of a conversation.
 *
 * Copies wherever the player's camera already is and parks a scene camera
 * there. No reframing, no look-at, no move — the picture simply stops
 * responding to the mouse until the conversation ends, so clicking through
 * options does not swing the view about.
 *
 * The rotation is copied as well as the position, which is what makes it a
 * freeze rather than a cut: without it the scene camera would adopt its own
 * default facing and the view would jump at exactly the moment it was supposed
 * to settle.
 */
function lockView(): void {
  if (!NPC_LOOK.camera.enabled || !convoCamera) return

  const from = Transform.getOrNull(engine.CameraEntity)
  if (!from) return

  Transform.createOrReplace(convoCamera, {
    position: Vector3.create(from.position.x, from.position.y, from.position.z),
    rotation: Quaternion.create(from.rotation.x, from.rotation.y, from.rotation.z, from.rotation.w)
  })

  VirtualCamera.createOrReplace(convoCamera, {
    defaultTransition: {
      transitionMode: { $case: 'time', time: NPC_LOOK.camera.transitionSeconds }
    }
  })

  MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: convoCamera })
}

/** Gives the view back to the player. */
function release(): void {
  if (!NPC_LOOK.camera.enabled) return
  // Cleared rather than removed: removing MainCamera outright has the explorer
  // cut instead of blending, and the transition is half of why this reads as a
  // conversation rather than a jump.
  MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: undefined })
}

export function close(): void {
  if (active) setTalking(active, false)
  stopTalking()
  active = null
  node = null
  release()
}

/**
 * Ends the conversation and does not let it restart until you walk away.
 *
 * What F does, and what choosing a parting line does. Plain close() is for
 * ending it because you have left — this one is for ending it on purpose while
 * still stood there.
 */
export function dismiss(): void {
  if (active) active.dismissed = true
  close()
}

/** Picks the nth choice on the current node. */
export function choose(index: number): void {
  const current = currentNode()
  if (!current || !active) return
  const choice = nodeChoices(current)[index]
  if (!choice) return
  const npc = active
  choice.act?.()
  // A choice with nowhere to go is a goodbye, so treat it as one: it has to
  // suppress the walk-up trigger too, or the parting line reopens the
  // conversation before it has finished closing.
  if (!choice.goto || !npc.dialog[choice.goto]) dismiss()
  // Deliberately does not touch the voice. They are already talking and go on
  // talking until you leave — clicking through four options is one
  // conversation, and restarting the clip at every click would make it stutter
  // rather than speak.
  else node = choice.goto
}

function setTalking(npc: Npc, on: boolean): void {
  const a = AvatarShape.getMutableOrNull(npc.avatar)
  if (a) a.talking = on
}

// --- per-frame -------------------------------------------------------------

/**
 * Turns each of them to look at whoever is nearby, and keeps their idle going.
 *
 * The turn is eased rather than snapped: a figure that instantly pivots to
 * track you reads as a security camera, not a person. Out of range they drift
 * back to their resting facing rather than staring at the spot someone left
 * from.
 *
 * Emotes do not loop on their own — the timestamp has to move for the explorer
 * to replay one — so nudging it on a slow timer is what keeps them alive rather
 * than frozen mid-pose.
 */
export function updateNpcs(dt: number): void {
  const player = Transform.getOrNull(engine.PlayerEntity)

  for (const npc of npcs) {
    let distance = Number.POSITIVE_INFINITY
    if (player) {
      const dx = player.position.x - npc.spec.position.x
      const dz = player.position.z - npc.spec.position.z
      distance = Math.sqrt(dx * dx + dz * dz)
    }

    const t = Transform.getMutableOrNull(npc.avatar)
    if (t && player && NPC_LOOK.turnToPlayer) {
      const dx = player.position.x - npc.spec.position.x
      const dz = player.position.z - npc.spec.position.z
      const near = distance <= NPC_LOOK.noticeRange
      const want = near ? (Math.atan2(dx, dz) * 180) / Math.PI : npc.spec.facingDegrees

      // Shortest way round, so nobody takes the long way to turn 10 degrees.
      let delta = ((want - npc.yaw + 540) % 360) - 180
      const step = NPC_LOOK.turnRate * dt
      if (Math.abs(delta) > step) delta = Math.sign(delta) * step
      npc.yaw = (npc.yaw + delta + 360) % 360
      t.rotation = Quaternion.fromEulerDegrees(0, npc.yaw + NPC_LOOK.modelYawOffset, 0)
    }

    // Walking up starts the conversation; walking off ends it.
    //
    // The two ranges are not the same number on purpose. One threshold would
    // open and close the dialogue every frame you drifted across it, and the
    // gap between them is what makes approaching and leaving distinct events
    // rather than one line you keep tripping over.
    if (distance <= NPC_LOOK.talkRange) {
      // active must be null rather than "not this one": walking past somebody
      // mid-conversation should not drag you out of the one you are having.
      if (!npc.dismissed && active === null) openWith(npc, 'start')
    } else if (distance > NPC_LOOK.leaveRange) {
      npc.dismissed = false
      if (active === npc) close()
    }

    npc.emoteClock -= dt
    if (npc.emoteClock > 0) continue
    const busy = active === npc && node !== null
    npc.emoteClock = busy ? npc.spec.talkEmoteInterval : npc.spec.idleEmoteInterval
    const a = AvatarShape.getMutableOrNull(npc.avatar)
    if (!a) continue
    npc.emoteStamp++
    a.expressionTriggerId = busy ? npc.spec.talkEmote : npc.spec.idleEmote
    a.expressionTriggerTimestamp = npc.emoteStamp
  }
}

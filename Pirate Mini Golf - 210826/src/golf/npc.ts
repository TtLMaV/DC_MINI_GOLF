import {
  AvatarShape,
  ColliderLayer,
  engine,
  Entity,
  InputAction,
  MeshCollider,
  pointerEventsSystem,
  Transform
} from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import { NPC_LOOK } from './config'

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
}

type Npc = {
  spec: NpcSpec
  avatar: Entity
  dialog: Dialog
  yaw: number
  emoteClock: number
  emoteStamp: number
}

const npcs: Npc[] = []

/** Whoever is currently being talked to, and which node is on screen. */
let active: Npc | null = null
let node: string | null = null

export function createNpc(spec: NpcSpec, dialog: Dialog): void {
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
    emoteStamp: 0
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
    () => openWith(npc, 'start')
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

function openWith(npc: Npc, at: string): void {
  if (!npc.dialog[at]) return
  if (active && active !== npc) setTalking(active, false)
  active = npc
  node = at
  setTalking(npc, true)
}

export function close(): void {
  if (active) setTalking(active, false)
  active = null
  node = null
}

/** Picks the nth choice on the current node. */
export function choose(index: number): void {
  const current = currentNode()
  if (!current || !active) return
  const choice = nodeChoices(current)[index]
  if (!choice) return
  choice.act?.()
  if (!choice.goto || !active.dialog[choice.goto]) close()
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
    const t = Transform.getMutableOrNull(npc.avatar)
    if (t && player && NPC_LOOK.turnToPlayer) {
      const dx = player.position.x - npc.spec.position.x
      const dz = player.position.z - npc.spec.position.z
      const near = Math.sqrt(dx * dx + dz * dz) <= NPC_LOOK.noticeRange
      const want = near ? (Math.atan2(dx, dz) * 180) / Math.PI : npc.spec.facingDegrees

      // Shortest way round, so nobody takes the long way to turn 10 degrees.
      let delta = ((want - npc.yaw + 540) % 360) - 180
      const step = NPC_LOOK.turnRate * dt
      if (Math.abs(delta) > step) delta = Math.sign(delta) * step
      npc.yaw = (npc.yaw + delta + 360) % 360
      t.rotation = Quaternion.fromEulerDegrees(0, npc.yaw + NPC_LOOK.modelYawOffset, 0)
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

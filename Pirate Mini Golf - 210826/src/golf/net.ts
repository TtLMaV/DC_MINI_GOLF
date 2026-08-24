import {
  Billboard,
  engine,
  Entity,
  Material,
  MeshRenderer,
  Schemas,
  TextShape,
  Transform
} from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'
import { isStateSyncronized, syncEntity } from '@dcl/sdk/network'
import { getPlayer, onLeaveScene } from '@dcl/sdk/players'
import { HOLES } from './course'
import { NET } from './config'

/**
 * Multiplayer, without a server.
 *
 * The whole design turns on one fact about mini golf: everybody plays their own
 * ball. There is no shared physics to agree on, so each client simulates only
 * its own ball and simply tells everyone else where it ended up. That sidesteps
 * the hard problem entirely — no lockstep, no rollback, no authority fights over
 * a contested simulation.
 *
 * So every player owns exactly one synced entity carrying their own state, and
 * is the only writer of it. Nobody hosts. There is no "scene owner" to elect and
 * nothing breaks when any particular person walks out; the leaderboard is just
 * everyone's own card read back and sorted. Decentraland's serverless sync does
 * not persist state once the last player leaves, which is fine here — a round is
 * only meaningful while there is someone playing it.
 */

export const GolfPlayer = engine.defineComponent('golf::player', {
  userId: Schemas.String,
  name: Schemas.String,
  /** Signed up at the board. Spectators walking through are not in the round. */
  joined: Schemas.Boolean,
  /** Which hole they are on now. */
  holeIndex: Schemas.Int,
  strokes: Schemas.Int,
  /** Score per hole, -1 until played. */
  card: Schemas.Array(Schemas.Int),
  /**
   * How many times they have been round the nine. Play is continuous, so
   * without this a player who laps the group would reset their card to all -1
   * and read as "has not finished this hole yet", stalling everyone behind.
   */
  round: Schemas.Int,
  /** Their ball, so everyone can watch everyone else's shots. */
  bx: Schemas.Float,
  by: Schemas.Float,
  bz: Schemas.Float
})

export type GolfPlayerState = {
  userId: string
  name: string
  joined: boolean
  holeIndex: number
  strokes: number
  card: number[]
  round: number
  bx: number
  by: number
  bz: number
}

let mine: Entity | undefined
let myId = ''
let myName = 'Player'

/** Anyone who has walked out. Their entity may linger for a moment. */
const departed = new Set<string>()

/** Locally-built visuals for other people's balls, keyed by their entity. */
const visuals = new Map<Entity, { ball: Entity; label: Entity }>()

/** Throttle on publishing ball position — see publishBall. */
let ballClock = 0

export function setupNet(): void {
  const p = getPlayer()
  myId = p?.userId ?? `local-${engine.RootEntity}`
  myName = p?.name ?? 'Player'

  mine = engine.addEntity()
  GolfPlayer.create(mine, {
    userId: myId,
    name: myName,
    joined: false,
    holeIndex: 0,
    strokes: 0,
    card: HOLES.map(() => -1),
    round: 0,
    bx: 0,
    by: -100,
    bz: 0
  })

  // No entityEnumId: this entity is created at runtime per player, so the
  // system assigns an id. Fixed ids are only needed for entities that exist at
  // scene load on every client, where a mismatch would cross the wires.
  syncEntity(mine, [GolfPlayer.componentId])

  onLeaveScene((userId) => departed.add(userId))
}

export function myUserId(): string {
  return myId
}

export function myDisplayName(): string {
  return myName
}

export function ready(): boolean {
  return isStateSyncronized()
}

/** My own row, writable. */
export function myRow() {
  return mine ? GolfPlayer.getMutableOrNull(mine) : null
}

/** Everyone signed up and still here, me included. */
export function roster(): GolfPlayerState[] {
  const out: GolfPlayerState[] = []
  for (const [, state] of engine.getEntitiesWith(GolfPlayer)) {
    if (!state.joined) continue
    if (departed.has(state.userId)) continue
    out.push(state as unknown as GolfPlayerState)
  }
  return out
}

/** Everyone at the board, whether signed up or not. */
export function present(): GolfPlayerState[] {
  const out: GolfPlayerState[] = []
  for (const [, state] of engine.getEntitiesWith(GolfPlayer)) {
    if (departed.has(state.userId)) continue
    out.push(state as unknown as GolfPlayerState)
  }
  return out
}


/**
 * Ball position, rate limited.
 *
 * Writing three floats every frame while the ball rolls is 60 CRDT updates a
 * second per player, and with a group on the course that is most of the
 * bandwidth budget spent on something nobody is looking at closely. A tenth of
 * a second is plenty when the receiving end interpolates, and a settled ball
 * stops publishing altogether.
 */
export function publishBall(dt: number, x: number, y: number, z: number, moving: boolean): void {
  const row = myRow()
  if (!row) return

  ballClock -= dt
  const moved =
    Math.abs(row.bx - x) > 0.01 || Math.abs(row.by - y) > 0.01 || Math.abs(row.bz - z) > 0.01
  if (!moved) return
  if (moving && ballClock > 0) return

  ballClock = NET.ballPublishInterval
  row.bx = x
  row.by = y
  row.bz = z
}

// ---------------------------------------------------------------------------
// Other people's balls
// ---------------------------------------------------------------------------

function makeVisual(name: string): { ball: Entity; label: Entity } {
  const ball = engine.addEntity()
  MeshRenderer.setSphere(ball)
  Material.setPbrMaterial(ball, {
    albedoColor: Color4.create(0.55, 0.78, 1, 1),
    emissiveColor: Color3.create(0.4, 0.66, 1),
    emissiveIntensity: 0.35,
    metallic: 0,
    roughness: 0.4
  })
  Transform.create(ball, {
    position: Vector3.create(0, -100, 0),
    scale: Vector3.create(NET.ballSize, NET.ballSize, NET.ballSize)
  })

  const label = engine.addEntity()
  Transform.create(label, { position: Vector3.create(0, NET.labelHeight, 0), parent: ball })
  TextShape.create(label, {
    text: name,
    fontSize: NET.labelSize,
    textColor: Color4.create(0.8, 0.9, 1, 1),
    outlineWidth: 0.2,
    outlineColor: Color3.Black()
  })
  Billboard.create(label)

  return { ball, label }
}

/**
 * Keeps a ball on screen for every other player, eased toward the last position
 * they published rather than snapped, so a tenth of a second between updates
 * reads as rolling instead of teleporting.
 */
export function updateRemotes(dt: number): void {
  const live = new Set<Entity>()

  for (const [entity, state] of engine.getEntitiesWith(GolfPlayer)) {
    if (state.userId === myId) continue
    if (departed.has(state.userId)) continue
    // Signed up or not: if someone is putting, you can see their ball.
    if (state.by < -50) continue
    live.add(entity)

    let vis = visuals.get(entity)
    if (!vis) {
      vis = makeVisual(state.name)
      visuals.set(entity, vis)
    }

    const t = Transform.getMutableOrNull(vis.ball)
    if (!t) continue
    const k = Math.min(1, dt * NET.smoothing)
    t.position.x += (state.bx - t.position.x) * k
    t.position.y += (state.by - t.position.y) * k
    t.position.z += (state.bz - t.position.z) * k
  }

  // Anyone who left, unjoined, or whose entity has gone.
  for (const [entity, vis] of visuals) {
    if (live.has(entity)) continue
    engine.removeEntity(vis.label)
    engine.removeEntity(vis.ball)
    visuals.delete(entity)
  }
}

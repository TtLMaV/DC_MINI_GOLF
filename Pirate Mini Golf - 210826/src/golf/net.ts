import {
  AvatarAnchorPointType,
  AvatarAttach,
  Billboard,
  engine,
  Entity,
  GltfContainer,
  Material,
  MeshRenderer,
  Schemas,
  TextShape,
  Transform,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { isStateSyncronized, syncEntity } from '@dcl/sdk/network'
import { getPlayer, onLeaveScene } from '@dcl/sdk/players'
import { HOLES } from './course'
import { CLUB, NET } from './config'
import { itemById } from './shop'
import { ballModelScale } from './ball'

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
  bz: Schemas.Float,
  /**
   * What they are holding, as catalogue ids.
   *
   * Ids rather than model paths, for the same reason the shop equips by id:
   * the mapping from an item to a .glb is the catalogue's business, and a path
   * on the wire would be a second copy of it, free to go stale the day an
   * asset is renamed. Empty until they have published, which is what the
   * fallbacks below are for.
   */
  ballId: Schemas.String,
  clubId: Schemas.String
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
  ballId: string
  clubId: string
}

let mine: Entity | undefined
let myId = ''
let myName = 'Player'

/** Anyone who has walked out. Their entity may linger for a moment. */
const departed = new Set<string>()

/**
 * Anyone whose row is still here but who is not.
 *
 * departed is fed by the explorer's leave event, which is reliable for a
 * player who walks out of the scene and is not reliable for one who closes the
 * tab or loses their connection. Their synced row stays behind either way, and
 * with it their ball — parked wherever it was when they went, on a green
 * somebody else is trying to putt on.
 *
 * So presence is checked as well as listened for. getPlayer answers whether
 * the explorer still knows about them, and a row whose owner has been
 * unanswered for NET.goneAfter seconds stops counting: no ball, no club, no
 * label, and off the sign-up board and the standings with it.
 *
 * Not permanent, which is the difference between this and departed. Somebody
 * who wandered off the parcels and comes back is simply present again and gets
 * their ball back. Marking them gone for good would punish walking to the
 * beach.
 */
const absent = new Set<string>()
const unseenFor = new Map<string, number>()

function stillHere(userId: string, dt: number): boolean {
  if (getPlayer({ userId }) !== null) {
    if (unseenFor.size > 0) unseenFor.delete(userId)
    absent.delete(userId)
    return true
  }

  const gone = (unseenFor.get(userId) ?? 0) + dt
  unseenFor.set(userId, gone)
  if (gone < NET.goneAfter) return true

  absent.add(userId)
  return false
}

/**
 * Locally-built visuals for other people, keyed by their entity.
 *
 * `ballId` and `clubId` are what is currently *drawn*, not what they are
 * holding. Kept so the models are only swapped when they actually change: a
 * GltfContainer whose src is rewritten reloads the asset, and rewriting it
 * every frame with the same string would reload it every frame.
 */
type Visual = {
  ball: Entity
  sphere: Entity
  model: Entity
  label: Entity
  club: Entity
  clubModel: Entity
  ballId: string
  clubId: string
}
const visuals = new Map<Entity, Visual>()

/** Throttle on publishing ball position — see publishBall. */
let ballClock = 0

/**
 * Whether the explorer has actually told us who this is yet.
 *
 * getPlayer() answers null until the profile has loaded, which is routinely
 * *after* the scene has started. Everything below used to be read once in
 * setupNet and kept forever, so a slow profile left the player permanently
 * called 'Player' with a made-up id — silently, because a fallback that works
 * looks exactly like a fallback that was never needed.
 *
 * That was harmless while nothing read the name. It stopped being harmless
 * when the leaderboard started sending it to the server, and it became a
 * visible fault when the test panel started checking it: 'Player' does not
 * match 'thepixelarcade', so the panel simply never opened.
 */
let identityKnown = false

/**
 * Takes the profile as soon as there is one, and keeps the synced entity in
 * step.
 *
 * Runs every frame only until it succeeds, then takes itself off the engine.
 * The name and id are also re-read lazily by the getters below, so a caller
 * that asks early and a caller that asks late get the same answer.
 */
function identitySystem(): void {
  if (identityKnown) {
    engine.removeSystem(identitySystem)
    return
  }
  const p = getPlayer()
  if (!p || !p.userId) return

  myId = p.userId
  if (p.name) myName = p.name
  identityKnown = true

  if (mine) {
    const row = GolfPlayer.getMutableOrNull(mine)
    if (row) {
      row.userId = myId
      row.name = myName
    }
  }
  console.log(`[golf] identity resolved: ${myName} (${myId})`)
  engine.removeSystem(identitySystem)
}

export function setupNet(): void {
  const p = getPlayer()
  myId = p?.userId ?? `local-${engine.RootEntity}`
  myName = p?.name ?? 'Player'
  identityKnown = !!p?.userId

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
    bz: 0,
    ballId: '',
    clubId: ''
  })

  // No entityEnumId: this entity is created at runtime per player, so the
  // system assigns an id. Fixed ids are only needed for entities that exist at
  // scene load on every client, where a mismatch would cross the wires.
  syncEntity(mine, [GolfPlayer.componentId])

  onLeaveScene((userId) => departed.add(userId))

  // Only if the profile was not ready at start-up, which is the common case.
  if (!identityKnown) engine.addSystem(identitySystem)
}

export function myUserId(): string {
  if (!identityKnown) identitySystem()
  return myId
}

export function myDisplayName(): string {
  if (!identityKnown) identitySystem()
  return myName
}

/** True once the explorer has actually said who this is. */
export function identityReady(): boolean {
  return identityKnown
}

/**
 * Whether the player is the person named.
 *
 * Comparing Decentraland names is not string equality. A claimed name shows as
 * "thepixelarcade"; an unclaimed one carries a four-digit tag —
 * "thepixelarcade#1a2b" — and the same person can appear either way depending
 * on what they are wearing and whether the claim has gone through. Case is not
 * dependable either. So the tag is cut, both sides are lower-cased, and only
 * then are they compared.
 *
 * Worth saying out loud: a name is not proof of anything. The client reports
 * its own, so this is a convenience for deciding what to *draw*, never a
 * permission. Anything that costs or mints Pixel Points is checked on the
 * server against a wallet, which is the only identity here that cannot be
 * typed in.
 */
export function nameMatches(want: string): boolean {
  const strip = (n: string) => n.trim().toLowerCase().replace(/#[0-9a-f]{4}$/i, '')
  return strip(want) !== '' && strip(want) === strip(myName)
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
    if (departed.has(state.userId) || absent.has(state.userId)) continue
    out.push(state as unknown as GolfPlayerState)
  }
  return out
}

/** Everyone at the board, whether signed up or not. */
export function present(): GolfPlayerState[] {
  const out: GolfPlayerState[] = []
  for (const [, state] of engine.getEntitiesWith(GolfPlayer)) {
    if (departed.has(state.userId) || absent.has(state.userId)) continue
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

/**
 * What this player is holding, so everyone else can see it.
 *
 * Cheap and rare: two strings, written only when they change, which is a
 * handful of times in a session. Unlike the ball position there is nothing to
 * rate limit.
 */
export function publishGear(ballId: string, clubId: string): void {
  const row = myRow()
  if (!row) return
  if (row.ballId !== ballId) row.ballId = ballId
  if (row.clubId !== clubId) row.clubId = clubId
}

// ---------------------------------------------------------------------------
// Other people's balls and clubs
// ---------------------------------------------------------------------------

/** The .glb for a catalogue id, if there is one and it is the right kind. */
function modelFor(id: string, kind: 'ball' | 'club'): string {
  const item = id ? itemById(id) : undefined
  return item && item.kind === kind && item.model ? item.model : ''
}

function makeVisual(state: GolfPlayerState): Visual {
  // A holder at scale 1 that nothing but the position is written to, with the
  // parts hung off it. The sphere used to be the ball itself, which meant its
  // 0.2 scale was inherited by anything parented to it: a model hung there
  // would have come out a fifth of its size.
  const ball = engine.addEntity()
  Transform.create(ball, { position: Vector3.create(0, -100, 0) })

  // The fallback, and the only thing anybody saw before this. Still here for
  // the moment before a player has published what they are holding, and for
  // anyone running a build old enough not to publish it at all.
  const sphere = engine.addEntity()
  Transform.create(sphere, {
    scale: Vector3.create(NET.ballSize, NET.ballSize, NET.ballSize),
    parent: ball
  })
  MeshRenderer.setSphere(sphere)
  Material.setPbrMaterial(sphere, {
    albedoColor: Color4.create(0.55, 0.78, 1, 1),
    emissiveColor: Color3.create(0.4, 0.66, 1),
    emissiveIntensity: 0.35,
    metallic: 0,
    roughness: 0.4
  })
  VisibilityComponent.create(sphere, { visible: true })

  const scale = ballModelScale()
  const model = engine.addEntity()
  Transform.create(model, {
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: Vector3.create(scale, scale, scale),
    parent: ball
  })

  const label = engine.addEntity()
  Transform.create(label, { position: Vector3.create(0, NET.labelHeight, 0), parent: ball })
  TextShape.create(label, {
    text: state.name,
    fontSize: NET.labelSize,
    textColor: Color4.create(0.8, 0.9, 1, 1),
    outlineWidth: 0.2,
    outlineColor: Color3.Black()
  })
  Billboard.create(label)

  // Their club, hung off their own right hand rather than off the ball.
  //
  // avatarId is the whole trick: without it AvatarAttach binds to the local
  // player, which is how the local club works and would have put every other
  // player's club in your own fist. The grip offsets are the same ones the
  // local club is carried at, so a club looks the same in anybody's hand.
  const club = engine.addEntity()
  AvatarAttach.create(club, {
    avatarId: state.userId,
    anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND
  })

  const grip = engine.addEntity()
  Transform.create(grip, {
    position: Vector3.create(CLUB.gripOffset.x, CLUB.gripOffset.y, CLUB.gripOffset.z),
    rotation: Quaternion.fromEulerDegrees(
      CLUB.gripRotation.x,
      CLUB.gripRotation.y,
      CLUB.gripRotation.z
    ),
    scale: Vector3.create(CLUB.scale, CLUB.scale, CLUB.scale),
    parent: club
  })

  const clubModel = engine.addEntity()
  Transform.create(clubModel, {
    // The .glb models the face on -Z, same correction the local club makes.
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    parent: grip
  })

  const vis: Visual = { ball, sphere, model, label, club, clubModel, ballId: '', clubId: '' }
  dressVisual(vis, state)
  return vis
}

/**
 * Puts the right models on a visual, and does nothing when they are already
 * right.
 *
 * Setting a GltfContainer's src is an asset load, so this is guarded on the
 * id rather than called blindly every frame.
 */
function dressVisual(vis: Visual, state: GolfPlayerState): void {
  if (vis.ballId !== state.ballId) {
    vis.ballId = state.ballId
    const src = modelFor(state.ballId, 'ball')
    if (src) {
      const gltf = GltfContainer.getMutableOrNull(vis.model)
      if (gltf) gltf.src = src
      else GltfContainer.create(vis.model, { src })
    }
    // The sphere stands in until there is a model, and steps aside once there
    // is one. It is never removed, so an unknown id later on still has
    // something to show rather than an invisible ball rolling about.
    const v = VisibilityComponent.getMutableOrNull(vis.sphere)
    if (v) v.visible = src === ''
  }

  if (vis.clubId !== state.clubId) {
    vis.clubId = state.clubId
    const src = modelFor(state.clubId, 'club')
    const gltf = GltfContainer.getMutableOrNull(vis.clubModel)
    if (src) {
      if (gltf) gltf.src = src
      else GltfContainer.create(vis.clubModel, { src })
    } else if (gltf) {
      // Nothing published yet: better an empty hand than the wrong club.
      GltfContainer.deleteFrom(vis.clubModel)
    }
  }
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
    // Checked here rather than in a system of its own, because this is the
    // one place that runs every frame and already has dt in its hand.
    if (!stillHere(state.userId, dt)) continue
    // Signed up or not: if someone is putting, you can see their ball.
    if (state.by < -50) continue
    live.add(entity)

    let vis = visuals.get(entity)
    if (!vis) {
      vis = makeVisual(state as unknown as GolfPlayerState)
      visuals.set(entity, vis)
    } else {
      dressVisual(vis, state as unknown as GolfPlayerState)
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
    engine.removeEntity(vis.clubModel)
    engine.removeEntity(vis.club)
    engine.removeEntity(vis.label)
    engine.removeEntity(vis.model)
    engine.removeEntity(vis.sphere)
    engine.removeEntity(vis.ball)
    visuals.delete(entity)
  }
}

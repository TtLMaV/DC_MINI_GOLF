import {
  AudioSource,
  AvatarAnchorPointType,
  AvatarAttach,
  ColliderLayer,
  engine,
  Entity,
  GltfContainer,
  Transform,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { DETECTOR } from './config'
import { room } from './room'

/**
 * Sally's metal detector.
 *
 * Hot and cold. Carry it, walk the cave floor, and it clicks — slowly when
 * there is something within range, quickly when you are stood over it. Nothing
 * is marked and nothing glows: the finds are at fixed spots and the only way to
 * locate one is to sweep until the clicks tighten up. That is the entire reason
 * to hand somebody a detector rather than a map.
 *
 * ---------------------------------------------------------------------------
 * What is and is not trusted
 * ---------------------------------------------------------------------------
 * Same arrangement as the shells. Which sites are dug is client-side, so every
 * player has their own cave and nobody can strip it before you arrive. The
 * scrap you are carrying is not: digging sends "one more" and the server keeps
 * the tally, rate-limited against how fast a person could walk between sites.
 * It cannot know the dig was real; it can know that six in a second was not.
 */

type Site = {
  /** Index into DETECTOR.spots, or -1 for the motor, which has its own spot. */
  at: number
  /**
   * The one-off motor rather than an ordinary piece of scrap.
   *
   * It is the same buried object with the same sweep and the same dig — the
   * only differences are that its position is drawn at random from
   * DETECTOR.motorSpots rather than fixed, that it is only in the ground while
   * Coconutty's quest is running, and that digging it reports a motor rather
   * than adding to the scrap count.
   */
  motor?: boolean
  /** Seconds until something washes back in. Zero while it holds a find. */
  cooling: number
  /** The buried thing itself. Sits under the floor until you get close. */
  piece?: Entity
  /** How far out of the ground it is, 0..1. Eased towards its target. */
  risen: number
  /** Its own turn, so fourteen pieces are not all facing the same way. */
  spin: number
}

const sites: Site[] = DETECTOR.spots.map((_, i) => ({
  at: i,
  cooling: 0,
  risen: 0,
  spin: Math.random() * 360
}))

// The motor, on the end of the same list so the sweep, the reveal and the dig
// all treat it as one more site rather than as a second mechanism.
sites.push({ at: -1, motor: true, cooling: 0, risen: 0, spin: Math.random() * 360 })

/**
 * Where the motor is this time.
 *
 * Chosen once, the first time somebody is actually looking for it, and then
 * left alone for the rest of the session. Choosing it at startup would mean
 * rolling for a thing nobody is hunting; re-rolling it while the quest is
 * running would mean the motor moving out from under a player mid-sweep, which
 * is not a hunt, it is a joke at their expense.
 *
 * Random rather than fixed so the answer cannot be looked up or passed on. It
 * is a per-session choice rather than a per-wallet one — logging out and back
 * in re-rolls it — which is fine: it is still one motor in one place for as
 * long as anybody is stood in the cave sweeping for it.
 */
let motorAt: { x: number; y: number; z: number } | undefined

/** Somewhere harmless to park the motor's model until it has a real spot. */
function caveMiddle(): { x: number; y: number; z: number } {
  const c = DETECTOR.cave
  return { x: (c.minX + c.maxX) / 2, y: -20, z: (c.minZ + c.maxZ) / 2 }
}

function motorSpot(): { x: number; y: number; z: number } {
  if (!motorAt) {
    motorAt = DETECTOR.motorSpots[Math.floor(Math.random() * DETECTOR.motorSpots.length)]
    console.log(
      `[golf] the old motor is at (${motorAt.x}, ${motorAt.y}, ${motorAt.z}) this session`
    )
  }
  return motorAt
}

/**
 * Whether the motor should be in the ground at all.
 *
 * Asked rather than told, and asked from outside this module, because the
 * answer belongs to the quest engine and the ledger — this file has no
 * business importing either. Until something answers, it is not there.
 */
let motorWanted: (() => boolean) | undefined
let onMotorDug: (() => void) | undefined

export function whenMotorWanted(test: () => boolean, dug: () => void): void {
  motorWanted = test
  onMotorDug = dug
}

let carrying = false
/**
 * Put away or out. Only meaningful once you have one.
 *
 * Starts stowed. Sally hands it over outside the cave in the ordinary run of
 * things, and a detector that arrives already clicking in your hand while you
 * are trying to talk to her is a worse introduction than one you have to draw.
 */
let out = false
let scrap = 0
let ping: Entity | undefined
let pingClock = 0
/** The thing in your hand. Hidden rather than destroyed when stowed. */
let model: Entity | undefined

/** Whether the player was in the cave last frame, for edge detection. */
let wasInCave = false

/** 0 when nothing is in range, 1 when stood on top of a find. */
let heat = 0
/** Metres to the nearest undug site, or Infinity. */
let nearest = Number.POSITIVE_INFINITY

// ---------------------------------------------------------------------------
// What the HUD reads
// ---------------------------------------------------------------------------

export function hasDetector(): boolean {
  return carrying
}

/** In your hands and sweeping. Everything that reacts should read this. */
export function detectorIsOut(): boolean {
  return carrying && out
}

/** Sally hands it over. Nothing to own — you either have it or you do not. */
export function giveDetector(): void {
  carrying = true
  showModel(detectorIsOut())
}

export function detectorHeat(): number {
  return heat
}

export function detectorNearest(): number {
  return nearest
}

/** True when you are stood close enough to dig. */
export function overFind(): boolean {
  return detectorIsOut() && nearest <= DETECTOR.digRange
}

export function scrapCarried(): number {
  return scrap
}

/** The server's count, once it answers. Overrides the local guess. */
export function setScrapCarried(n: number): void {
  scrap = Math.max(0, n)
}

// ---------------------------------------------------------------------------
// Sweeping
// ---------------------------------------------------------------------------

/** Where a site is. The motor keeps its own spot rather than an index. */
function where(site: Site): { x: number; y: number; z: number } {
  return site.motor ? motorSpot() : DETECTOR.spots[site.at]
}

function distanceToSite(site: Site, from: { x: number; y: number; z: number }): number {
  const p = where(site)
  const dx = p.x - from.x
  const dz = p.z - from.z
  // Horizontal only. The cave floor steps up and down, and a find a metre below
  // your feet is still a find under your feet.
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Runs the detector: finds the nearest buried thing, and clicks about it.
 *
 * The click interval is interpolated between slowestPing and fastestPing by
 * how close you are — not stepped through bands. Bands would tell you which
 * ring you were in; a continuous rate tells you whether the last step helped,
 * which is what sweeping actually is.
 */
/** Inside the cave box. Flat — the floor steps about and height is not the test. */
export function inCave(at: { x: number; z: number }): boolean {
  const c = DETECTOR.cave
  return at.x >= c.minX && at.x <= c.maxX && at.z >= c.minZ && at.z <= c.maxZ
}

function sweep(dt: number): void {
  for (const site of sites) {
    if (site.cooling <= 0) continue
    site.cooling -= dt
  }

  // Coming and going, rather than being inside.
  //
  // Only the crossing changes anything, so somebody who stows it deliberately
  // while stood in the cave keeps it stowed — it does not fight them back out
  // every frame. It comes out again next time they walk in.
  const here = Transform.getOrNull(engine.PlayerEntity)
  if (here && carrying) {
    const now = inCave(here.position)
    if (now !== wasInCave) {
      wasInCave = now
      out = now
      showModel(detectorIsOut())
      onAuto?.(now)
    }
  }

  if (!detectorIsOut()) {
    heat = 0
    nearest = Number.POSITIVE_INFINITY
    // Everything sinks back when the detector goes away, so nothing is left
    // standing proud of the floor for somebody walking past without one.
    for (const site of sites) rise(site, 0, dt)
    return
  }

  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!player) return

  nearest = Number.POSITIVE_INFINITY
  for (const site of sites) {
    // The motor is in the ground only while somebody is looking for it. Before
    // the quest it does not exist, and after it is dug it does not come back —
    // otherwise the far end of the cave would click at people for no reason
    // for the rest of the scene's life.
    if (site.motor && !motorWanted?.()) {
      rise(site, 0, dt)
      continue
    }
    if (site.cooling > 0) {
      rise(site, 0, dt)
      continue
    }
    const d = distanceToSite(site, player.position)
    if (d < nearest) nearest = d

    // Out of the ground as you close the last few metres. Full height by the
    // time you are near enough to dig, so the thing you press E on is the
    // thing you can see rather than a patch of floor.
    const span = Math.max(0.01, DETECTOR.revealRange - DETECTOR.digRange)
    const want = Math.max(0, Math.min(1, (DETECTOR.revealRange - d) / span))
    rise(site, want, dt)
  }

  if (nearest > DETECTOR.senseRange) {
    heat = 0
    pingClock = 0
    return
  }

  heat = 1 - nearest / DETECTOR.senseRange

  const interval =
    DETECTOR.slowestPing + (DETECTOR.fastestPing - DETECTOR.slowestPing) * heat
  pingClock -= dt
  if (pingClock <= 0) {
    pingClock = interval
    click()
  }
}

/**
 * Eases a piece towards how far out of the ground it should be.
 *
 * Eased rather than set, because the distance changes as fast as you walk and
 * a piece pinned exactly to it jitters. A second-order approach also means it
 * keeps rising for a moment after you stop, which reads as the ground giving
 * it up rather than as a slider you are dragging.
 */
function rise(site: Site, want: number, dt: number): void {
  if (!site.piece) return

  const speed = 4
  site.risen += (want - site.risen) * Math.min(1, speed * dt)
  if (site.risen < 0.001) site.risen = 0

  const up = site.risen > 0.02
  VisibilityComponent.createOrReplace(site.piece, { visible: up })
  if (!up) return

  site.spin = (site.spin + DETECTOR.revealSpin * dt) % 360

  const spot = where(site)
  const t = Transform.getMutable(site.piece)
  t.position = Vector3.create(
    spot.x,
    spot.y - DETECTOR.buriedDepth * (1 - site.risen),
    spot.z
  )
  t.rotation = Quaternion.fromEulerDegrees(0, site.spin, 0)
}

function click(): void {
  if (!ping) return
  const a = AudioSource.getMutableOrNull(ping)
  if (!a) return
  // Restarting a playing clip needs the flag toggled, not just set — the
  // explorer replays on the transition, so a second click inside one clip is
  // otherwise swallowed and the fast end of the sweep goes silent.
  a.playing = false
  a.playing = true
  // Higher pitch as it closes, so the two cues agree with each other.
  a.pitch = 0.85 + heat * 0.9
}

// ---------------------------------------------------------------------------
// Digging
// ---------------------------------------------------------------------------

/**
 * Digs, if you are stood over something.
 *
 * Returns true when it dug, so the caller knows the key was used and the golf
 * swing should not also see it. Called from the game loop rather than owning
 * its own input, because E is the club and the two must not both answer.
 */
export function tryDig(): boolean {
  if (!overFind()) return false

  let best: Site | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!player) return false

  for (const site of sites) {
    if (site.cooling > 0) continue
    // Belt and braces. The sweep already refuses to notice a motor nobody is
    // looking for, so nearest can never be within reach of one — but this is
    // the function that hands things over, and it should not depend on another
    // function having been careful.
    if (site.motor && !motorWanted?.()) continue
    const d = distanceToSite(site, player.position)
    if (d < bestDistance) {
      bestDistance = d
      best = site
    }
  }
  if (!best || bestDistance > DETECTOR.digRange) return false

  // Gone the moment it is yours, rather than sinking back — sinking would read
  // as having missed it.
  best.risen = 0
  if (best.piece) VisibilityComponent.createOrReplace(best.piece, { visible: false })
  nearest = Number.POSITIVE_INFINITY
  heat = 0

  if (best.motor) {
    // Never comes back, and never counts as scrap. The server checks that it
    // has not already been dug — this side only decides that it can be.
    best.cooling = Number.POSITIVE_INFINITY
    onMotorDug?.()
    void room.send('motor', { one: 1 })
    return true
  }

  best.cooling = DETECTOR.respawnSeconds
  scrap += DETECTOR.scrapPerFind
  void room.send('dig', { one: 1 })
  return true
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

/**
 * Shows or hides the detector in the hand.
 *
 * Hidden rather than removed: a GltfContainer created hidden does not always
 * come back cleanly, which is the same reason the club keeps its model around
 * and toggles visibility instead.
 */
function showModel(visible: boolean): void {
  if (!model) return
  VisibilityComponent.createOrReplace(model, { visible })
}

export function setupDetector(): void {
  // The click lives on its own entity parented to the player, so it follows you
  // and is not competing with the course sound effects for a channel.
  ping = engine.addEntity()
  Transform.create(ping, { parent: engine.PlayerEntity })
  AudioSource.create(ping, {
    audioClipUrl: 'assets/scene/Golf/sounds/putt.mp3',
    playing: false,
    loop: false,
    volume: 0.5
  })

  // Hung off the right hand, same anchor the club uses. No avatarId, so it
  // attaches to the local player.
  const hand = engine.addEntity()
  AvatarAttach.create(hand, { anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND })

  model = engine.addEntity()
  Transform.create(model, {
    position: Vector3.create(DETECTOR.gripOffset.x, DETECTOR.gripOffset.y, DETECTOR.gripOffset.z),
    rotation: Quaternion.fromEulerDegrees(DETECTOR.gripTilt, DETECTOR.gripYaw, 0),
    scale: Vector3.create(DETECTOR.scale, DETECTOR.scale, DETECTOR.scale),
    parent: hand
  })
  GltfContainer.create(model, { src: DETECTOR.model })
  // Nobody has one until Sally hands it over.
  VisibilityComponent.create(model, { visible: false })

  // One buried piece per site, created once and moved rather than spawned on
  // approach — a GltfContainer takes a moment to load the first time, and that
  // moment would land exactly as you were watching it come up.
  for (const site of sites) {
    // Parked well under the middle of the cave rather than at its real spot.
    // Asking where() here would force the motor's random choice at startup —
    // rolling for a thing nobody is hunting yet, and printing the answer in
    // the console on load. It is invisible until something brings it up, and
    // rise() writes its real position on the same frame it becomes visible.
    const spot = site.motor ? caveMiddle() : DETECTOR.spots[site.at]
    const piece = engine.addEntity()
    Transform.create(piece, {
      position: Vector3.create(spot.x, spot.y - DETECTOR.buriedDepth, spot.z),
      rotation: Quaternion.fromEulerDegrees(0, site.spin, 0),
      scale: site.motor
        ? Vector3.create(DETECTOR.motorScale, DETECTOR.motorScale, DETECTOR.motorScale)
        : Vector3.One()
    })
    GltfContainer.create(piece, {
      src: site.motor
        ? DETECTOR.motorModel
        : DETECTOR.scrapModels[Math.floor(Math.random() * DETECTOR.scrapModels.length)],
      // Nothing to walk into or bump the ball off. It is scenery that happens
      // to be worth something.
      visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
      invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
    })
    VisibilityComponent.create(piece, { visible: false })
    site.piece = piece
  }

  engine.addSystem(sweep)
  console.log(
    `[golf] metal detector ready, ${DETECTOR.spots.length} sites buried. ` +
      `The motor has ${DETECTOR.motorSpots.length} possible spots and is placed when somebody goes looking.`
  )
}

/**
 * Puts it away and back out again.
 *
 * Bound to 3 by the game layer. Worth having rather than leaving it always on:
 * the click is a nuisance while playing golf, and a detector should feel like a
 * thing you get out rather than something welded to your hand.
 */
let onAuto: ((out: boolean) => void) | undefined

/** Told when the cave puts it in or out of your hands, so the club can follow. */
export function onDetectorAuto(cb: (out: boolean) => void): void {
  onAuto = cb
}

export function toggleDetector(): boolean {
  if (!carrying) return false
  out = !out
  showModel(detectorIsOut())
  return out
}

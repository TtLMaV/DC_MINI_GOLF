import {
  engine,
  Transform,
  TransformType,
  Name,
  Entity,
  Material,
  MeshRenderer
} from '@dcl/sdk/ecs'
import { Color4, Vector3, Quaternion } from '@dcl/sdk/math'
import { isMobile, getPlatform } from '@dcl/sdk/platform'

// IMPORTANT: absolute path import — the bare "cannon-es" specifier does NOT
// resolve inside the SDK bundler. Also add this path to tsconfig "include".
import { isServer } from '@dcl/sdk/network'

import * as CANNON from 'cannon-es'
import { courseData } from './collisionData/course_collision'
import { barrelData } from './collisionData/barrel_collision'
import { wheelData } from './collisionData/wheel_collision'
import { rampData } from './collisionData/ramp_collision'
import { practiceData } from './collisionData/practice_collision'
import { boatData } from './collisionData/boat_collision'

import { ADMIN, AIM, BOAT } from './golf/config'
import { Game, Physics, curball } from './golf/game'
import { setupHud } from './golf/hud'
import { setupMusic } from './golf/music'
import { setupSfx } from './golf/sfx'
import { setBallModel, setBallSkin } from './golf/ball'
import { setupNet } from './golf/net'
import {
  motorIsFound,
  onCoconutsAccepted,
  onScrapAccepted,
  onShellsAccepted,
  setupPoints
} from './golf/points'
import { clubPower, DEFAULTS, itemById, onEquipChanged } from './golf/shop'
import { setClubModel } from './golf/club'
import { runLedger } from './golf/ledger'
import { seedQuests } from './golf/quests'
import { createNpc } from './golf/npc'
import { COCONUTS, COCONUTTY, POINTS, QUARTERMASTER, SALLY, SHELLMAN, SHELLS, SHOPKEEPER } from './golf/config'
import { quartermasterDialog } from './golf/quartermaster'
import { shopkeeperDialog } from './golf/shopkeeper'
import { shellmanDialog, shellsAccepted } from './golf/shellman'
import { sallyDialog, scrapAccepted } from './golf/sally'
import { onDetectorAuto, setupDetector } from './golf/detector'
import { setupShells } from './golf/shells'
import { setupCoconuts } from './golf/coconuts'
import { setupLeaderBoard } from './golf/leaderboard'
import { setupSkeletons } from './golf/skeletons'
import { coconuttyDialog, coconutsAccepted, motorDug } from './golf/coconutty'
import { setupDrink } from './golf/drink'
import { setupLevelUp } from './golf/levelup'
import { whenMotorWanted } from './golf/detector'
import { questStatus } from './golf/quests'
import { setupQuestBoard } from './golf/questboard'
import { setupBoard } from './golf/board'
import { setupSky } from './golf/sky'
import { RAMP_BOX, REST_Y as RAMP_REST_Y, rampHeight, rampRise, setupRamp, updateRamp } from './golf/ramp'
import { setupWater } from './golf/water'

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
const BALL_RADIUS = 0.1
const MAX_POWER = 25 // impulse magnitude at full charge
const REST_SPEED = 0.05 // below this speed the ball counts as "stopped"

// cannon-es has no built-in CCD, so a fast ball is only as good as how finely
// we step the simulation. A smaller fixed step (with a matching higher
// substep cap) means less distance — and less penetration variance — between
// collision checks, which is what was causing the inconsistent bounces.
// The ordinary step, used whenever the ball is going at a speed the original
// 1/120 could have handled anyway. Fast shots get a finer one, see stepFor().
const FIXED_TIME_STEP = 1 / 180
// A ceiling on substeps per frame rather than a target. At the finest step a
// 30fps frame asks for about 16, so this leaves room without ever being hit.
const MAX_SUBSTEPS = 40

/**
 * How far the ball is allowed to travel between collision checks.
 *
 * This is the number the whole speed question actually turns on. The ball has
 * a 10cm radius, and at 9.33cm per step it has never yet stepped clean through
 * a wall, so that figure is kept as the budget and everything else is derived
 * from it rather than guessed at.
 */
const STEP_TRAVEL = 0.0933
// Hard cap on ball speed. The strongest club in the catalogue lands exactly on
// this at full charge and nothing can go past it.
//
// This used to be the number that kept the ball inside the course, which is
// why it was 11.2. It is not any more: stepFor() below picks a step fine
// enough for whatever speed the ball is doing, so this is now a design
// decision about how hard the best club may hit rather than a physics limit.
// It is still worth being deliberate about, because a faster ball means more
// substeps per frame, and the scene is played on phones.
const MAX_BALL_SPEED = 28

/**
 * The ceiling while ADMIN.uncapBallSpeed is on. High enough that a club power
 * of 20 is felt in full, and low enough that nothing overflows. Nothing about
 * the simulation is trustworthy up here: at 224 m/s a 1/180s step moves the
 * ball 1.24m, twelve times its own radius, so it passes through the course
 * rather than bouncing off it.
 */
const UNSAFE_MAX_BALL_SPEED = 240

/**
 * Launch speed at full charge, holding the starting club.
 *
 * The ball has mass 1, so an impulse of MAX_POWER would leave at 25 m/s, but
 * clampBallSpeed caps everything. That cap was once doing the work of the
 * charge: anything past about a third of the bar produced an identical 8 m/s
 * shot, so two thirds of the meter did nothing at all. Mapping the charge onto
 * the speed the ball is actually allowed to leave at makes the whole bar live.
 *
 * This is deliberately a fixed number rather than the cap it used to be read
 * from. It is the Stick Club's full-charge shot, and it has to stay at 11.2 so
 * that the starting club plays exactly as it always has while the clubs above
 * it multiply past it. Read the cap here instead and every club in the game
 * silently gets stronger the next time MAX_BALL_SPEED moves.
 */
const BASE_LAUNCH_SPEED = 11.2

// ---------------------------------------------------------------------------
// Physics world
// ---------------------------------------------------------------------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })

const groundMat = new CANNON.Material('ground')
const ballMat = new CANNON.Material('ball')
// The moving ramp gets its own material so it can be made far less bouncy than
// the course. A lift the ball has to settle on wants to absorb impacts, not
// return them — at the course's 0.45 restitution the ball kicks off its edges.
const rampMat = new CANNON.Material('ramp')
world.addContactMaterial(
  new CANNON.ContactMaterial(groundMat, ballMat, {
    friction: 0.0,
    restitution: 0.45, // a little bounce, not a pinball
    contactEquationStiffness: 1e8, // stiffer contacts resolve penetration faster/more consistently
    contactEquationRelaxation: 3 // fewer "soft" frames of settling into the surface
  })
)

world.addContactMaterial(
  new CANNON.ContactMaterial(rampMat, ballMat, {
    friction: 0.0,
    restitution: 0.05, // deadens the seam rather than pinging the ball back
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  })
)

// Collision groups. The course keeps the default group; the ball gets its own
// purely so the aim guide's downward probes can be told to ignore it. Both keep
// the default "collide with everything" mask, so the simulation is unchanged.
const GROUP_COURSE = 1
const GROUP_BALL = 2

// ---------------------------------------------------------------------------
// State, resolved from the authored scene at startup
// ---------------------------------------------------------------------------
let ballEntity: Entity | undefined
let ballBody: CANNON.Body | undefined
let ballStart = new CANNON.Vec3(0, BALL_RADIUS, 0)

// Entity States For Moving Physics Obstacles
let barrelBody: CANNON.Body | undefined
let wheelBody: CANNON.Body | undefined
let rampBody: CANNON.Body | undefined
let boatBody: CANNON.Body | undefined
/** The authored local position of the boat, so the bob offsets it rather than replacing it. */
let boatHome: TransformType['position'] | undefined
let boatEntity: Entity | undefined
let boatClock = 0
let pathClock = 0
let lastLogged: { x: number; y: number; z: number } | undefined

/** Build static bodies from every entity named col_* and grab the ball. */
function buildWorldFromScene() {
  for (const [entity, name, transform] of engine.getEntitiesWith(Name, Transform)) {
    const n = name.value

    if (n === 'ball') {
      ballEntity = entity
      const p = transform.position
      ballStart = new CANNON.Vec3(p.x, p.y, p.z)
      continue
    }

    if (n.startsWith('col_')) {
      const s = transform.scale
      const r = transform.rotation
      const p = transform.position
      const body = new CANNON.Body({
        mass: 0, // static -> effectively free to simulate
        type: CANNON.Body.STATIC,
        material: groundMat,
        shape: new CANNON.Box(new CANNON.Vec3(s.x / 2, s.y / 2, s.z / 2)),
        position: new CANNON.Vec3(p.x, p.y, p.z),
        quaternion: new CANNON.Quaternion(r.x, r.y, r.z, r.w),
        collisionFilterGroup: GROUP_COURSE
      })
      world.addBody(body)
    }
  }

  //--------
  // Adding the custom physics from the imported collision data
  //--------

  const courseBody = new CANNON.Body({
    mass: 0, // Static environment
    type: CANNON.Body.STATIC,
    shape: new CANNON.Trimesh(courseData.vertices, courseData.indices),
    material: groundMat,
    collisionFilterGroup: GROUP_COURSE
  })
  courseBody.position.set(0, 0, 0)
  world.addBody(courseBody)

  // The practice green in the Shack. A separate body because it is a separate
  // export: course_collision.ts covers the nine holes only and stops at
  // x 3.05, so without this the practice ball falls through the green.
  //
  // Baked in play space, so like the course it sits at the origin.
  const practiceBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Trimesh(practiceData.vertices, practiceData.indices),
    material: groundMat,
    collisionFilterGroup: GROUP_COURSE
  })
  practiceBody.position.set(0, 0, 0)
  world.addBody(practiceBody)

  barrelBody = new CANNON.Body({
    mass: 0, // Static environment
    type: CANNON.Body.STATIC,
    shape: new CANNON.Trimesh(barrelData.vertices, barrelData.indices),
    material: groundMat,
    collisionFilterGroup: GROUP_COURSE
  })
  barrelBody.position.set(36, 2.91, 41.53)
  world.addBody(barrelBody)

  // Hole 7's boat. KINEMATIC like the ramp rather than STATIC, because it
  // moves — a static body that is teleported each frame imparts no velocity,
  // so a ball resting against it gets shoved rather than carried.
  boatBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC,
    shape: new CANNON.Trimesh(boatData.vertices, boatData.indices),
    material: groundMat,
    position: new CANNON.Vec3(BOAT.home.x, BOAT.home.y, BOAT.home.z),
    collisionFilterGroup: GROUP_COURSE
  })
  world.addBody(boatBody)

  wheelBody = new CANNON.Body({
    mass: 0, // Static environment
    type: CANNON.Body.STATIC,
    shape: new CANNON.Trimesh(wheelData.vertices, wheelData.indices),
    material: groundMat,
    collisionFilterGroup: GROUP_COURSE
  })
  wheelBody.position.set(5.26, 0.25, 72.24)
  world.addBody(wheelBody)

  // Hole 9's moving ramp. KINEMATIC rather than STATIC: a kinematic body can
  // carry a velocity, so the ball is lifted by a surface that is moving rather
  // than repeatedly teleported into, which is what makes it ride up cleanly.
  rampBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC,
    material: rampMat,
    // The real wedge, exported from the .glb's collider mesh, so the ball runs
    // down the slope it can see instead of sitting on a flat shelf.
    shape: new CANNON.Trimesh(rampData.vertices, rampData.indices),
    position: new CANNON.Vec3(RAMP_BOX.centreX, RAMP_REST_Y, RAMP_BOX.centreZ),
    collisionFilterGroup: GROUP_COURSE
  })
  world.addBody(rampBody)

  //--------
  // Adding the ball physics
  //--------

  if (ballEntity) {
    ballBody = new CANNON.Body({
      mass: 1,
      material: ballMat,
      shape: new CANNON.Sphere(BALL_RADIUS),
      position: ballStart.clone(),
      linearDamping: 0.5, // rolling resistance so the ball settles
      angularDamping: 0.8,
      collisionFilterGroup: GROUP_BALL
    })
    ballBody.allowSleep = true
    ballBody.sleepSpeedLimit = REST_SPEED
    ballBody.sleepTimeLimit = 0.3
    world.addBody(ballBody)
  }
}

/**
 * Paints the ball.
 *
 * A PBR material on the ball entity, not on the physics body — cannon has no
 * opinion about colour.
 *
 * The actual colours live in golf/ball.ts so the shop can repaint it without
 * importing this module, which would be circular.
 */
/**
 * Puts the starting club in their hand.
 *
 * The club's counterpart to paintBall, and it exists for exactly the same
 * reason that one does: onEquipChanged fires when the equipped item *changes*,
 * and the item everybody starts with never changes, so without this the club
 * keeps whatever .glb club.ts was written with. That was the Pirate Putter,
 * which is not even in the catalogue now.
 *
 * Read from the catalogue rather than named here, so the starting club is
 * DEFAULTS.club and nowhere else.
 */
function fitClub(game: Game): void {
  const club = itemById(DEFAULTS.club)
  if (!club?.model) {
    console.log(`[golf] no model for the starting club "${DEFAULTS.club}"`)
    return
  }
  setClubModel(game.club, club.model)
}

function paintBall(): void {
  // The catalogue's id, not a loose string. This said 'white' and the shop
  // renamed it 'ball-white' underneath it, so setBallSkin found nothing, gave
  // up, and the ball went unpainted from the moment the shop landed.
  setBallSkin(DEFAULTS.ball)
}

export function debugShowPhysBB(body: CANNON.Body): Entity {
  // 1. Force Cannon to calculate the AABB if it hasn't yet
  const aabb = body.aabb

  // 2. Calculate center position and size
  const width = aabb.upperBound.x - aabb.lowerBound.x
  const height = aabb.upperBound.y - aabb.lowerBound.y
  const depth = aabb.upperBound.z - aabb.lowerBound.z

  const centerX = body.position.x + (aabb.lowerBound.x + aabb.upperBound.x) / 2
  const centerY = body.position.y + (aabb.lowerBound.y + aabb.upperBound.y) / 2
  const centerZ = body.position.z + (aabb.lowerBound.z + aabb.upperBound.z) / 2

  // 3. Create Debug Box Entity in Decentraland
  const debugBox = engine.addEntity()

  MeshRenderer.setBox(debugBox)

  Transform.create(debugBox, {
    position: { x: centerX, y: centerY, z: centerZ },
    scale: { x: width, y: height, z: depth }
  })

  // 4. Make it semi-transparent red
  Material.setPbrMaterial(debugBox, {
    albedoColor: Color4.create(1, 0, 0, 0.3), // Red with 30% opacity
    transparencyMode: 2 // Alpha blend
  })

  return debugBox
}

/**
 * The physics step to run at, given how fast the ball is going.
 *
 * A fixed step has to be chosen for the worst case, and the worst case here is
 * rare: one club, at full charge, for the second or so before damping brings it
 * back down. Paying for that on every frame of every putt would cost four times
 * the physics work for the whole game to protect a handful of shots.
 *
 * So the step is chosen per frame instead. Below the speed the ordinary step
 * already handles, nothing changes and the cost is exactly what it was. Above
 * it, the step tightens just enough to hold the ball to STEP_TRAVEL between
 * checks, and relaxes again as the ball slows.
 *
 * The floor is there because a step that small means a great many substeps in
 * one frame, and a stuck physics loop is worse than a ball through a wall.
 */
function stepFor(speed: number): number {
  if (speed * FIXED_TIME_STEP <= STEP_TRAVEL) return FIXED_TIME_STEP
  return Math.max(1 / 960, STEP_TRAVEL / speed)
}

function ballSpeed(): number {
  if (!ballBody) return 0
  const v = ballBody.velocity
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

/** Hard speed cap. MAX_POWER should already keep us under this, but this
 * guards against any stacked impulses (e.g. a strike landing right as a
 * bounce is resolving) pushing the ball into a speed regime where discrete
 * collision detection starts producing inconsistent results. */
function clampBallSpeed() {
  if (!ballBody) return
  // The test override still clamps, just somewhere absurd, so a stray impulse
  // cannot produce an infinite or NaN velocity and take the world with it.
  const ceiling = ADMIN.uncapBallSpeed ? UNSAFE_MAX_BALL_SPEED : MAX_BALL_SPEED
  const v = ballBody.velocity
  const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (speed > ceiling) {
    const scale = ceiling / speed
    v.x *= scale
    v.y *= scale
    v.z *= scale
  }
}

// ---------------------------------------------------------------------------
// Moving Physics Objects
// ---------------------------------------------------------------------------
function UpdateObstacles(dt: number) {
  // Update Hz
  world.step(30, dt, 2)

  // The ramp is driven here rather than by its .glb animation, so the mesh the
  // player sees and the body the ball lands on come from one number.
  updateRamp(dt)
  if (rampBody) {
    rampBody.position.y = rampHeight()
    rampBody.velocity.set(0, rampRise(), 0)
  }

  // The boat rides. One set of numbers drives both the model and the body, so
  // what the ball hits is always what is on screen.
  boatClock += dt

  logWhereYouAre(dt)
  const bob = Math.sin(boatClock * BOAT.bobSpeed) * BOAT.bobHeight
  const roll = Math.sin(boatClock * BOAT.rollSpeed) * BOAT.rollDegrees
  // Two ways of describing the run. A measured pair of end points wins, since
  // it can follow any line; the axis oscillation is the fallback for when
  // nobody has measured one.
  const wave = Math.sin(boatClock * BOAT.travelSpeed)
  const along = BOAT.from && BOAT.to
    ? {
        // -1..1 mapped onto the segment, so the ends are the ends.
        x: BOAT.from.x + ((wave + 1) / 2) * (BOAT.to.x - BOAT.from.x),
        z: BOAT.from.z + ((wave + 1) / 2) * (BOAT.to.z - BOAT.from.z)
      }
    : { x: BOAT.home.x + BOAT.travelOffset + wave * BOAT.travel, z: BOAT.home.z }

  const sailX = along.x - BOAT.home.x
  const sailZ = along.z - BOAT.home.z

  if (!boatEntity) {
    const found = engine.getEntityOrNullByName('boat.glb')
    if (found !== null && Transform.has(found)) {
      boatEntity = found
      // Kept because the boat is a child of Hole 7 Base: its Transform is in
      // the parent's space, so the bob has to be added to what was authored
      // rather than written as a world position.
      boatHome = { ...Transform.get(found).position }
    }
  }

  if (boatEntity && boatHome) {
    const t: TransformType = Transform.getMutable(boatEntity)
    t.position = { x: boatHome.x + sailX, y: boatHome.y + bob, z: boatHome.z + sailZ }
    t.rotation = Quaternion.fromEulerDegrees(0, BOAT.faceDegrees, roll)
  }

  if (boatBody) {
    boatBody.position.x = BOAT.home.x + sailX
    boatBody.position.y = BOAT.home.y + bob
    boatBody.position.z = BOAT.home.z + sailZ
    boatBody.quaternion.setFromEuler(0, (BOAT.faceDegrees * Math.PI) / 180, (roll * Math.PI) / 180)
    // The velocity both motions imply, rather than nothing.
    //
    // A kinematic body that is teleported each frame has no velocity, so it
    // shoves anything it meets instead of carrying it — and a boat that sails
    // through a resting ball rather than nudging it along is the version of
    // this that looks broken. These are the derivatives of the two sines
    // above, so they are exact rather than estimated from the last frame.
    // Derivative of the same motion, so a ball on the path is carried rather
    // than shoved. Works for either description of the run.
    const rate = Math.cos(boatClock * BOAT.travelSpeed) * BOAT.travelSpeed
    const span = BOAT.from && BOAT.to
      ? { x: (BOAT.to.x - BOAT.from.x) / 2, z: (BOAT.to.z - BOAT.from.z) / 2 }
      : { x: BOAT.travel, z: 0 }
    boatBody.velocity.set(
      rate * span.x,
      Math.cos(boatClock * BOAT.bobSpeed) * BOAT.bobSpeed * BOAT.bobHeight,
      rate * span.z
    )
  }

  // Get Barrel GLB and Spin It
  const barrelFound = engine.getEntityOrNullByName('Barrel.glb')
  if (barrelFound !== null && Transform.has(barrelFound)) {
    // Get the mutable transform typed as TransformType
    const barrelMut: TransformType = Transform.getMutable(barrelFound)
    barrelMut.rotation = Quaternion.multiply(
      barrelMut.rotation,
      Quaternion.fromAngleAxis(1, Vector3.Forward())
    )

    // Apply This Rotation to Physics Data Properties
    if (barrelBody) {
      let r = barrelMut.rotation
      barrelBody.quaternion = new CANNON.Quaternion(r.x, r.y, r.z, r.w)
    }
  }

  //
  const wheelFound = engine.getEntityOrNullByName('Wheel.glb')
  if (wheelFound !== null && Transform.has(wheelFound)) {
    // Get the mutable transform typed as TransformType
    const wheelMut: TransformType = Transform.getMutable(wheelFound)
    wheelMut.rotation = Quaternion.multiply(
      wheelMut.rotation,
      Quaternion.fromAngleAxis(1, Vector3.Up())
    )

    if (wheelBody) {
      let r = wheelMut.rotation
      wheelBody.quaternion = new CANNON.Quaternion(r.x, r.y, r.z, r.w)
    }
  }
}


function onMobile(): boolean {
  try {
    return typeof isMobile === 'function' ? (isMobile as () => boolean)() : !!isMobile
  } catch {
    return false
  }
}

function HalfOnMobile(number2Half: number): number {
  return onMobile()
    ? number2Half / 2 // MOBILE — increase these if still too small
    : number2Half // DESKTOP — your original
}

/** Step physics and copy the body pose onto the authored ball entity. */
function physicsSystem(dt: number) {
  if (!ballBody || !ballEntity) return

  world.step(HalfOnMobile(stepFor(ballSpeed())), dt, HalfOnMobile(MAX_SUBSTEPS))
  clampBallSpeed() // catch speed gained from steep ramps too, not just strikes

  const t = Transform.getMutable(ballEntity)
  t.position = {
    x: ballBody.position.x,
    y: ballBody.position.y,
    z: ballBody.position.z
  }
  t.rotation = {
    x: ballBody.quaternion.x,
    y: ballBody.quaternion.y,
    z: ballBody.quaternion.z,
    w: ballBody.quaternion.w
  }
}

// ---------------------------------------------------------------------------
// Bridge to the game layer (src/golf)
//
// Everything above stays as the physics setup you have. The game only ever
// talks to the world through the small interface below, so scoring, hole
// progression and the UI can all change without touching the simulation.
//
// The old single-hole logic (holePos / onSink / resetBall / inputSystemGolf)
// has moved into src/golf/game.ts, which does the same job across nine holes
// and keeps a scorecard.
// ---------------------------------------------------------------------------

const probeRay = new CANNON.RaycastResult()
const probeFrom = new CANNON.Vec3()
const probeTo = new CANNON.Vec3()

/**
 * Height and normal of the course under a point. This is what lets the aim
 * guide lie on a ramp instead of cutting through it. The ball is excluded by
 * collision group, otherwise a probe taken at the ball's own position would
 * just hit the ball.
 */
function probeSurface(x: number, z: number, aroundY: number) {
  probeFrom.set(x, aroundY + AIM.probeUp, z)
  probeTo.set(x, aroundY - AIM.probeDown, z)
  probeRay.reset()
  world.raycastClosest(
    probeFrom,
    probeTo,
    { collisionFilterMask: GROUP_COURSE, skipBackfaces: false },
    probeRay
  )
  if (!probeRay.hasHit) return null
  return {
    y: probeRay.hitPointWorld.y,
    nx: probeRay.hitNormalWorld.x,
    ny: probeRay.hitNormalWorld.y,
    nz: probeRay.hitNormalWorld.z
  }
}



/**
 * How far the ball will roll for a given charge, on the flat.
 *
 * The strike is an impulse on a unit mass, so the launch speed is the impulse,
 * capped by clampBallSpeed. Contact friction is zero, so all the ball loses is
 * linear damping, which cannon applies as v *= (1 - d)^t — an exponential decay
 * with a half-life of one second at d = 0.5. Integrating that from launch down
 * to the speed at which the body sleeps gives the distance below.
 */
function predictRoll(power: number): number {
  const launch = Math.max(0, Math.min(1, power)) * BASE_LAUNCH_SPEED * clubPower()
  const decay = -Math.log(1 - 0.5) // linearDamping 0.5 -> ln 2 per second
  return Math.max(0, (launch - REST_SPEED) / decay)
}

function makePhysicsBridge(body: CANNON.Body): Physics {
  return {
    ballRadius: BALL_RADIUS,
    position: () => ({ x: body.position.x, y: body.position.y, z: body.position.z }),
    speed: ballSpeed,
    // Horizontal speed only. Dropping into a cup means gaining vertical speed
    // fast, so a 3D speed test rejects the very shots that are going in; what
    // actually decides a lip-out is how quickly the ball is crossing the hole.
    flatSpeed: () => {
      if (!ballBody) return 0
      const v = ballBody.velocity
      return Math.sqrt(v.x * v.x + v.z * v.z)
    },
    settled: () => body.sleepState === CANNON.Body.SLEEPING || ballSpeed() < REST_SPEED,
    place(x, y, z) {
      body.velocity.set(0, 0, 0)
      body.angularVelocity.set(0, 0, 0)
      body.position.set(x, y, z)
      body.quaternion.set(0, 0, 0, 1)
      body.wakeUp()
    },
    strike(dirX, dirZ, power) {
      // Horizontal, applied at the centre so it imparts no spin, then clamped —
      // the same stroke as before, just with the charge mapped across the whole
      // usable speed range instead of saturating a third of the way up.
      const p = Math.max(0, Math.min(1, power)) * BASE_LAUNCH_SPEED * clubPower()
      body.wakeUp()
      body.applyImpulse(new CANNON.Vec3(dirX * p, 0, dirZ * p), body.position)
      clampBallSpeed()
    },
    freeze() {
      body.velocity.set(0, 0, 0)
      body.angularVelocity.set(0, 0, 0)
      body.sleep()
    },
    probe: probeSurface,
    predictRoll
  }
}

/**
 * Prints where the player is stood, when they have moved.
 *
 * Rate-limited to once a second and gated on having actually gone somewhere,
 * so standing still is silent and the last line printed is where you are —
 * which is the whole point of it, since it is normally read while stood on the
 * spot you want to measure.
 *
 * The facing is included because it is the other half of placing anything: a
 * character, a sign, the direction a thing travels. Same convention as
 * NpcSpec.facingDegrees, so a reading can be pasted straight into config.
 */
function logWhereYouAre(dt: number): void {
  if (!ADMIN.logPosition) return
  pathClock += dt
  if (pathClock < 1) return
  pathClock = 0

  const me = Transform.getOrNull(engine.PlayerEntity)
  if (!me) return
  const p = me.position

  if (lastLogged) {
    const dx = p.x - lastLogged.x
    const dy = p.y - lastLogged.y
    const dz = p.z - lastLogged.z
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) < ADMIN.logPositionEvery) return
  }
  lastLogged = { x: p.x, y: p.y, z: p.z }

  const q = me.rotation
  const yaw = (Math.atan2(2 * (q.w * q.y + q.z * q.x), 1 - 2 * (q.x * q.x + q.y * q.y)) * 180) / Math.PI

  console.log(
    `[golf] you are at  x ${p.x.toFixed(2)}   y ${p.y.toFixed(2)}   z ${p.z.toFixed(2)}   facing ${yaw.toFixed(0)}`
  )
}

/**
 * Runs a piece of optional setup, and lets it fail.
 *
 * Deliberately narrow: this is for scenery and characters, not for physics or
 * the game loop. Swallowing an error is only right when what is left still
 * works, and the point of it is that the console names the thing that broke
 * instead of the scene going dark and blaming whatever ran last.
 */
function safely(what: string, fn: () => void): void {
  try {
    fn()
  } catch (e) {
    console.log(`[golf] ${what} failed to start, carrying on without it:`, e)
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
export function main() {
  // The scene's code runs in two places now: here in every player's client, and
  // once more headlessly on the Multiplayer Server. The server has no screen,
  // no player and nothing to simulate — it keeps the ledger and answers
  // questions about it. Running the cannon world, the characters and the HUD
  // there would be a full golf simulation nobody is watching.
  if (isServer()) {
    runLedger()
    return
  }

  buildWorldFromScene()
  paintBall()
  setupSky()
  setupWater()
  setupRamp()
  engine.addSystem(UpdateObstacles)
  engine.addSystem(physicsSystem)

  if (!ballBody) {
    console.log('[golf] no entity named "ball" in the scene — the game cannot start')
    return
  }

  setupSfx()
  setupMusic()
  setupNet()
  const game = new Game(makePhysicsBridge(ballBody))
  fitClub(game)

  // The HUD goes up first, and the scenery that follows is each allowed to
  // fail on its own.
  //
  // This used to run setupBoard, then the two characters, then setupHud, in a
  // bare sequence. main() is one function, so a throw anywhere in that list
  // took the rest of it with it — a bad prop on the sign-up board meant no
  // scorecard, no leaderboard, no shop and no aim guide, which reads as "all
  // the UI is broken" and points at entirely the wrong file. None of these
  // three are load-bearing for the golf, so none of them get to stop it.
  setupHud(game)
  safely('sign-up board', () => setupBoard(() => game.join()))
  safely('quartermaster', () => createNpc(QUARTERMASTER, quartermasterDialog(game)))
  safely('shopkeeper', () => createNpc(SHOPKEEPER, shopkeeperDialog(game)))
  safely('shellman', () => createNpc(SHELLMAN, shellmanDialog()))
  safely('shells', () => setupShells())
  safely('cave explorer sally', () => createNpc(SALLY, sallyDialog()))
  safely('metal detector', () => setupDetector())
  safely('coconutty', () => createNpc(COCONUTTY, coconuttyDialog()))
  safely('coconuts', () => setupCoconuts())
  safely('pina colada', () => setupDrink())
  safely('level up', () => setupLevelUp())
  safely('quest board', () => setupQuestBoard())
  safely('leaderboard', () => setupLeaderBoard())
  safely('skeleton cages', () => setupSkeletons())

  // Opens the ledger. Anything sent before the room connects is queued, so
  // this can go now and the answer arrives when it arrives — nothing here
  // blocks play, and the HUD shows a dash until it lands.
  // Whatever the server says they are holding, they hold. Fires on arrival and
  // again the moment a purchase lands.
  onEquipChanged((item) => {
    if (item.kind === 'ball') setBallSkin(item.id)
    else if (item.model) setClubModel(game.club, item.model)
  })

  onEquipChanged((item) => {
    if (item.kind === 'ball') {
      if (item.model) setBallSkin(item.id)
    }
    if (item.kind === 'club') {
      if(ballBody)
      {
        ballBody.linearDamping = item.damping ? item.damping : 0.5
        ballBody.angularDamping = item.damping ? item.damping : 0.5
      }
      curball.ballpowerMod = item.power ? item.power : 1
      curball.ballAngleMod = item.forgiveness ? item.forgiveness : 0

      if (item.model) setClubModel(game.club, item.model)
    }
  })

  // What Shellman took, rather than what he was offered — he turns shells away
  // once he has had his fill for the day, and those must not count towards the
  // hundred. The server's answer is the only thing that moves that quest.
  onShellsAccepted((taken, paid, refused) => {
    shellsAccepted(taken)
    if (taken > 0) {
      game.announce(
        `${taken} shell${taken === 1 ? '' : 's'} taken`,
        paid > 0 ? `+${paid} ${POINTS.short}` : 'Connect a wallet to be paid for these',
        'good',
        4
      )
    }
    if (refused > 0) {
      game.announce(
        'He will not take any more today',
        `${refused} left in hand. He takes ${SHELLS.dailyLimit} a day.`,
        'bad',
        4
      )
    }
  })

  // Walking into the cave draws the detector; the game layer owns what that
  // means for the club, since both hang off the same hand.
  onDetectorAuto((out) => {
    game.announce(
      out ? 'Detector out' : 'Detector away',
      out ? 'Sweep slowly and let it click.' : '',
      'neutral',
      out ? 3 : 2
    )
  })

  // What Coconutty took, rather than what he was offered — the same rule as
  // Shellman, for the same reason: he turns coconuts away once he has had his
  // fill for the day and those must not count towards the hundred.
  onCoconutsAccepted((taken, paid, refused) => {
    coconutsAccepted(taken)
    if (taken > 0) {
      game.announce(
        `${taken} coconut${taken === 1 ? '' : 's'} taken`,
        paid > 0 ? `+${paid} ${POINTS.short}` : 'Connect a wallet to be paid for these',
        'good',
        4
      )
    }
    if (refused > 0) {
      game.announce(
        'He will not take any more today',
        `${refused} left in hand. He takes ${COCONUTS.dailyLimit} a day.`,
        'bad',
        4
      )
    }
  })

  // Whether the old motor is in the ground at all.
  //
  // Asked every frame by the detector rather than set once, because both
  // halves of the answer can change while somebody is stood in the cave: the
  // quest can be accepted, and the motor can be dug. It is in the ground only
  // while that quest is actually running, and the ledger's own flag is the
  // long-term memory — a claimed quest and a fresh session must not put it
  // back.
  whenMotorWanted(
    () => questStatus('blender-motor') === 'active' && !motorIsFound(),
    () => {
      motorDug()
      game.announce('The old motor', 'Heavier than it looks. Coconutty will want to see this.', 'good', 5)
    }
  )

  // What Sally took, rather than what was offered — the same rule as Shellman.
  onScrapAccepted((taken, total) => {
    scrapAccepted(taken)
    if (taken > 0) {
      game.announce(
        `${taken} scrap handed over`,
        `${total} in all. She is sorting it as you leave.`,
        'good',
        4
      )
    }
  })

  setupPoints(
    // Quest progress the server was holding, put back before anyone sees it.
    () => seedQuests(),
    (amount, reason) => game.announce(`+${amount} ${POINTS.short}`, reason, 'good', 5),
    (reason) => game.announce('Not this time', reason, 'bad', 4)
  )

  game.start()

  // Added after the physics systems so the game always reads a settled pose.
  engine.addSystem((dt: number) => game.update(dt))
}

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

// IMPORTANT: absolute path import — the bare "cannon-es" specifier does NOT
// resolve inside the SDK bundler. Also add this path to tsconfig "include".
import { isServer } from '@dcl/sdk/network'

import * as CANNON from 'cannon-es'
import { courseData } from './collisionData/course_collision'
import { barrelData } from './collisionData/barrel_collision'
import { wheelData } from './collisionData/wheel_collision'
import { rampData } from './collisionData/ramp_collision'
import { practiceData } from './collisionData/practice_collision'

import { AIM } from './golf/config'
import { Game, Physics } from './golf/game'
import { setupHud } from './golf/hud'
import { setupMusic } from './golf/music'
import { setupSfx } from './golf/sfx'
import { setBallSkin } from './golf/ball'
import { setupNet } from './golf/net'
import { setupPoints } from './golf/points'
import { onEquipChanged } from './golf/shop'
import { setClubModel } from './golf/club'
import { runLedger } from './golf/ledger'
import { seedQuests } from './golf/quests'
import { createNpc } from './golf/npc'
import { POINTS, QUARTERMASTER, SHOPKEEPER } from './golf/config'
import { quartermasterDialog } from './golf/quartermaster'
import { shopkeeperDialog } from './golf/shopkeeper'
import { setupBoard } from './golf/board'
import { setupSky } from './golf/sky'
import { RAMP_BOX, REST_Y as RAMP_REST_Y, rampHeight, rampRise, setupRamp, updateRamp } from './golf/ramp'
import { setupWater } from './golf/water'

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
const BALL_RADIUS = 0.1
const MAX_POWER = 25 // impulse magnitude at full charge
const REST_SPEED = 0.15 // below this speed the ball counts as "stopped"

// cannon-es has no built-in CCD, so a fast ball is only as good as how finely
// we step the simulation. A smaller fixed step (with a matching higher
// substep cap) means less distance — and less penetration variance — between
// collision checks, which is what was causing the inconsistent bounces.
const FIXED_TIME_STEP = 1 / 120
const MAX_SUBSTEPS = 20
// Hard cap so a stray impulse can't push us into "way too fast to resolve
// cleanly" territory. Raised from 8 to give the stroke 40% more legs — it is
// the real ceiling on shot power, because clampBallSpeed applies it to every
// strike and LAUNCH_SPEED below is bounded by it. Still inside the safe range
// for the trimesh: at 11.2 m/s a 1/120s step moves the ball 9.3cm against a
// 10cm radius, so it never steps clean through a wall between collision checks.
const MAX_BALL_SPEED = 11.2

/**
 * Launch speed at full charge.
 *
 * The ball has mass 1, so an impulse of MAX_POWER would leave at 25 m/s — but
 * clampBallSpeed caps everything at MAX_BALL_SPEED. That cap was doing the work
 * of the charge: anything past about a third of the bar produced an identical
 * 8 m/s shot, so two thirds of the meter did nothing at all. Mapping the charge
 * onto the speed the ball is actually allowed to leave at makes the whole bar
 * live, and leaves the cap doing what it was written for — catching stacked
 * impulses — rather than flattening the player's input.
 */
const LAUNCH_SPEED = Math.min(MAX_POWER, MAX_BALL_SPEED)

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
function paintBall(): void {
  setBallSkin('white')
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
  const v = ballBody.velocity
  const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (speed > MAX_BALL_SPEED) {
    const scale = MAX_BALL_SPEED / speed
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

/** Step physics and copy the body pose onto the authored ball entity. */
function physicsSystem(dt: number) {
  if (!ballBody || !ballEntity) return

  world.step(FIXED_TIME_STEP, dt, MAX_SUBSTEPS) // finer fixed timestep -> less penetration variance per collision check
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
  const launch = Math.max(0, Math.min(1, power)) * LAUNCH_SPEED
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
      const p = Math.max(0, Math.min(1, power)) * LAUNCH_SPEED
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
  setupBoard(() => game.join())
  createNpc(QUARTERMASTER, quartermasterDialog(game))
  createNpc(SHOPKEEPER, shopkeeperDialog(game))
  setupHud(game)

  // Opens the ledger. Anything sent before the room connects is queued, so
  // this can go now and the answer arrives when it arrives — nothing here
  // blocks play, and the HUD shows a dash until it lands.
  // Whatever the server says they are holding, they hold. Fires on arrival and
  // again the moment a purchase lands.
  onEquipChanged((item) => {
    if (item.kind === 'ball') setBallSkin(item.id)
    else if (item.model) setClubModel(game.club, item.model)
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

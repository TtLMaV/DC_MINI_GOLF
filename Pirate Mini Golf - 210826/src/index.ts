import {
  engine,
  InputAction,
  Transform,
  TransformType,
  Name,
  Entity,
  Material,
  MeshRenderer,
  TouchScreenControls,
  DeleteEntity
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
import { boatData } from './collisionData/boat_collision'

import { ADMIN, AIM, BOAT } from './golf/config'
import { Game, Physics } from './golf/game'
import { setupHud } from './golf/hud'
import { setupMusic } from './golf/music'
import { setupSfx } from './golf/sfx'
import { setBallSkin } from './golf/ball'
import { publishGear, setupNet } from './golf/net'
import {
  motorIsFound,
  onCoconutsAccepted,
  onJugCoconutsAccepted,
  onScrapAccepted,
  onShellsAccepted,
  setupPoints
} from './golf/points'
import {
  clubPower,
  DEFAULTS,
  equippedId,
  equippedItem,
  Item,
  onEquipChanged
} from './golf/shop'
import { setClubModel } from './golf/club'
import { runLedger } from './golf/ledger'
import { seedQuests } from './golf/quests'
import { createNpc } from './golf/npc'
import { COCONUTS, COCONUTTY, POINTS, QUARTERMASTER, SALLY, SHELLMAN, SHELLS, SHOPKEEPER } from './golf/config'
import { quartermasterDialog } from './golf/quartermaster'
import { shopkeeperDialog } from './golf/shopkeeper'
import { shellmanDialog, shellsAccepted } from './golf/shellman'
import { sallyDialog, scrapAccepted } from './golf/sally'
import { hasDetector, onDetectorAuto, setupDetector } from './golf/detector'
import { setupShells } from './golf/shells'
import { setupCoconuts } from './golf/coconuts'
import { setupLeaderBoard } from './golf/leaderboard'
import { setupSkeletons } from './golf/skeletons'
import { coconuttyDialog, coconutsAccepted, jugCoconutsAccepted, motorDug } from './golf/coconutty'
import { setupDrink } from './golf/drink'
import { setupLevelUp } from './golf/levelup'
import { whenMotorWanted } from './golf/detector'
import { questStatus } from './golf/quests'
import { setupQuestBoard } from './golf/questboard'
import { setupBoard } from './golf/board'
import { setupBones } from './golf/bones'
import { setupBar } from './golf/bar'
import { setupSky } from './golf/sky'
import { RAMP_BOX, REST_Y as RAMP_REST_Y, rampHeight, rampRise, setupRamp, updateRamp } from './golf/ramp'
import { setupWater } from './golf/water'

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
const BALL_RADIUS = 0.1               // Size of the Players Ball
const REST_SPEED = 0.1                // The speed at which the ball is counted as stopped
const FIXED_TIME_STEP = 1 / 120       // The amount of times per second to calc physics steps
const MAX_STEPS_PER_FRAME = 12        // The Max Substeps of Physics Based On Frames
const STEP_TRAVEL = 0.08              // The physics Step Of Travel
const MAX_DEBT_SECONDS = 0.5          // Point at which physics snaps forward
const MAX_BALL_SPEED = 17             // Hard cap on ball speed. Prevents Travelling Through Objs
const UNSAFE_MAX_BALL_SPEED = 240     // The ceiling while ADMIN.uncapBallSpeed is on
const BASE_LAUNCH_SPEED = 11.2        // Launch speed at full charge

// ---------------------------------------------------------------------------
// Physics world
// ---------------------------------------------------------------------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })

const groundMat = new CANNON.Material('ground')
const ballMat = new CANNON.Material('ball')
const rampMat = new CANNON.Material('ramp')

// Add material Values Between ground and ball as well as Hole 9 Ramp and Ball
const groundBallCont = new CANNON.ContactMaterial(groundMat, ballMat, {
    friction: 0.0,
    restitution: 0.2, // a little bounce, not a pinball
    contactEquationStiffness: 1e8, // stiffer contacts resolve penetration faster/more consistently
    contactEquationRelaxation: 3 // fewer "soft" frames of settling into the surface
  })
world.addContactMaterial(groundBallCont)

world.addContactMaterial(
  new CANNON.ContactMaterial(rampMat, ballMat, {
    friction: 0.0,
    restitution: 0.05, // deadens the seam rather than pinging the ball back
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  })
)

// Collision groups
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
let boatClock = 0
let boatTime: number = 12
let boatMoveAmount: Vector3 = Vector3.create(0, 0, 3)
let boatStartPos: Vector3

let pathClock = 0
let lastLogged: { x: number; y: number; z: number } | undefined

let rampClock = 0
let rampTime: number = 15
let rampMoveAmount: Vector3 = Vector3.create(0, 1.45, 0)
let rampStartPos: Vector3

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
    collisionFilterGroup: GROUP_COURSE
  })
  boatBody.position.set(15, 0.50, 44.5)
  boatStartPos = boatBody.position
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
    collisionFilterGroup: GROUP_COURSE
  })
  rampBody.position.set(19.25, 1.3, 49.25)
  rampStartPos = rampBody.position
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
 * Paints the ball
 */
function holdClub(game: Game, item: Item): void {
  if (item.model) setClubModel(game.club, item.model)
  else console.log(`[golf] no model for club "${item.id}"`)

  if (ballBody) {
    // Angular alongside linear so a ball that stops rolling also stops
    // spinning. Left apart, a settled ball keeps turning on the spot.
    const d = item.damping ?? 0.5
    ballBody.linearDamping = d
    ballBody.angularDamping = d + 0.2
    const b = item.bounciness ?? 0.3
    groundBallCont.restitution = b
  }
}

/**
 * Puts the club they are actually holding in their hand, at start-up.
 */
function fitClub(game: Game): void {
  holdClub(game, equippedItem('club'))
}

function paintBall(): void {
  // The catalogue's id, not a loose string. This said 'white' and the shop
  // renamed it 'ball-white' underneath it, so setBallSkin found nothing, gave
  // up, and the ball went unpainted from the moment the shop landed.
  setBallSkin(DEFAULTS.ball)
}

let deleteNextDegub: Entity | null = null

export function debugShowPhysBB(body: CANNON.Body): Entity {
  // Delete This From Last Frame
  if(deleteNextDegub != null)
  {
    engine.removeEntity(deleteNextDegub)
  }

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
  deleteNextDegub = debugBox

  return debugBox
}

/**
 * The physics step to run at, given how fast the ball is going
 */

function stepFor(speed: number): number {
  if (speed * FIXED_TIME_STEP <= STEP_TRAVEL) return FIXED_TIME_STEP
  return Math.max(1 / 960, STEP_TRAVEL / speed)
}

// ---------------------------------------------------------------------------
// The on-screen buttons a phone gets
// ---------------------------------------------------------------------------

const ICON_DIR = 'assets/scene/ui/icons'
const icon = (file: string) => ({
  tex: { $case: 'texture' as const, texture: { src: `${ICON_DIR}/${file}` } }
})

/**
 * What the client draws down the right-hand side on a phone
 */
function applyTouchControls(detectorInHand: boolean): void {
  TouchScreenControls.createOrReplace(engine.RootEntity, {
    hideJoystick: false,
    hideCrosshair: true,
    // `hide` is spelled out on every row. The docs show it as optional and the
    // generated type has it required, so an entry without it does not compile.
    touchInputs: [
      { inputAction: InputAction.IA_PRIMARY, hide: false, icon: icon('swing.png') },
      { inputAction: InputAction.IA_SECONDARY, hide: false, icon: icon('close.png') },
      { inputAction: InputAction.IA_ACTION_3, hide: true },
      { inputAction: InputAction.IA_ACTION_4, hide: true },
      { inputAction: InputAction.IA_ACTION_5, hide: !detectorInHand, icon: icon('detector.png') },
      { inputAction: InputAction.IA_ACTION_6, hide: false, icon: icon('club.png') }
    ]
  })
}

// ---------------------------------------------------------------------------
// Physics Calcs basics Step Method
// ---------------------------------------------------------------------------

// Determines Balls Cur Speed
function ballSpeed(): number {
  if (!ballBody) return 0
  const v = ballBody.velocity
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

// Hard speed cap for ball, MAX_POWER should already keep us under this
function clampBallSpeed() {
  if (!ballBody) return
  // The test override still clamps
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

// Test Whether the ball is idle in the world
function worldIsIdle(): boolean {
  if (!ballBody) return false
  if (ballBody.sleepState !== CANNON.Body.SLEEPING) return false

  const p = ballBody.position
  for (const body of [rampBody, boatBody, barrelBody, wheelBody]) {
    if (!body) continue
    const dx = p.x - body.position.x
    const dy = p.y - body.position.y
    const dz = p.z - body.position.z
    if (dx * dx + dy * dy + dz * dz < 100) return false
  }
  return true
}

// Value used in detecting physics drift
let accumulator = 0

// Tick Through Physics Calculations
function physicsSystem(dt: number) {
  if (!ballBody || !ballEntity) return
  if (worldIsIdle()) return

  const step = stepFor(ballSpeed())
  accumulator += dt
  if (accumulator > MAX_DEBT_SECONDS) accumulator = MAX_DEBT_SECONDS

  let steps = 0
  while (accumulator >= step && steps < MAX_STEPS_PER_FRAME) {
    world.step(step)
    accumulator -= step
    steps++
  }
  clampBallSpeed() // catch speed gained from steep ramps too, not just strikes

  // Update Ball Positions
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
// ---------------------------------------------------------------------------

const probeRay = new CANNON.RaycastResult()
const probeFrom = new CANNON.Vec3()
const probeTo = new CANNON.Vec3()

// Height and normal of the course under a point
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

// How far the ball will roll for a given charge, on the flat
function predictRoll(power: number): number {
  const launch = Math.max(0, Math.min(1, power)) * BASE_LAUNCH_SPEED * clubPower()
  const decay = -Math.log(1 - 0.5) // linearDamping 0.5 -> ln 2 per second
  return Math.max(0, (launch - REST_SPEED) / decay)
}

// Push Ball Physics Updates
function makePhysicsBridge(body: CANNON.Body): Physics {
  return {
    ballRadius: BALL_RADIUS,
    position: () => ({ x: body.position.x, y: body.position.y, z: body.position.z }),
    speed: ballSpeed,
    // Horizontal speed only
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
      // Horizontal Strike, applied at the centre so it imparts no spin
      const p = Math.max(0, Math.min(1, power)) * BASE_LAUNCH_SPEED * clubPower()
      body.wakeUp()
      body.applyImpulse(new CANNON.Vec3(dirX * p, 0, dirZ * p), body.position)
      clampBallSpeed()
    },
    chipshot(power) {
        const p = Math.max(0, Math.min(1, (4 * power) - 3)) * 2 * clubPower()
        body.applyImpulse(new CANNON.Vec3(0, p, 0), body.position)
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
// Moving Physics Objects
// ---------------------------------------------------------------------------
function UpdateObstacles(dt: number) {

  // Fixing This Bullshit the way that shouldn't crap its pants on mobile
  rampClock += dt
  rampClock = rampClock % rampTime
  let rampPhase = Math.sin(2 * Math.PI * rampClock / rampTime)

  const rampFound = engine.getEntityOrNullByName('Moving Ramp.glb')
    if (rampFound !== null && Transform.has(rampFound)) {
    // Get the mutable transform typed as TransformType
    const rampMut: TransformType = Transform.getMutable(rampFound)
    rampMut.parent = undefined
    rampMut.position = Vector3.add(rampStartPos, (Vector3.scale(rampMoveAmount, rampPhase)))
    // boat Update Physics
    if(rampBody)
    {
      let p = rampMut.position
      rampBody.position = new CANNON.Vec3(p.x + 2.9, p.y + 0.5, p.z + 26)
      //debugShowPhysBB(rampBody)
    }
  }

  // Boat Movement Back and forth
  boatClock += dt
  boatClock = boatClock % boatTime
  let boatPhase = Math.sin(2 * Math.PI * boatClock / boatTime)

  const boatFound = engine.getEntityOrNullByName('boat.glb')
  if (boatFound !== null && Transform.has(boatFound)) {
    // Get the mutable transform typed as TransformType
    const boatMut: TransformType = Transform.getMutable(boatFound)
    boatMut.parent = undefined
    boatMut.position = Vector3.add(boatStartPos, (Vector3.scale(boatMoveAmount, boatPhase)))
    // boat Update Physics
    if(boatBody)
    {
      let p = boatMut.position
      boatBody.position = new CANNON.Vec3(p.x, p.y, p.z)
      //debugShowPhysBB(boatBody)
    }
  }

  // Get Barrel GLB and Spin It [Hole 5]
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

  // Update Wheel Spinning based on GLB of Pirate Ships Wheel [Hole 9]
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

/**
 * Prints where the player is stood, when they have moved
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
 * Runs a piece of optional setup, and lets it fail
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

  // The detector button appears the moment Sally hands one over and not
  // before, so the strip is watched rather than set once. One boolean compare
  // a frame, and the component is only rewritten when the answer changes.
  applyTouchControls(hasDetector())
  let detectorShown = hasDetector()
  engine.addSystem(() => {
    const has = hasDetector()
    if (has === detectorShown) return
    detectorShown = has
    applyTouchControls(has)
  })
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
  safely('bones', () => setupBones())
  safely('coconutty', () => createNpc(COCONUTTY, coconuttyDialog()))
  safely('coconuts', () => setupCoconuts())
  safely('pina colada', () => setupDrink())
  safely("coconutty's bar", () => setupBar())
  safely('level up', () => setupLevelUp())
  safely('quest board', () => setupQuestBoard())
  safely('leaderboard', () => setupLeaderBoard())
  safely('skeleton cages', () => setupSkeletons())

  // Opens the ledger. Anything sent before the room connects is queued, so
  // this can go now and the answer arrives when it arrives — nothing here
  // blocks play, and the HUD shows a dash until it lands.
  // Whatever the server says they are holding, they hold. Fires on arrival and
  // again the moment a purchase lands.
  // One handler. onEquipChanged keeps a single callback rather than a list, so
  // registering twice does not add a listener, it replaces the first one and
  // quietly drops whatever it did.
  //
  // Nothing sets curball here any more. The club's power reaches the ball
  // through clubPower() in the physics bridge below, and setting it in two
  // places would apply it twice the moment the commented-out lines in game.ts
  // were switched back on.
  onEquipChanged((item) => {
    if (item.kind === 'ball') setBallSkin(item.id)
    else holdClub(game, item)
    // Onto the wire, so everyone else sees what you just picked up.
    publishGear(equippedId('ball'), equippedId('club'))
  })

  // And once at the start, for the same reason fitClub exists: onEquipChanged
  // only fires on a change, and somebody who never changes anything would
  // otherwise be the one player nobody could see the kit of.
  publishGear(equippedId('ball'), equippedId('club'))

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

  // The jug's own hand-over. Announced separately from the one above because
  // it is a separate errand: these did not go against his daily twelve and
  // they are not on their way to the hundred.
  onJugCoconutsAccepted((taken, paid, need) => {
    jugCoconutsAccepted(taken)
    if (taken <= 0) return
    game.announce(
      need > 0
        ? `${taken} for the jug`
        : 'That is the jug',
      need > 0
        ? `${need} more wanted.${paid > 0 ? `  +${paid} ${POINTS.short}` : ''}`
        : paid > 0
          ? `+${paid} ${POINTS.short}`
          : 'Go and tell him.',
      'good',
      4
    )
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

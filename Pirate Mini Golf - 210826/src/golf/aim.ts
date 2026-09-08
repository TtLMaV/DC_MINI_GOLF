import { engine, Entity, MeshRenderer, Material, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { AIM } from './config'

/**
 * What you see on the ground while you are lining a shot up.
 *
 * Deliberately two things and no more: a ring on the floor marking where the
 * ball is, and a straight line out of it showing which way the shot will go.
 * Everything else that used to be here — the dashed roll preview, the landing
 * marker, the pin arrow, the distance labels — added information nobody was
 * reading and made the ball harder to see, not easier. Power is the meter's
 * job; this is only ever the answer to "which way am I facing".
 */

/** Raycast down from (x, aroundY, z) for the course surface. */
export type SurfaceProbe = (
  x: number,
  z: number,
  aroundY: number
) => { y: number; ny: number } | null

export type Aim = {
  /** Segments of the ring around the ball. */
  ring: Entity[]
  /** The direction line, and the arrowhead on the end of it. */
  line: Entity
  head: Entity
  ringVisible: boolean
  lineVisible: boolean
}

const RING_COLOUR = Color4.create(0.99, 0.85, 0.35, 0.9)
const LINE_COLOUR = Color4.create(0.99, 0.85, 0.35, 0.95)

function flatBox(colour: Color4): Entity {
  const e = engine.addEntity()
  MeshRenderer.setBox(e)
  Material.setPbrMaterial(e, {
    albedoColor: colour,
    emissiveColor: Color3.create(colour.r, colour.g, colour.b),
    emissiveIntensity: 1.4,
    roughness: 1,
    metallic: 0
  })
  Transform.create(e, { position: Vector3.create(0, -60, 0) })
  VisibilityComponent.create(e, { visible: false })
  return e
}

export function createAim(_ballRadius: number): Aim {
  const ring: Entity[] = []
  for (let i = 0; i < AIM.ringSegments; i++) ring.push(flatBox(RING_COLOUR))

  const line = flatBox(LINE_COLOUR)

  // Cone, laid flat later, so the line reads as pointing rather than just lying
  // there. setCylinder with a zero top radius is how you get a cone in SDK7.
  const head = engine.addEntity()
  MeshRenderer.setCylinder(head, 0, 1)
  Material.setPbrMaterial(head, {
    albedoColor: LINE_COLOUR,
    emissiveColor: Color3.create(LINE_COLOUR.r, LINE_COLOUR.g, LINE_COLOUR.b),
    emissiveIntensity: 1.4,
    roughness: 1,
    metallic: 0
  })
  Transform.create(head, { position: Vector3.create(0, -60, 0) })
  VisibilityComponent.create(head, { visible: false })

  return { ring, line, head, ringVisible: false, lineVisible: false }
}

function show(entity: Entity, visible: boolean): void {
  const v = VisibilityComponent.getMutableOrNull(entity)
  if (v && v.visible !== visible) v.visible = visible
}

export function setRingVisible(aim: Aim, visible: boolean): void {
  if (aim.ringVisible === visible) return
  aim.ringVisible = visible
  for (const seg of aim.ring) show(seg, visible)
  // Coming back into view counts as having moved: the ball may well be
  // somewhere else since the ring was last drawn, and the cached position
  // would otherwise leave it behind on the last hole.
  if (visible) invalidateRing()
}

export function setLineVisible(aim: Aim, visible: boolean): void {
  if (aim.lineVisible === visible) return
  aim.lineVisible = visible
  show(aim.line, visible)
  show(aim.head, visible)
}

/**
 * Where the ring was last built, so it is only built when it has moved.
 *
 * This is the single most expensive thing the scene did per frame, and it did
 * it at the worst possible moment. Every segment of the ring casts a ray at
 * the course to find the floor under it, and the course is a 159,000-triangle
 * mesh: twenty-four raycasts a frame, every frame, for the whole time you are
 * stood over the ball with the meter running. That is exactly when the meter
 * needs the frames, and exactly when the ball is about to need the physics.
 *
 * The ring is a circle around the ball on ground that does not move, so it
 * only needs rebuilding when the ball is somewhere else. Standing still and
 * looking around changes nothing about it. The line does move with your aim,
 * but that is two rays rather than twenty-four.
 */
let ringAt = { x: Number.NaN, y: Number.NaN, z: Number.NaN }

/** Force the next updateRing to rebuild, whatever the ball position says. */
export function invalidateRing(): void {
  ringAt = { x: Number.NaN, y: Number.NaN, z: Number.NaN }
}

/**
 * Lays the ring flat on whatever the ball is sitting on. Drawn on the floor
 * rather than around the ball in the air, because the thing that is hard to see
 * on this course is where the ball is *standing*.
 */
export function updateRing(aim: Aim, probe: SurfaceProbe, x: number, y: number, z: number): void {
  if (!aim.ringVisible) return

  // A centimetre of movement is not worth twenty-four rays. The ring is 90cm
  // across, so a centimetre of error in where it sits is invisible.
  const moved =
    Math.abs(x - ringAt.x) > 0.01 || Math.abs(y - ringAt.y) > 0.01 || Math.abs(z - ringAt.z) > 0.01
  if (!moved) return
  ringAt = { x, y, z }

  const r = AIM.ringRadius
  const n = aim.ring.length
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const sx = x + Math.cos(a) * r
    const sz = z + Math.sin(a) * r
    const hit = probe(sx, sz, y + AIM.probeUp)
    const t = Transform.getMutableOrNull(aim.ring[i])
    if (!t) continue
    t.position.x = sx
    t.position.y = (hit ? hit.y : y) + AIM.hover
    t.position.z = sz
    // Each segment is a short chord, turned to sit tangent to the circle.
    t.rotation = Quaternion.fromEulerDegrees(0, (-a * 180) / Math.PI, 0)
    t.scale = Vector3.create(AIM.ringThickness, AIM.ringThickness, (Math.PI * 2 * r) / n)
  }
}

/**
 * Points the line down the aim. Fixed length on purpose — it says direction and
 * nothing else, so it does not twitch about while the power meter is running.
 */
export function updateLine(
  aim: Aim,
  probe: SurfaceProbe,
  x: number,
  y: number,
  z: number,
  dirX: number,
  dirZ: number
): void {
  if (!aim.lineVisible) return

  const start = AIM.ringRadius + 0.1
  const length = AIM.lineLength
  const midX = x + dirX * (start + length / 2)
  const midZ = z + dirZ * (start + length / 2)
  const yaw = (Math.atan2(dirX, dirZ) * 180) / Math.PI

  const midHit = probe(midX, midZ, y + AIM.probeUp)
  const t = Transform.getMutableOrNull(aim.line)
  if (t) {
    t.position.x = midX
    t.position.y = (midHit ? midHit.y : y) + AIM.hover
    t.position.z = midZ
    t.rotation = Quaternion.fromEulerDegrees(0, yaw, 0)
    t.scale = Vector3.create(AIM.lineThickness, AIM.lineThickness, length)
  }

  const tipX = x + dirX * (start + length)
  const tipZ = z + dirZ * (start + length)
  const tipHit = probe(tipX, tipZ, y + AIM.probeUp)
  const h = Transform.getMutableOrNull(aim.head)
  if (h) {
    h.position.x = tipX
    h.position.y = (tipHit ? tipHit.y : y) + AIM.hover
    h.position.z = tipZ
    // The cone runs along its own Y, so tip it over onto the aim direction.
    h.rotation = Quaternion.fromToRotation(Vector3.Up(), Vector3.create(dirX, 0, dirZ))
    h.scale = Vector3.create(AIM.headWidth, AIM.headLength, AIM.headWidth)
  }
}

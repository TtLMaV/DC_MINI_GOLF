import { engine, Entity, Name, GltfContainer, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { DEFAULTS, Item, itemById } from './shop'

const MODEL = 'assets/scene/Balls/Stone Ball.glb'
let current = DEFAULTS.ball
let ballGLTF: Entity | null = null

function ballEntity(): Entity | null {
  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    if (name.value === 'ball') return entity
  }
  return null
}

export function currentSkin(): Item {
  return itemById(current) ?? itemById(DEFAULTS.ball)!
}

export function MakeBallGLTF(): Entity {
  const parentEntity = ballEntity()
  
  // Reuse existing entity if already created, otherwise add new one
  if (!ballGLTF) {
    ballGLTF = engine.addEntity()
  }

  Transform.createOrReplace(ballGLTF, {
    position: Vector3.Zero(), // Fixed: Vector3 instead of cannon-es Vec3
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: Vector3.create(10, 10, 10),
    parent: parentEntity ?? undefined
  })

  GltfContainer.createOrReplace(ballGLTF, { src: MODEL })
  VisibilityComponent.createOrReplace(ballGLTF, { visible: true })

  return ballGLTF
}

export function setBallModel(id: string, src: string): void {
  const skin = itemById(id)
  if (!skin || skin.kind !== 'ball') return
  current = skin.id

  // If the GLTF hasn't been created yet, create it now
  if (!ballGLTF) {
    MakeBallGLTF()
  }

  const gltf = GltfContainer.getMutableOrNull(ballGLTF!)
  if (!gltf) {
    console.error("Ball GLTF entity has no GltfContainer component.")
    return
  }

  // Update src only if changed
  if (gltf.src !== src) {
    gltf.src = src
  }
}
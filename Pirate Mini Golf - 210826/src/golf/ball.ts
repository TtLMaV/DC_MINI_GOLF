import { engine, Entity, Material, Name } from '@dcl/sdk/ecs'
import { Color3, Color4 } from '@dcl/sdk/math'

import { DEFAULTS, Item, itemById } from './shop'

/**
 * The look of the player's ball.
 *
 * Separate from index.ts so the shop can repaint it without the game layer
 * having to import the physics module — that would be a circular dependency.
 * The entity is looked up by name each time, which costs nothing at the rate
 * anyone changes ball colour.
 *
 * The colours themselves live in the catalogue now, beside their prices, so
 * there is one list of balls rather than a list of skins and a list of stock
 * that have to be kept in step.
 */

let current = DEFAULTS.ball

function ballEntity(): Entity | null {
  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    if (name.value === 'ball') return entity
  }
  return null
}

export function currentSkin(): Item {
  return itemById(current) ?? itemById(DEFAULTS.ball)!
}

export function setBallSkin(id: string): void {
  const skin = itemById(id)
  if (!skin || skin.kind !== 'ball') return
  current = skin.id

  const entity = ballEntity()
  if (!entity) return
  const colour = skin.colour ?? Color4.White()
  Material.setPbrMaterial(entity, {
    albedoColor: colour,
    emissiveColor: Color3.create(colour.r, colour.g, colour.b),
    emissiveIntensity: skin.emissive ?? 0.12,
    metallic: 0,
    roughness: 0.35,
    castShadows: true
  })
}

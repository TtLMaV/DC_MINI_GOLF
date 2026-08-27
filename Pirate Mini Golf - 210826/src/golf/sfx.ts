import { AudioSource, engine, Entity, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { PICKUP_SOUND } from './config'

/**
 * Small pool of one-shot emitters. AudioSource plays from wherever its entity
 * sits, so each sound is moved to the point it happened before it fires.
 * Retriggering the same clip needs `playing` to go false first, hence the
 * two-step restart.
 */

const CLIP = {
  putt: 'assets/scene/Golf/sounds/putt.mp3',
  rail: 'assets/scene/Golf/sounds/rail.mp3',
  drop: 'assets/scene/Golf/sounds/drop.mp3',
  splash: 'assets/scene/Golf/sounds/splash.mp3',
  holed: 'assets/scene/Golf/sounds/holed.mp3',
  charge: 'assets/scene/Golf/sounds/charge.mp3',
  shell: PICKUP_SOUND.shell,
  coconut: PICKUP_SOUND.coconut
} as const

export type ClipName = keyof typeof CLIP

const pool: Entity[] = []
let next = 0
let chargeEntity: Entity

export function setupSfx(): void {
  for (let i = 0; i < 5; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(0, -60, 0) })
    AudioSource.create(e, { audioClipUrl: CLIP.putt, playing: false, volume: 0 })
    pool.push(e)
  }
  chargeEntity = engine.addEntity()
  Transform.create(chargeEntity, { position: Vector3.create(0, -60, 0) })
  AudioSource.create(chargeEntity, {
    audioClipUrl: CLIP.charge,
    playing: false,
    loop: true,
    volume: 0.25,
    global: true
  })
}

export function play(clip: ClipName, x: number, y: number, z: number, volume = 1, pitch = 1): void {
  if (pool.length === 0) return
  const e = pool[next]
  next = (next + 1) % pool.length
  const t = Transform.getMutableOrNull(e)
  if (t) {
    t.position.x = x
    t.position.y = y
    t.position.z = z
  }
  const src = AudioSource.getMutableOrNull(e)
  if (!src) return
  src.playing = false
  src.audioClipUrl = CLIP[clip]
  src.volume = volume
  src.pitch = pitch
  src.currentTime = 0
  src.playing = true
}

/** The rising tone while a shot is being charged. */
export function setCharging(on: boolean, power = 0): void {
  const src = AudioSource.getMutableOrNull(chargeEntity)
  if (!src) return
  if (on) {
    if (!src.playing) {
      src.currentTime = 0
      src.playing = true
    }
    src.pitch = 0.85 + power * 0.7
    src.volume = 0.08 + power * 0.2
  } else if (src.playing) {
    src.playing = false
  }
}

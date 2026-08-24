import { AudioSource, engine, Entity, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { MUSIC } from './config'

/**
 * Background music.
 *
 * `global: true` is the part that matters: without it an AudioSource plays from
 * wherever its entity is standing and falls off with distance, so the track
 * would swell and fade as you walked the course. Global keeps it at constant
 * volume everywhere, which is what a soundtrack should do. The entity is parked
 * underground since its position is then irrelevant.
 */

const TRACK = 'assets/scene/Golf/sounds/pirate-music.mp3'

let source: Entity | undefined

export function setupMusic(): void {
  source = engine.addEntity()
  Transform.create(source, { position: Vector3.create(0, -60, 0) })
  AudioSource.create(source, {
    audioClipUrl: TRACK,
    playing: MUSIC.enabled,
    loop: true,
    volume: MUSIC.volume,
    global: true
  })
}

/** Set the level at runtime, 0..1. */
export function setMusicVolume(volume: number): void {
  if (!source) return
  const a = AudioSource.getMutableOrNull(source)
  if (a) a.volume = Math.max(0, Math.min(1, volume))
}

export function setMusicPlaying(playing: boolean): void {
  if (!source) return
  const a = AudioSource.getMutableOrNull(source)
  if (a) a.playing = playing
}

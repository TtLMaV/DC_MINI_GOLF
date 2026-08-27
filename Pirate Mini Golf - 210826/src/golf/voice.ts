import { AudioSource, engine, Entity, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { VOICE } from './config'

/**
 * What the characters sound like.
 *
 * A character talks for as long as you are stood in front of them. Clips run
 * one after another with a short uneven breath between, chosen at random, at
 * that character's pitch — and stop the moment the conversation does.
 *
 * Each character carries its own pitch, its own wobble and its own pauses. The
 * wobble turns out to matter more than the pitch: two voices an octave apart
 * that both vary by the same amount still sound like the same performer, and
 * two at the same pitch where one is flat and the other is all over the place
 * do not.
 *
 * Nobody says words. That is the whole trick: a voice that is not language
 * cannot fall out of step with text that is, so a line can be rewritten
 * without anything needing re-recording, and a slow reader is not left in
 * silence halfway down a paragraph.
 *
 * ---------------------------------------------------------------------------
 * Why a clock rather than an event
 * ---------------------------------------------------------------------------
 * There is no way to be told a sound has finished. An AudioSource can be
 * started and stopped, and that is the whole of the interface — so the only
 * way to know when to start the next clip is to have written down how long
 * this one lasts, which is why every clip in config carries its length.
 *
 * The length has to be divided by the pitch, because pitch and speed are the
 * same knob here: Shellman at 0.66 takes half as long again to get through a
 * clip as Salt does, and Sally at 1.45 gets through it in two thirds. Without
 * that, the lowest voice would be talked over by its own next clip and the
 * highest would leave gaps.
 *
 * ---------------------------------------------------------------------------
 * One source per character
 * ---------------------------------------------------------------------------
 * The clip on an AudioSource is swapped rather than kept, so five characters
 * cost five entities instead of fifty. The trade is that the first play of any
 * particular clip may hitch while the explorer fetches it; they are 30 to 100
 * kilobytes each and cached afterwards.
 *
 * The source sits on the character rather than on the player, so a voice comes
 * from where its owner is standing.
 */

/** One AudioSource per character, keyed by NpcSpec id. */
const mouths = new Map<string, Entity>()

/**
 * How one character sounds. Mirrors the voice block on their NpcSpec.
 *
 * Passed in rather than looked up, because voice.ts has no business knowing
 * what an NPC is — it is handed an id, a sound, and told to get on with it.
 */
export type VoiceProfile = {
  pitch: number
  /** How far the pitch moves from clip to clip. */
  wobble: number
  /** The breath between clips, in seconds. */
  gapMin: number
  gapMax: number
}

/** Who is talking, how they sound, and how long until the next clip. */
type Talking = {
  id: string
  voice: VoiceProfile
  /** Seconds until the next clip should start. */
  next: number
  /** Which clip is playing, so the next one is never the same. */
  last: number
}

let talking: Talking | undefined
let running = false

/**
 * Gives a character a voice.
 *
 * Called once, as they are built. The entity is separate from the avatar and
 * carries its own Transform: an AvatarShape's transform belongs to the engine,
 * and hanging audio off it would mean the sound following whatever the rig
 * does rather than staying where the character is.
 */
export function giveVoice(id: string, at: { x: number; y: number; z: number }): void {
  if (mouths.has(id)) return

  const mouth = engine.addEntity()
  Transform.create(mouth, {
    // Head height rather than their feet, which is where a voice comes from
    // and, more practically, is above the decking rather than inside it.
    position: Vector3.create(at.x, at.y + VOICE.mouthHeight, at.z)
  })
  AudioSource.create(mouth, {
    audioClipUrl: VOICE.clips[0].file,
    playing: false,
    loop: false,
    volume: VOICE.volume
  })
  mouths.set(id, mouth)
}

// ---------------------------------------------------------------------------
// Talking
// ---------------------------------------------------------------------------

/**
 * Plays one clip and says how long to wait before the next.
 *
 * Which clip is unrelated to what is being said — they are nonsense either
 * way — except that it is never the one that just played. Ten clips picked
 * fairly would repeat about one time in ten, and a repeat is the one thing
 * that gives the trick away: you hear the same three seconds again and it
 * stops being a person.
 */
function playOne(state: Talking): void {
  const mouth = mouths.get(state.id)
  if (!mouth) return
  const source = AudioSource.getMutableOrNull(mouth)
  if (!source) return

  let index = Math.floor(Math.random() * VOICE.clips.length)
  if (VOICE.noRepeats && VOICE.clips.length > 1 && index === state.last) {
    // Step to a neighbour rather than re-rolling. A loop that re-rolls can in
    // principle spin, and a system that runs every frame is not the place for
    // an unbounded one.
    index = (index + 1 + Math.floor(Math.random() * (VOICE.clips.length - 1))) % VOICE.clips.length
  }
  state.last = index

  const clip = VOICE.clips[index]
  const v = state.voice
  const wobble = (Math.random() * 2 - 1) * v.wobble
  const pitch = Math.max(0.3, v.pitch + wobble)

  source.audioClipUrl = clip.file
  source.pitch = pitch
  source.volume = VOICE.volume
  // Toggled rather than set. The explorer replays on the transition, so
  // starting a clip while one is already going is otherwise swallowed and the
  // character falls silent for the rest of the conversation — the same thing
  // the detector's click ran into.
  source.playing = false
  source.playing = true

  // Pitch is speed as well as tone, so a clip played low lasts longer.
  const gap = v.gapMin + Math.random() * Math.max(0, v.gapMax - v.gapMin)
  state.next = clip.seconds / pitch + gap
}

/**
 * Starts somebody talking, and keeps them talking.
 *
 * Called when a conversation opens. Node changes deliberately do not restart
 * it: clicking through four options is one continuous conversation, and
 * cutting the voice off at every click would make it stutter rather than
 * speak.
 */
export function startTalking(id: string, voice: VoiceProfile): void {
  hushAll()
  talking = { id, voice, next: 0, last: -1 }
  playOne(talking)
}

/**
 * Stops whoever is talking.
 *
 * Called when the conversation ends, however it ends — walking away, F, or a
 * parting line. Without it a six-second clip carries on out of somebody you
 * have finished with, and follows you to the next character.
 */
export function stopTalking(): void {
  hushAll()
  talking = undefined
}

function hushAll(): void {
  if (!talking) return
  const mouth = mouths.get(talking.id)
  if (!mouth) return
  const source = AudioSource.getMutableOrNull(mouth)
  if (source) source.playing = false
}

function voiceSystem(dt: number): void {
  if (!talking) return
  talking.next -= dt
  if (talking.next <= 0) playOne(talking)
}

export function setupVoice(): void {
  if (running) return
  running = true
  engine.addSystem(voiceSystem)
}

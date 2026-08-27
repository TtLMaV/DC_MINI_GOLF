import { AvatarLocomotionSettings, engine } from '@dcl/sdk/ecs'

import { DRINK } from './config'
import { room } from './room'

/**
 * The pina colada, and the only temporary thing anybody owns.
 *
 * Decentraland does give a scene control of how fast an avatar moves:
 * AvatarLocomotionSettings on the player entity overrides walk, jog, run and
 * jump. What it does not give is a way to read the defaults back, because the
 * component only ever carries the overrides — which is why removing it, rather
 * than writing "normal" numbers into it, is how the drink wears off. Writing
 * guessed defaults would leave everybody permanently at whatever I guessed.
 *
 * The clock runs here rather than on the server. The server decides whether
 * the drink was bought — that is the part worth defending, since it costs
 * Pixel Points — and then says how long it lasts; counting the seconds down is
 * something the client has to do anyway to show the timer, and a second clock
 * on the server would only be a second answer to the same question. The worst
 * a rewritten client can do with that is keep its own boost running, which
 * costs nobody anything and is not worth a heartbeat message every second.
 */

let secondsLeft = 0
let running = false
/** Seconds since a drink was asked for, while nothing has come back yet. */
let waiting = 0

/** Seconds of drink remaining. Zero when there is none. */
export function drinkLeft(): number {
  return secondsLeft
}

/** Whether one is running right now, for the HUD. */
export function drinkIsUp(): boolean {
  return secondsLeft > 0
}

/**
 * True between asking for a drink and hearing anything back.
 *
 * The dialogue needs this because the node that describes the drink is drawn
 * before the answer arrives, and without it the first frame after ordering
 * reads as a failure — which is exactly the trap the shell hand-over fell into.
 * It clears itself after a couple of seconds so a genuinely silent server does
 * eventually say so rather than pouring forever.
 */
export function drinkPending(): boolean {
  return waiting > 0
}

/** Asks the server for one. It decides whether the wallet can afford it. */
export function buyDrink(): void {
  waiting = 2.5
  void room.send('buyDrink', { one: 1 })
}

/**
 * Starts, or restarts, the boost.
 *
 * Called from the server's answer rather than from the button, so a drink that
 * was refused — no blender yet, not enough points, pressed twice — never lifts
 * anybody off the ground.
 */
export function drinkPoured(seconds: number): void {
  waiting = 0
  if (seconds <= 0) return
  // Restart rather than stack, so six drinks are not half an hour of running.
  secondsLeft = DRINK.restarts ? seconds : Math.max(secondsLeft, seconds)
  apply()
}

function apply(): void {
  AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
    walkSpeed: DRINK.speeds.walk,
    jogSpeed: DRINK.speeds.jog,
    runSpeed: DRINK.speeds.run,
    jumpHeight: DRINK.speeds.jumpHeight
  })
}

function clear(): void {
  // Deleted, not zeroed. The component is an override; with it gone the client
  // goes back to its own numbers, which is the only way to get them back.
  if (AvatarLocomotionSettings.has(engine.PlayerEntity)) {
    AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity)
  }
}

/** Called when the server refuses one, so the dialogue stops saying "pouring". */
export function drinkRefused(): void {
  waiting = 0
}

function drinkSystem(dt: number): void {
  if (waiting > 0) waiting = Math.max(0, waiting - dt)
  if (secondsLeft <= 0) return
  secondsLeft -= dt
  if (secondsLeft <= 0) {
    secondsLeft = 0
    clear()
  }
}

export function setupDrink(): void {
  if (running) return
  running = true
  // Cleared at startup as well as on expiry. Nothing should carry a boost
  // across a reload, and a stale component from a previous session would be
  // invisible and permanent.
  clear()
  engine.addSystem(drinkSystem)
}

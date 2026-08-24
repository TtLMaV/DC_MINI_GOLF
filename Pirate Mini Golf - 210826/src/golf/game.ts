import { engine, InputAction, inputSystem, PointerEventType, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'

import {
  Aim,
  createAim,
  setLineVisible,
  setRingVisible,
  SurfaceProbe,
  updateLine,
  updateRing
} from './aim'
import { Club, createClub, playStrike, updateClub } from './club'
import { ADMIN, BOARD, CUP, FREE, RULES, SHOT } from './config'
import { cupCentre, Hole, HOLES, PRACTICE, SECRET, teeStand, TOTAL_PAR } from './course'
import { boardPosition, markJoined, markLeft, requestJoin, updateBoard } from './board'
import { myRow, myUserId, publishBall, roster, updateRemotes } from './net'
import { close as closeDialog, talking, updateNpcs } from './npc'
import { claimSecretHole, previewAward, submitRound } from './points'
import { report as reportQuest } from './quests'
import { closeShop, shopOpen } from './shop'
import { play, setCharging } from './sfx'
import { createSwing, deviationDegrees, resetSwing, strikeLabel, Swing, updateSwing } from './swing'

/**
 * The rules layer: which hole you are on, how many shots it has taken, when the
 * ball is holed or lost, and moving you to the next tee.
 *
 * It does not simulate anything. index.ts owns the cannon world and hands over
 * the small interface below, so the physics setup stays exactly as it is.
 */

export type Physics = {
  ballRadius: number
  position(): { x: number; y: number; z: number }
  speed(): number
  /** Horizontal speed alone, which is what decides a lip-out. */
  flatSpeed(): number
  settled(): boolean
  place(x: number, y: number, z: number): void
  strike(dirX: number, dirZ: number, power: number): void
  freeze(): void
  probe: SurfaceProbe
  /** How far the ball rolls on the flat for a given charge, in metres. */
  predictRoll(power: number): number
}

type ballStats = {
  ballpowerMod: number
  ballAngleMod: number
}

export let curball: ballStats = {
  ballAngleMod: 0,
  ballpowerMod: 0.7
}

export type Phase =
  | 'walking' // too far from the ball to play
  | 'ready' // in range, waiting to address
  | 'address' // stood over the ball, lining the shot up
  | 'swinging' // the meter is running
  | 'rolling'
  | 'sinking'
  | 'between'
  | 'finished'

export type Toast = {
  title: string
  detail: string
  ttl: number
  tone: 'good' | 'bad' | 'neutral'
}

export type GameState = {
  phase: Phase
  holeIndex: number
  strokes: number
  /** Score per hole, -1 until played. */
  card: number[]
  toast: Toast | null
  distanceToBall: number
  distanceToPin: number
  /** How far the shot at the meter's current reading would travel. */
  shotDistance: number
  /** How the last strike came off the face, e.g. PERFECT or SLICED. */
  lastStrike: string
  penalties: number
  /** Signed up at the board. */
  joined: boolean
  /** Times round the nine, so a lapped card does not stall the group. */
  round: number
  /** Metres to the sign-up board, while in the lobby. */
  toBoard: number
  /** The hole-select test panel is showing. */
  adminOpen: boolean
  /**
   * Knocking about on the practice green rather than playing the round.
   *
   * True whenever the player is not signed on — on arrival, and again once the
   * nine are done — so the practice hole is simply what you are playing when
   * you are not playing the course.
   */
  practising: boolean
  /** Putts holed on the practice green this visit. */
  practicePutts: number
  /** Which of the two free holes is in play. */
  freeHole: 'practice' | 'secret'
}

export class Game {
  readonly state: GameState = {
    phase: 'walking',
    holeIndex: 0,
    strokes: 0,
    card: HOLES.map(() => -1),
    toast: null,
    distanceToBall: 99,
    distanceToPin: 0,
    shotDistance: 0,
    lastStrike: '',
    penalties: 0,
    joined: false,
    round: 0,
    toBoard: 999,
    adminOpen: false,
    practising: true,
    practicePutts: 0,
    freeHole: 'practice'
  }

  /** The swing meter, read directly by the HUD. */
  readonly swing: Swing = createSwing()

  private physics: Physics
  private aim: Aim
  /**
   * The player's putter.
   *
   * Public only so the shop can swap its model when a different club is
   * equipped — the swing, the grip and the emote all stay where they are.
   */
  readonly club: Club
  /** Aim direction as a compass yaw in radians, taken from where you look. */
  private aimYaw = 0

  private settleTimer = 0
  /** Ball position last frame, so a fast pass over the cup cannot be missed. */
  private lastBall = Vector3.Zero()
  /** Where a lost or reset ball is replayed from. */
  private safe = Vector3.Zero()

  private sinkTimer = 0
  private sinkFrom = Vector3.Zero()
  private sinkTo = Vector3.Zero()
  private betweenTimer = 0
  /** Ignore input briefly after a state change so one press can't do two jobs. */
  private inputLock = 0

  constructor(physics: Physics) {
    this.physics = physics
    this.aim = createAim(physics.ballRadius)
    this.club = createClub()
  }

  /**
   * The hole being played.
   *
   * Returning PRACTICE here rather than special-casing it everywhere means
   * aiming, the meter, the club, the cup test and the lost-ball floor all work
   * on the practice green with no changes. The only thing that differs is what
   * happens when the ball drops, and that is handled in scoreHole.
   */
  get hole(): Hole {
    if (!this.state.practising) return HOLES[this.state.holeIndex]
    return this.state.freeHole === 'secret' ? SECRET : PRACTICE
  }

  get playedTotal(): number {
    return this.state.card.reduce((n, s) => (s >= 0 ? n + s : n), 0)
  }

  get toPar(): number {
    let total = 0
    let par = 0
    for (let i = 0; i < HOLES.length; i++) {
      if (this.state.card[i] >= 0) {
        total += this.state.card[i]
        par += HOLES[i].par
      }
    }
    return total - par
  }

  // -------------------------------------------------------------------------

  start(): void {
    this.beginPractice(false)
    this.toast(
      'Pirate Mini Golf',
      'Have a putt on the practice green. Join a round at the board when you are ready.',
      'neutral',
      8
    )
  }

  /**
   * Puts the ball on the practice tee and lets the ordinary shot pipeline run.
   *
   * Practice is not a separate mode with its own rules — it is the normal game
   * pointed at a hole that never scores. That keeps one code path for aiming,
   * the meter, the club and the cup, so anything that works out on the course
   * works here and the two cannot drift apart.
   */
  private beginPractice(announce = true): void {
    this.beginFree(this.state.freeHole, announce)
  }

  /**
   * Puts the ball on one of the two free holes and lets the ordinary shot
   * pipeline run.
   *
   * Free play is not a separate mode with its own rules — it is the normal
   * game pointed at a hole that never scores. That keeps one code path for
   * aiming, the meter, the club and the cup, so anything that works out on the
   * course works here and the two cannot drift apart.
   */
  private beginFree(which: 'practice' | 'secret', announce = true): void {
    this.state.practising = true
    this.state.freeHole = which
    const hole = which === 'secret' ? SECRET : PRACTICE
    this.state.strokes = 0
    this.state.lastStrike = ''
    this.settleTimer = RULES.settleTime
    this.inputLock = 0.4
    resetSwing(this.swing)
    this.setPhase('walking')

    this.teeUp(hole)
    setRingVisible(this.aim, true)
    const cup = cupCentre(hole)
    this.aimYaw = Math.atan2(cup.x - hole.tee.x, cup.z - hole.tee.z)

    if (announce) this.toast(hole.name, hole.hint, 'neutral', 4)
  }

  /**
   * Moves the ball between the practice green and the secret hole by walking.
   *
   * Only ever between shots and only with the ball at rest, so nobody loses a
   * ball in flight by wandering. Whichever tee you are stood next to is the
   * one you are playing.
   */
  private updateFreeHole(): void {
    if (this.state.phase !== 'walking' || !this.physics.settled()) return
    const player = Transform.getOrNull(engine.PlayerEntity)
    if (!player) return

    const other = this.state.freeHole === 'practice' ? SECRET : PRACTICE
    const dx = player.position.x - other.tee.x
    const dz = player.position.z - other.tee.z
    if (Math.sqrt(dx * dx + dz * dz) > FREE.switchRange) return

    this.beginFree(this.state.freeHole === 'practice' ? 'secret' : 'practice')
  }

  /** Called by the sign-up board. */
  join(): void {
    if (this.state.joined) return
    this.state.joined = true
    this.state.practising = false
    this.state.practicePutts = 0
    markJoined()

    const row = myRow()
    if (row) {
      row.joined = true
      row.round = this.state.round
      row.holeIndex = 0
      row.strokes = 0
      row.card = this.state.card.slice()
    }

    this.beginHole(0, false)
    this.movePlayerToTee(HOLES[0])

    const others = roster().length - 1
    this.toast(
      `Hole 1 — ${HOLES[0].name}`,
      others > 0
        ? `Par ${HOLES[0].par}. Playing with ${others} other${others === 1 ? '' : 's'}.`
        : `Par ${HOLES[0].par}. ${HOLES[0].hint}`,
      'neutral',
      5
    )
  }

  restart(): void {
    this.state.practising = false
    for (let i = 0; i < this.state.card.length; i++) this.state.card[i] = -1
    this.state.penalties = 0
    this.beginHole(0)
    this.movePlayerToTee(HOLES[0])
  }

  private beginHole(index: number, announce = true): void {
    const hole = HOLES[index]
    this.state.practising = false
    this.state.holeIndex = index
    this.state.strokes = 0
    this.state.lastStrike = ''
    this.settleTimer = RULES.settleTime
    this.setPhase('walking')
    this.inputLock = 0.5
    resetSwing(this.swing)

    this.teeUp(hole)
    setRingVisible(this.aim, true)

    // Start lined up down the hole.
    const cup = cupCentre(hole)
    this.aimYaw = Math.atan2(cup.x - hole.tee.x, cup.z - hole.tee.z)

    if (announce) {
      this.toast(`Hole ${hole.number} — ${hole.name}`, `Par ${hole.par}. ${hole.hint}`, 'neutral', 5)
    }
  }

  private teeUp(hole: Hole): void {
    // Clear the swept-test history, or the first shot is tested against a
    // segment that starts wherever the ball was on the last hole.
    this.lastBall = Vector3.create(hole.tee.x, hole.tee.y, hole.tee.z)
    const y = hole.tee.y + this.physics.ballRadius + 0.01
    this.physics.place(hole.tee.x, y, hole.tee.z)
    this.safe = Vector3.create(hole.tee.x, y, hole.tee.z)
  }

  private movePlayerToTee(hole: Hole): void {
    const stand = teeStand(hole)
    const cup = cupCentre(hole)
    void movePlayerTo({
      newRelativePosition: Vector3.create(stand.x, stand.y, stand.z),
      cameraTarget: Vector3.create(cup.x, cup.y + 0.6, cup.z)
    })
  }

  private toast(title: string, detail: string, tone: Toast['tone'], ttl = 3): void {
    this.state.toast = { title, detail, ttl, tone }
  }

  /** A callout raised by something outside the game layer, e.g. a quest paid out. */
  announce(title: string, detail: string, tone: Toast['tone'] = 'good', ttl = 5): void {
    this.toast(title, detail, tone, ttl)
  }



  /**
   * The board is clickable, but a player who cannot find it, or whose pointer
   * misses the panel, would just stand there pressing E at nothing. So E works
   * anywhere within reach of the board too.
   */
  private updateLobby(): void {
    const player = Transform.getOrNull(engine.PlayerEntity)
    const board = boardPosition()
    if (player) {
      const dx = player.position.x - board.x
      const dz = player.position.z - board.z
      this.state.toBoard = Math.sqrt(dx * dx + dz * dz)
    }
    if (this.state.toBoard <= BOARD.reach && this.clicked()) requestJoin()
  }


  /** Whether this player may open the test panel. */
  private adminAllowed(): boolean {
    if (!ADMIN.enabled) return false
    if (ADMIN.allow.length === 0) return true
    const me = myUserId().toLowerCase()
    return ADMIN.allow.some((a) => a.toLowerCase() === me)
  }

  /**
   * Drop straight onto a hole. Signs you up if you are not already in, so the
   * card and the leaderboard behave exactly as they would in a real round —
   * the point is to test the hole, not a special case of it.
   */
  gotoHole(index: number): void {
    if (index < 0 || index >= HOLES.length) return
    this.state.adminOpen = false
    this.state.practising = false

    if (!this.state.joined) {
      this.state.joined = true
      markJoined()
    }
    const row = myRow()
    if (row) {
      row.joined = true
      row.round = this.state.round
      row.card = this.state.card.slice()
    }

    this.beginHole(index, false)
    this.movePlayerToTee(HOLES[index])
    const hole = HOLES[index]
    this.toast(`Hole ${hole.number} — ${hole.name}`, `Par ${hole.par}. ${hole.hint}`, 'neutral', 4)
  }

  /**
   * Drops straight onto one of the two free holes.
   *
   * The secret hole is out past the end of the course and the practice green is
   * back at the Shack, so reaching either one on foot to test it is a long
   * walk. This is the same door the hole buttons use.
   *
   * It leaves the round first. Free play only runs while you are not signed on
   * — the board has to be offering again, and the card has to stop mattering —
   * so jumping to the practice green mid-round quietly ends the round, exactly
   * as finishing the nine does.
   */
  gotoFree(which: 'practice' | 'secret'): void {
    this.state.adminOpen = false

    if (this.state.joined) {
      this.state.joined = false
      markLeft()
      const row = myRow()
      if (row) row.joined = false
    }

    const hole = which === 'secret' ? SECRET : PRACTICE
    this.beginFree(which, false)
    this.movePlayerToTee(hole)
    this.toast(hole.name, hole.hint, 'neutral', 4)
  }

  /** Wipes the card without leaving the hole you are on. */
  clearCard(): void {
    for (let i = 0; i < this.state.card.length; i++) this.state.card[i] = -1
    this.state.penalties = 0
    this.state.strokes = 0
    const row = myRow()
    if (row) row.card = this.state.card.slice()
    this.toast('Card cleared', 'Every hole back to unplayed.', 'neutral', 2)
  }

  closeAdmin(): void {
    this.state.adminOpen = false
    this.inputLock = 0.2
  }

  /** Pushes my card to everyone else. Cheap: only writes when something moved. */
  private publish(): void {
    const row = myRow()
    if (!row) return
    if (row.holeIndex !== this.state.holeIndex) row.holeIndex = this.state.holeIndex
    if (row.strokes !== this.state.strokes) row.strokes = this.state.strokes
    if (row.round !== this.state.round) row.round = this.state.round
    for (let i = 0; i < this.state.card.length; i++) {
      if (row.card[i] !== this.state.card[i]) row.card = this.state.card.slice()
    }
  }

  private setPhase(phase: Phase): void {
    if (this.state.phase === phase) return
    this.state.phase = phase
  }

  // -------------------------------------------------------------------------

  update(dt: number): void {
    // These run whether or not you are playing — a spectator should still see
    // the board fill up and everyone else's balls moving.
    updateBoard(dt)
    updateRemotes(dt)
    updateNpcs(dt)

    // The inventory takes the controls the same way a conversation does — every
    // row of it is a click target, and a stray E while reading prices should
    // not put the ball down the fairway.
    if (shopOpen()) {
      if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) closeShop()
      return
    }

    // A conversation takes over the controls. Without this, E would advance the
    // dialog and swing the club on the same press, and the ball would be gone
    // before you had finished reading.
    if (talking()) {
      if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) closeDialog()
      return
    }

    if (this.inputLock > 0) this.inputLock = Math.max(0, this.inputLock - dt)
    if (this.state.toast) {
      this.state.toast.ttl -= dt
      if (this.state.toast.ttl <= 0) this.state.toast = null
    }

    // The board stays live the whole time you are not signed on, but it no
    // longer owns the frame: the practice ball has to keep playing underneath
    // it, which is the whole point of the green being usable while you wait.
    if (!this.state.joined) {
      this.updateLobby()
      this.updateFreeHole()
    }

    // The test panel toggle — the 2 key. Ahead of everything else so it opens
    // from any state, including mid-swing when you have just realised you
    // wanted a different hole.
    if (
      this.adminAllowed() &&
      inputSystem.isTriggered(InputAction.IA_ACTION_4, PointerEventType.PET_DOWN)
    ) {
      this.state.adminOpen = !this.state.adminOpen
      if (this.state.adminOpen) {
        resetSwing(this.swing)
        setCharging(false)
      }
      this.inputLock = 0.2
      return
    }

    // While it is open it owns the controls, so a click on a hole button
    // cannot also swing the club.
    if (this.state.adminOpen) return

    // F is handled here rather than inside the per-phase updates.
    //
    // Cancelling was previously checked inside updateSwinging behind the same
    // inputLock as every other key, and the lock is set the instant the meter
    // starts — which is exactly when someone realises the power is wrong and
    // stabs F. Cancelling is never destructive, so it does not need the
    // debounce that firing a shot does, and running it before the phase switch
    // means nothing earlier in the frame can eat it.
    if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) {
      if (this.cancelShot()) return
    }

    const ball = this.physics.position()
    publishBall(dt, ball.x, ball.y, ball.z, !this.physics.settled())

    // The 1 key does the same job as the RESET BALL button, for players who
    // would rather not take their hand off the keyboard. SDK7 exposes a fixed
    // set of actions: primary is E, secondary is F, and action_3..6 are the
    // number keys 1/2/3/4. There is no way to bind a letter of your choosing.
    if (
      this.inputLock <= 0 &&
      this.state.phase !== 'finished' &&
      this.state.phase !== 'sinking' &&
      this.state.phase !== 'between' &&
      inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)
    ) {
      this.resetBall()
      return
    }

    switch (this.state.phase) {
      case 'walking':
      case 'ready':
        this.updateApproach(dt)
        break
      case 'address':
        this.updateAddressing(dt)
        break
      case 'swinging':
        this.updateSwinging(dt)
        break
      case 'rolling':
        this.updateRolling(dt)
        break
      case 'sinking':
        this.updateSinking(dt)
        break
      case 'between':
        // Straight on to the next tee. Play used to gate here until everyone
        // on the hole had holed out, which meant one slow or idle player
        // stopped the whole course. Everybody now plays at their own pace and
        // simply watches each other's balls instead.
        this.betweenTimer -= dt
        if (this.betweenTimer <= 0) this.advance()
        break
      case 'finished':
        if (this.clicked()) this.restart()
        break
    }

    this.updateVisuals()
    this.publish()

    const swinging = this.state.phase === 'address' || this.state.phase === 'swinging'
    const backswing =
      this.swing.phase === 'power'
        ? this.swing.cursor
        : this.swing.phase === 'accuracy'
        ? this.swing.power
        : 0
    updateClub(this.club, dt, swinging, backswing)
  }

  /**
   * The action button. E and only E — the pointer used to be bound here too,
   * so a stray click fired the swing on top of the key press.
   */
  private clicked(): boolean {
    if (this.inputLock > 0) return false
    return inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)
  }


  /**
   * F. Backs out one step: out of the swing to addressing, then out of
   * addressing to walking. Returns true if it did something, so the caller
   * knows to skip the rest of the frame.
   */
  private cancelShot(): boolean {
    const phase = this.state.phase
    if (phase === 'swinging') {
      resetSwing(this.swing)
      setCharging(false)
      setLineVisible(this.aim, true)
      this.setPhase('address')
      this.toast('Swing cancelled', 'No stroke counted. Line it up again.', 'neutral', 1.6)
      return true
    }
    if (phase === 'address') {
      resetSwing(this.swing)
      setCharging(false)
      this.setPhase('walking')
      this.inputLock = 0.25
      return true
    }
    return false
  }

  private measure(): { x: number; y: number; z: number } {
    const ball = this.physics.position()
    const player = Transform.getOrNull(engine.PlayerEntity)
    if (player) {
      const dx = ball.x - player.position.x
      const dz = ball.z - player.position.z
      const dy = Math.max(0, Math.abs(ball.y - player.position.y) - 1.2)
      this.state.distanceToBall = Math.sqrt(dx * dx + dz * dz + dy * dy)
    }
    const pin = cupCentre(this.hole)
    this.state.distanceToPin = Math.sqrt(
      (pin.x - ball.x) * (pin.x - ball.x) + (pin.z - ball.z) * (pin.z - ball.z)
    )
    return ball
  }

  // --- walking up ----------------------------------------------------------

  private updateApproach(dt: number): void {
    this.measure()

    if (this.physics.settled()) this.settleTimer += dt
    else this.settleTimer = 0

    const canPlay = this.state.distanceToBall <= SHOT.reach && this.settleTimer >= RULES.settleTime
    this.setPhase(canPlay ? 'ready' : 'walking')

    if (canPlay && this.clicked()) {
      this.readAimFromCamera()
      this.setPhase('address')
      this.inputLock = 0.25
      resetSwing(this.swing)
    }
  }

  // --- addressing ----------------------------------------------------------

  private updateAddressing(_dt: number): void {
    this.measure()

    // The aim simply is where you are looking. No scene camera, no keys to turn
    // with — the previous version took the camera off you to make A and D work,
    // and that is what felt broken. Now the line on the floor and your view are
    // the same thing by construction.
    this.readAimFromCamera()

    if (this.clicked()) {
      resetSwing(this.swing)
      // Start the meter on this same press.
      updateSwing(this.swing, 0, true)
      this.setPhase('swinging')
      this.inputLock = 0.1
    }
  }

  /**
   * Horizontal facing of the player camera, as a compass yaw. Pulled straight
   * off the camera transform, which is only readable because nothing is
   * overriding the camera any more.
   */
  private readAimFromCamera(): void {
    const cam = Transform.getOrNull(engine.CameraEntity)
    if (!cam) return
    const q = cam.rotation
    const fx = 2 * (q.x * q.z + q.w * q.y)
    const fz = 1 - 2 * (q.x * q.x + q.y * q.y)
    if (Math.abs(fx) < 1e-6 && Math.abs(fz) < 1e-6) return
    this.aimYaw = Math.atan2(fx, fz)
  }

  private aimVector(): { x: number; z: number } {
    return { x: Math.sin(this.aimYaw), z: Math.cos(this.aimYaw) }
  }

  // --- the swing meter -----------------------------------------------------

  private updateSwinging(dt: number): void {
    // Aim is locked the moment the meter starts, so looking around mid-swing
    // cannot drag the shot with it.
    this.measure()

    const fired = updateSwing(this.swing, dt, this.clicked())
    if (!fired) {
      setCharging(true, this.swing.phase === 'power' ? this.swing.cursor : this.swing.power)
    } else {
      this.release()
    }
  }
  
  private release(): void {
    const ball = this.physics.position()
    const power = this.swing.power * curball.ballpowerMod

    // A missed impact click bends the shot off the aim line. This is the only
    // thing that makes the meter a skill rather than a formality.
    const aim = this.aimVector()
    const bend = (1 - curball.ballAngleMod) * (deviationDegrees(this.swing) * Math.PI) / 180
    //console.log(bend)
    const cos = Math.cos(bend)
    const sin = Math.sin(bend)
    const dirX = aim.x * cos + aim.z * sin
    const dirZ = -aim.x * sin + aim.z * cos

    this.physics.strike(dirX, dirZ, power)

    this.state.strokes++
    this.state.lastStrike = strikeLabel(this.swing)
    this.settleTimer = 0
    setCharging(false)
    setLineVisible(this.aim, false)
    playStrike(this.club, power)
    play('putt', ball.x, ball.y, ball.z, 0.5 + power * 0.5, 0.94 + power * 0.22)

    this.setPhase('rolling')
    this.inputLock = 0.35
    resetSwing(this.swing)
  }

  // --- ball in motion -------------------------------------------------------

  private updateRolling(dt: number): void {
    const ball = this.measure()

    const holed = this.checkHoled(ball)
    this.lastBall = Vector3.create(ball.x, ball.y, ball.z)
    if (holed) return
    if (this.checkLost(ball)) return

    if (this.physics.settled()) {
      this.settleTimer += dt
      if (this.settleTimer >= RULES.settleTime) {
        // Stopped. If it stopped in the hole, it is in the hole.
        if (this.restingInCup(ball)) {
          const cup = this.hole.cup
          if (cup.kind === 'cup') {
            this.holeOut(cup.centre.x, cup.floorY + this.physics.ballRadius, cup.centre.z)
            return
          }
        }
        this.safe = Vector3.create(ball.x, ball.y, ball.z)
        this.afterShot()
      }
    } else {
      this.settleTimer = 0
    }
  }

  /**
   * Did that shot go in?
   *
   * Three things were letting balls sit in the hole uncounted.
   *
   * The speed gate used 3D speed. A ball dropping into a cup gains vertical
   * speed immediately — a couple of tenths of a metre of fall is already 2 m/s
   * — so by the frame it was below the rim it often read as "too fast" and was
   * treated as a lip-out. What actually decides a lip-out is how fast it is
   * crossing the hole, so the gate is on horizontal speed now.
   *
   * The test was a single point sampled once a frame. A ball crossing the cup
   * off-centre can travel further between frames than the chord it cuts
   * through the capture circle, and skip it entirely. It is now swept: the
   * whole segment from last frame's position to this one is tested.
   *
   * And nothing re-checked a ball that had already stopped. See restingInCup.
   */
  private checkHoled(ball: { x: number; y: number; z: number }): boolean {
    const cup = this.hole.cup

    if (cup.kind === 'cup') {
      const near = this.sweptDistanceToCup(ball, cup.centre.x, cup.centre.z)
      const belowRim = ball.y < cup.centre.y + this.physics.ballRadius * 0.8
      if (near < CUP.captureRadius && belowRim && this.physics.flatSpeed() < CUP.captureSpeed) {
        this.holeOut(cup.centre.x, cup.floorY + this.physics.ballRadius, cup.centre.z)
        return true
      }
      return false
    }

    if (
      ball.x > cup.min.x &&
      ball.x < cup.max.x &&
      ball.y > cup.min.y &&
      ball.y < cup.max.y &&
      ball.z > cup.min.z &&
      ball.z < cup.max.z
    ) {
      this.holeOut(ball.x, cup.centre.y, ball.z)
      return true
    }
    return false
  }

  /**
   * Closest the ball got to the cup axis on its way here, rather than where it
   * happens to be at the instant we looked.
   */
  private sweptDistanceToCup(
    ball: { x: number; y: number; z: number },
    cupX: number,
    cupZ: number
  ): number {
    const ax = this.lastBall.x - cupX
    const az = this.lastBall.z - cupZ
    const bx = ball.x - cupX
    const bz = ball.z - cupZ
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz
    if (len2 < 1e-9) return Math.sqrt(bx * bx + bz * bz)
    // Where along the segment the cup axis is nearest, clamped to the segment.
    let t = -(ax * dx + az * dz) / len2
    t = Math.max(0, Math.min(1, t))
    const cx = ax + dx * t
    const cz = az + dz * t
    return Math.sqrt(cx * cx + cz * cz)
  }

  /**
   * A ball that has come to rest in the hole is in the hole, however it got
   * there and however fast it was going on the way. This is the backstop: once
   * the ball stops, holing was never re-tested, so anything the gates above
   * turned away simply sat there and counted as a normal lie.
   */
  private restingInCup(ball: { x: number; y: number; z: number }): boolean {
    const cup = this.hole.cup
    if (cup.kind !== 'cup') return false
    const dx = ball.x - cup.centre.x
    const dz = ball.z - cup.centre.z
    const flat = Math.sqrt(dx * dx + dz * dz)
    // Slightly more generous than the capture radius: it is already stopped,
    // so there is no lip-out left to judge, only whether it is in the hole.
    const belowRim = ball.y < cup.centre.y + this.physics.ballRadius * 0.9
    return flat < CUP.restRadius && belowRim
  }



  private checkLost(ball: { x: number; y: number; z: number }): boolean {
    const floor = Math.min(this.hole.tee.y, cupCentre(this.hole).y)
    if (ball.y > floor - RULES.lostBelowTee && ball.y > -10) return false

    play('splash', ball.x, ball.y, ball.z, 0.8)
    this.state.strokes += RULES.hazardPenalty
    this.state.penalties += RULES.hazardPenalty
    this.toast(
      'Lost ball',
      `+${RULES.hazardPenalty} stroke. Playing again from where it last came to rest.`,
      'bad',
      3.2
    )
    this.physics.place(this.safe.x, this.safe.y, this.safe.z)
    this.afterShot()
    return true
  }

  private afterShot(): void {
    this.settleTimer = 0

    // The limit is the hole's own if it has one, and the ordinary ten out on
    // the course. The practice green sets neither, which is the point of it —
    // being told to pick up after ten goes at a warm-up putt would be absurd.
    const limit = this.hole.maxStrokes ?? (this.state.practising ? 0 : RULES.maxStrokes)
    if (limit > 0 && this.state.strokes >= limit) {
      this.toast('Picked up', `Maximum ${limit} strokes on ${this.hole.name}.`, 'bad', 3.5)
      // Free play has no card to write to, so being picked up is simply the
      // ball going back on the tee. Routing it through scoreHole would run the
      // holed-out branch and congratulate you for running out of shots.
      if (this.state.practising) this.beginFree(this.state.freeHole, false)
      else this.scoreHole(limit)
      return
    }
    this.setPhase('walking')
  }

  /**
   * Puts the ball back where it last came to rest. For when it settles somewhere
   * silly — wedged against a prop, or on a ledge you cannot stand next to.
   */
  resetBall(): void {
    const p = this.state.phase
    if (p === 'sinking' || p === 'between' || p === 'finished') return
    resetSwing(this.swing)
    setCharging(false)
    this.physics.place(this.safe.x, this.safe.y, this.safe.z)
    this.state.strokes += RULES.resetPenalty
    this.settleTimer = 0
    this.setPhase('walking')
    this.inputLock = 0.4
    this.toast(
      'Ball reset',
      RULES.resetPenalty > 0
        ? `Back to your last lie, +${RULES.resetPenalty} stroke.`
        : 'Back to your last lie, no penalty.',
      'neutral',
      2.4
    )
  }

  // --- holing out -----------------------------------------------------------

  private holeOut(x: number, y: number, z: number): void {
    const ball = this.physics.position()
    this.physics.freeze()
    this.sinkFrom = Vector3.create(ball.x, ball.y, ball.z)
    this.sinkTo = Vector3.create(x, y, z)
    this.sinkTimer = 0
    this.setPhase('sinking')
    setLineVisible(this.aim, false)
    play('drop', x, y, z, 0.9)
  }

  private updateSinking(dt: number): void {
    this.sinkTimer += dt
    const p = Math.min(1, this.sinkTimer / CUP.dropTime)
    const ease = p * p * (3 - 2 * p)
    this.physics.place(
      this.sinkFrom.x + (this.sinkTo.x - this.sinkFrom.x) * ease,
      this.sinkFrom.y + (this.sinkTo.y - this.sinkFrom.y) * ease,
      this.sinkFrom.z + (this.sinkTo.z - this.sinkFrom.z) * ease
    )
    if (p >= 1) this.scoreHole(this.state.strokes)
  }

  private scoreHole(strokes: number): void {
    // Nothing on the practice green touches the card. Hole it and the ball is
    // straight back on the tee, which is what makes it worth standing there
    // hitting the same putt until the meter stops surprising you.
    if (this.state.practising) {
      const secret = this.state.freeHole === 'secret'
      reportQuest({ kind: 'holed', where: secret ? 'secret' : 'practice', hole: 0, strokes })
      if (!secret) this.state.practicePutts++
      const n = this.state.practicePutts
      play('holed', this.sinkTo.x, this.sinkTo.y, this.sinkTo.z, 0.85)
      this.toast(
        strokes === 1 ? 'In one' : secret ? 'You holed the secret' : 'Holed',
        secret
          ? `${strokes} shot${strokes === 1 ? '' : 's'}. Very few people see that.`
          : `${strokes} shot${strokes === 1 ? '' : 's'}. That's ${n} down on the practice green.`,
        strokes === 1 || secret ? 'good' : 'neutral',
        secret ? 4 : 2.4
      )
      // The one thing in free play that pays, and only the first time it is
      // ever done. The award lands a moment later, so it gets its own toast
      // rather than trying to be part of this one.
      if (secret) claimSecretHole()

      this.beginFree(this.state.freeHole, false)
      return
    }

    const hole = this.hole
    reportQuest({ kind: 'holed', where: 'course', hole: hole.number, strokes })
    this.state.card[this.state.holeIndex] = strokes
    const diff = strokes - hole.par

    let title = `+${diff}`
    let tone: Toast['tone'] = 'bad'
    if (strokes === 1) {
      title = 'HOLE IN ONE!'
      tone = 'good'
    } else if (diff <= -2) {
      title = 'EAGLE'
      tone = 'good'
    } else if (diff === -1) {
      title = 'BIRDIE'
      tone = 'good'
    } else if (diff === 0) {
      title = 'PAR'
      tone = 'good'
    } else if (diff === 1) {
      title = 'BOGEY'
      tone = 'neutral'
    } else if (diff === 2) {
      title = 'DOUBLE BOGEY'
    }

    const overall = this.toPar
    const standing =
      overall === 0 ? 'level par' : overall > 0 ? `${overall} over` : `${-overall} under`
    this.toast(
      title,
      `${strokes} shot${strokes === 1 ? '' : 's'} on hole ${hole.number}. You're ${standing}.`,
      tone,
      RULES.advanceDelay
    )
    play('holed', this.sinkTo.x, this.sinkTo.y, this.sinkTo.z, 0.85)

    setRingVisible(this.aim, false)
    setLineVisible(this.aim, false)
    this.setPhase('between')
    this.betweenTimer = RULES.advanceDelay
  }

  private advance(): void {
    const next = this.state.holeIndex + 1
    if (next >= HOLES.length) {
      this.finishRound()
      return
    }
    this.beginHole(next)
    this.movePlayerToTee(HOLES[next])
  }

  /**
   * End of the nine. Play is continuous, so rather than parking on a results
   * screen the card is banked, the round counter ticks over and you go straight
   * back to the first tee. The leaderboard on screen is the results screen.
   */
  private finishRound(): void {
    const total = this.playedTotal
    const overall = this.toPar
    reportQuest({ kind: 'roundComplete', strokes: total, toPar: overall })
    const label = overall === 0 ? 'level par' : overall > 0 ? `+${overall}` : `${overall}`

    const field = roster().filter((p) => p.round === this.state.round)
    const beaten = field.filter((p) => {
      if (p.userId === myUserId()) return false
      const theirs = p.card.reduce((n, sc) => (sc >= 0 ? n + sc : n), 0)
      const played = p.card.filter((sc) => sc >= 0).length
      return played === HOLES.length && theirs > total
    }).length
    const place = field.length > 1 ? `  Beat ${beaten} of ${field.length - 1}.` : ''

    this.toast(
      'Round complete',
      `${total} shots for the nine, ${label} against a par of ${TOTAL_PAR}.${place} Going again.`,
      overall <= 0 ? 'good' : 'neutral',
      RULES.advanceDelay + 3
    )

    // Pixel Points. The card goes up once, here, and nowhere else — the server
    // scores it and answers with its own callout, so nothing on this side ever
    // announces a payment that might not have happened.
    const preview = previewAward(this.state.card)
    submitRound(this.state.card.slice())
    if (preview.total > 0) {
      this.toast(
        'Card in',
        `${preview.lines.map((l) => l.label).join(', ')}.`,
        'good',
        4
      )
    }

    this.state.round++
    this.state.penalties = 0
    for (let i = 0; i < this.state.card.length; i++) this.state.card[i] = -1

    const row = myRow()
    if (row) {
      row.round = this.state.round
      row.card = this.state.card.slice()
    }

    // Out of the round and back on the practice green rather than straight
    // into another nine. The board is the way back in, so a player who has
    // just finished can stand and putt, read the leaderboard, or sign on again
    // — and nobody is dragged into a fresh card they did not ask for.
    this.state.joined = false
    markLeft()
    const row2 = myRow()
    if (row2) row2.joined = false

    this.beginPractice(false)
    this.movePlayerToTee(PRACTICE)
  }

  // --- what the player sees -------------------------------------------------

  private updateVisuals(): void {
    const phase = this.state.phase
    if (phase === 'between' || phase === 'finished') {
      this.state.shotDistance = 0
      setLineVisible(this.aim, false)
      return
    }

    const ball = this.physics.position()
    const lining = phase === 'address' || phase === 'swinging'

    // The ring stays on whenever the ball is in play — on a course this bright
    // a small white ball is genuinely hard to find, and the ring doubles as the
    // thing that tells you where it is.
    updateRing(this.aim, this.physics.probe, ball.x, ball.y, ball.z)

    setLineVisible(this.aim, lining)
    if (!lining) {
      this.state.shotDistance = 0
      return
    }

    const aim = this.aimVector()
    updateLine(this.aim, this.physics.probe, ball.x, ball.y, ball.z, aim.x, aim.z)

    // Still worth knowing how far the current meter reading actually carries,
    // even though nothing is drawn for it any more — the HUD prints the number.
    const reading =
      this.swing.phase === 'power'
        ? this.swing.cursor
        : this.swing.phase === 'idle'
        ? 0.55
        : this.swing.power
    this.state.shotDistance = this.physics.predictRoll(reading)
  }
}

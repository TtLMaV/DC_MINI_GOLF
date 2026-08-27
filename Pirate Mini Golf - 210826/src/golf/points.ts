import { engine } from '@dcl/sdk/ecs'

import { ADMIN, POINTS } from './config'
import { HOLES } from './course'
import { room } from './room'
import { ItemKind, syncInventory } from './shop'
import { standing, Standing } from './ranks'
import { setCoconutsCarried } from './coconuts'
import { drinkPoured, drinkRefused } from './drink'
import { showLevelUp } from './levelup'
import { identityReady, myDisplayName, myUserId } from './net'
import { setStandings } from './standings'
import { setShellsCarried } from './shells'
import { setScrapCarried } from './detector'

/**
 * Pixel Points: the client's view of the ledger.
 *
 * It holds no truth. The server owns the balance, the claims and the quest
 * tallies, and this is a copy of the last thing it said — every message that
 * changes anything comes back as a whole ledger rather than a delta, so there
 * is nothing here to get out of step.
 *
 * That is the shape the auth server bought us. No endpoint to call, no
 * signature to verify, no key to keep: the code that decides what anything is
 * worth is the same code running headlessly on the server, literally the same
 * file, in golf/ledger.ts.
 */

export type Award = {
  lines: { label: string; points: number }[]
  total: number
}

export type PointsStatus =
  /** Nothing heard from the server yet. */
  | 'loading'
  /** A live, durable balance. */
  | 'ready'
  /** Connected, but a guest — nothing here will survive the visit. */
  | 'guest'

let status: PointsStatus = 'loading'
let balanceValue = 0
let lifetimeValue = 0
let claims = new Set<string>()
let questsAtStart: Record<string, number> = {}
/** Set once the first ledger arrives, so quest progress is seeded only once. */
let seeded = false

export function pointsStatus(): PointsStatus {
  return status
}

export function balance(): number {
  return balanceValue
}

/** Everything ever earned. The level is read off this and nothing else. */
export function lifetime(): number {
  return lifetimeValue
}

/**
 * Level, rank and how far through the level they are.
 *
 * Worked out here rather than sent, because it is a pure function of a number
 * the server already sends — putting the level on the wire as well would be a
 * second copy of the same fact, free to disagree with the first.
 */
export function playerStanding(): Standing {
  return standing(lifetimeValue)
}

/** The claim keys already collected, for the shop's unlock check. */
export function claimedKeys(): string[] {
  return Array.from(claims)
}

export function pointsVisible(): boolean {
  return true
}

/** True while the balance is real but cannot be kept — a guest. */
export function pointsAreLocal(): boolean {
  return status === 'guest'
}

/** Whether a once-ever award has already been collected. */
export function alreadyClaimed(key: string): boolean {
  return claims.has(key)
}

/** Quest progress the server was holding when we arrived. */
export function storedQuestProgress(): Record<string, number> {
  return questsAtStart
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/**
 * What a finished card is worth.
 *
 * The server works this out again for itself and its answer is the one that
 * pays. This copy exists so the round-complete callout can name a number
 * immediately rather than after a round trip — and because both copies read
 * the same POINTS.award, they cannot disagree about the total.
 */
export function previewAward(card: number[]): Award {
  const a = POINTS.award
  const lines: { label: string; points: number }[] = []

  if (card.filter((n) => n >= 0).length < HOLES.length) return { lines, total: 0 }

  lines.push({ label: 'Round complete', points: a.finish })

  let pars = 0
  let birdies = 0
  let eagles = 0
  let aces = 0
  for (let i = 0; i < HOLES.length; i++) {
    const strokes = card[i]
    if (strokes < 0) continue
    // A hole in one is paid as an ace and nothing else, or a par 3 would pay
    // twice for the same swing.
    if (strokes === 1) aces++
    else if (strokes - HOLES[i].par <= -2) eagles++
    else if (strokes - HOLES[i].par === -1) birdies++
    else if (strokes === HOLES[i].par) pars++
  }

  if (pars) lines.push({ label: `${pars} par${pars === 1 ? '' : 's'}`, points: pars * a.par })
  if (birdies) lines.push({ label: `${birdies} birdie${birdies === 1 ? '' : 's'}`, points: birdies * a.birdie })
  if (eagles) lines.push({ label: `${eagles} eagle${eagles === 1 ? '' : 's'}`, points: eagles * a.eagle })
  if (aces) lines.push({ label: `${aces} hole in one`, points: aces * a.holeInOne })

  return { lines, total: lines.reduce((n, l) => n + l.points, 0) }
}

// ---------------------------------------------------------------------------
// Talking to the server
// ---------------------------------------------------------------------------

let scrapTotalValue = 0
let onScrapTaken: ((taken: number, total: number) => void) | undefined

/** Scrap handed to Sally ever. This is what her arc counts. */
export function scrapTotal(): number {
  return scrapTotalValue
}

/** Offers Sally everything dug up. She takes the lot. */
export function handScrap(): void {
  void room.send('handScrap', { all: 1 })
}

export function onScrapAccepted(cb: (taken: number, total: number) => void): void {
  onScrapTaken = cb
}

let coconutsTodayValue = 0
let coconutsTotalValue = 0
let blenderBuilt = false
let motorFound = false
let onCoconutsTaken:
  | ((taken: number, paid: number, refused: number, total: number) => void)
  | undefined
/** Set the first time Coconutty answers, so his dialogue can tell the truth. */
let heardFromCoconutty = false

export function coconuttyHasAnswered(): boolean {
  return heardFromCoconutty
}

/** Handed to Coconutty today, against his daily limit. */
export function coconutsToday(): number {
  return coconutsTodayValue
}

/** Handed to Coconutty ever. This is what earns the Coconut Ball. */
export function coconutsTotal(): number {
  return coconutsTotalValue
}

/** Whether the blender is finished, which is what puts drinks on his menu. */
export function blenderIsBuilt(): boolean {
  return blenderBuilt
}

/** Whether the old motor is already out of the ground. */
export function motorIsFound(): boolean {
  return motorFound
}

/** Offers Coconutty everything in hand. He decides how many he will take. */
export function handCoconuts(): void {
  void room.send('handCoconuts', { all: 1 })
}

export function onCoconutsAccepted(
  cb: (taken: number, paid: number, refused: number, total: number) => void
): void {
  onCoconutsTaken = cb
}

let shellsTodayValue = 0
let shellsTotalValue = 0
let onShellsTaken: ((taken: number, paid: number, refused: number, total: number) => void) | undefined

let heardFromShellman = false

/** Whether the server has ever answered a hand-over. Used to tell the truth. */
export function shellmanHasAnswered(): boolean {
  return heardFromShellman
}

/** Handed to Shellman today, against his daily limit. */
export function shellsToday(): number {
  return shellsTodayValue
}

/** Handed to Shellman ever. This is what earns the Seaside Club. */
export function shellsTotal(): number {
  return shellsTotalValue
}

/** Offers Shellman everything in hand. He decides how many he will take. */
export function handShells(): void {
  void room.send('handShells', { all: 1 })
}

export function onShellsAccepted(
  cb: (taken: number, paid: number, refused: number, total: number) => void
): void {
  onShellsTaken = cb
}

let onSeeded: (() => void) | undefined
let onAward: ((amount: number, reason: string) => void) | undefined
let onRefused: ((reason: string) => void) | undefined

/**
 * Opens the ledger.
 *
 * The room queues anything sent before it is connected, so hello can go
 * immediately and the answer arrives whenever the server is ready. Nothing
 * here blocks play: until the ledger lands the HUD shows a dash.
 */
/** One greeting. Split out because it is now sent twice — see nameWatch. */
function greet(): void {
  void room.send('hello', { version: 1, name: myDisplayName() })
}

export function setupPoints(
  seededCallback?: () => void,
  awardCallback?: (amount: number, reason: string) => void,
  refusedCallback?: (reason: string) => void
): void {
  onSeeded = seededCallback
  onAward = awardCallback
  onRefused = refusedCallback

  room.onMessage('ledger', (data) => {
    balanceValue = data.balance
    lifetimeValue = data.lifetime
    // The server's count wins. The beach increments a local guess so the
    // number moves the moment a shell is picked up; this is the correction.
    setShellsCarried(data.shellsCarried)
    setScrapCarried(data.scrapCarried)
    scrapTotalValue = data.scrapTotal
    shellsTodayValue = data.shellsToday
    shellsTotalValue = data.shellsTotal
    setCoconutsCarried(data.coconutsCarried)
    coconutsTodayValue = data.coconutsToday
    coconutsTotalValue = data.coconutsTotal
    blenderBuilt = data.blender
    motorFound = data.motor
    status = data.durable ? 'ready' : 'guest'

    try {
      claims = new Set(JSON.parse(data.claims) as string[])
    } catch {
      claims = new Set()
    }

    // Every ledger carries the whole inventory, so this is how a club bought a
    // moment ago actually arrives in the player's hand.
    try {
      syncInventory(
        JSON.parse(data.owned) as string[],
        JSON.parse(data.equipped) as Partial<Record<ItemKind, string>>
      )
    } catch {
      /* a malformed inventory leaves them with the free stock, which is safe */
    }

    // Only the first ledger seeds quest progress. Later ones are answers to
    // something we did, and re-seeding from them would undo the counting that
    // has happened since.
    if (!seeded) {
      seeded = true
      // One line, once, so it is obvious in the console whether the
      // Multiplayer Server is actually answering. Everything that can be
      // earned, bought or counted goes through it, so "did the ledger arrive"
      // is the first question worth asking about any of it.
      console.log(
        `[golf] ledger connected: balance ${data.balance}, lifetime ${data.lifetime}, ` +
          `shells carried ${data.shellsCarried}, durable ${data.durable}`
      )
      // Who the scene thinks you are, once, while the test panel is on.
      //
      // The panel can be opened by name, but granting points is checked on the
      // server against a wallet — and a wallet is the one thing about yourself
      // you cannot simply know. This is where to copy it from into
      // ADMIN.allow. Off with ADMIN.enabled, so a live deploy stays quiet.
      if (ADMIN.enabled) {
        console.log(`[golf] you are ${myDisplayName()} (${myUserId()})`)
      }
      try {
        questsAtStart = JSON.parse(data.quests) as Record<string, number>
      } catch {
        questsAtStart = {}
      }
      onSeeded?.()
    }
  })

  room.onMessage('awarded', (data) => {
    onAward?.(data.amount, data.reason)
  })

  room.onMessage('scrapTaken', (data) => {
    onScrapTaken?.(data.taken, data.total)
  })

  room.onMessage('shellsTaken', (data) => {
    heardFromShellman = true
    onShellsTaken?.(data.taken, data.paid, data.refused, data.total)
  })

  room.onMessage('coconutsTaken', (data) => {
    heardFromCoconutty = true
    onCoconutsTaken?.(data.taken, data.paid, data.refused, data.total)
  })

  // The only message that changes how the player moves. Wired to the server's
  // answer rather than to the button, so a drink that was refused — no
  // blender, not enough points, pressed twice — never lifts anybody off the
  // ground.
  room.onMessage('drink', (data) => {
    drinkPoured(data.seconds)
  })

  // The server noticed the level, priced the bonus and sent the lot. Nothing
  // is worked out here — the client has the curve and could tell it had gone
  // up, but announcing a level-up is also announcing a payment, and that is
  // not a call the scene gets to make.
  room.onMessage('levelUp', (data) => {
    showLevelUp({
      level: data.level,
      gained: data.gained,
      bonus: data.bonus,
      rank: data.rank,
      newRank: data.newRank,
      unlocked: data.unlocked
    })
  })

  room.onMessage('leaders', (data) => {
    setStandings(data.level, data.best, data.today, data.day)
  })

  room.onMessage('refused', (data) => {
    // Clears the "pouring" state as well. A refusal is an answer, and without
    // this the bar would keep saying the motor was thinking about it for two
    // and a half seconds after being told no.
    drinkRefused()
    onRefused?.(data.reason)
  })

  // The name goes up with the greeting because the server has no other way to
  // learn it — it deals in wallets, and a leaderboard of wallets is a
  // leaderboard nobody can read.
  greet()

  // ...and again once the explorer says who this actually is.
  //
  // The profile routinely lands after the scene has started, so the first
  // greeting can easily carry 'Player' — which is how everybody on the
  // leaderboard came to be called Player. hello is idempotent: it loads the
  // wallet, stores the name and answers with the ledger, so sending it a
  // second time costs one message and fixes the row.
  let greeted = myDisplayName()
  function nameWatch(): void {
    if (!identityReady()) return
    engine.removeSystem(nameWatch)
    if (myDisplayName() === greeted) return
    greeted = myDisplayName()
    greet()
  }
  engine.addSystem(nameWatch)

  // If nothing has come back by now, say so plainly rather than leaving the
  // HUD on a dash and every hand-over silently doing nothing. The scene still
  // plays — the golf is entirely client-side — but points, quests, the shop
  // and the shells all need the server, and none of them will work.
  let waited = 0
  function ledgerWatchdog(dt: number): void {
    if (seeded) {
      engine.removeSystem(ledgerWatchdog)
      return
    }
    waited += dt
    if (waited < 12) return
    engine.removeSystem(ledgerWatchdog)
    console.log(
      '[golf] LEDGER SILENT: no answer from the Multiplayer Server after 12s. ' +
        'Pixel Points, quests, the shop and Shellman will all do nothing. ' +
        'Check that the scene is running with authoritativeMultiplayer enabled.'
    )
  }
  engine.addSystem(ledgerWatchdog)
}

/** Posts a finished card. The server scores it and sends the balance back. */
export function submitRound(card: number[]): void {
  void room.send('card', { strokes: card })
}

/**
 * Asks for a once-ever award.
 *
 * Fire and forget: the answer arrives as a fresh ledger, and if it was already
 * claimed or the player is a guest the balance simply does not move. Nothing
 * needs reconciling here, because nothing here was ever the truth.
 */
export function claimOnce(key: string): void {
  if (claims.has(key)) return
  void room.send('claim', { key })
}

export function claimSecretHole(): void {
  claimOnce('secret')
}

/** Asks the server for testing points. Refused unless the wallet is allow-listed. */
export function grantPoints(amount: number): void {
  void room.send('grant', { amount })
}

/** Tells the server where a quest has got to. */
export function reportQuestProgress(id: string, done: number): void {
  void room.send('quest', { id, done })
}

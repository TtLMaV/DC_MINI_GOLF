import { POINTS } from './config'
import { HOLES } from './course'
import { room } from './room'
import { ItemKind, syncInventory } from './shop'

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
let claims = new Set<string>()
let questsAtStart: Record<string, number> = {}
let admin = true
/** Set once the first ledger arrives, so quest progress is seeded only once. */
let seeded = false

export function pointsStatus(): PointsStatus {
  return status
}

export function balance(): number {
  return balanceValue
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

  room.onMessage('refused', (data) => {
    onRefused?.(data.reason)
  })

  void room.send('hello', { version: 1 })
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

/** Tells the server where a quest has got to. */
export function reportQuestProgress(id: string, done: number): void {
  void room.send('quest', { id, done })
}

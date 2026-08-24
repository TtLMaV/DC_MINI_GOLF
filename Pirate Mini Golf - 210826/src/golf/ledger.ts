import { engine } from '@dcl/sdk/ecs'
import { Storage } from '@dcl/sdk/server'

import { POINTS } from './config'
import { HOLES } from './course'
import { room } from './room'
import { QUESTS } from './quests'
import { DEFAULTS, itemById } from './shop'

/**
 * Pixel Points and quest progress, on the server.
 *
 * This is the whole ledger now. There is no Vercel project and no Upstash
 * behind it: the Multiplayer Server runs this scene's code headlessly and
 * Storage.player keeps a record per wallet that survives restarts. What used to
 * be an endpoint, a signed-fetch verification and a Redis bill is a message
 * handler and a JSON blob.
 *
 * Two things that were duplicated are now not. The award table is imported from
 * config rather than transcribed into a server that could drift from it, and
 * the once-ever prices are read straight off QUESTS — so a new quest cannot be
 * added to the scene and forgotten in the ledger, which was the sharpest edge
 * of the old arrangement.
 *
 * ---------------------------------------------------------------------------
 * What this can and cannot promise
 * ---------------------------------------------------------------------------
 * The server owns every number that is paid. The client sends a card, never an
 * award, so the table cannot be rewritten from the scene, and a claim is named
 * by key and priced here.
 *
 * It still cannot know the card is honest. The golf runs client-side, so the
 * server sees a result rather than a round. Making that true would mean moving
 * cannon onto the server and sending every shot, which is a different and much
 * larger scene. So: the card must be well formed, and rounds cannot be banked
 * faster than they can be played. Same honest limit as before, now enforced
 * somewhere the player cannot reach.
 */

type Wallet = {
  balance: number
  /** Once-ever awards already collected, by key. */
  claims: string[]
  /** Quest id -> how many times the counted thing has happened. */
  quests: Record<string, number>
  /** Fewest strokes for the nine, for the personal best award. */
  best: number
  /** YYYY-MM-DD of the last completed round, for first-of-day. */
  lastDay: string
  /** Epoch seconds of the last banked round, for the cooldown. */
  lastRound: number
  /** Item ids bought. Free stock is not listed — everybody has it. */
  owned: string[]
  /** What they are holding, by kind. */
  equipped: Record<string, string>
}

const STORAGE_KEY = 'pp'

const empty = (): Wallet => ({
  balance: 0,
  claims: [],
  quests: {},
  best: 0,
  lastDay: '',
  lastRound: 0,
  owned: [],
  equipped: { club: DEFAULTS.club, ball: DEFAULTS.ball }
})

/** A round cannot be banked more often than this. Nine holes take longer. */
const ROUND_COOLDOWN_SECONDS = 240
/** The in-scene pick-up limit. A card claiming more than this is not a card. */
const MAX_STROKES = 10

/**
 * Everything that can be earned exactly once, and what it pays.
 *
 * Built from the quest list rather than kept beside it, so the two cannot
 * disagree. A key nobody knows pays nothing.
 */
function priceOf(key: string): number {
  if (key === 'secret') return POINTS.award.secretHole
  if (key.startsWith('quest:')) {
    const quest = QUESTS.find((q) => q.id === key.slice(6))
    return quest ? quest.reward : 0
  }
  return 0
}

/**
 * Only a real wallet gets a durable balance.
 *
 * A guest's address is not stable between visits, so anything stored against
 * it is lost and reads to the player as a bug rather than a policy. They are
 * still answered — they simply are not paid, and are told as much.
 */
function isWallet(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

// ---------------------------------------------------------------------------
// Cache and writes
// ---------------------------------------------------------------------------

const cache = new Map<string, Wallet>()
const dirty = new Set<string>()

async function load(address: string): Promise<Wallet> {
  const held = cache.get(address)
  if (held) return held

  const stored = await Storage.player.get<Wallet>(address, STORAGE_KEY)
  const wallet = stored ? { ...empty(), ...stored } : empty()
  cache.set(address, wallet)
  return wallet
}

/**
 * Marks a wallet for writing rather than writing it.
 *
 * Quest progress moves a putt at a time, and the host has a limit on calls in
 * flight. Marking and flushing on a timer turns five aces into one or two
 * writes, and costs at worst a few seconds of progress if the server stops
 * between flushes.
 */
function touch(address: string): void {
  dirty.add(address)
}

let sinceFlush = 0
const FLUSH_SECONDS = 10

function flushSystem(dt: number): void {
  sinceFlush += dt
  if (sinceFlush < FLUSH_SECONDS || dirty.size === 0) return
  sinceFlush = 0

  for (const address of dirty) {
    const wallet = cache.get(address)
    if (wallet) void Storage.player.set(address, STORAGE_KEY, wallet)
  }
  dirty.clear()
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function wellFormed(card: number[]): boolean {
  if (card.length !== HOLES.length) return false
  return card.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_STROKES)
}

/**
 * What a finished card is worth.
 *
 * A hole in one pays holeInOne and nothing else — on a par 3 it is an eagle as
 * well, and paying twice for one swing reads as a bug even when it is
 * generous.
 */
function scoreCard(card: number[]): number {
  const a = POINTS.award
  let total = a.finish

  for (let i = 0; i < HOLES.length; i++) {
    const strokes = card[i]
    const diff = strokes - HOLES[i].par
    if (strokes === 1) total += a.holeInOne
    else if (diff <= -2) total += a.eagle
    else if (diff === -1) total += a.birdie
    else if (diff === 0) total += a.par
  }

  return total
}

const today = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function sendLedger(address: string, wallet: Wallet): void {
  void room.send(
    'ledger',
    {
      balance: wallet.balance,
      claims: JSON.stringify(wallet.claims),
      quests: JSON.stringify(wallet.quests),
      owned: JSON.stringify(wallet.owned),
      equipped: JSON.stringify(wallet.equipped),
      durable: isWallet(address)
    },
    { to: [address] }
  )
}

/**
 * Starts the ledger. Called from main() only when running on the server.
 */
export function runLedger(): void {

  engine.addSystem(flushSystem)

  room.onMessage('hello', async (_data, context) => {
    const address = context?.from
    if (!address) return
    sendLedger(address, await load(address))
  })

  room.onMessage('card', async (data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    const card = Array.from(data.strokes)
    if (!wellFormed(card) || !isWallet(address)) {
      sendLedger(address, wallet)
      return
    }

    // The cooldown is the honest half of the anti-farm story: the card cannot
    // be verified, but it can only be banked as fast as a round can be played.
    const now = Math.floor(Date.now() / 1000)
    if (wallet.lastRound && now - wallet.lastRound < ROUND_COOLDOWN_SECONDS) {
      sendLedger(address, wallet)
      return
    }

    let awarded = scoreCard(card)
    const strokes = card.reduce((n, s) => n + s, 0)

    if (!wallet.best || strokes < wallet.best) {
      awarded += POINTS.award.personalBest
      wallet.best = strokes
    }

    const day = today()
    if (wallet.lastDay !== day) {
      awarded += POINTS.award.firstOfDay
      wallet.lastDay = day
    }

    wallet.balance += awarded
    wallet.lastRound = now
    touch(address)

    void room.send('awarded', { amount: awarded, reason: 'Round complete' }, { to: [address] })
    sendLedger(address, wallet)
  })

  room.onMessage('claim', async (data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    const key = data.key
    const amount = priceOf(key)
    // Already had, unknown, or a guest: answered, but paid nothing. The client
    // puts the claim back so it can be tried again rather than losing it.
    if (!amount || wallet.claims.includes(key) || !isWallet(address)) {
      sendLedger(address, wallet)
      return
    }

    wallet.claims.push(key)
    wallet.balance += amount
    touch(address)

    void room.send('awarded', { amount, reason: labelFor(key) }, { to: [address] })
    sendLedger(address, wallet)
  })

  room.onMessage('buy', async (data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    const item = itemById(data.id)
    // Priced here, from the same catalogue the shop draws — the client names
    // an id and never an amount, so there is no number of theirs to trust.
    if (!item || item.price <= 0) return
    if (wallet.owned.includes(item.id)) return

    if (!isWallet(address)) {
      void room.send('refused', { reason: 'Connect a wallet to keep anything you buy.' }, { to: [address] })
      return
    }
    if (wallet.balance < item.price) {
      void room.send(
        'refused',
        { reason: `${item.name} is ${item.price}. You have ${wallet.balance}.` },
        { to: [address] }
      )
      return
    }

    wallet.balance -= item.price
    wallet.owned.push(item.id)
    // Straight into their hand. Buying a thing and then having to equip it is
    // a step that exists only because the shop forgot to.
    wallet.equipped[item.kind] = item.id
    touch(address)

    sendLedger(address, wallet)
  })

  room.onMessage('equip', async (data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    const item = itemById(data.id)
    if (!item) return
    // Free stock needs no purchase; anything else has to have been bought.
    if (item.price > 0 && !wallet.owned.includes(item.id)) return

    if (wallet.equipped[item.kind] === item.id) return
    wallet.equipped[item.kind] = item.id
    touch(address)

    sendLedger(address, wallet)
  })

  room.onMessage('quest', async (data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    const quest = QUESTS.find((q) => q.id === data.id)
    if (!quest) return

    // Never backwards, and never past the target. A client that has lost its
    // place asks for less than it should; it should not be able to undo work,
    // and it should not be able to declare itself finished either.
    const done = Math.max(0, Math.min(quest.target, Math.floor(data.done)))
    if (done <= (wallet.quests[quest.id] ?? 0)) return

    wallet.quests[quest.id] = done
    touch(address)
  })
}

function labelFor(key: string): string {
  if (key === 'secret') return 'The secret hole'
  const quest = QUESTS.find((q) => q.id === key.slice(6))
  return quest ? quest.name : 'Claimed'
}

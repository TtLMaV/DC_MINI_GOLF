import { engine } from '@dcl/sdk/ecs'
import { Storage } from '@dcl/sdk/server'

import { ADMIN, COCONUTS, DETECTOR, DRINK, POINTS, SHELLS } from './config'
import { HOLES } from './course'
import { room } from './room'
import { QUESTS } from './quests'
import { CATALOGUE, DEFAULTS, isUnlocked, itemById } from './shop'
import { levelFor, rankFor } from './ranks'
import {
  leaderTables,
  leadersChanged,
  loadLeaders,
  noteBest,
  noteLifetime,
  noteToday,
  saveLeaders,
  tidyName
} from './leaders'

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
  /**
   * Every point ever earned. Only ever goes up.
   *
   * Separate from balance because spending is the point of earning, and a
   * ladder that fell when you bought something would teach people not to buy
   * things. Every award below has to touch both, which is why they go through
   * one function rather than being added by hand in six places.
   */
  lifetime: number
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

  /** Shells picked up and not yet handed over. */
  shellsCarried: number
  /** Handed over on shellsDay, against the daily limit. */
  shellsToday: number
  /** YYYY-MM-DD the daily count belongs to. */
  shellsDay: string
  /** Handed over ever, which is what earns the Seaside Club. */
  shellsTotal: number
  /** Epoch seconds of the last pick-up, for the walking-pace limit. */
  lastShell: number

  /** Scrap dug and not yet handed over. */
  scrapCarried: number
  /** Handed to Sally ever, which is what her arc counts. */
  scrapTotal: number
  /** Epoch seconds of the last dig. */
  lastDig: number

  /** Coconuts picked up and not yet handed over. */
  coconutsCarried: number
  /** Handed over on coconutsDay, against the daily limit. */
  coconutsToday: number
  /** YYYY-MM-DD the daily count belongs to. */
  coconutsDay: string
  /** Handed over ever, which is what earns the Coconut Ball. */
  coconutsTotal: number
  /** Epoch seconds of the last pick-up, for the walking-pace limit. */
  lastCoconut: number

  /**
   * Whether the old motor has been dug up.
   *
   * A flag rather than a count, because there is one and it does not come
   * back. It lives here rather than in quests so the cave knows not to bury it
   * again after the quest that wanted it has been claimed and forgotten.
   */
  motor: boolean
  /** Epoch seconds of the last drink bought, to stop fat-finger doubles. */
  lastDrink: number

  /**
   * What this player calls themselves.
   *
   * The client's word for it, tidied on the way in. Kept on the wallet rather
   * than only in the leaderboard tables so a player who changes their name is
   * renamed everywhere the next time anything they do touches a table, rather
   * than only in whichever table they happen to beat next.
   */
  name: string
  /**
   * The level they were last told they had reached.
   *
   * Stored rather than derived so a level-up can be spotted at all: the level
   * itself is a pure function of lifetime, and a pure function cannot tell you
   * it has just changed. -1 means "not established yet" and is seeded in
   * silence — without it, every wallet that existed before this was written
   * would announce a dozen level-ups the next time it earned a point.
   */
  level: number
  /** Pixel Points earned on earnedDay, for the daily table. */
  earnedToday: number
  /** YYYY-MM-DD the daily earnings belong to. */
  earnedDay: string
}

const STORAGE_KEY = 'pp'

const empty = (): Wallet => ({
  balance: 0,
  lifetime: 0,
  claims: [],
  quests: {},
  best: 0,
  lastDay: '',
  lastRound: 0,
  owned: [],
  equipped: { club: DEFAULTS.club, ball: DEFAULTS.ball },
  shellsCarried: 0,
  shellsToday: 0,
  shellsDay: '',
  shellsTotal: 0,
  lastShell: 0,
  scrapCarried: 0,
  scrapTotal: 0,
  lastDig: 0,
  coconutsCarried: 0,
  coconutsToday: 0,
  coconutsDay: '',
  coconutsTotal: 0,
  lastCoconut: 0,
  motor: false,
  lastDrink: 0,
  name: '',
  level: -1,
  earnedToday: 0,
  earnedDay: ''
})

/**
 * Pays a wallet.
 *
 * The only thing that adds to a balance. Lifetime has to move with every award
 * and never with a purchase, and the reliable way to hold that rule is to have
 * exactly one function that can break it.
 */
function pay(wallet: Wallet, amount: number): void {
  if (amount <= 0) return
  wallet.balance += amount
  wallet.lifetime += amount

  // The daily tally rides along here rather than being added at each call
  // site, for exactly the reason lifetime does: there are seven things that
  // pay, and a rule kept in seven places is a rule with six chances to be
  // forgotten. A stale day is treated as zero rather than reset, so the roll
  // over at UTC midnight needs nothing to run at midnight.
  const day = today()
  wallet.earnedToday = (wallet.earnedDay === day ? wallet.earnedToday : 0) + amount
  wallet.earnedDay = day
}

/**
 * Pays something that is not earnings.
 *
 * Balance and the daily tally move; lifetime does not. That distinction only
 * matters for one thing so far — the level-up bonus — but it matters a lot
 * there. Lifetime is what decides the level, so paying a level-up into
 * lifetime would be a ladder partly climbing itself: a curve that no longer
 * means "this much play" but "this much play plus whatever the rungs paid".
 *
 * At the bottom of the ladder it is worse than untidy. Level 2 sits at 90
 * lifetime and level 3 at 246, and a bonus that fed lifetime would push a
 * player straight through the next rung and then the one after — a cascade
 * paid for by nothing.
 */
function bonus(wallet: Wallet, amount: number): void {
  if (amount <= 0) return
  wallet.balance += amount

  const day = today()
  wallet.earnedToday = (wallet.earnedDay === day ? wallet.earnedToday : 0) + amount
  wallet.earnedDay = day
}

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

/**
 * Whether this player may earn and spend at all.
 *
 * Separate from isWallet because durability and permission are two different
 * questions: POINTS.allowGuests lets a preview session play the whole loop
 * without a linked wallet, while the ledger still reports the balance as not
 * durable, so nothing on screen claims it will be there tomorrow.
 */
function canEarn(address: string): boolean {
  return isWallet(address) || POINTS.allowGuests
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

  // Where they already stand, written down before anything can change it.
  //
  // Seeded here rather than on the first touch, and the difference is a real
  // one: a brand-new player whose first round carries them to level 2 would
  // otherwise have that first level-up swallowed by the seeding, because the
  // seed would be taken *after* the round had already been paid for. Doing it
  // at load means the baseline is always what they walked in with.
  if (wallet.level < 0) wallet.level = levelFor(wallet.lifetime)

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

  const wallet0 = cache.get(address)
  if (wallet0) checkLevel(address, wallet0)

  // The leaderboard is fed from here rather than from the twelve places that
  // change a wallet, for the same reason pay() is the only thing that moves a
  // balance: one funnel cannot be forgotten. Only a durable wallet goes on the
  // board — a guest's address changes between visits, so their row would be a
  // ghost that nobody could ever displace.
  const wallet = cache.get(address)
  if (!wallet || !isWallet(address)) return
  const name = wallet.name || tidyName('', address)
  noteLifetime(address, name, wallet.lifetime)
  noteBest(address, name, wallet.best)
  noteToday(address, name, wallet.earnedDay === today() ? wallet.earnedToday : 0)
}

/**
 * Notices a level-up, pays for it, and says so.
 *
 * Hooked into touch() rather than into pay(), for two reasons. pay() does not
 * know whose wallet it is holding — it takes the wallet, not the address, and
 * there is nobody to send a message to. And a level can move without anything
 * being paid at all: an admin grant, a migration, a curve retune. touch() is
 * called after every change of any kind, which is exactly the set of moments
 * worth re-checking.
 *
 * Several levels at once are one announcement, not several. A good round can
 * carry somebody through two rungs, and two banners back to back is a worse
 * moment than one that says it happened twice.
 */
function checkLevel(address: string, wallet: Wallet): void {
  const now = levelFor(wallet.lifetime)

  // First sight of this wallet: write down where they are and say nothing.
  // Every wallet that existed before this code did would otherwise announce
  // its whole history the next time it earned a point.
  if (wallet.level < 0) {
    wallet.level = now
    return
  }

  if (now <= wallet.level) return

  const from = wallet.level
  const gained = now - from
  wallet.level = now

  // One payment covering every rung crossed, each priced at the level it
  // reached — so two levels at once pays what two levels are worth rather
  // than what the last one is.
  let paid = 0
  for (let l = from + 1; l <= now; l++) {
    paid += POINTS.award.levelUp.base + POINTS.award.levelUp.perLevel * l
  }
  if (canEarn(address)) bonus(wallet, paid)

  const rank = rankFor(now)
  const before = rankFor(from)
  const promoted = rank.name !== before.name
  const club = promoted ? itemById(rank.club) : undefined

  void room.send(
    'levelUp',
    {
      level: now,
      gained,
      bonus: canEarn(address) ? paid : 0,
      rank: rank.name,
      newRank: promoted,
      // Named rather than implied. "You are a Buccaneer" is a title; "the
      // Golden Club is on the shelf" is a reason to walk to the shack.
      unlocked: club ? club.name : ''
    },
    { to: [address] }
  )
}

let sinceFlush = 0
const FLUSH_SECONDS = 10

/**
 * How often the leaderboard is written out and broadcast.
 *
 * Slower than the wallet flush on purpose. Wallets are written because losing
 * one loses somebody's afternoon; the board is a sign, and a sign that is
 * fifteen seconds behind is a sign nobody notices is behind. Broadcasting on
 * every change would put a message on the wire for every shell picked up.
 */
let sinceBoard = 0
const BOARD_SECONDS = 15

function flushSystem(dt: number): void {
  sinceBoard += dt
  if (sinceBoard >= BOARD_SECONDS) {
    sinceBoard = 0
    if (leadersChanged()) {
      void saveLeaders()
      broadcastLeaders()
    }
  }

  sinceFlush += dt
  if (sinceFlush < FLUSH_SECONDS || dirty.size === 0) return
  sinceFlush = 0

  for (const address of dirty) {
    const wallet = cache.get(address)
    if (wallet) void Storage.player.set(address, STORAGE_KEY, wallet)
  }
  dirty.clear()
}

/** To everybody, because it is the same answer for everybody. */
function broadcastLeaders(): void {
  void room.send('leaders', leaderTables())
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

/** Everything this wallet may hold right now: bought, plus free and unlocked. */
function ownedIds(wallet: Wallet): string[] {
  if (ADMIN.freeStock) return CATALOGUE.map((i) => i.id)
  const level = levelFor(wallet.lifetime)
  const free = CATALOGUE.filter(
    (i) => i.price <= 0 && isUnlocked(i, level, wallet.claims)
  ).map((i) => i.id)
  return Array.from(new Set([...wallet.owned, ...free]))
}

/**
 * How many they have handed over today, treating a stale day as zero.
 *
 * Read rather than reset, so nothing has to run at midnight and a wallet that
 * has not been touched since Tuesday still reports today's count as nought.
 */
function shellsTodayFor(wallet: Wallet): number {
  return wallet.shellsDay === today() ? wallet.shellsToday : 0
}

/** The same, for coconuts. A stale day reads as zero rather than being reset. */
function coconutsTodayFor(wallet: Wallet): number {
  return wallet.coconutsDay === today() ? wallet.coconutsToday : 0
}

/**
 * Whether the blender is finished.
 *
 * Derived from the claim list rather than stored as its own flag. The last
 * quest in Coconutty's chain is the blender, so "has the blender" and "has
 * collected that reward" are the same fact — and a fact with one home cannot
 * disagree with itself. It also means the bar opens the instant the quest is
 * handed in, with nothing else to remember to set.
 */
function hasBlender(wallet: Wallet): boolean {
  return wallet.claims.indexOf('quest:blender-motor') >= 0
}

function sendLedger(address: string, wallet: Wallet): void {
  void room.send(
    'ledger',
    {
      balance: wallet.balance,
      lifetime: wallet.lifetime,
      claims: JSON.stringify(wallet.claims),
      quests: JSON.stringify(wallet.quests),
      // What they can actually hold, worked out here rather than inferred on
      // the client.
      //
      // Bought items plus anything that costs nothing and whose unlock they
      // have met — the quest clubs are priced at zero, so without that second
      // half a player would finish Three Aces and find the Flag Club unlocked,
      // unowned and unequippable. The client used to decide this by treating
      // every zero-price item as owned, which handed all four out on day one.
      //
      // freeStock is the testing switch, and this is the half of it that makes
      // the ordinary path work: the client is told it owns the catalogue, so
      // the inventory, the equip request and what comes back all agree.
      owned: JSON.stringify(ownedIds(wallet)),
      equipped: JSON.stringify(wallet.equipped),
      scrapCarried: wallet.scrapCarried,
      scrapTotal: wallet.scrapTotal,
      shellsCarried: wallet.shellsCarried,
      shellsToday: shellsTodayFor(wallet),
      shellsTotal: wallet.shellsTotal,
      coconutsCarried: wallet.coconutsCarried,
      coconutsToday: coconutsTodayFor(wallet),
      coconutsTotal: wallet.coconutsTotal,
      blender: hasBlender(wallet),
      motor: wallet.motor,
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

  // Whatever the last run left behind. Nothing waits on it — the tables start
  // empty and are replaced when it lands, so a slow read delays the sign
  // rather than the ledger.
  void loadLeaders()

  room.onMessage('hello', async (data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    // The only moment the server learns what to call somebody. Stored rather
    // than used once, so a rename shows up on the board the next time this
    // player does anything at all rather than only when they beat their own
    // score.
    const name = tidyName(data.name ?? '', address)
    if (name !== wallet.name) {
      wallet.name = name
      touch(address)
    }

    sendLedger(address, wallet)
    // Straight away rather than on the next broadcast: somebody who has just
    // walked in should not be looking at a blank sign for fifteen seconds.
    void room.send('leaders', leaderTables(), { to: [address] })
  })

  room.onMessage('card', async (data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    const card = Array.from(data.strokes)
    if (!wellFormed(card) || !canEarn(address)) {
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

    pay(wallet, awarded)
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
    if (!amount || wallet.claims.includes(key) || !canEarn(address)) {
      sendLedger(address, wallet)
      return
    }

    wallet.claims.push(key)
    pay(wallet, amount)
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

    if (!canEarn(address)) {
      void room.send('refused', { reason: 'Connect a wallet to keep anything you buy.' }, { to: [address] })
      return
    }

    // The gate goes before the price, and it is checked here rather than only
    // in the shop, because the shop is the half a player could rewrite. The
    // level is derived from lifetime on this side too — the client never sends
    // a level, so there is no level of theirs to trust.
    if (!isUnlocked(item, levelFor(wallet.lifetime), wallet.claims)) {
      void room.send('refused', { reason: `${item.name} is not unlocked yet.` }, { to: [address] })
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
    // Free stock needs no purchase; anything else has to have been bought —
    // unless ADMIN.freeStock is on, which is the whole point of it.
    if (!ADMIN.freeStock) {
      // Owning it is not enough on its own: a free item still has to be
      // unlocked, or every quest club would be wearable from the first putt.
      if (!isUnlocked(item, levelFor(wallet.lifetime), wallet.claims)) return
      if (item.price > 0 && !wallet.owned.includes(item.id)) return
    }

    if (wallet.equipped[item.kind] === item.id) return
    wallet.equipped[item.kind] = item.id
    touch(address)

    sendLedger(address, wallet)
  })

  room.onMessage('grant', async (data, context) => {
    const address = context?.from
    if (!address) return

    // Deliberately not ADMIN.enabled. An empty allow list means the test panel
    // opens for everyone, which is what you want while building — it is not
    // what you want for a button that prints money. This one needs the wallet
    // written down.
    const allowed = ADMIN.allow.some((a) => a.toLowerCase() === address.toLowerCase())
    if (!allowed) {
      void room.send(
        'refused',
        {
          reason:
            'Granting points needs your wallet in ADMIN.allow. ' +
            'The console prints it at startup — look for "[golf] you are".'
        },
        { to: [address] }
      )
      return
    }

    const wallet = await load(address)
    const amount = Math.max(0, Math.min(100000, Math.floor(data.amount)))
    pay(wallet, amount)
    touch(address)

    void room.send('awarded', { amount, reason: 'Granted for testing' }, { to: [address] })
    sendLedger(address, wallet)
  })

  room.onMessage('shell', async (_data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    // The honest limit, and the only one available: the scene runs client-side,
    // so the server cannot watch a shell being picked up. What it can know is
    // that shells sit metres apart, so a person cannot produce them faster than
    // they can walk between them. Anything quicker is dropped in silence — a
    // refusal would only tell someone what the limit is.
    const now = Math.floor(Date.now() / 1000)
    if (wallet.lastShell && now - wallet.lastShell < SHELLS.minSecondsBetweenPickups) return
    if (wallet.shellsCarried >= SHELLS.maxCarried) return

    wallet.lastShell = now
    wallet.shellsCarried++
    touch(address)

    // No ledger back. A pick-up happens every few seconds and the client has
    // already counted it; sending the whole inventory each time would be a
    // message per shell for something nobody is looking at.
  })

  room.onMessage('dig', async (_data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    // Same honest limit as the shells: the sites are metres apart, so a person
    // cannot produce them faster than they can walk between them. Dropped in
    // silence rather than refused — a refusal only tells you what the limit is.
    const now = Math.floor(Date.now() / 1000)
    if (wallet.lastDig && now - wallet.lastDig < DETECTOR.minSecondsBetweenDigs) return
    if (wallet.scrapCarried >= DETECTOR.maxCarried) return

    wallet.lastDig = now
    wallet.scrapCarried += DETECTOR.scrapPerFind
    touch(address)
  })

  room.onMessage('handScrap', async (_data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    // Sally takes the lot. There is no daily limit on her — the throttle is the
    // digging, and a second cap on top would only mean carrying scrap around.
    const taken = wallet.scrapCarried
    if (taken > 0) {
      wallet.scrapCarried = 0
      wallet.scrapTotal += taken
      touch(address)
    }

    void room.send('scrapTaken', { taken, total: wallet.scrapTotal }, { to: [address] })
    sendLedger(address, wallet)
  })

  room.onMessage('handShells', async (_data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    const carrying = wallet.shellsCarried
    const room_ = Math.max(0, SHELLS.dailyLimit - shellsTodayFor(wallet))
    const taken = Math.min(carrying, room_)
    const refused = carrying - taken

    if (taken > 0) {
      // Both counts move together, which is what makes one hand-over serve the
      // daily errand and the hundred for the club at the same time.
      wallet.shellsCarried -= taken
      wallet.shellsDay = today()
      wallet.shellsToday = shellsTodayFor(wallet) + taken
      wallet.shellsTotal += taken

      if (canEarn(address)) pay(wallet, taken * SHELLS.pointsPerShell)
      touch(address)
    }

    void room.send(
      'shellsTaken',
      { taken, paid: canEarn(address) ? taken * SHELLS.pointsPerShell : 0, refused, total: wallet.shellsTotal },
      { to: [address] }
    )
    sendLedger(address, wallet)
  })

  room.onMessage('coconut', async (_data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    // The same honest limit as the shells, and for the same reason: the scene
    // is client-side, so the server never sees a coconut picked up. What it
    // can know is that they are metres apart, so nobody can produce them
    // faster than they can walk between two palms. Anything quicker is dropped
    // in silence — a refusal would only tell somebody where the line is.
    const now = Math.floor(Date.now() / 1000)
    if (wallet.lastCoconut && now - wallet.lastCoconut < COCONUTS.minSecondsBetweenPickups) return
    if (wallet.coconutsCarried >= COCONUTS.maxCarried) return

    wallet.lastCoconut = now
    wallet.coconutsCarried++
    touch(address)

    // No ledger back, same as the shells. The client has already counted it
    // and a whole inventory per coconut is a message nobody is reading.
  })

  room.onMessage('handCoconuts', async (_data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    const carrying = wallet.coconutsCarried
    const room_ = Math.max(0, COCONUTS.dailyLimit - coconutsTodayFor(wallet))
    const taken = Math.min(carrying, room_)
    const refused = carrying - taken

    if (taken > 0) {
      // Both counts move together, which is what makes one hand-over serve the
      // daily errand and the hundred for the ball at the same time — the same
      // bargain Shellman has, because it is the one people expect.
      wallet.coconutsCarried -= taken
      wallet.coconutsDay = today()
      wallet.coconutsToday = coconutsTodayFor(wallet) + taken
      wallet.coconutsTotal += taken

      if (canEarn(address)) pay(wallet, taken * COCONUTS.pointsPerCoconut)
      touch(address)
    }

    void room.send(
      'coconutsTaken',
      {
        taken,
        paid: canEarn(address) ? taken * COCONUTS.pointsPerCoconut : 0,
        refused,
        total: wallet.coconutsTotal
      },
      { to: [address] }
    )
    sendLedger(address, wallet)
  })

  room.onMessage('motor', async (_data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    // Once ever. The client only offers the dig while the quest is running and
    // only within reach of one spot, but it is the client saying so, and a
    // motor that could be dug twice would be a quest that could be finished
    // twice.
    if (wallet.motor) return

    wallet.motor = true
    touch(address)
    sendLedger(address, wallet)
  })

  room.onMessage('buyDrink', async (_data, context) => {
    const address = context?.from
    if (!address) return
    const wallet = await load(address)

    if (!hasBlender(wallet)) {
      void room.send('refused', { reason: 'There is nothing to make it in yet' }, { to: [address] })
      return
    }

    // A short gap between rounds, so a double click is one drink rather than
    // two. Silent, because it is a fat finger rather than a cheat.
    const now = Math.floor(Date.now() / 1000)
    if (wallet.lastDrink && now - wallet.lastDrink < DRINK.minSecondsBetweenBuys) return

    if (wallet.balance < DRINK.price) {
      void room.send('refused', { reason: 'Not enough for a drink' }, { to: [address] })
      return
    }

    wallet.balance -= DRINK.price
    wallet.lastDrink = now
    touch(address)

    // Priced and timed here. The client counts the seconds down because it has
    // to draw them anyway, but how many seconds there were is the server's to
    // say, and it is the only half of this that costs anything.
    void room.send('drink', { seconds: DRINK.seconds }, { to: [address] })
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

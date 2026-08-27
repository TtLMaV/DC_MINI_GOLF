import { ADMIN } from './config'
import { xpForLevel } from './ranks'
import { room } from './room'

/**
 * The shop, and what a player owns.
 *
 * Everything here is a row of data, the same way a quest is. An item has an
 * id, a price and enough to draw it; the machinery below never mentions golf,
 * and adding stock is adding a row.
 *
 * Nothing here is the truth. The server holds the balance, the owned list and
 * what is equipped, and prices items from this same catalogue — so a purchase
 * is a request, not an instruction, and the client cannot grant itself a club
 * however hard it tries. What comes back is the whole inventory, so there is
 * nothing to reconcile.
 *
 * ---------------------------------------------------------------------------
 * Clubs now change how far the ball goes
 * ---------------------------------------------------------------------------
 * They did not, for a long time, and the reason is still worth knowing: the
 * nine are scored, the card goes on a leaderboard, and a club you can buy that
 * hits further is a leaderboard nobody fully trusts. That is the price of the
 * decision below, and it was made knowingly rather than arriving with the shop.
 *
 * `power` is the multiplier on the full-charge launch speed. The Stick Club is
 * 1.0 by definition: it plays exactly as the game always has, so nothing a
 * current player has learned about distance is taken off them. Everything
 * above it is a genuine buff rather than the rest of the ladder being a nerf.
 *
 * The top of the ladder is 2.5, and that number is not free to change on its
 * own. The strongest club lands exactly on MAX_BALL_SPEED in index.ts, so a
 * power past 2.5 is simply clamped away unless that cap is raised to match.
 * The cap is safe to raise now that the physics step adapts to the ball's
 * speed, but it is not free: a faster ball means more substeps per frame, and
 * this scene gets played on phones.
 *
 * `forgiveness` is still unread by anything. It is left empty on purpose
 * rather than filled with numbers nothing consumes, which is how the previous
 * set of values came to be quietly lost.
 */

export type ItemKind = 'club' | 'ball'

/**
 * What stands between a player and an item.
 *
 * Price is a separate question. Almost everything on the ladder is both
 * unlocked *and* paid for — reaching First Mate puts the Ruby Club on the
 * shelf with a price on it. `free` means nothing gates it, not that it costs
 * nothing.
 *
 * `pending` is for art that exists with no condition decided yet. It shows in
 * the inventory as unobtainable rather than being left out, because a club
 * nobody can explain is worse than one that plainly says "not yet".
 */
export type Unlock =
  | { kind: 'free' }
  | { kind: 'level'; level: number }
  | { kind: 'quest'; quest: string }
  | { kind: 'pending' }

export type Item = {
  id: string
  kind: ItemKind
  name: string
  /** One line under the name in the inventory. */
  blurb: string
  /** Pixel Points. Zero means it costs nothing once unlocked. */
  price: number
  /** What has to be true before it can be bought at all. */
  unlock: Unlock

  /** The .glb. Every item has its own now — no more shared placeholder. */
  model?: string

  /**
   * Multiplier on full-charge launch speed. 1.0 is the Stick Club, i.e. the
   * game as it has always played. Left off, clubPower() reads it as 1.0.
   *
   * Capped in effect at 1.5: see the note at the top of the file.
   */
  power?: number
  /**
   * Meant to widen the accuracy window on the meter. Nothing reads it yet, so
   * it is deliberately unset rather than carrying numbers that do nothing.
   */
  forgiveness?: number
  // NEW DAMPING MODIFIER PER CLUB TO ALTER BALL ROLLING DISTANCE
  damping?: number
}

const CLUBS = 'assets/scene/Golf'
const BALLS = 'assets/scene/Balls'

const level = (n: number): Unlock => ({ kind: 'level', level: n })
const quest = (id: string): Unlock => ({ kind: 'quest', quest: id })
const FREE: Unlock = { kind: 'free' }
/** Art is in, the condition is not decided. See the note on Unlock. */
const PENDING: Unlock = { kind: 'pending' }

/**
 * What a rank-locked item costs, as a share of the ladder you climbed to reach
 * it.
 *
 * Prices used to be typed in by hand, which meant they said nothing about each
 * other: the Ruby Club at 1500 and the Master at 3000 were two numbers that
 * happened to be in the same file. Now every level-gated price is a fixed
 * fraction of xpForLevel(unlockLevel) — the lifetime Pixel Points you must
 * have earned to be allowed to buy it at all — so the ladder prices itself and
 * a retune of the curve carries the shop along with it.
 *
 * A quarter for a club, an eighth for a ball. Clubs are the rank reward and
 * should feel like the purchase of the tier; balls are the thing you swap for
 * fun, and two of the good ones should be affordable in the same stretch as
 * one club.
 *
 * The shares are chosen so that a player who has bought *everything* available
 * so far can still afford the next thing the moment it unlocks — which is the
 * only affordability property that actually matters, and the one a hand-typed
 * table has no way to guarantee. Owning the lot by level 100 comes to about
 * 47% of everything earned, which leaves the rest for drinks.
 */
export const PRICING = {
  club: 0.25,
  ball: 0.12
}

/**
 * Rounds a price to something that looks decided rather than computed.
 *
 * 1150 reads as a price; 1141 reads as arithmetic left showing. The step grows
 * with the number for the same reason a shop does not price a car to the
 * nearest pound.
 */
function tidyPrice(raw: number): number {
  const step = raw < 500 ? 10 : raw < 5000 ? 50 : 500
  return Math.max(10, Math.round(raw / step) * step)
}

export const CATALOGUE: Item[] = [
  // --- clubs: the rank ladder ----------------------------------------------
  // One per rank, in order. The level here and the band in ranks.ts have to
  // agree; RANKS carries the club id so a mismatch is findable rather than
  // silent.
  {
    id: 'club-stick',
    kind: 'club',
    name: 'Stick Club',
    blurb: 'A stick. You found it on the way in.',
    price: 0,
    unlock: FREE,
    // The baseline the whole ladder is measured against. Do not change it.
    power: 1.0,
    forgiveness: 0.0,
    damping: 0.5,
    model: `${CLUBS}/Stick Club.glb`
  },
  {
    id: 'club-standard',
    kind: 'club',
    name: 'Standard Club',
    blurb: 'An actual putter, for an actual deckhand.',
    price: 250,
    unlock: level(6),
    power: 1.1,
    forgiveness: 0.2,
    damping: 0.45,
    model: `${CLUBS}/Standard Club.glb`
  },
  {
    id: 'club-golden',
    kind: 'club',
    name: 'Golden Club',
    blurb: 'Heavier than gold has any business being.',
    price: 750,
    unlock: level(11),
    power: 1.25,
    forgiveness: 0.4,
    damping: 0.4,
    model: `${CLUBS}/Golden Club.glb`
  },
  {
    id: 'club-ruby',
    kind: 'club',
    name: 'Ruby Club',
    blurb: 'Set with a stone nobody asks about twice.',
    price: 1500,
    unlock: level(16),
    power: 1.35,
    forgiveness: 0.55,
    damping: 0.35,
    model: `${CLUBS}/Ruby Club.glb`
  },
  {
    id: 'club-master',
    kind: 'club',
    name: 'Master Club',
    blurb: 'Carried by people who no longer need to prove it.',
    price: 3000,
    unlock: level(25),
    power: 1.4,
    forgiveness: 0.65,
    damping: 0.3,
    model: `${CLUBS}/Master Club.glb`
  },
  {
    id: 'club-cutlass',
    kind: 'club',
    name: 'Pirate Cutlass',
    blurb: 'Not a golf club. Nobody is going to tell you that.',
    price: 10000,
    unlock: level(100),
    // Top of the ladder. Lands exactly on MAX_BALL_SPEED at full charge, so
    // raising it needs that raised to match, and the note there read first.
    power: 1.5,
    forgiveness: 0.75,
    damping: 0.25,
    model: `${CLUBS}/Pirate Cutlass Club.glb`
  },

  // --- clubs: earned rather than ranked ------------------------------------
  // These cost nothing. The quest is the price, and charging twice for one
  // thing makes the quest feel like a coupon.
  {
    id: 'club-flag',
    kind: 'club',
    name: 'Flag Club',
    blurb: 'Three in one round. They took the pin down for you.',
    price: 0,
    unlock: quest('three-aces'),
    power: 1.25,
    forgiveness: 0.55,
    damping: 0.4,
    model: `${CLUBS}/Flag Club.glb`
  },
  {
    id: 'club-mechanical',
    kind: 'club',
    name: 'Mechanical Club',
    blurb: 'Clicks when you line it up. Sally knows exactly why.',
    price: 0,
    // Built by Sally out of what you dug up, so it is the end of her arc
    // rather than a reward for one good round. It was quest('under-par')
    // before the scrap existed.
    unlock: quest('scrap-mechanism'),
    power: 1.3,
    forgiveness: 0.55,
    damping: 0.4,
    model: `${CLUBS}/Mechanical Club.glb`
  },
  {
    id: 'club-seaside',
    kind: 'club',
    name: 'Seaside Club',
    blurb: 'Ten shells off the beach, handed over in person.',
    price: 0,
    unlock: quest('shell-hoard'),
    power: 1.35,
    forgiveness: 0.55,
    damping: 0.3,
    model: `${CLUBS}/Seaside Club.glb`
  },
  {
    id: 'club-neon',
    kind: 'club',
    name: 'Neon Club',
    blurb: 'Lit up like the pier on a Saturday.',
    price: 0,
    unlock: quest('secret-eight'),
    power: 1.3,
    forgiveness: 0.55,
    damping: 0.3,
    model: `${CLUBS}/Neon Club.glb`
  },

  // -------------------------------------------------------------------------
  // --- balls ---------------------------------------------------------------
  // -------------------------------------------------------------------------
  {
    id: 'ball-stone',
    kind: 'ball',
    name: 'Stone Ball',
    blurb: 'Rolls. Barely.',
    price: 0,
    unlock: FREE,
    model: `${BALLS}/Stone Ball.glb`
  },
  {
    id: 'ball-standard',
    kind: 'ball',
    name: 'Standard Ball',
    blurb: 'The first real ball you will own.',
    price: 10,
    unlock: level(2),
    model: `${BALLS}/Standard Ball.glb`
  },
  {
    id: 'ball-golden',
    kind: 'ball',
    name: 'Golden Ball',
    blurb: 'No advantage whatsoever. Everyone can see it.',
    price: 1000,
    unlock: level(13),
    model: `${BALLS}/Golden Ball.glb`
  },
  {
    id: 'ball-ruby',
    kind: 'ball',
    name: 'Ruby Ball',
    blurb: 'Catches the light on the way past the pin.',
    price: 500,
    unlock: level(16),
    model: `${BALLS}/Ruby Ball.glb`
  },
  {
    id: 'ball-master',
    kind: 'ball',
    name: 'Master Ball',
    blurb: 'Thirty levels of not giving up.',
    price: 1500,
    unlock: level(30),
    model: `${BALLS}/Master Ball.glb`
  },
  {
    id: 'ball-crown',
    kind: 'ball',
    name: 'Crown Ball',
    blurb: 'There is one rank above Captain, and you hold it.',
    price: 5000,
    unlock: level(100),
    model: `${BALLS}/Crown Ball.glb`
  },
  {
    id: 'ball-8',
    kind: 'ball',
    name: '8 Ball',
    blurb: 'Eight on every hole. Deliberately.',
    price: 0,
    unlock: quest('all-eights'),
    model: `${BALLS}/8- Ball.glb`
  },
  {
    id: 'ball-cannon',
    kind: 'ball',
    name: 'Cannon Ball',
    blurb: 'Ran out of shots on all nine. Some kind of record.',
    // Free, like every other quest item. It was 100 for a while, which meant
    // finishing the worst quest on the board and then being asked for money.
    price: 0,
    unlock: quest('all-nine-lost'),
    model: `${BALLS}/Cannon Ball.glb`
  },
  {
    id: 'ball-coconut',
    kind: 'ball',
    name: 'Coconut Ball',
    blurb: 'Off one of the palms. Still has the husk on.',
    price: 0,
    unlock: quest('coconut-hundred'),
    model: `${BALLS}/Coconut Ball.glb`
  },
  {
    id: 'ball-neon',
    kind: 'ball',
    name: 'Neon Ball',
    blurb: 'You will not lose this one after dark.',
    price: 0,
    unlock: quest('secret-eight'),
    model: `${BALLS}/Neon Ball.glb`
  }
]

/**
 * Prices every rank-locked item off the curve, once, at startup.
 *
 * A pass over the finished catalogue rather than a value written into each
 * entry, because the price is a function of two fields on the entry and one
 * expression cannot see both while the object is still being built.
 *
 * Only level unlocks are touched. A quest reward stays at whatever the entry
 * says — which is zero, and deliberately: finishing All Eights and then being
 * asked for money is the complaint the Cannon Ball already earned. The Golden
 * Ball keeps its hand-set price too, because it has no rank to price against;
 * being expensive and useless is the entire joke.
 *
 * Both ends run this. shop.ts is imported by the HUD and by the server's
 * ledger, so the price the row shows and the price the wallet is charged are
 * not two numbers that agree — they are one number.
 */
for (const item of CATALOGUE) {
  if (item.unlock.kind !== 'level') continue
  item.price = tidyPrice(xpForLevel(item.unlock.level) * PRICING[item.kind])
}

/**
 * Whether this player has met an item's unlock condition.
 *
 * Deliberately a pure function of what it is told rather than something that
 * reads the ledger itself. The server calls it to decide whether a purchase is
 * allowed and the HUD calls it to decide how to draw a row, and those two must
 * never disagree — the surest way to guarantee that is one function with no
 * hidden inputs. It also keeps shop.ts from importing points.ts, which imports
 * shop.ts.
 *
 * `claimed` is the set of quest claim keys already collected, in the same
 * 'quest:<id>' form the ledger stores.
 */
export function isUnlocked(item: Item, playerLevel: number, claimed: string[]): boolean {
  switch (item.unlock.kind) {
    case 'free':
      return true
    case 'level':
      return playerLevel >= item.unlock.level
    case 'quest':
      return claimed.includes(`quest:${item.unlock.quest}`)
    case 'pending':
      // Not "locked until later" — there is no condition to meet. Nothing
      // should let this be bought, including a client that asks nicely.
      return false
  }
}

/** One line saying what stands in the way, for a locked row in the inventory. */
export function unlockLabel(item: Item): string {
  switch (item.unlock.kind) {
    case 'free':
      return ''
    case 'level':
      return `Level ${item.unlock.level}`
    case 'quest':
      return 'Earned, not bought'
    case 'pending':
      return 'Not yet'
  }
}

export function itemById(id: string): Item | undefined {
  return CATALOGUE.find((i) => i.id === id)
}

export function itemsOfKind(kind: ItemKind): Item[] {
  return CATALOGUE.filter((i) => i.kind === kind)
}

/** Free stock, which nobody has to buy and everybody starts with. */
export const DEFAULTS: Record<ItemKind, string> = {
  club: 'club-stick',
  ball: 'ball-stone'
}

// ---------------------------------------------------------------------------
// What this player has
// ---------------------------------------------------------------------------

const owned = new Set<string>([DEFAULTS.club, DEFAULTS.ball])
const equipped: Record<ItemKind, string> = { club: DEFAULTS.club, ball: DEFAULTS.ball }

let onEquip: ((item: Item) => void) | undefined

/** Called when the equipped item changes, so the club and ball can follow it. */
export function onEquipChanged(callback: (item: Item) => void): void {
  onEquip = callback
}

/**
 * Whether they may hold this.
 *
 * Only what the server said, plus the two starting items. There used to be a
 * shortcut here that treated any zero-price item as owned, which was fine when
 * the only free things were the starting club and ball — it stopped being fine
 * the moment the quest clubs were priced at zero, because it handed out all
 * four before the quests existed. The server sends the free-and-unlocked ids
 * in the inventory now, so there is nothing left to infer.
 */
export function isOwned(id: string): boolean {
  if (ADMIN.freeStock) return true
  return owned.has(id)
}

export function equippedId(kind: ItemKind): string {
  return equipped[kind]
}

export function equippedItem(kind: ItemKind): Item {
  return itemById(equipped[kind]) ?? itemById(DEFAULTS[kind])!
}

/**
 * How hard the club in the player's hand hits, as a multiple of the Stick
 * Club.
 *
 * index.ts multiplies both the strike and the roll prediction by this, so the
 * distance readout in the HUD tells the truth for the club actually being
 * held rather than for the starting one.
 *
 * Falls back to 1.0, so an item with no `power` plays as the baseline instead
 * of producing a shot that goes nowhere.
 */
export function clubPower(): number {
  return equippedItem('club').power ?? 1
}

/**
 * Takes the inventory the server sent.
 *
 * Called on every ledger message, not just the first: a purchase is answered
 * with the whole inventory, so this is how a new club actually arrives.
 */
export function syncInventory(ownedIds: string[], equippedIds: Partial<Record<ItemKind, string>>): void {
  owned.clear()
  owned.add(DEFAULTS.club)
  owned.add(DEFAULTS.ball)
  for (const id of ownedIds) owned.add(id)

  for (const kind of ['club', 'ball'] as ItemKind[]) {
    const want = equippedIds[kind]
    // Never equip something the server has not said they own — a stale id
    // would leave them holding a club they did not buy.
    if (!want || !isOwned(want)) continue
    if (equipped[kind] === want) continue
    equipped[kind] = want
    const item = itemById(want)
    if (item) onEquip?.(item)
  }
}

/**
 * Asks to buy. The server checks the price against the balance and answers
 * with the inventory — nothing is owned here until it says so.
 */
export function buy(id: string): void {
  if (isOwned(id)) return
  void room.send('buy', { id })
}

/**
 * Asks to equip something already owned.
 *
 * Under freeStock it also applies straight away rather than waiting to be told
 * — testing a club should not depend on the ledger answering, and the server
 * is sent the same message regardless, so the real path still runs underneath.
 */
export function equip(id: string): void {
  if (!isOwned(id)) return

  if (ADMIN.freeStock) {
    const item = itemById(id)
    if (item && equipped[item.kind] !== item.id) {
      equipped[item.kind] = item.id
      onEquip?.(item)
    }
  }

  void room.send('equip', { id })
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

let open = false
let tab: ItemKind = 'ball'

export function shopOpen(): boolean {
  return open
}

export function shopTab(): ItemKind {
  return tab
}

export function setShopTab(kind: ItemKind): void {
  tab = kind
}

export function openShop(kind: ItemKind = 'ball'): void {
  tab = kind
  open = true
}

export function closeShop(): void {
  open = false
}

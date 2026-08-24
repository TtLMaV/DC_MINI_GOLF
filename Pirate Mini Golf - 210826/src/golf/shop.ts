import { Color4 } from '@dcl/sdk/math'

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
 * Placeholder art
 * ---------------------------------------------------------------------------
 * Every club currently points at the one putter model, so they are told apart
 * by name and price alone. Give an item its own `model` when the real assets
 * land and nothing else has to change. Balls are tinted rather than modelled,
 * which is why they look different already.
 *
 * ---------------------------------------------------------------------------
 * Clubs do not change how the game plays
 * ---------------------------------------------------------------------------
 * Deliberately. The nine are scored, the card goes on a leaderboard, and a
 * club you can buy that hits straighter is a leaderboard nobody trusts. The
 * fields are there — `power` and `forgiveness`, both 1 on everything — so the
 * decision is one number away if you want it, but it should be a decision,
 * not a thing that arrived with the shop.
 */

export type ItemKind = 'club' | 'ball'

export type Item = {
  id: string
  kind: ItemKind
  name: string
  /** One line under the name in the inventory. */
  blurb: string
  /** Pixel Points. Zero means everybody has it from the start. */
  price: number

  /** Clubs: the .glb to hang off the hand. Placeholder art for now. */
  model?: string

  /** Balls: the colour to paint the ball, and how much it glows in shade. */
  colour?: Color4
  emissive?: number

  /**
   * Play modifiers, both 1 on everything in the catalogue.
   *
   * power scales the strike, forgiveness widens the accuracy window. Nothing
   * reads them yet — see the note at the top of the file before anything does.
   */
  power?: number
  forgiveness?: number
}

const PUTTER = 'assets/scene/Golf/Pirate Putter.glb'

export const CATALOGUE: Item[] = [
  // --- clubs ---------------------------------------------------------------
  {
    id: 'club-driftwood',
    kind: 'club',
    name: 'Driftwood Putter',
    blurb: 'Came off the beach. Does the job.',
    price: 0,
    model: PUTTER
  },
  {
    id: 'club-brass',
    kind: 'club',
    name: 'Brass Fitting',
    blurb: 'Off a ship that is not coming back for it.',
    price: 300,
    model: PUTTER
  },
  {
    id: 'club-bosun',
    kind: 'club',
    name: "Bosun's Mallet",
    blurb: 'Heavier than it looks. Salt swears by it.',
    price: 600,
    model: PUTTER
  },
  {
    id: 'club-kraken',
    kind: 'club',
    name: 'Kraken Bone',
    blurb: 'He will not say where he got it.',
    price: 1000,
    model: PUTTER
  },

  // --- balls ---------------------------------------------------------------
  {
    id: 'ball-white',
    kind: 'ball',
    name: 'Standard White',
    blurb: 'A golf ball. Reliable in that way.',
    price: 0,
    colour: Color4.White(),
    emissive: 0.12
  },
  {
    id: 'ball-gold',
    kind: 'ball',
    name: 'Doubloon Gold',
    blurb: 'Worth less than it looks. Still worth something.',
    price: 100,
    colour: Color4.create(1, 0.82, 0.3, 1),
    emissive: 0.3
  },
  {
    id: 'ball-coral',
    kind: 'ball',
    name: 'Coral Pink',
    blurb: 'Easy to find in the rough. Harder to live down.',
    price: 150,
    colour: Color4.create(1, 0.45, 0.62, 1),
    emissive: 0.25
  },
  {
    id: 'ball-lime',
    kind: 'ball',
    name: 'Deck-light Lime',
    blurb: 'Visible at night, which is when most balls are lost.',
    price: 250,
    colour: Color4.create(0.6, 1, 0.35, 1),
    emissive: 0.3
  },
  {
    id: 'ball-pearl',
    kind: 'ball',
    name: 'Black Pearl',
    blurb: 'Almost impossible to follow. That is the point.',
    price: 400,
    colour: Color4.create(0.12, 0.12, 0.16, 1),
    emissive: 0.05
  }
]

export function itemById(id: string): Item | undefined {
  return CATALOGUE.find((i) => i.id === id)
}

export function itemsOfKind(kind: ItemKind): Item[] {
  return CATALOGUE.filter((i) => i.kind === kind)
}

/** Free stock, which nobody has to buy and everybody starts with. */
export const DEFAULTS: Record<ItemKind, string> = {
  club: 'club-driftwood',
  ball: 'ball-white'
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

export function isOwned(id: string): boolean {
  const item = itemById(id)
  if (item && item.price === 0) return true
  return owned.has(id)
}

export function equippedId(kind: ItemKind): string {
  return equipped[kind]
}

export function equippedItem(kind: ItemKind): Item {
  return itemById(equipped[kind]) ?? itemById(DEFAULTS[kind])!
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

/** Asks to equip something already owned. */
export function equip(id: string): void {
  if (!isOwned(id)) return
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

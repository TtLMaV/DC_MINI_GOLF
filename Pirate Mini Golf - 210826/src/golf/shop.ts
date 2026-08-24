import { Color4 } from '@dcl/sdk/math'

import { ADMIN } from './config'
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
  Damping?: number
}

// Club Skins
const Club_Stick = 'assets/scene/Golf/Stick Club.glb'
const Club_Standard = 'assets/scene/Golf/Standard Club.glb'
const Club_Golden = 'assets/scene/Golf/Golden Club.glb'
const Club_Ruby = 'assets/scene/Golf/Ruby Club.glb'
const Club_Master = 'assets/scene/Golf/Master Club.glb'
const Club_Pirate = 'assets/scene/Golf/Pirate Cutlass Club.glb'
const Club_Flag = 'assets/scene/Golf/Flag Club.glb'
const Club_Mech = 'assets/scene/Golf/Mechanical Club.glb'
const Club_Neon = 'assets/scene/Golf/Neon Club.glb'
const Club_Seaside = 'assets/scene/Golf/Seaside Club.glb'

// Ball Skins
const Ball_stone = 'assets/scene/Balls/Stone Ball.glb'
const Ball_Standard = 'assets/scene/Balls/Standard Ball.glb'
const Ball_Golden = 'assets/scene/Balls/Golden Ball.glb'
const Ball_Ruby = 'assets/scene/Balls/Ruby Ball.glb'
const Ball_Master = 'assets/scene/Balls/Master Ball.glb'
const Ball_Crown = 'assets/scene/Balls/Crown Ball.glb'


export const CATALOGUE: Item[] = [
  // --- clubs ---------------------------------------------------------------
  {
    id: 'club-stick',
    kind: 'club',
    name: 'Stick Putter',
    blurb: 'Add Description',
    price: 0,
    model: Club_Stick,
    power: 0.9,
    forgiveness: 0,
    Damping: 0.55
  },
  {
    id: 'club-standard',
    kind: 'club',
    name: 'Iron Club',
    blurb: 'Add Description',
    price: 300,
    model: Club_Standard,
    power: 0.95,
    forgiveness: 0.25,
    Damping: 0.35
  },
  {
    id: 'club-golden',
    kind: 'club',
    name: "Golden Club",
    blurb: 'Add Description',
    price: 600,
    model: Club_Golden,
    power: 1.0,
    forgiveness: 0.5,
    Damping: 0.28
  },
  {
    id: 'club-ruby',
    kind: 'club',
    name: 'Ruby Club',
    blurb: 'Add Description',
    price: 1000,
    model: Club_Ruby,
    power: 1.1,
    forgiveness: 0.75,
    Damping: 0.22
  },
  {
    id: 'club-master',
    kind: 'club',
    name: "Master Club",
    blurb: 'Add Description',
    price: 250,
    model: Club_Master,
    power: 1.2,
    forgiveness: 0.9,
    Damping: 0.21
  },
  {
    id: 'club-pirate',
    kind: 'club',
    name: 'Pirate Club',
    blurb: 'Add Description',
    price: 5000,
    model: Club_Pirate,
    power: 2,
    forgiveness: 0.99,
    Damping: 0.2
  },{
    id: 'club-flag',
    kind: 'club',
    name: "Flag Putter",
    blurb: 'Add Description',
    price: 9000,
    model: Club_Flag,
    power: 1.0,
    forgiveness: 0.5,
    Damping: 0.35
  },
  {
    id: 'club-mech',
    kind: 'club',
    name: 'Mechanical Club',
    blurb: 'Add Description',
    price: 9000,
    model: Club_Mech,
    power: 1.0,
    forgiveness: 0.5,
    Damping: 0.35
  },
  {
    id: 'club-neon',
    kind: 'club',
    name: "Neon Club",
    blurb: 'Add Description',
    price: 9000,
    model: Club_Neon,
    power: 1.0,
    forgiveness: 0.5,
    Damping: 0.35
  },
  {
    id: 'club-seaside',
    kind: 'club',
    name: 'Seaside Club',
    blurb: 'Add Description',
    price: 9000,
    model: Club_Seaside,
    power: 1.0,
    forgiveness: 0.5,
    Damping: 0.35
  },

  // --- balls ---------------------------------------------------------------
  {
    id: 'ball-stone',
    kind: 'ball',
    name: 'Stone Ball',
    blurb: 'Add Description',
    price: 0,
    model: Ball_stone,
  },
  {
    id: 'ball-standard',
    kind: 'ball',
    name: 'Standard Ball',
    blurb: 'Add Description',
    price: 100,
    model: Ball_Standard,
  },
  {
    id: 'ball-golden',
    kind: 'ball',
    name: 'Golden Ball',
    blurb: 'Add Description',
    price: 150,
    model: Ball_Golden,
  },
  {
    id: 'ball-ruby',
    kind: 'ball',
    name: 'Ruby Ball',
    blurb: 'Add Description',
    price: 250,
    model: Ball_Ruby,
  },
  {
    id: 'ball-master',
    kind: 'ball',
    name: 'Master Ball',
    blurb: 'Add Description',
    price: 400,
    model: Ball_Master,
  },
  {
    id: 'ball-crown',
    kind: 'ball',
    name: 'Crown Ball',
    blurb: 'Add Description',
    price: 250,
    model: Ball_Crown,
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

export function isOwned(id: string): boolean {
  if (ADMIN.freeStock) return true
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

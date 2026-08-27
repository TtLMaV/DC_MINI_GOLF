import { Storage } from '@dcl/sdk/server'

import { LEADER_BOARD } from './config'

/**
 * The three leaderboard tables, on the server.
 *
 * Everything else the ledger keeps is per wallet: Storage.player hands each
 * player their own record and nobody ever reads anybody else's. A leaderboard
 * is the one thing in the scene that is genuinely about everybody at once, so
 * it lives in scene-scoped storage instead — one key, one document, read at
 * startup and written when it changes.
 *
 * ---------------------------------------------------------------------------
 * Why the tables are kept rather than computed
 * ---------------------------------------------------------------------------
 * The obvious implementation is to read every wallet and sort. There is no way
 * to do that: player storage is addressed by wallet, and the server has no list
 * of which wallets exist. So the tables are maintained instead — each player's
 * figures are offered up as they change, and a table keeps the best few it has
 * been shown.
 *
 * That has a real consequence worth stating plainly: a player who has never
 * connected since this was added is not on the board, however good their round
 * was. They appear the first time they finish anything.
 *
 * ---------------------------------------------------------------------------
 * What this does not defend against
 * ---------------------------------------------------------------------------
 * The figures are the server's own — a client cannot post a score to the board,
 * only earn one. The *name* beside it is the client's word for itself, cleaned
 * up but not verified, because there is nothing to verify it against. Somebody
 * determined to appear as a rude word can. That is the same exposure as any
 * name in the scene rather than a new one.
 *
 * If two server instances ever run at once, both hold their own copy and the
 * later write wins, so an entry can be lost. One instance per scene is the
 * normal case and this is not worth a locking protocol for a mini golf sign.
 */

export type Entry = {
  /** Wallet, so the same player replaces their own row rather than adding one. */
  who: string
  /** Display name, cleaned and cut. */
  n: string
  /** The figure being ranked. */
  v: number
}

type Tables = {
  /** Ranked by lifetime Pixel Points, highest first. */
  level: Entry[]
  /** Ranked by total strokes for the nine, lowest first. */
  best: Entry[]
  /** Ranked by Pixel Points earned today, highest first. */
  today: Entry[]
  /** Which UTC day the 'today' table belongs to. */
  day: string
}

const KEY = 'leaders'

const blank = (): Tables => ({ level: [], best: [], today: [], day: '' })

let tables: Tables = blank()
let loaded = false
let dirty = false

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Makes a client-supplied name safe to write on a sign.
 *
 * Not sanitising for security — there is no markup here to inject into, and a
 * TextShape draws whatever it is given. It is sanitising for legibility: a name
 * with newlines in it would push every row below it off the parchment, and one
 * forty characters long would run off the side.
 */
export function tidyName(raw: string, address: string): string {
  let name = (raw || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (name.length > LEADER_BOARD.maxNameLength) {
    name = name.slice(0, LEADER_BOARD.maxNameLength - 1).trimEnd() + '…'
  }
  // A wallet is a poor name but it is better than a blank row, and it is the
  // only thing the server actually knows about somebody.
  if (name.length === 0) {
    name = address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
  }
  return name
}

// ---------------------------------------------------------------------------
// Keeping the tables
// ---------------------------------------------------------------------------

/**
 * Puts one player's figure into one table.
 *
 * Replaces their own row rather than adding a second — the tables are "best per
 * player", not "best rounds ever", so somebody who plays all day should occupy
 * one line however many times they beat themselves.
 *
 * `better` decides the direction, because two of these rank high and one ranks
 * low, and passing a comparator is cheaper than three near-identical functions.
 */
function offer(
  table: Entry[],
  who: string,
  name: string,
  value: number,
  better: (a: number, b: number) => boolean
): boolean {
  const at = table.findIndex((e) => e.who === who)

  if (at >= 0) {
    // Their name may have changed since last time even when the figure has not.
    const nameChanged = table[at].n !== name
    if (!better(value, table[at].v) && !nameChanged) return false
    if (better(value, table[at].v)) table[at].v = value
    table[at].n = name
    trim(table, better)
    return true
  }

  // Somebody not on the board at all. They may still not be once it is sorted
  // — most players are not in anybody's top five — and the answer matters,
  // because "changed" is what triggers a storage write and a broadcast. The
  // honest way to tell a real entry from a push-and-truncate that put
  // everything back is to compare the table with what it was.
  const was = signature(table)
  table.push({ who, n: name, v: value })
  trim(table, better)
  return signature(table) !== was
}

/** Sorts by whichever direction this table ranks in, then cuts it to length. */
function trim(table: Entry[], better: (a: number, b: number) => boolean): void {
  table.sort((a, b) => (better(a.v, b.v) ? -1 : better(b.v, a.v) ? 1 : 0))
  if (table.length > LEADER_BOARD.maxRows) table.length = LEADER_BOARD.maxRows
}

function signature(table: Entry[]): string {
  return table.map((e) => `${e.who}:${e.v}`).join('|')
}

const higher = (a: number, b: number) => a > b
const lower = (a: number, b: number) => a < b

/** Rolls the daily table over at UTC midnight, so it is never yesterday's. */
function freshenDay(): void {
  const day = today()
  if (tables.day === day) return
  tables.day = day
  tables.today = []
  dirty = true
}

/** Lifetime Pixel Points. The level is read off this at the other end. */
export function noteLifetime(who: string, name: string, lifetime: number): void {
  if (lifetime <= 0) return
  if (offer(tables.level, who, name, lifetime, higher)) dirty = true
}

/** Total strokes for a finished nine. Lower is better, which is why it exists. */
export function noteBest(who: string, name: string, strokes: number): void {
  if (strokes <= 0) return
  if (offer(tables.best, who, name, strokes, lower)) dirty = true
}

/** Pixel Points earned today. Rolls over on its own at UTC midnight. */
export function noteToday(who: string, name: string, earned: number): void {
  freshenDay()
  if (earned <= 0) return
  if (offer(tables.today, who, name, earned, higher)) dirty = true
}

// ---------------------------------------------------------------------------
// Reading and writing
// ---------------------------------------------------------------------------

/** What to put on the wire. Called by the ledger, which owns the sending. */
export function leaderTables(): {
  level: string
  best: string
  today: string
  day: string
} {
  freshenDay()
  // The wallet goes out with each row, because it is what draws the picture.
  // An AvatarTexture takes a userId and nothing else — the explorer looks the
  // face up itself — so without it the board can have names or portraits but
  // not both.
  //
  // This is not a disclosure: a userId is already the public handle for
  // everybody standing in the scene, and net.ts has been putting them on the
  // wire since the first multiplayer round. It is the same fact, on a sign.
  const rows = (t: Entry[]) => JSON.stringify(t.map((e) => ({ n: e.n, v: e.v, u: e.who })))
  return {
    level: rows(tables.level),
    best: rows(tables.best),
    today: rows(tables.today),
    day: tables.day
  }
}

/** Whether anything has changed since the last time this was asked. */
export function leadersChanged(): boolean {
  return dirty
}

/**
 * Writes the tables out, if they have moved.
 *
 * Called on a timer rather than on every change. A busy afternoon moves the
 * daily table on every hand-over of a shell, and a storage write per shell is a
 * write per shell — this coalesces all of them into one.
 */
export async function saveLeaders(): Promise<void> {
  if (!loaded || !dirty) return
  dirty = false
  try {
    await Storage.set(KEY, tables)
  } catch (e) {
    // Losing a leaderboard write is not worth taking the ledger down for. The
    // in-memory tables are still right and the next save will carry them.
    console.log(`[golf] leaderboard save failed: ${e}`)
    dirty = true
  }
}

/** Reads whatever was there from a previous run. Called once, at startup. */
export async function loadLeaders(): Promise<void> {
  try {
    const stored = await Storage.get<Tables>(KEY)
    if (stored && Array.isArray(stored.level)) {
      tables = {
        level: stored.level ?? [],
        best: stored.best ?? [],
        today: stored.today ?? [],
        day: stored.day ?? ''
      }
    }
  } catch (e) {
    console.log(`[golf] leaderboard load failed, starting empty: ${e}`)
    tables = blank()
  }
  loaded = true
  freshenDay()
  console.log(
    `[golf] leaderboard loaded: ${tables.level.length} ranked, ` +
      `${tables.best.length} rounds, ${tables.today.length} playing today`
  )
}

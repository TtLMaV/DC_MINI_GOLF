import { standing } from './ranks'

/**
 * The leaderboard tables, as the client last heard them.
 *
 * Holds no truth and works none out. The server keeps the tables and sends
 * them whole; this is the last thing it said, parsed once on arrival rather
 * than every time the sign redraws — the board refreshes twice a second and
 * re-parsing three JSON strings at that rate for a thing that changes every
 * fifteen would be silly.
 *
 * The one derivation here is the level, and it is deliberate: the server sends
 * lifetime Pixel Points, and standing() turns that into a level and a rank
 * name using the same curve the HUD already uses. Sending the level as well
 * would put a second copy of a derived number on the wire, free to disagree
 * with the first the moment the curve is retuned.
 */

/** One line of one table. Named Row rather than Standing because ranks.ts
 * already exports a Standing, and it means something else there. */
export type Row = {
  /** Display name, already tidied and cut by the server. */
  name: string
  /** The figure being ranked: lifetime points, strokes, or points today. */
  value: number
  /**
   * Their wallet, which is what draws the portrait.
   *
   * An AvatarTexture is given a userId and nothing else — the explorer looks
   * the face up itself, with no fetch, no external host and no scene
   * permission. That is the whole reason this travels: a name with no userId
   * beside it is a row that can only ever be text.
   */
  userId: string
}

type Tables = {
  level: Row[]
  best: Row[]
  today: Row[]
  /** Which UTC day the 'today' table belongs to. */
  day: string
  /** False until the server has said anything, so the sign can say so. */
  heard: boolean
}

let tables: Tables = { level: [], best: [], today: [], day: '', heard: false }

function parse(json: string): Row[] {
  try {
    const rows = JSON.parse(json) as { n: string; v: number; u?: string }[]
    if (!Array.isArray(rows)) return []
    return rows
      .filter((r) => r && typeof r.n === 'string' && typeof r.v === 'number')
      // A missing userId is not a broken row — it is a row from a server that
      // predates the portraits, and it should still show a name. The board
      // simply leaves the picture off that one.
      .map((r) => ({ name: r.n, value: r.v, userId: typeof r.u === 'string' ? r.u : '' }))
  } catch {
    // A malformed table is one empty page, not a broken sign.
    return []
  }
}

export function setStandings(level: string, best: string, today: string, day: string): void {
  tables = {
    level: parse(level),
    best: parse(best),
    today: parse(today),
    day,
    heard: true
  }
}

/** Whether the server has sent a board yet. */
export function standingsHeard(): boolean {
  return tables.heard
}

/**
 * One page of the board, ready to draw.
 *
 * Returns the rows already formatted, because how a figure reads is a property
 * of which table it came from — 4,820 points, 31 strokes and 260 today are
 * three different things and only one of them is a bare number.
 */
export type PageRow = { name: string; figure: string; userId: string }

export function standingsPage(key: string): PageRow[] {
  if (key === 'level') {
    // The level alone, not the rank name beside it. "Pirate Lord  100" is
    // 1.09m of figure on a 1.9m sign, which leaves nine characters for a name
    // and pushes the last of it off the edge. The heading already says what is
    // being ranked, and the rank is a function of the level for anybody who
    // wants it.
    return tables.level.map((row) => ({
      name: row.name,
      figure: `Lv ${standing(row.value).level}`,
      userId: row.userId
    }))
  }
  if (key === 'best') {
    return tables.best.map((row) => ({
      name: row.name,
      figure: `${row.value}`,
      userId: row.userId
    }))
  }
  if (key === 'today') {
    return tables.today.map((row) => ({
      name: row.name,
      figure: `${row.value}`,
      userId: row.userId
    }))
  }
  return []
}

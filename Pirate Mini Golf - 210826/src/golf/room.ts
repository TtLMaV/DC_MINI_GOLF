import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

/**
 * The wire between the scene and its server.
 *
 * Kept in its own module with no imports of ours on purpose. Both ends need
 * these definitions — the client to send, the server to answer — and if this
 * lived in either of them the two would import each other in a circle.
 *
 * Complex payloads travel as JSON strings rather than nested schemas. A claim
 * list and a quest tally are both open-ended maps, and a schema for them would
 * have to be revised every time a quest is added, which is exactly the sort of
 * coupling the quest template exists to avoid.
 */
export const MESSAGES = {
  /**
   * Client -> server: I have arrived, tell me what you hold for me.
   *
   * The display name rides along because the server has no other way to get
   * it — it holds wallets, and a leaderboard of wallets is a leaderboard
   * nobody can read. It is the client's word for it and is treated as such:
   * trimmed, stripped of anything that is not printable, and cut to length
   * before it is stored.
   */
  hello: Schemas.Map({ version: Schemas.Int, name: Schemas.String }),

  /**
   * Server -> one client: everything it has for that player.
   *
   * Sent on hello and again after anything that changes it, so the client
   * never has to work out what its balance should now be — it is told.
   */
  ledger: Schemas.Map({
    balance: Schemas.Int,
    /**
     * Every point ever earned, which never goes down when they spend.
     *
     * The level is read from this rather than stored, so there is no second
     * number that could disagree with it and nothing to migrate when the
     * curve is retuned.
     */
    lifetime: Schemas.Int,
    /** JSON string[]: the once-ever awards already collected. */
    claims: Schemas.String,
    /** JSON Record<questId, count>: progress on everything running. */
    quests: Schemas.String,
    /** JSON string[]: item ids this player owns. */
    owned: Schemas.String,
    /** JSON Record<'club'|'ball', itemId>: what they are holding. */
    equipped: Schemas.String,
    /** Scrap dug and not yet handed to Sally, and handed over ever. */
    scrapCarried: Schemas.Int,
    scrapTotal: Schemas.Int,

    /** Shells in hand, handed over today, and handed over ever. */
    shellsCarried: Schemas.Int,
    shellsToday: Schemas.Int,
    shellsTotal: Schemas.Int,

    /** Coconuts in hand, handed over today, and handed over ever. */
    coconutsCarried: Schemas.Int,
    coconutsToday: Schemas.Int,
    coconutsTotal: Schemas.Int,
    /** Whether the blender is built, which is what puts drinks on the menu. */
    blender: Schemas.Boolean,
    /** Whether the old motor has been dug up, so it is not buried twice. */
    motor: Schemas.Boolean,

    /** False for a guest, who has nowhere durable to keep any of it. */
    durable: Schemas.Boolean
  }),

  /** Client -> server: a finished nine-hole card, one message per round. */
  card: Schemas.Map({ strokes: Schemas.Array(Schemas.Int) }),

  /** Client -> server: a once-ever award, named by key and priced by the server. */
  claim: Schemas.Map({ key: Schemas.String }),

  /**
   * Client -> server: I picked up a shell.
   *
   * One at a time, never a total. The client saying "I have forty" would be a
   * number to trust; the client saying "one more" is something the server can
   * rate-limit against how fast a person could walk between them.
   */
  shell: Schemas.Map({ one: Schemas.Int }),

  /** Client -> server: I dug up a piece of scrap. One at a time, never a total. */
  dig: Schemas.Map({ one: Schemas.Int }),

  /** Client -> server: give Sally everything I have dug up. */
  handScrap: Schemas.Map({ all: Schemas.Int }),

  /** Server -> one client: what Sally took, and what it left her needing. */
  scrapTaken: Schemas.Map({ taken: Schemas.Int, total: Schemas.Int }),

  /** Client -> server: hand Shellman everything I am carrying. */
  handShells: Schemas.Map({ all: Schemas.Int }),

  /**
   * Server -> one client: what Shellman actually took, and what it paid.
   *
   * Sent as well as the ledger because the dialogue has to say something
   * specific — how many he took, how many he turned down, whether that was
   * the hundredth.
   */
  shellsTaken: Schemas.Map({
    taken: Schemas.Int,
    paid: Schemas.Int,
    refused: Schemas.Int,
    total: Schemas.Int
  }),

  /**
   * Client -> server: I picked up a coconut.
   *
   * One at a time, never a total — the same bargain as the shells, and
   * rate-limited against how fast a person could walk between two palms.
   */
  coconut: Schemas.Map({ one: Schemas.Int }),

  /** Client -> server: hand Coconutty everything I am carrying. */
  handCoconuts: Schemas.Map({ all: Schemas.Int }),

  /** Server -> one client: what Coconutty took, what it paid, and his running total. */
  coconutsTaken: Schemas.Map({
    taken: Schemas.Int,
    paid: Schemas.Int,
    refused: Schemas.Int,
    total: Schemas.Int
  }),

  /** Client -> server: I dug up the old motor. Once ever, and the server checks. */
  motor: Schemas.Map({ one: Schemas.Int }),

  /** Client -> server: a pina colada, please. */
  buyDrink: Schemas.Map({ one: Schemas.Int }),

  /**
   * Server -> one client: a drink was poured, and how long it lasts.
   *
   * Seconds rather than an end time, because the two clocks are not the same
   * clock and the difference between them is exactly the kind of thing nobody
   * notices until a drink lasts four minutes.
   */
  drink: Schemas.Map({ seconds: Schemas.Int }),

  /** Client -> server: where a quest has got to. */
  quest: Schemas.Map({ id: Schemas.String, done: Schemas.Int }),

  /** Client -> server: buy an item, priced by the server from the catalogue. */
  buy: Schemas.Map({ id: Schemas.String }),

  /** Client -> server: hold something already owned. */
  equip: Schemas.Map({ id: Schemas.String }),

  /**
   * Client -> server: put points in my pocket, for testing.
   *
   * Refused unless the asking wallet is named in ADMIN.allow. The test panel
   * opens for anybody while ADMIN.allow is empty, which is right for building
   * — but minting currency is a different thing from jumping to a hole, so it
   * takes naming yourself explicitly and never works by default.
   */
  grant: Schemas.Map({ amount: Schemas.Int }),

  /** Server -> one client: a purchase that could not go through, and why. */
  refused: Schemas.Map({ reason: Schemas.String }),

  /** Server -> one client: what just paid, and why, for the callout. */
  awarded: Schemas.Map({ amount: Schemas.Int, reason: Schemas.String }),

  /**
   * Server -> one client: they have gone up a level.
   *
   * Sent by the server rather than worked out on the client, even though the
   * client has the curve and the lifetime and could tell. The bonus is real
   * Pixel Points, so whoever announces the level-up is also deciding that a
   * payment happened, and that is not a decision to hand to the scene.
   *
   * gained can be more than one: a good round can carry somebody through two
   * levels at once, and two banners in a row is worse than one that says so.
   */
  levelUp: Schemas.Map({
    level: Schemas.Int,
    gained: Schemas.Int,
    bonus: Schemas.Int,
    /** The rank at the new level, named. */
    rank: Schemas.String,
    /** True when this level crossed into a band they were not in before. */
    newRank: Schemas.Boolean,
    /** The club that rank puts on the shelf, or empty when the rank is unchanged. */
    unlocked: Schemas.String
  }),

  /**
   * Server -> everyone: the three leaderboard tables.
   *
   * Broadcast rather than addressed, because it is the same answer for
   * everybody and a per-player copy would be the same bytes sent N times.
   *
   * Each table is a JSON array of { n, v } — a display name and a figure —
   * for the same reason the claims and quests travel as JSON: the shape is
   * open-ended and a schema for it would need revising every time a column
   * is added.
   *
   * The level table sends lifetime points rather than a level. The curve
   * lives in ranks.ts and both ends already have it, so sending the level as
   * well would be a second copy of a derived number, free to disagree with
   * the first.
   */
  leaders: Schemas.Map({
    level: Schemas.String,
    best: Schemas.String,
    today: Schemas.String,
    /** Which UTC day the 'today' table belongs to, so a stale one can be spotted. */
    day: Schemas.String
  })
}

export const room = registerMessages(MESSAGES)

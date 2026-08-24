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
  /** Client -> server: I have arrived, tell me what you hold for me. */
  hello: Schemas.Map({ version: Schemas.Int }),

  /**
   * Server -> one client: everything it has for that player.
   *
   * Sent on hello and again after anything that changes it, so the client
   * never has to work out what its balance should now be — it is told.
   */
  ledger: Schemas.Map({
    balance: Schemas.Int,
    /** JSON string[]: the once-ever awards already collected. */
    claims: Schemas.String,
    /** JSON Record<questId, count>: progress on everything running. */
    quests: Schemas.String,
    /** JSON string[]: item ids this player owns. */
    owned: Schemas.String,
    /** JSON Record<'club'|'ball', itemId>: what they are holding. */
    equipped: Schemas.String,
    /** False for a guest, who has nowhere durable to keep any of it. */
    durable: Schemas.Boolean
  }),

  /** Client -> server: a finished nine-hole card, one message per round. */
  card: Schemas.Map({ strokes: Schemas.Array(Schemas.Int) }),

  /** Client -> server: a once-ever award, named by key and priced by the server. */
  claim: Schemas.Map({ key: Schemas.String }),

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
  awarded: Schemas.Map({ amount: Schemas.Int, reason: Schemas.String })
}

export const room = registerMessages(MESSAGES)

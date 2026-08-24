/**
 * Tunables for the game layer.
 *
 * Nothing here touches the physics setup in index.ts — ball radius, impulse
 * scale, damping, contact materials and step size all stay where they are.
 * These are the rules-and-feel numbers on top.
 */

export const SHOT = {
  /** How close the player has to stand before they can address the ball. */
  reach: 3.0
}

export const SWING = {
  /** Seconds for the cursor to sweep the full bar on the power click. */
  powerSweepTime: 1.6,
  /**
   * Seconds for it to come back to the impact line. This used to be 0.62, which
   * meant a perfect strike was a ~7ms click — not a skill test, a coin flip.
   */
  accuracySweepTime: 1.5,
  /** A click below this still counts as a tap-in rather than a whiff. */
  minPower: 0.04,
  /** Cursor distance from the impact line that counts as a full miss. */
  impactWindow: 0.4,
  /** How far past the line the cursor runs before the swing auto-fires. */
  overrun: 0.3,
  /** Worst-case deviation from the aim line, in degrees. */
  maxDeviationDegrees: 9
}

export const CUP = {
  /** Horizontal distance for the ball to drop. index.ts uses 0.25 as well. */
  captureRadius: 0.25,
  /**
   * Above this *horizontal* speed the ball lips out instead of dropping. It
   * used to be measured against 3D speed, which counted the ball's fall into
   * the cup against it and rejected shots that were plainly going in.
   */
  captureSpeed: 2.0,
  /**
   * How close a *stopped* ball has to be to count as holed. Slightly wider
   * than the capture radius: there is no lip-out left to judge once it has
   * come to rest, only whether it is in the hole.
   */
  restRadius: 0.3,
  /** Seconds the drop animation takes before the hole is scored. */
  dropTime: 0.5
}

export const RULES = {
  /** Strokes added when the ball is lost off the course. */
  hazardPenalty: 1,
  /** Pick up and take this score if a hole is going badly. */
  maxStrokes: 10,
  /** Seconds between holing out and being set down on the next tee. */
  advanceDelay: 2.6,
  /** Below the current hole's tee by this much counts as lost. */
  lostBelowTee: 3.5,
  /** Seconds a ball must be still before the next shot is allowed. */
  settleTime: 0.25,
  /** Strokes added by the reset button. Zero makes it a get-unstuck, not a mulligan. */
  resetPenalty: 0
}

export const AIM = {
  /** Boxes making up the ring. Enough to read as a circle, few enough to be cheap. */
  ringSegments: 24,
  ringRadius: 0.45,
  ringThickness: 0.035,
  /** Length and weight of the direction line. Fixed — it means direction only. */
  lineLength: 2.2,
  lineThickness: 0.045,
  headWidth: 0.16,
  headLength: 0.3,
  /** How far above the surface the ring and line float, to beat z-fighting. */
  hover: 0.02,
  /** How far above and below a point the course surface is looked for. */
  probeUp: 0.6,
  probeDown: 2.5
}

export const CLUB = {
  /**
   * Two rigs, swapped depending on what you are doing.
   *
   * 'hand' hangs the putter off the avatar's right hand bone, which is what you
   * want while walking around — it moves with the arm and reads as carried.
   * But an AvatarAttach entity's transform is owned by the engine, so the club
   * inherits whatever angle the wrist happens to be at and the scene cannot
   * read that angle back to correct it. That makes it useless for the shot,
   * where the face has to be square and the swing has to follow a known arc.
   *
   * So the moment you address the ball the club switches to 'play': anchored to
   * the player transform instead, where its angle is ours to set and the swing
   * is a real arc rather than whatever the wrist does. Set carryAnchor to
   * 'player' to use that rig for walking too.
   */
  carryAnchor: 'hand' as 'hand' | 'player',

  /**
   * How the club sits in the fist while carried.
   *
   * The 180 on x is the one that matters. Avatar rigs point a bone's +Y at its
   * child, so the hand bone's +Y runs down the fingers, while the putter model
   * hangs along its own -Y from the butt of the grip. Unrotated, those cancel
   * and the club stands straight up out of the fist. y spins the head around
   * the shaft — flip to -90 if the face ends up pointing the wrong way.
   */
  gripOffset: { x: 0.02, y: -0.02, z: 0.06 },
  gripRotation: { x: 180, y: 180, z: 0 },
  scale: 1,

  /** Where the club sits relative to the player, carried and at address. */
  carry: { position: { x: 0.3, y: 0.95, z: -0.05 }, tilt: 22, yaw: -18 },
  address: { position: { x: 0.16, y: 1.02, z: 0.26 }, tilt: 4, yaw: 0 },

  /** Flip if the backswing draws forwards instead of back. */
  swingSign: 1,

  /**
   * Emote fired on the avatar at impact, so the body actually swings rather
   * than the club moving on its own beside a statue.
   *
   * The scene cannot pose an arm directly — the only handle on avatar animation
   * is the built-in emote list. 'swingWeaponOneHand' is the closest of them to a
   * golf stroke and matches the club being held in one hand;
   * 'swingWeaponTwoHands' is a bigger, wilder swing if you want more drama.
   * 'none' falls back to the hand-authored club arc with the body left still.
   */
  emote: 'swingWeaponOneHand' as 'swingWeaponOneHand' | 'swingWeaponTwoHands' | 'none',

  /**
   * Play the emote on the upper body only. Legs keep their own stance, so the
   * swing does not lock the player in place or reset them to a standing idle.
   */
  emoteUpperBodyOnly: true,

  /**
   * The swing, in degrees about the grip. The backswing is driven live by the
   * power sweep, so the club is literally showing how hard you are about to hit
   * it — take the meter to the top and the putter goes right back with it.
   */
  backswingBase: 14,
  backswingRange: 62,
  throughBase: -20,
  throughRange: -40,

  /** Seconds. Sharp down through the ball, longer float back to address. */
  downswingTime: 0.16,
  followTime: 0.28,
  recoverTime: 0.5
}

export const SKY = {
  /**
   * Time of day, in seconds since midnight, pinned for everyone in the scene.
   *
   *   0      midnight        50400  14:00  <- here
   *   21600  06:00 dawn      64800  18:00 dusk
   *   32400  09:00           75600  21:00
   *   43200  midday          79200  22:00 night
   *
   * Early afternoon rather than midday on purpose: at 43200 the sun is
   * straight overhead, shadows collapse under the props and the course reads
   * flat. Two hours off noon puts them back at an angle, so the lighthouse,
   * the galleon and the flags all sit on the deck properly. Wind it to 32400
   * for a longer morning shadow, or back to 79200 for the night look.
   */
  fixedTime: 50400
}

/** The two holes you can play without signing on: practice, and the secret one. */
export const FREE = {
  /**
   * Walk this close to the other free hole's tee and the ball moves to it.
   *
   * There is no key for this on purpose. The two tees are eighty-odd metres
   * apart, so being near one is unambiguous, and a prompt to press E for a
   * hole you are already standing on is a step that earns nothing.
   */
  switchRange: 10
}

/**
 * Pixel Points — the coin you earn playing the nine.
 *
 * The balance lives on the Multiplayer Server, which runs this scene's code
 * headlessly and keeps a record per wallet in Storage.player. There is no
 * endpoint, no key and no external service: golf/ledger.ts is the ledger, and
 * it reads the table below rather than a transcription of it, so the two
 * cannot drift.
 *
 * Two rules still shape the numbers:
 *
 * ONE WRITE PER ROUND. The award is worked out when the nine are done and
 * banked once, not credited shot by shot. Quest progress is the exception, and
 * even that is coalesced into a write every few seconds rather than one per
 * putt — the host limits calls in flight, and a currency that writes on every
 * event finds that limit.
 *
 * NOTHING REPEATABLE PAYS. The practice green and the secret hole both re-tee
 * you on a hole-out, so anything paying per putt could be farmed standing
 * still. Only a completed round pays, and the secret hole and every quest pay
 * once ever.
 */
export const POINTS = {
  name: 'Pixel Points',
  short: 'PP',

  /**
   * What a round pays.
   *
   * The floor is deliberately "you finished" rather than "you were good": a
   * first-timer twenty over still leaves with 50, which is the same
   * low-pressure instinct as not showing a results screen.
   *
   * A hole in one pays holeInOne INSTEAD OF eagle, not as well as — on a par 3
   * it is both, and paying twice for one swing reads as a bug.
   *
   * These numbers are duplicated in the endpoint, which is the copy that
   * counts: the scene only uses them to show you what you earned while the
   * request is in flight.
   */
  award: {
    /** For completing all nine, whatever the score. */
    finish: 50,
    par: 5,
    birdie: 15,
    /** Eagle or better. */
    eagle: 40,
    holeInOne: 50,
    /** Beating your own best round for the nine. */
    personalBest: 30,
    /** First completed round of the day. */
    firstOfDay: 25,
    /** Holing the secret hole. Once ever, not once a visit. */
    secretHole: 150
  }
}

export const NET = {
  /** Seconds between ball position updates while the ball is moving. */
  ballPublishInterval: 0.1,
  /** How hard remote balls are pulled toward their last published position. */
  smoothing: 12,
  ballSize: 0.2,
  labelHeight: 0.45,
  labelSize: 1.4
}

export const BOARD = {
  /** Metres behind the first tee, and to one side so it is not in the shot. */
  behindTee: 2.6,
  sideOffset: 1.4,
  height: 1.5,
  width: 2.4,
  tall: 1.6,
  titleY: 0.32,
  /** How close you have to be for the join prompt to appear. */
  reach: 6,
  maxNames: 8,
  refreshInterval: 0.5
}

export const MUSIC = {
  enabled: true,
  /**
   * Linear gain, not perceived loudness. 0.32 is about -10dB — a couple of dB
   * up from the 0.25 it was, which is roughly the smallest step the ear
   * reliably notices. Anything finer and you would not hear the change.
   */
  volume: 0.32
}

export const ADMIN = {
  /**
   * Opens on the 2 key (IA_ACTION_4). SDK7's InputAction set is fixed —
   * E, F, WASD, space, shift and the number keys 1..4 — so a letter like T
   * cannot be bound. 1 is already the ball reset, leaving 2, 3 and 4.
   */
  /**
   * The test panel. Set false before a public deploy, or leave it on and put
   * your wallet address in `allow` below.
   */
  enabled: true,

  /**
   * Who may open it. Empty means anybody, which is what you want while
   * building and emphatically not what you want once the scene is live — the
   * panel skips straight to any hole, so an open one is a free scorecard.
   * Addresses are compared lower-case.
   */
  allow: [] as string[]
}

export const RAMP = {
  /**
   * Hole 9's lift.
   *
   * The ramp is a wedge, not a slab: its top face is a 24-degree slope running
   * the full 1.8m of the shaft. Measured off the collider mesh, relative to the
   * node's own height:
   *
   *   play x 21.25 (low-deck side)    surface = height + 0.70   <- the high edge
   *   play x 23.05 (high-deck side)   surface = height - 0.10   <- the low edge
   *
   * So the ball rolls ON over the high edge at the bottom of travel, and OFF
   * over the low edge at the top. Each end is set against the deck it meets,
   * 2cm proud in the direction of travel so the seam is always a small step
   * DOWN and the ball can never catch a flush edge.
   *
   * The decks, from the collision mesh: 1.00 below x 21.25, nothing across the
   * 1.8m shaft, 3.00 above x 23.05.
   */

  /** High edge lands at 0.98, two centimetres under the 1.00 low deck. */
  bottomY: 0.28,
  /** Low edge lands at 3.02, two centimetres over the 3.00 high deck. */
  topY: 3.12,

  /** Seconds climbing, then held at the top. */
  riseSeconds: 9.1,
  topDwellSeconds: 0.9,
  /** Seconds descending, then held at the bottom before it sets off again. */
  fallSeconds: 9.5,
  bottomDwellSeconds: 1.0
}

/** Shared look-and-feel for every character. */
export const NPC_LOOK = {
  /** Turn to face whoever walks up, rather than staring at a wall. */
  turnToPlayer: true,
  /** Degrees per second they swing round. Slow enough to read as a person. */
  turnRate: 220,
  /** Beyond this they go back to their resting facing. */
  noticeRange: 12,
  /** Invisible box you point at to talk. AvatarShape takes no pointer events. */
  hitboxWidth: 1.1,
  hitboxHeight: 2.0,
  reach: 6,
  /**
   * Which way the avatar model itself points before we rotate it.
   *
   * Zero: an AvatarShape's forward really is +Z, so the bearing the look-at
   * maths produces is the rotation to apply, unchanged. This was briefly 180
   * on the theory that the rig came out backwards. It does not — that only
   * turned their backs on anyone who walked up. Kept as a dial rather than
   * deleted, because it is the first thing to reach for if a future character
   * is built from a .glb whose forward is not +Z.
   */
  modelYawOffset: 0
}

/**
 * Base wearables. An AvatarShape with an empty list renders the bare body
 * shape — the explorer does not apply a default outfit the way the avatar
 * editor does, which is how the first one turned up naked. These are all
 * off-chain base wearables, so they need no ownership check.
 */
const OUTFIT_QUARTERMASTER = [
  'urn:decentraland:off-chain:base-avatars:black_jacket',
  'urn:decentraland:off-chain:base-avatars:brown_pants',
  'urn:decentraland:off-chain:base-avatars:classic_shoes',
  'urn:decentraland:off-chain:base-avatars:casual_hair_01',
  'urn:decentraland:off-chain:base-avatars:balbo_beard',
  'urn:decentraland:off-chain:base-avatars:blue_bandana',
  'urn:decentraland:off-chain:base-avatars:blue_star_earring'
]

const OUTFIT_SHOPKEEPER = [
  'urn:decentraland:off-chain:base-avatars:baggy_pullover',
  'urn:decentraland:off-chain:base-avatars:cargo_shorts',
  'urn:decentraland:off-chain:base-avatars:bun_shoes',
  'urn:decentraland:off-chain:base-avatars:cool_hair',
  'urn:decentraland:off-chain:base-avatars:chin_beard',
  'urn:decentraland:off-chain:base-avatars:black_sun_glasses'
]

export const QUARTERMASTER = {
  id: 'quartermaster',
  name: 'The Quartermaster',
  /**
   * A corner of the Shack, clear of the barrels.
   *
   * Taken from the Shack's own collider mesh: the nearest position forward of
   * the corner where he and all eight neighbouring positions are clear between
   * knee and head height, so he stands in open deck rather than wedged between
   * two props. The deck here is 0.470, not the 0.601 of the course itself.
   *
   * Re-checked against this scene: Shack.glb sits at entity (19.25, 0, 49.25)
   * and the glb-to-play mapping is play = (entity.x - local.x, entity.y +
   * local.y, entity.z + local.z) — the same mirrored-x mapping the hole 9 ramp
   * is built on. That puts the shack deck at play x -10.95..-1.35, z
   * 21.61..24.56, so both of these still land on it.
   */
  position: { x: -3.0, y: 0.47, z: 22.8 },
  facingDegrees: 200,
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  wearables: OUTFIT_QUARTERMASTER,
  idleEmote: 'raiseHand',
  idleEmoteInterval: 14,
  talkEmote: 'wave',
  talkEmoteInterval: 6
}

export const SHOPKEEPER = {
  id: 'shopkeeper',
  name: 'Salt',
  /**
   * Behind the Putts 'n' Balls counter, at the near end of the Shack.
   *
   * Placed off the "A Red" marker set in the Creator Hub, which is the spot
   * asked for: scene x -6.25, z 3.0. Only the height is ours — the marker was
   * left floating at y 2 and an avatar wants the deck, which is 0.470 here,
   * the same boards as the rest of the Shack.
   *
   * Checked against Shack.glb's geometry, mapped into play space the way the
   * hole 9 ramp is (play = entity.x - local.x, entity.y + local.y, entity.z +
   * local.z, with Shack.glb at 19.25 / 0 / 49.25):
   *
   *   counter run   z 1.91..2.36, top at 1.51, x -12.80..-1.02
   *   back shelf    z 2.18..3.22, top at 1.81, x -9.70..-4.68
   *   deck          0.470 throughout
   *
   * So he stands in the serving strip between the counter and the back shelf,
   * with the customer side at z below 1.91. Clear standing room runs back to
   * z 4.25 if he ever wants shifting off the shelf line.
   *
   * Two earlier positions, both wrong ends of the building, kept in case:
   * (-8.9, 0.47, 23.7) is the middle of the bar counter, and
   * (-2.34, 0.47, 24.15) is the gap in the far counter run.
   */
  position: { x: -6.25, y: 0.47, z: 3.0 },
  /**
   * Resting facing: into the Shack, at +z, which is where players come from.
   *
   * This is only what he does with nobody about — inside noticeRange he turns
   * to whoever walked up. So it is the pose you see on the way in, across the
   * room, rather than the one you see while talking to him.
   */
  facingDegrees: 0,
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  wearables: OUTFIT_SHOPKEEPER,
  idleEmote: 'clap',
  idleEmoteInterval: 18,
  talkEmote: 'raiseHand',
  talkEmoteInterval: 7
}



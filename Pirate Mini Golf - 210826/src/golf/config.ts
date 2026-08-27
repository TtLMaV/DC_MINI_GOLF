/**
 * Tunables for the game layer.
 *
 * Nothing here touches the physics setup in index.ts — ball radius, impulse
 * scale, damping, contact materials and step size all stay where they are.
 * These are the rules-and-feel numbers on top.
 */

export const SHOT = {
  /** How close the player has to stand before they can address the ball. */
  reach: 3.0,
  /**
   * How near the ball you have to be for "Walk up to your ball" to appear.
   *
   * The walking phase is the scene's resting state — you are in it from the
   * moment you load until you stand over a ball — so a prompt tied to the
   * phase alone is a prompt that is on permanently, including on the beach,
   * in the cave and stood talking to somebody. It is instruction, not status:
   * it should turn up when the ball is the thing you are heading for and stay
   * out of the way otherwise.
   *
   * 20m is roughly a long putt away, so it appears as you come up on it rather
   * than the moment you turn round.
   */
  promptRange: 20
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
  switchRange: 10,

  /**
   * The level the secret hole opens at.
   *
   * It was reachable from the first minute, which made it a curiosity rather
   * than a discovery — you either wandered past the ninth or you did not, and
   * either way it happened before anything else in the scene meant much.
   * Twelve puts it a good way up the ladder, so finding it is something the
   * island gives you rather than something you trip over.
   *
   * Salt starts talking about it at SECRET_QUEST.needsLevel, two levels
   * earlier, so it arrives as something to climb towards rather than as a
   * locked door with no sign on it.
   */
  secretLevel: 12
}

/**
 * Holing the secret hole in a handful of shots.
 *
 * The only quest in the scene that is about a place rather than an errand, and
 * the one that finally gives the two Neon items a home — they have sat in the
 * catalogue marked PENDING since the art arrived, buyable by nobody.
 *
 * Salt hands it out because he is the one who cannot sell them to you. A
 * chandler who stocks everything, admitting there are two things on his own
 * shelf he has no price for, is a better way to say "this is not for sale"
 * than a locked row in a menu.
 */
export const SECRET_QUEST = {
  /** Salt will not mention it below this. */
  needsLevel: 10,
  /** Shots or fewer on the secret hole. */
  strokes: 8,
  reward: 900
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
   * Let a guest earn, buy and complete quests.
   *
   * Off in the normal course of things: a guest address is not stable between
   * visits, so anything stored against one is lost, and paying somebody in
   * something they cannot keep is worse than not paying them.
   *
   * On for testing. A preview usually runs as a guest unless a wallet has been
   * linked, and with this off a second developer sees the shop and the quest
   * but cannot make either of them do anything — which reads as broken rather
   * than as policy. Turn it on to exercise the whole loop, and off again
   * before a public deploy.
   *
   * The HUD still stars the balance either way, because it is still not
   * durable — this changes who may earn, not who may keep.
   */
  allowGuests: false,

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
    secretHole: 150,

    /**
     * What reaching a new level is worth.
     *
     * base + perLevel x the level reached, so it grows with the ladder without
     * ever becoming the reason to climb it: level 2 pays 30, level 25 pays 145,
     * level 100 pays 520. A round pays about 100, so this reads as a pat on the
     * back rather than as income.
     *
     * Paid into the balance only, never into lifetime — see bonus() in
     * ledger.ts. Lifetime is what decides the level, so a level-up that fed
     * lifetime would be a ladder partly climbing itself, and at the low end,
     * where the gaps between levels are smaller than the bonus, it would
     * literally cascade.
     */
    levelUp: { base: 20, perLevel: 5 }
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
  /**
   * Where the sign lives, read off the 'Artwork Info' marker in Creator Hub.
   *
   * It used to be worked out from the first tee — a few metres back and to one
   * side — which put a floating box wherever the maths landed. The sign is now
   * lettering painted onto the board that is part of the decking, so the spot
   * is a fact about the model rather than something to derive, and it is
   * written down here. Move the marker, read its transform, change these two.
   */
  position: { x: 6.0, y: 2.25, z: 17.25 },
  /**
   * Which way the board faces, in degrees, same convention as the NPCs.
   *
   * The text reads outward along the sign's +Z, so this is the direction a
   * player stands to read it. This was -90 first, inferred from a screenshot
   * rather than measured, and came out facing the wrong way; 90 is the
   * measured answer. If the lettering ever reads mirrored or disappears into
   * the board again, 180 either way is the whole fix.
   */
  facingDegrees: 90,

  /**
   * The face of the decking board, in metres. Nothing is drawn at this size —
   * it is the clickable area, and the box the text is centred and aligned in.
   */
  width: 2.4,
  tall: 1.2,
  /** How far the lettering stands off the board so it does not z-fight. */
  standoff: 0.02,
  /**
   * Un-mirrors the lettering. 0 or 180, and nothing else is useful.
   *
   * This is a different question from facingDegrees and needs its own dial. A
   * TextShape is readable from one side of its plane and mirrored from the
   * other, and which side that is does not depend on where the board is
   * pointing — so turning the board around does not un-mirror anything, it
   * just walks you round to the other side of the same backwards text. That is
   * why -90 and 90 looked identical here, and why two goes at flipping the
   * board never touched the actual problem.
   *
   * facingDegrees chooses which side of the decking the lettering sits on.
   * This chooses which way round the letters read on it.
   *
   * Settled by screenshot, not by reasoning: at facingDegrees 90 the board's
   * front is its +X side, and a TextShape is readable from its own +Z. So the
   * lettering wants no turn of its own. 180 pointed it back into the board and
   * showed its reverse through the front, which is the mirrored text.
   *
   * Worth saying plainly, since three goes at this were spent on it: every
   * report before the build was fixed was of a stale bundle. Nothing about the
   * sign was ever wrong except this one number.
   */
  textYaw: 0,
  /**
   * Sideways nudge, in metres, across the face of the board.
   *
   * The parchment is not centred on the timber it is nailed to, so lettering
   * centred on the board sits left of centre on the paper — 'PIRATE' was
   * hanging off the parchment onto the frame. Measured off a screenshot: the
   * title started about 0.23m left of where it should.
   *
   * Positive moves it right as you look at the sign. I reasoned my way to the
   * opposite of that and was wrong, so take this as measured rather than
   * derived: at facingDegrees 90, local +X is screen right. If facingDegrees
   * is ever changed by 180, this needs negating with it.
   */
  textX: 0.23,

  /**
   * The two lines, centred on the marker rather than sitting high on it.
   *
   * Symmetric about zero on purpose: the marker is the middle of the board, so
   * equal and opposite offsets keep the block centred whatever the board turns
   * out to measure. Widen the pair to push them apart, narrow it to close them
   * up — but keep them mirrored or the block drifts off centre again.
   */
  titleY: 0.2,
  /**
   * Sized by hand, and it has to be: fontSize is only consulted while
   * fontAutoSize is off.
   *
   * 'PIRATE MINI GOLF' is 16 characters, and a character comes out at roughly
   * 0.065m per point of fontSize, so 16 x 0.065 x 2.1 is about 2.2m — inside
   * the 2.4m board with a little air either side. Change the wording and this
   * needs changing with it; that is why the sum is written down.
   *
   * The alternative is TextShape's own fontAutoSize, which overrides fontSize
   * to fill width/height. It is only better than this once BOARD.width and
   * BOARD.tall are the board's real measurements rather than my guess at them
   * — auto-fitting to a wrong box just gets the wrong size on its own.
   */
  titleSize: 2.1,
  listY: -0.2,
  listSize: 1.4,

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
  volume: 0.16
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
   * Who may open it, by wallet.
   *
   * This is the list the *server* checks before it will mint points, so it is
   * the one that actually defends anything. Compared lower-case.
   *
   * Your wallet is printed to the console at startup while ADMIN.enabled is
   * on — look for "[golf] you are ...". Paste it in here to use the panel's
   * grant button.
   */
  allow: ['0xbe21e2cbac649134e1b113e613f0dad15c91a9e2','0x87b1a311980ed517a26b3cb2111dcaebdf584662'] as string[],

  /**
   * Who may open it, by Decentraland name.
   *
   * Here because a name is the thing you know about yourself and a wallet is
   * not. The tag on an unclaimed name is ignored and case does not matter, so
   * 'thepixelarcade' matches whichever way it turns up.
   *
   * What this is worth is worth being straight about: the client reports its
   * own name, so this decides what gets *drawn*, not what is permitted. It
   * keeps the panel out of ordinary players' way, which is the actual job.
   * Somebody running a modified client could open it — and would find that
   * granting points still goes to the server and is still refused unless their
   * wallet is in `allow` above.
   *
   * Both lists empty means anybody, which is right while building and
   * emphatically wrong once the scene is live: the panel skips straight to any
   * hole, so an open one is a free scorecard.
   */
  allowNames: ['thepixelarcade','JoelC'] as string[],

  /**
   * Everything in the shop counts as owned.
   *
   * For testing the clubs and balls without the currency in the way. It is not
   * a shortcut round the shop — the item is genuinely owned, so equipping it
   * runs the ordinary path: the server records what you are holding, answers
   * with the inventory, and the club model and ball colour change off the back
   * of that, exactly as they would after a real purchase. The only thing
   * skipped is paying.
   *
   * You can tell it is on by looking at the inventory: everything reads EQUIP
   * rather than a price.
   *
   * Set false before a public deploy or the shop is a giveaway.
   */
  freeStock: true,

  /**
   * Prints where you are standing, and which way you are facing.
   *
   * Kept on because it is the fastest way to settle anything positional. Half
   * the corrections in this scene — where a character stands, which way a sign
   * reads, the line the boat sails — came down to a coordinate that could have
   * been read in five seconds instead of inferred from a screenshot.
   *
   * Only prints when you have actually moved, so standing still leaves the
   * last reading on screen rather than burying it under identical lines. That
   * also means the final line before you stop is where you are stood.
   *
   * Set false before a public deploy — it is console noise, not a secret.
   */
  logPosition: true,
  /** Metres you have to move before it says anything again. */
  logPositionEvery: 0.15,

  /**
   * Lifts the ball speed cap so a club power above about 1.5 can be felt.
   *
   * MAX_BALL_SPEED exists because the ball must not travel further than its
   * own radius between collision checks. Turning this on does not make a fast
   * ball safe, it just stops the clamp hiding the number you typed: the ball
   * will go through rails, walls and the cup, and holes will be unplayable.
   *
   * It is for answering "how far does this actually throw it" while dialling a
   * club in. Turn it off, and bring the power back under the ladder's top rung,
   * before anything is played for real.
   */
  uncapBallSpeed: false
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
/**
 * How many quests one character will have on the go with you at once.
 *
 * Two, so the Quartermaster is a person with a couple of jobs rather than a
 * noticeboard. Anything already accepted holds a slot until it is handed in and
 * paid, at which point it leaves the conversation entirely and the next one on
 * his list takes its place.
 */
export const QUEST_LIMIT = { perGiver: 2 }

/**
 * The boat on hole 7.
 *
 * Reconstructed rather than recovered. Something in index.ts used to drive it
 * and was lost when that file was overwritten — the giveaway was
 * collisionData/boat_collision.ts still sitting there with nothing importing
 * it, which also meant the boat had no physics body at all and the ball went
 * straight through it.
 *
 * The original motion is gone, so these numbers are a guess at a boat sitting
 * on water: a slow rise and fall, and a slower roll that is not in step with
 * it, because two motions on the same period read as one mechanism rather than
 * as floating.
 *
 * The collision body is driven from the same numbers as the model, so whatever
 * these are set to, what the ball hits is what you can see.
 */
export const BOAT = {
  /** Where it sits, in world space: its local -4.25, 0.5, -4.75 under Hole 7 Base at 19.25, 0, 49.25. */
  home: { x: 15.0, y: 0.5, z: 44.5 },

  /**
   * The two ends of the run, in world space.
   *
   * When both are set the boat travels between them and travel/travelOffset
   * are ignored, so the path can be any line rather than one aligned to an
   * axis. Leave `to` null and it falls back to the axis oscillation below.
   *
   * These two were walked and read off the position log rather than inferred.
   * They run 5.59m almost purely in z, centred on z 44.4 — within a tenth of
   * a metre of where the boat is authored, which is a good sign they are
   * right. Everything I derived before this was a guess: a collision sample
   * said the open floor ran along x and sent me sideways across the hole,
   * which was wrong.
   *
   * They are the ends of the boat's *centre*. The hull is 1.9m long, so bow
   * and stern reach about a metre past each. If it clips the ends, bring both
   * in by 0.95 rather than shortening one.
   */
  from: { x: 15.31, z: 41.59 } as { x: number; z: number } | null,
  to: { x: 15.35, z: 47.18 } as { x: number; z: number } | null,

  /**
   * It sails across the hole, along world X.
   *
   * Measured, not chosen. Sampling the course collision around the boat, the
   * open floor at its position runs x 8.92..19.38 — 10.47m — while along z
   * there is 0.80m before a wall. So the channel crosses in x, and an earlier
   * attempt to sail it along z would have driven it into the side.
   *
   * The hull is 1.9m long, so its centre can travel between 9.87 and 18.43.
   * That is centred on 14.15, which is 0.85 short of where the boat is
   * authored — hence the offset — with an amplitude of 4.28. End to end that
   * puts the bow and stern exactly on the two walls.
   */
  travelOffset: -0.85,
  travel: 4.28,
  /** Radians per second. At 0.4 a full crossing and back takes about 16s. */
  travelSpeed: 0.4,

  /**
   * Extra yaw on the model. Zero: it keeps the facing it was placed with.
   *
   * This was briefly 90, to turn the bow along the travel axis. That was my
   * addition and it was wrong — pointing the boat the way it moves makes it
   * read as going forwards and backwards, when the whole point is that it
   * crosses the hole left to right. It keeps its authored facing and travels
   * broadside, which is what makes the crossing legible from the tee.
   */
  faceDegrees: 0,

  /** Metres up and down from home. */
  bobHeight: 0.09,
  /** Radians per second of the rise and fall. */
  bobSpeed: 0.9,
  /** Degrees of roll either side of upright. */
  rollDegrees: 3.5,
  /** Deliberately not a multiple of bobSpeed, so the two never synchronise. */
  rollSpeed: 0.62
}

/**
 * When the club is in your hand.
 *
 * It used to be out permanently, which meant walking the whole island holding
 * a putter — including into a cave to dig, and up to people to talk to them.
 * Now it appears when there is golf to play and otherwise stays on your back,
 * unless you ask for it.
 */
export const CLUB_CARRY = {
  /**
   * Phases that count as playing.
   *
   * 'ready' is included so it is already in hand as you walk up to the ball
   * rather than appearing at the moment you address it, which reads as the
   * club being late.
   */
  showInPhases: ['ready', 'address', 'swinging', 'rolling', 'sinking'] as string[],
  /** Out on the practice green too, which is not a phase but is still golf. */
  showWhilePractising: true
}

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
   * Walk up and they talk to you. No button.
   *
   * Two ranges rather than one, because a single threshold flickers: stand
   * exactly on it and the conversation opens and shuts every frame you sway.
   * You have to get within talkRange to start, and past leaveRange to end, so
   * the boundary you cross depends on which way you are going.
   *
   * leaveRange is well short of noticeRange on purpose — they keep watching
   * you for a while after the conversation ends, which is what stops the
   * goodbye reading as them losing interest the instant you step back.
   *
   * These were 3.2 and 4.6 and that was much too eager: characters started
   * talking to you from across the room, which reads as them shouting rather
   * than as a conversation. 2.0 means you have to walk up to somebody. The
   * hitbox is 1.1 wide, so stood right beside one you are about 1.2 away —
   * comfortably inside it, without the trigger reaching down the deck.
   */
  talkRange: 2.0,
  leaveRange: 3.2,

  /**
   * Freezes the view while you are talking.
   *
   * A scene camera takes over, sat exactly where your own camera already was,
   * so the picture stops moving the moment a conversation opens and picks up
   * again when it ends. It does not reframe anything — it is a lock, not a
   * shot.
   *
   * Safe here in a way it was not for aiming: while a scene camera drives, the
   * transform the scene can read is the virtual one rather than the player's,
   * so mouse yaw is invisible. That is exactly why the locked address camera
   * was removed. Nothing is aimed during a conversation, so nothing is lost.
   */
  camera: {
    enabled: true,
    /**
     * Seconds to blend. Zero on purpose — a transition into a lock is itself
     * camera movement, which is the thing being got rid of.
     */
    transitionSeconds: 0
  },
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

const OUTFIT_COCONUTTY = [
  'urn:decentraland:off-chain:base-avatars:hawaiian_shirt',
  'urn:decentraland:off-chain:base-avatars:swim_trunks',
  'urn:decentraland:off-chain:base-avatars:sneakers',
  'urn:decentraland:off-chain:base-avatars:cornrows',
  'urn:decentraland:off-chain:base-avatars:granpa_beard',
  'urn:decentraland:off-chain:base-avatars:pirate_bandana',
  'urn:decentraland:off-chain:base-avatars:piratepatch'
]

const OUTFIT_SHELLMAN = [
  'urn:decentraland:off-chain:base-avatars:safari_shirt',
  'urn:decentraland:off-chain:base-avatars:safari_pants',
  'urn:decentraland:off-chain:base-avatars:sport_black_shoes',
  'urn:decentraland:off-chain:base-avatars:curly_hair',
  'urn:decentraland:off-chain:base-avatars:old_mustache_beard',
  'urn:decentraland:off-chain:base-avatars:safari_hat',
  'urn:decentraland:off-chain:base-avatars:thug_life'
]

/**
 * The quest board.
 *
 * Found by entity name at runtime rather than by coordinates, so moving the
 * sign in Creator Hub moves the board with it and nothing here needs editing.
 * That is the lesson of the first-tee board, which has its position written
 * down and took three goes to place.
 *
 * The sizes below are in metres on the sign's own face, and they are guesses
 * until somebody looks at it — the sign's real dimensions are not knowable from
 * here. headingY is the top line's height above the sign's origin; everything
 * else stacks down from it.
 */
/**
 * What the characters sound like.
 *
 * Ten clips of the same wordless burble, played one after another for as long
 * as you are stood talking to somebody, and pitched to whoever is speaking.
 * Nobody says words, which is the point: a voice that is not language cannot
 * fall out of step with text that is, and it never needs re-recording when a
 * line is rewritten.
 *
 * The clips came in as six files, but the first was 21 seconds holding five
 * separate takes with pauses between them — the explorer cannot play part of a
 * file, so it was cut into its five, and the other five were trimmed of the
 * second of silence each carried on the end. They also arrived at -25dB peak,
 * which is about twenty quieter than it wants to be, so they were brought up
 * to -6 on the way through.
 *
 * Each clip carries its own length because there is no way to be told a sound
 * has finished: an AudioSource can be started and stopped and that is all. The
 * only way to know when to start the next one is to have written down how long
 * this one lasts — and then to divide by the pitch, because a clip played at
 * 0.72 takes almost half as long again to get through.
 */
const VOICE_DIR = 'assets/scene/Golf/sounds/voice'

export const PICKUP_SOUND = {
  /**
   * What a shell and a coconut sound like when you take one.
   *
   * Walking over them made the scene quieter, not louder: a click at least had
   * a cursor under it, and without a sound there is nothing at all to tell you
   * a pickup registered other than a number changing in the corner. These are
   * that feedback.
   *
   * Two different sounds rather than one, because they are two different
   * errands with two different daily caps and you can be filling both at once
   * on the same stretch of sand. The shell is a light glassy ping and the
   * coconut is a low woody knock — far enough apart to tell without looking.
   *
   * Synthesised rather than recorded, so swap them freely; the paths are the
   * only thing the code cares about.
   */
  shell: 'assets/scene/Golf/sounds/Shell Pickup.mp3',
  coconut: 'assets/scene/Golf/sounds/Coconut Pickup.mp3',
  volume: 0.8,
  /**
   * A little pitch either way, per pickup.
   *
   * A run along the beach is a dozen of these in twenty seconds, and a dozen
   * identical pings is a smoke alarm. Wobbling it turns a repeated sound into
   * a texture.
   */
  wobble: 0.12
}

export const VOICE = {
  clips: [
    { file: `${VOICE_DIR}/1.mp3`, seconds: 3.9 },
    { file: `${VOICE_DIR}/2.mp3`, seconds: 4.1 },
    { file: `${VOICE_DIR}/3.mp3`, seconds: 5.2 },
    { file: `${VOICE_DIR}/4.mp3`, seconds: 4.2 },
    { file: `${VOICE_DIR}/5.mp3`, seconds: 3.4 },
    { file: `${VOICE_DIR}/6.mp3`, seconds: 2.2 }
  ],
  volume: 0.95,
  /** How far above the character's feet the voice comes from. */
  mouthHeight: 1.6,
  /**
   * Never the same clip twice running.
   *
   * Ten clips and a fair coin means about one repeat in every ten, and a
   * repeat is the one thing that gives the trick away — you hear the same
   * three seconds again and it stops being a person.
   */
  noRepeats: true
}

/**
 * The hanging cages by the cave mouth.
 *
 * The sway is baked into Skeletons.glb as a looping clip rather than driven
 * from code — see skeletons.ts for why the model had to be split three ways
 * before that was possible at all.
 *
 * The amplitude lives in the file, not here: it is roughly two degrees, which
 * moves the foot of a 3.3m cage about 11cm. Enough to catch the eye from the
 * decking, not enough to look like weather. To change it the animation wants
 * rebuilding; speed below is the only dial the scene has.
 */
export const SKELETONS = {
  /** What the entity is called in Creator Hub. Matched loosely — see findCages. */
  entityName: 'Skeletons.glb',
  /** The clip inside the .glb. */
  clip: 'Sway',
  /** Off turns the cages back into statues. */
  sway: true,
  /**
   * Playback rate. 1 is the seven-second loop as authored.
   *
   * Below 1 is heavier and more reluctant, which is the direction to go if it
   * ever reads as breezy — these are iron cages, not wind chimes.
   */
  speed: 1
}

export const QUEST_BOARD = {
  /** What the sign is called in Creator Hub. Matched loosely — see findSign. */
  entityName: 'Quests',

  /** How many quests to list. Anything past this is simply not shown. */
  maxRows: 4,

  /**
   * Measured off Sign.glb rather than guessed.
   *
   * The whole sign is 2.435 x 1.847. The parchment you can actually write on
   * is 1.973 x 1.510, and it is not centred on the model's origin — it sits
   * about 0.126 to one side and 0.081 high. The numbers below are the
   * parchment, because writing to the whole sign puts text on the timber.
   */
  width: 1.9,
  tall: 1.45,

  /**
   * How far the lettering stands off the sign.
   *
   * Always positive: it means "out of the front", measured along whichever way
   * textYaw points the lettering, so it stays correct at any angle.
   *
   * Computed from the model rather than felt for, now that the node rotation
   * is understood. The mesh's own z maps to the entity's -x, so along this
   * axis the writable panel reaches +0.129 and the frame sits behind at
   * -0.102. The text only has to clear 0.129.
   *
   * Negative, and set from in-world rather than calculated.
   *
   * Every figure I derived from the model's bounds was positive and too large,
   * which means I had the face the wrong way round the whole time: the text
   * sits on the opposite side of the sign's origin to the one I kept measuring
   * to. -0.123 is what looks right when checked by eye, and eye beats my
   * arithmetic on this sign.
   * The first attempt used 0.03, so the text sat down inside the recess and
   * only the parts that cleared the moulding showed — which is why it read
   * "QUE" rather than "QUESTS".
   */
  standoff: -0.123,

  /**
   * Sideways nudge, to sit on the parchment rather than the model's origin.
   *
   * The parchment centre is 0.126 off the model's origin. Positive means right
   * as you read the sign, at any textYaw — the offsets are applied along the
   * text's own axes, so this no longer has to be re-derived every time the
   * board is turned. It used to, and that is what made this take four goes.
   */
  textX: 0.126,
  /** Lifts the block onto the parchment's centre rather than the origin. */
  textY: 0.081,
  /**
   * Which way the lettering faces, relative to the sign.
   *
   * The only orientation dial. standoff and textX follow it, so this can be
   * changed on its own: 0, 90, 180, 270, and one of the four is right.
   *
   * Only 0 and 180 are ever right on a flat sign: 90 and 270 turn the lettering
   * edge-on to the board, which is invisible rather than sideways. That is
   * worth writing down, because it means a report of the text being "90
   * degrees out" is never about this value.
   *
   * 90, because this sign's face normal is its local X rather than its local Z.
   *
   * That is not obvious from the model's bounds, which read 2.435 x 1.847 x
   * 0.101 and look like a board lying in XY. The Sign node inside the .glb
   * carries a -90 degree rotation about Y, so the mesh's width ends up along
   * the entity's Z and its thin axis — the face normal — along the entity's X.
   * Reading the mesh bounds without reading the node rotation is what made me
   * insist 90 could not be right.
   *
   * Only two of the four are ever valid, and which two depends on that node
   * rotation: here it is 90 and 270, not 0 and 180.
   */
  textYaw: 90,

  /**
   * Draws a labelled probe at every orientation at once, and nothing else.
   *
   * Turn this on, look at the sign, read which label is facing you the right
   * way round, put that number in textYaw, turn this off. It exists because
   * guessing this from a description cost five attempts — "flipped 180" and
   * "90 degrees wrong" are unambiguous to look at and very ambiguous to
   * translate into an axis and a sign.
   *
   * Each probe also carries its own standoff, so a probe that is behind the
   * sign tells you that too: you will only see the ones in front.
   */
  probeOrientation: false,

  /**
   * Sizes, worked out against the 1.97m parchment at roughly 0.065m per
   * character per point of fontSize — the rate the first-tee title turned out
   * to run at. 'QUESTS' at 2.2 is about 0.86m; a 36-character objective line
   * at 0.8 is about 1.87m, which is as long a line as this sign will take.
   */
  headingY: 0.6,
  headingSize: 2.2,
  /** Vertical gap between one quest and the next. */
  rowHeight: 0.27,
  nameSize: 1.4,
  /** How far the objective line sits under the quest name. */
  detailDrop: 0.105,
  detailSize: 0.8,
  /** How far the progress bar sits under the quest name. */
  barDrop: 0.185,
  barWidth: 1.75,
  barHeight: 0.03,

  refreshInterval: 0.5
}

/**
 * The leaderboard sign, out on the decking beside the quest board.
 *
 * Same model, same maths, same lesson: found at runtime by entity name rather
 * than by coordinates, so moving it in Creator Hub moves the board with it.
 * The geometry dials below are the quest board's, because it is literally the
 * same Sign.glb turned the same way — if one of them is ever re-measured, the
 * other wants the same number.
 *
 * It shows three tables rather than one, a page at a time. Three boards side
 * by side would each be a third the size on a sign this small, and the three
 * answer different questions anyway: who has played most, who has played best,
 * and who is playing today. A page each gives every one of them the whole
 * parchment.
 */
export const LEADER_BOARD = {
  /** What the sign is called in Creator Hub. Matched loosely — see findSign. */
  entityName: 'LeaderBoard',

  /** How many players each page lists. */
  maxRows: 5,

  /**
   * The pages, in the order they come round.
   *
   * Named here rather than in code so the order, the wording and which of them
   * appear at all are one edit in one place. Drop an entry and that page stops
   * being shown; the cycle simply gets shorter.
   */
  pages: [
    { key: 'level', heading: 'TOP RANKS', note: 'By lifetime Pixel Points' },
    { key: 'best', heading: 'BEST ROUNDS', note: 'Fewest strokes for the nine' },
    { key: 'today', heading: 'TODAY', note: 'Pixel Points earned today' }
  ],
  /** Seconds each page holds before the next one comes up. */
  pageSeconds: 8,

  /**
   * How long a name may be before it is cut.
   *
   * Names come from the client and are stored as given, so this is the only
   * thing standing between a very long one and a row that runs off the
   * parchment. Cut here rather than at the sign so the same limit applies to
   * what is stored and what is shown.
   */
  maxNameLength: 16,

  // --- geometry: the quest board's numbers, for the same sign -------------
  width: 1.9,
  standoff: -0.123,
  textX: 0.126,
  textY: 0.081,
  textYaw: 90,
  probeOrientation: false,

  headingY: 0.58,
  headingSize: 2.2,
  /** The line under the heading saying what the page is ranking. */
  noteDrop: 0.19,
  noteSize: 0.75,
  /**
   * Vertical gap between one player and the next.
   *
   * Five rows at 0.23 put the last one at -0.73, which is a centimetre past the
   * bottom of the 1.45m parchment before the glyphs are even counted. 0.20
   * lands it at -0.63 with room underneath.
   */
  rowHeight: 0.2,
  /**
   * Where the first player sits, under the heading and its note.
   *
   * Raised from 0.17 once the portraits went in. A portrait hangs 0.125 below
   * its row's line — portraitDrop plus half its height — and at 0.17 the fifth
   * one came out 3cm past the bottom of the parchment and onto the timber. The
   * text alone had fitted, which is exactly the sort of thing that only shows
   * up when you measure the picture rather than the words.
   */
  rowsTop: 0.28,
  rowSize: 1.05,

  /**
   * The four columns, as offsets from the parchment's left edge.
   *
   * Each is its own entity, centred — see the note in leaderboard.ts about why
   * text alignment is not used. So these are the middle of each column, not its
   * left edge, and the parchment runs 0 to LEADER_BOARD.width across.
   *
   * Separate entities rather than one padded string because the font is
   * proportional: spaces would line the numbers up differently on every row.
   */
  portraitX: 0.11,
  placeX: 0.3,
  nameX: 0.88,
  valueX: 1.63,

  /**
   * The player's own face, drawn as an AvatarTexture on a small plane.
   *
   * 0.16 against a 0.20 row leaves 4cm of air between one portrait and the
   * next, which is the difference between a column of faces and a strip of
   * them. Any larger and they touch.
   */
  portraitSize: 0.16,
  /**
   * How far the portrait sits below the text's own line.
   *
   * A plane is centred on its entity and so is a TextShape, but the glyphs sit
   * high inside their line box, so putting both at the same height leaves the
   * face looking like it has floated up off its row.
   */
  portraitDrop: -0.045,

  refreshInterval: 0.5
}

const OUTFIT_SALLY = [
  'urn:decentraland:off-chain:base-avatars:green_hoodie',
  'urn:decentraland:off-chain:base-avatars:brown_pants',
  'urn:decentraland:off-chain:base-avatars:sport_black_shoes',
  'urn:decentraland:off-chain:base-avatars:pony_tail',
  'urn:decentraland:off-chain:base-avatars:blue_bandana'
]

export const SALLY = {
  id: 'sally',
  name: 'Cave Explorer Sally',
  /** Walked to and read off the position log, facing included. */
  position: { x: 104.72, y: 1.83, z: 43.84 },
  facingDegrees: -164,
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseFemale',
  wearables: OUTFIT_SALLY,
  /**
   * The highest and the least steady voice in the scene.
   *
   * Eleven months on her own with nobody to tell any of it to, and then
   * somebody walks into the cave. She goes up at the end of everything, barely
   * stops for breath, and the wobble is nearly ten times Shellman's — she is
   * the only character here who is excited.
   */
  voice: { pitch: 1.45, wobble: 0.13, gapMin: 0.05, gapMax: 0.25 },
  idleEmote: 'shrug',
  idleEmoteInterval: 12,
  talkEmote: 'raiseHand',
  talkEmoteInterval: 6
}

/**
 * The metal detector, and what is buried out where Sally is digging.
 *
 * Hot and cold: carry it, sweep the ground, and it quickens as you close on
 * something. Nothing is marked — the finds are at fixed spots you have to
 * search out, which is the whole reason to give somebody a detector rather
 * than a map.
 *
 * ---------------------------------------------------------------------------
 * The dig sites are provisional
 * ---------------------------------------------------------------------------
 * Sally stands at x 104.7, which is past the end of every model in the scene —
 * the sand plane stops around x 76 and the island collider at x 60 — so the
 * ground she is stood on is not something I can measure from here. These
 * fourteen are scattered around her at her own height, which is walkable by
 * definition since that is where you were standing.
 *
 * If any of them end up inside a rock or hanging in the air, walk the dig area
 * and read positions off the log (ADMIN.logPosition), then replace this list.
 * That is how the boat's route got sorted and it took one attempt, against
 * three for everything I inferred.
 */
export const DETECTOR = {
  /**
   * The model, hung off the right hand the same way the club is.
   *
   * Measured: 0.24 x 0.88 x 0.20, origin at the grip with the shaft and coil
   * running down -Y. That is exactly how you would want it authored for a hand
   * attach — no offset needed to stop it floating, only a tilt so the coil
   * points at the ground in front rather than straight down at your boots.
   */
  model: 'assets/scene/Metal Detector/MetalDetector.glb',
  scale: 1.0,
  /**
   * Degrees of pitch in the hand.
   *
   * 145, not -35. The model runs down -Y from its grip, which I read as
   * "hangs downward" — but the hand anchor's own orientation turns it over, so
   * -35 held it coil-up like a sledgehammer. 145 is that plus a half turn,
   * which puts the coil down and forward where a detector's is.
   */
  gripTilt: 145,
  gripYaw: 0,
  /** Nudge in the hand, metres, if it sits through the fist. */
  gripOffset: { x: 0, y: 0, z: 0 },

  /**
   * The cave mouth, as a flat box in world space.
   *
   * Walk in and the detector comes out on its own; walk out and it goes away
   * again. Taken from the dig sites themselves — they span x 79.7..107.8 and
   * z 25.1..53.7, and Sally stands inside that — plus 7m of margin so the
   * change happens as you arrive rather than once you are stood on a find.
   *
   * A box rather than a radius because the pocket is longer than it is wide,
   * and a circle big enough to cover it would reach out over the water.
   */
  cave: { minX: 73, maxX: 115, minZ: 18, maxZ: 61 },

  /**
   * What comes out of the ground, picked at random per site.
   *
   * Measured: 0.34 x 0.38 x 0.41, 0.55 x 0.04 x 0.30, and 0.14 x 0.59 x 0.10.
   * All three carry their own scale on the node, so they arrive at those sizes
   * with no scaling from us.
   */
  scrapModels: [
    'assets/scene/Scrap/Scrap1.glb',
    'assets/scene/Scrap/Scrap2.glb',
    'assets/scene/Scrap/Scrap3.glb'
  ],

  /**
   * How deep a piece sits when you are nowhere near it.
   *
   * Far enough under that the cave floor hides it completely. It is not made
   * invisible until it is properly buried — being occluded by the ground is
   * the effect, and a piece that pops into existence reads as a spawn rather
   * than as something surfacing.
   */
  buriedDepth: 0.9,

  /**
   * Where surfacing starts, in metres.
   *
   * Deliberately much shorter than senseRange. The clicking is the long-range
   * instrument and should stay the only one — if scrap rose at 14m you would
   * see the answer from across the cave and never sweep for it. At 5m you are
   * already close, and the thing lifting out of the floor is confirmation
   * rather than a signpost.
   */
  revealRange: 5,
  /** Degrees a second it turns while it is up, so it catches the eye. */
  revealSpin: 40,

  /** Sweeping range. Beyond this it says nothing at all. */
  senseRange: 14,
  /** Inside this you can dig. */
  digRange: 1.6,
  /**
   * Seconds between pings at the extremes.
   *
   * Far away it clicks slowly; on top of something it is nearly a tone. The
   * interval is interpolated between these two by distance, which is what
   * makes sweeping feel like homing in rather than like reading a number.
   */
  slowestPing: 1.1,
  fastestPing: 0.09,

  /** How long a dug site stays empty before something else washes in. */
  respawnSeconds: 240,
  /** Scrap per find. */
  scrapPerFind: 1,
  /** Digs cannot come faster than this, in seconds. The honest anti-farm. */
  minSecondsBetweenDigs: 3,
  /** Nobody carries more than this. */
  maxCarried: 400,

  /**
   * Where the old motor might be.
   *
   * A list rather than a place. One of these is picked at random the first
   * time somebody actually goes looking — so the answer cannot be looked up,
   * and two people on the same quest are not stood in the same patch of floor.
   * It is only in the ground while Coconutty's motor quest is running, and
   * once dug it never comes back.
   *
   * Measured, not guessed. Every one is a point on the cave's own floor
   * geometry that is at least 4m from all fourteen ordinary dig sites, at
   * least 6m from every other candidate, and clear of Sally. Four metres is
   * comfortably outside the 1.6m dig range, so standing on the motor never
   * puts you within reach of an ordinary find — the two cannot be confused at
   * the moment it matters.
   */
  motorSpots: [
    { x: 103.75, y: 0.91, z: 23.99 },
    { x: 96.16, y: 2.12, z: 28.05 },
    { x: 88.53, y: 1.90, z: 28.64 },
    { x: 84.47, y: 0.24, z: 36.01 },
    { x: 75.88, y: 3.49, z: 37.79 },
    { x: 100.34, y: 0.47, z: 38.70 },
    { x: 90.84, y: 0.55, z: 40.64 },
    { x: 86.29, y: 0.65, z: 47.45 },
    { x: 101.51, y: 2.60, z: 51.04 }
  ],
  /** The motor itself, rather than a piece of scrap standing in for it. */
  motorModel: 'assets/scene/Motor/Motor.glb',
  /**
   * Measured: 0.23 x 0.24 x 0.34 as exported, which is about the size of the
   * smallest piece of scrap down there. At 1.5 it runs 0.34 x 0.35 x 0.51,
   * which makes it the biggest thing in the cave — worth saying, since the
   * whole quest is somebody being told to bring back the heavy one.
   */
  motorScale: 1.5,

  spots: [
    { x: 90.46, y: 1.56, z: 25.07 },
    { x: 99.61, y: 0.62, z: 25.09 },
    { x: 107.78, y: 0.68, z: 26.77 },
    { x: 82.31, y: 0.62, z: 31.61 },
    { x: 103.82, y: 0.55, z: 32.27 },
    { x: 89.73, y: 0.75, z: 33.23 },
    { x: 97.16, y: 0.42, z: 34.54 },
    { x: 106.64, y: 0.76, z: 39.48 },
    { x: 79.94, y: 0.04, z: 39.85 },
    { x: 86.19, y: 0.82, z: 41.75 },
    { x: 94.15, y: 0.75, z: 46.23 },
    { x: 102.03, y: 1.44, z: 46.32 },
    { x: 79.74, y: 0.56, z: 48.16 },
    { x: 104.74, y: 2.10, z: 53.72 }
  ]
}

export const SHELLMAN = {
  id: 'shellman',
  name: 'Shellman',
  /**
   * The 'B Red' marker on the south beach.
   *
   * x and z are the marker's. The y is not: markers float, and this one sits
   * at 0.75 while the sand under it is at 0.635 — sampled from the island's
   * own collider mesh within a metre of the spot, the same way Salt's 0.47
   * came from the Shack deck rather than from his marker at 2.
   *
   * He was on the east beach before this, which was my choice rather than
   * anybody's instruction.
   */
  position: { x: 27.5, y: 0.64, z: 41.25 },
  /** Straight off the marker's own rotation. */
  facingDegrees: 150,
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  wearables: OUTFIT_SHELLMAN,
  /**
   * The lowest and the flattest.
   *
   * Almost no wobble at all, because that is the character: he says everything
   * at the same unhurried pitch whatever it is, and the long gaps between
   * clips are him counting something you cannot see.
   */
  voice: { pitch: 0.66, wobble: 0.015, gapMin: 0.45, gapMax: 0.85 },
  // He is more animated than the other two. It is the whole character.
  idleEmote: 'headexplode',
  idleEmoteInterval: 9,
  talkEmote: 'clap',
  talkEmoteInterval: 4
}

/**
 * Shells on the beach.
 *
 * The supply is the throttle. Ten shells a day at ten points each is 100 PP,
 * about what a decent round pays — worth the walk, not worth doing instead of
 * playing golf. The respawn delay is what stops someone standing in one place
 * clearing the same spot over and over.
 */
export const SHELLS = {
  /** Models, picked at random per shell so the beach is not a row of clones. */
  /**
   * Exactly as the files are named on disk, including the _001.
   *
   * Creator Hub appends that when it imports an asset whose name it has seen
   * before, so replacing a model in place quietly renames it and every path
   * pointing at the old name loads nothing. There is no error for this — a
   * GltfContainer with a src that does not exist simply draws nothing — which
   * is why an empty beach was the only symptom.
   *
   * If these are re-imported again, check the folder before assuming the code
   * is at fault.
   */
  models: [
    'assets/scene/Shells/Shell 1_001.glb',
    'assets/scene/Shells/Shell 2_001.glb',
    'assets/scene/Shells/Spiral Shell_001.glb',
    'assets/scene/Shells/Spiral Shell 2_001.glb',
    'assets/scene/Shells/Spiral Shell 3_001.glb'
  ],
  /** How many are on the sand at once, out of the spots below. */
  onBeach: 20,

  /**
   * Puts every shell in a ring around the spawn point instead of on the beach.
   *
   * A test switch, and a deliberately unsubtle one. "No shells are spawning"
   * has two very different causes — the code is not placing them, or it is
   * placing them somewhere you have not walked — and from a description they
   * look identical. Turn this on and walk two paces: if they are there, the
   * system works and the beach coordinates are the problem; if they are not,
   * the problem is here.
   *
   * Off before anything ships.
   */
  testRing: false,
  testRingAt: { x: -10.6, y: 1.0, z: 16.7 },
  testRingRadius: 3.5,
  /** Seconds before a collected spot can be used again. */
  respawnSeconds: 45,
  /** How close you have to be to click one. */
  reach: 4,
  /** Walk over one and it is yours.
   *
   * Added because clicking a 20cm object is a fair ask with a mouse and an
   * unfair one with a thumb — on a phone the shells were the fiddliest thing
   * in the scene. Walking through them is the same action on every device.
   *
   * The click is kept as well rather than swapped out. It costs nothing, it
   * still works from four metres, and two ways of doing a thing that has no
   * downside beats one way that can be missed.
   *
   * The radius is generous on purpose: 1.2m means brushing past counts, which
   * is what "walk over it" means to somebody who is not aiming at it.
   */
  walkOver: true,
  walkOverRadius: 1.2,
  /**
   * How far above or below one you can be and still collect it.
   *
   * The beach is not flat and the player transform sits at their feet, so a
   * plain 3D distance would refuse a shell you are stood beside on a slope. A
   * wide vertical window with a tight horizontal one is the right shape.
   */
  walkOverHeight: 2.5,
  /**
   * Measured, not guessed. The five models are between 6cm and 27cm across as
   * exported, which is life-size for a shell and far too small to notice on a
   * beach from standing height. At 2 they run 12cm to 53cm, which reads as
   * something worth walking over to.
   */
  scale: 2,
  /** The invisible box you click. Sized so all five are equally easy to hit. */
  hitbox: 0.6,

  /** What Shellman pays, per shell. */
  pointsPerShell: 10,
  /** The most he will take in a day. Resets at UTC midnight, like firstOfDay. */
  dailyLimit: 10,
  /** Shells handed over in total to earn the Seaside Club. */
  forTheClub: 100,
  /**
   * Nobody can pick up two shells closer together than this, in seconds.
   *
   * The scene is client-side, so the server sees "I picked one up" rather than
   * watching it happen. It cannot know that is true — but it can know that
   * shells are metres apart, so they cannot honestly arrive faster than
   * somebody can walk between them.
   *
   * Down from 2 seconds once walking over them started collecting them, and
   * then down again from 0.4 after actually doing the arithmetic. The closest
   * two spots are 2.3m apart; at a jog that is 0.38s and with a colada in you
   * it is 0.16s. Anything slower than the fastest a player can legitimately
   * cross that gap means the server silently drops the second shell, the local
   * count drifts above the real one, and the next ledger appears to take a
   * shell away — which reads as a bug because it is one.
   *
   * 0.1 clears the worst case with room for frame jitter.
   *
   * Being straight about what is left: this is a backstop, not an anti-farm
   * measure, and it stopped being one the moment walking collected. That is
   * fine, because the pickup rate was never the throttle. What a shell is
   * worth is capped by the daily hand-in — ten a day to Shellman however many
   * are in your pockets — so two hundred pays exactly what ten pays. maxCarried
   * is the ceiling on absurdity; the errand is the economy.
   */
  minSecondsBetweenPickups: 0.1,
  /** Nobody sensibly carries more than this. A cap is cheaper than a debate. */
  maxCarried: 250,

  /**
   * Where shells appear.
   *
   * Read off Islands.glb rather than placed by eye: flat, upward-facing sand
   * between y 0.15 and 0.35, at least 7m from every tee and cup so the beach
   * never spills onto the course, then spread by farthest-point sampling so
   * they do not clump where the mesh happens to be dense. Two stretches came
   * out of that — the east beach around x 45..56, and the long south one
   * around x 24..42.
   *
   * Add or move spots freely; the system picks SHELLS.onBeach of them at a
   * time and only ever uses what is here.
   */
  spots: [
  { x: 52.08, y: 0.40, z: 8.93 },
  { x: 48.68, y: 0.31, z: 10.04 },
  { x: 46.69, y: 0.31, z: 13.25 },
  { x: 54.46, y: 0.32, z: 13.29 },
  { x: 47.27, y: 0.31, z: 17.18 },
  { x: 54.06, y: 0.33, z: 17.27 },
  { x: 50.22, y: 0.33, z: 19.58 },
  { x: 54.21, y: 0.26, z: 20.04 },
  { x: 27.07, y: 0.37, z: 37.01 },
  { x: 42.92, y: 0.35, z: 38.75 },
  { x: 24.56, y: 0.30, z: 40.97 },
  { x: 42.85, y: 0.37, z: 41.70 },
  { x: 25.59, y: 0.31, z: 43.30 },
  { x: 43.01, y: 0.24, z: 44.54 },
  { x: 25.50, y: 0.31, z: 45.95 },
  { x: 36.32, y: 0.31, z: 48.01 },
  { x: 30.49, y: 0.38, z: 48.25 },
  { x: 27.30, y: 0.37, z: 48.56 },
  { x: 33.50, y: 0.31, z: 50.01 },
  { x: 33.05, y: 0.28, z: 52.88 },
  { x: 30.76, y: 0.31, z: 53.53 },
  { x: 28.39, y: 0.27, z: 54.63 },
  { x: 27.07, y: 0.31, z: 56.77 },
  { x: 30.70, y: 0.31, z: 57.60 },
  { x: 25.53, y: 0.31, z: 58.66 },
  { x: 28.24, y: 0.31, z: 60.12 },
  { x: 32.07, y: 0.31, z: 61.00 },
  { x: 24.74, y: 0.28, z: 61.11 },
  { x: 30.04, y: 0.31, z: 62.08 },
  { x: 32.83, y: 0.31, z: 63.47 },
  { x: 25.77, y: 0.31, z: 64.05 },
  { x: 28.43, y: 0.31, z: 64.07 },
  { x: 34.77, y: 0.31, z: 65.28 },
  { x: 31.44, y: 0.31, z: 65.39 },
  { x: 28.15, y: 0.31, z: 66.69 },
  { x: 33.25, y: 0.31, z: 67.43 },
  { x: 35.87, y: 0.31, z: 68.08 },
  { x: 30.48, y: 0.26, z: 68.49 },
  { x: 38.80, y: 0.31, z: 68.66 }
  ]
}

/**
 * Coconutty, under the palms behind the shack.
 *
 * Position and facing are the readout from where Matt stood, unchanged. He is
 * the only character who wants two different things at once — a hundred
 * coconuts, and a blender built out of other people's rubbish — which is why
 * his quest list is the one that most needs the two-at-a-time cap.
 */
export const COCONUTTY = {
  id: 'coconutty',
  name: 'Coconutty',
  position: { x: 11.20, y: 1.25, z: -5.70 },
  facingDegrees: 163,
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  wearables: OUTFIT_COCONUTTY,
  /**
   * Up and cheerful, and quick with it.
   *
   * Not as high as Sally and nothing like as erratic — he is enjoying himself
   * rather than bursting with it.
   */
  voice: { pitch: 1.24, wobble: 0.07, gapMin: 0.2, gapMax: 0.45 },
  idleEmote: 'dance',
  idleEmoteInterval: 11,
  talkEmote: 'handsair',
  talkEmoteInterval: 5
}

/**
 * Fallen coconuts, under the palms.
 *
 * The same shape as the shells and for the same reasons: every player sees
 * their own, the count lives on the server, and a pick-up sends "one more"
 * rather than a total. What differs is where they are. Shells are strewn along
 * two beaches; coconuts fall from six trees, so the spots are rings around the
 * palms and nowhere else, which is what makes walking under a palm the way you
 * find them rather than walking anywhere at all.
 */
export const COCONUTS = {
  /**
   * One model, and it must be at this exact path.
   *
   * A GltfContainer with a src that does not exist draws nothing and says
   * nothing, which is how the shells spent an afternoon invisible. If more
   * coconut models turn up, add them here and one is picked per spot.
   */
  models: ['assets/scene/Coconuts/Coconut.glb'],
  /** How many lie on the ground at once, out of the spots below. */
  onGround: 22,
  /** Seconds before a picked spot can be used again. */
  respawnSeconds: 60,
  /** How close you have to be to click one. */
  reach: 4,
  /** Walk over one and it is yours. Same reasoning as the shells. */
  walkOver: true,
  walkOverRadius: 1.2,
  /** How far above or below one you can be and still collect it. */
  walkOverHeight: 2.5,
  /**
   * Measured. The model is 20cm across as exported, which is life-size for a
   * husked coconut and slightly small to spot from standing height. 1.4 puts
   * it at 28cm, which is a big one rather than an unbelievable one.
   */
  scale: 1.4,
  /** The invisible box you click. */
  hitbox: 0.55,

  /** What Coconutty pays, per coconut, on the daily errand. */
  pointsPerCoconut: 8,
  /** The most he will take in a day. Resets at UTC midnight. */
  dailyLimit: 12,
  /** Handed over in total to earn the Coconut Ball. */
  forTheBall: 100,
  /**
   * The walking-pace limit, same reasoning as the shells — including why it
   * came down from 2, and then from 0.4, once walking over them collected
   * them. The closest two coconut spots are 2.03m apart, which is 0.15s at a
   * colada sprint.
   */
  minSecondsBetweenPickups: 0.1,
  /** A cap is cheaper than a debate. */
  maxCarried: 250,

  /**
   * Where they lie.
   *
   * Read off the geometry rather than placed by eye. Palm Trees.glb has no
   * per-tree nodes — it is one merged mesh — so the six crowns were found by
   * splitting its collider into connected components and taking the coconut
   * bunches, which are the only parts that cluster at crown height. Each spot
   * below is then a point in a 1.3m-to-5m ring around a crown, dropped onto
   * the island collider's own upward-facing floor for its height, kept at
   * least 6m from every tee and cup so the course stays clear, and spread by
   * farthest-point sampling with a 1.7m minimum so no two are within reach of
   * each other.
   *
   * Add or move spots freely; the system uses COCONUTS.onGround of them at a
   * time and only ever uses what is here.
   */
  spots: [
    { x: 54.21, y: 0.07, z: 8.17 },
    { x: 49.65, y: 0.21, z: 9.26 },
    { x: 47.92, y: 0.21, z: 10.53 },
    { x: 51.67, y: 0.61, z: 10.61 },
    { x: 54.71, y: 1.00, z: 11.00 },
    { x: 49.86, y: 0.76, z: 11.88 },
    { x: 46.24, y: 0.07, z: 14.14 },
    { x: 49.26, y: 0.67, z: 14.17 },
    { x: 52.85, y: 0.25, z: 14.28 },
    { x: 51.01, y: 0.27, z: 16.21 },
    { x: 47.25, y: 0.25, z: 17.12 },
    { x: 24.94, y: 0.12, z: 23.80 },
    { x: 28.23, y: 0.24, z: 23.96 },
    { x: 31.71, y: 0.17, z: 24.13 },
    { x: 42.45, y: 0.34, z: 37.74 },
    { x: 27.55, y: 0.57, z: 39.02 },
    { x: 24.41, y: 0.06, z: 39.19 },
    { x: 41.60, y: 0.39, z: 39.78 },
    { x: 43.43, y: 0.24, z: 40.93 },
    { x: 26.68, y: 0.53, z: 41.81 },
    { x: 40.09, y: 1.15, z: 42.52 },
    { x: 24.41, y: 0.11, z: 43.18 },
    { x: 43.26, y: 0.20, z: 44.20 },
    { x: 27.60, y: 0.55, z: 44.33 },
    { x: 37.89, y: 0.75, z: 45.26 },
    { x: 40.94, y: 0.08, z: 46.07 },
    { x: 27.78, y: 0.48, z: 46.36 },
    { x: 25.51, y: 0.19, z: 47.00 },
    { x: 29.43, y: 0.40, z: 47.55 },
    { x: 27.28, y: 0.34, z: 48.34 },
    { x: 31.75, y: 0.25, z: 59.96 },
    { x: 27.91, y: 0.25, z: 60.36 },
    { x: 29.91, y: 0.25, z: 60.89 },
    { x: 34.59, y: 0.25, z: 62.39 },
    { x: 28.12, y: 0.25, z: 62.89 },
    { x: 25.63, y: 0.25, z: 63.06 },
    { x: 30.69, y: 0.25, z: 63.17 },
    { x: 32.56, y: 0.25, z: 64.90 },
    { x: 28.94, y: 0.25, z: 64.94 },
    { x: 27.34, y: 0.25, z: 66.20 },
    { x: 34.64, y: 0.25, z: 66.24 },
    { x: 30.70, y: 0.25, z: 66.48 },
    { x: 28.97, y: 0.06, z: 68.18 },
    { x: 32.36, y: 0.20, z: 69.10 }
  ]
}

/**
 * The pina colada.
 *
 * What the blender is for, and the only thing in the scene you buy that is
 * gone when it wears off. Everything else in the shop is a club or a ball you
 * keep; this is five minutes of moving faster, which is worth more on an
 * island this size than another putter.
 *
 * The speeds are absolute metres per second, not multipliers. The client's own
 * defaults are not readable from the scene — AvatarLocomotionSettings only
 * carries the overrides, and removing the component is what restores them — so
 * these were picked to feel like a lift rather than a launch and want tuning
 * by eye rather than by arithmetic.
 */
export const DRINK = {
  /** What one costs, once the blender works. */
  price: 150,
  /** How long it lasts. Five minutes, as asked. */
  seconds: 300,
  /**
   * Whether a second drink stacks or restarts.
   *
   * Restarts. Stacking means somebody buys six and walks about at running
   * speed for half an hour, which is not a drink, it is a permanent upgrade
   * bought in instalments.
   */
  speeds: { walk: 3.2, jog: 8, run: 14, jumpHeight: 1.8 },
  /** Buying again while one is running resets the clock rather than adding. */
  restarts: true,
  /** The soonest a wallet may buy another, in seconds. Stops fat-finger doubles. */
  minSecondsBetweenBuys: 3
}

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
  /**
   * Low, with a bit of swing on it.
   *
   * He runs the place and has said all of this before, so there is some
   * colour in it but no urgency.
   */
  voice: { pitch: 0.85, wobble: 0.05, gapMin: 0.25, gapMax: 0.55 },
  idleEmote: 'raiseHand',
  idleEmoteInterval: 14,
  talkEmote: 'wave',
  talkEmoteInterval: 6
}

export const SHOPKEEPER = {
  id: 'shopkeeper',
  name: 'Salt',
  /**
   * Walked to and read off the position log, rather than derived.
   *
   * x -7.18, y 0.55, z 4.27. The y is the deck under your feet at that spot,
   * which is what the log reports, so he stands on the boards rather than
   * hovering over them or sunk into them.
   *
   * That is back off the counter line: the serving strip runs to about z 4.25
   * before the back shelf, so he is at the rear of it now rather than tight
   * against the counter at z 3.0 where he was.
   *
   * Earlier positions, kept because each was wrong in a way worth not
   * repeating: (-6.25, 0.47, 3.0) came off the "A Red" marker and was right
   * but cramped; (-8.9, 0.47, 23.7) and (-2.34, 0.47, 24.15) are the far end
   * of the building entirely, from before the shack's play-space mapping was
   * pinned down.
   */
  position: { x: -7.18, y: 0.55, z: 4.27 },
  /**
   * Resting facing, read off the same log line.
   *
   * This is only what he does with nobody about — inside noticeRange he turns
   * to whoever walked up. So it is the pose you see on the way in, across the
   * room, rather than the one you see while talking to him.
   *
   * If he has his back to the counter, this wants 256 instead: the log reports
   * which way *you* were looking when you took the reading, which is his facing
   * only if you were stood as he should stand.
   */
  facingDegrees: 76,
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  wearables: OUTFIT_SHOPKEEPER,
  /**
   * Middle of the range, and the most sing-song.
   *
   * A wide wobble on an ordinary pitch is what patter sounds like: he is
   * selling you something and the tune matters more than the note.
   */
  voice: { pitch: 1.02, wobble: 0.09, gapMin: 0.15, gapMax: 0.4 },
  idleEmote: 'clap',
  idleEmoteInterval: 18,
  talkEmote: 'raiseHand',
  talkEmoteInterval: 7
}

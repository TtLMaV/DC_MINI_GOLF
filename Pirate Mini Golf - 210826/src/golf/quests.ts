import { Dialog, DialogChoice } from './npc'
import { alreadyClaimed, claimOnce, playerStanding, reportQuestProgress, storedQuestProgress } from './points'
import {
  COCONUTS,
  COCONUTTY,
  FREE,
  POINTS,
  QUARTERMASTER,
  QUEST_LIMIT,
  RULES,
  SALLY,
  SECRET_QUEST,
  SHELLMAN,
  SHELLS,
  SHOPKEEPER
} from './config'

/**
 * Quests.
 *
 * The shape is deliberately small, because the point of it is that the second
 * quest costs almost nothing to add. A quest is a row of data: who hands it
 * out, what has to happen, how many times, and what four lines they say. The
 * machinery below never mentions golf.
 *
 * Anything that happens in a round is reported here as a QuestEvent, and every
 * accepted quest is asked whether that event counts. That is the whole engine.
 * A new quest needs no new plumbing unless it needs a new kind of event.
 *
 * Nothing here is the truth. Progress and completion both live on the server,
 * in golf/ledger.ts, and this counts along in step with it: every increment is
 * reported, the server coalesces them into a write every few seconds, and what
 * it was holding is read back and seeded in when the player arrives. Leave
 * mid-quest and you come back where you were, give or take the last few
 * seconds.
 *
 * ---------------------------------------------------------------------------
 * Adding a quest
 * ---------------------------------------------------------------------------
 * Add a row to QUESTS below. If the thing it counts already has an event, that
 * is the entire job — the reward price and the claim key are both read off
 * this list by the ledger, so there is no second place to keep in step. Give
 * it a giver (the id of the NpcSpec who hands it out — if that character
 * already gives quests out, there is no wiring at all), a `counts` predicate
 * over QuestEvent, a target, a reward, and the five lines they say.
 *
 * A goal that counts something with no QuestEvent yet needs a new event, and
 * one line in the game layer to raise it. Nothing else.
 */

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type QuestEvent =
  | {
      kind: 'holed'
      /** Which part of the island it was on. */
      where: 'practice' | 'secret' | 'course'
      /** Hole number, 0 for the practice green. */
      hole: number
      strokes: number
    }
  | {
      kind: 'roundComplete'
      strokes: number
      toPar: number
      /**
       * The finished card, one entry per hole.
       *
       * Carried because a whole class of goals is about the *shape* of a round
       * rather than any one shot — three aces in it, eight everywhere, the
       * limit reached on all nine. Counting those from 'holed' events would
       * mean the quest keeping its own tally and knowing when a round started
       * and ended, which is exactly the bookkeeping this engine exists to
       * avoid. One array at the end answers all of them.
       */
      card: number[]
    }
  | {
      kind: 'scrap'
      /** How much Sally just took. */
      handed: number
    }
  | {
      kind: 'shells'
      /** How many Shellman took. Not how many were offered him. */
      handed: number
    }
  | {
      kind: 'coconuts'
      /** How many Coconutty took. Not how many were offered him. */
      handed: number
    }
  | {
      /** The old motor, out of the cave floor. Happens once, ever. */
      kind: 'motor'
    }

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export type QuestStatus =
  /** Never spoken to the giver, or turned it down. */
  | 'offered'
  | 'active'
  /** Target reached, reward not collected. */
  | 'complete'
  | 'claimed'

export type Quest = {
  id: string
  name: string
  /** The NpcSpec id of whoever hands it out. */
  giver: string
  /** One line for the tracker. Present tense, no punctuation. */
  objective: string
  target: number
  counts: (e: QuestEvent) => boolean
  /**
   * How much a counted event is worth, when it is not one.
   *
   * Handing over eight shells at once should move a hundred-shell quest by
   * eight, not by one. Everything else leaves this out and moves by one.
   */
  amount?: (e: QuestEvent) => number
  reward: number

  /**
   * The level before which this is not offered at all.
   *
   * Only one quest uses it so far, and it is the one about the secret hole:
   * the hole itself does not open until FREE.secretLevel, so a giver who
   * mentioned it on day one would be sending people to a door that does not
   * open. Absent means no gate, which is every other quest.
   */
  needsLevel?: number

  /** What the giver says when it has not been taken. */
  offer: string
  /** On accepting. */
  accepted: string
  /** While it is running. */
  progress: (done: number, target: number) => string
  /** When it is done but not handed in. */
  done: string
  /** After the reward is paid. */
  afterwards: string
}

export const QUESTS: Quest[] = [
  {
    id: 'five-aces',
    name: 'Five Aces',
    giver: 'quartermaster',
    objective: 'Hole the practice green in one',
    target: 5,
    // The practice green pays nothing per putt on purpose — it re-tees you, so
    // anything per-hole-out could be farmed standing still. This counts, but
    // the reward is claimed once ever, so the farm is worth exactly one payout.
    counts: (e) => e.kind === 'holed' && e.where === 'practice' && e.strokes === 1,
    reward: 150,

    offer:
      'You want something to do while you wait? Here. The practice green, six and a half metres, dead straight. ' +
      'Hole it in one. Do it five times and I will see you right.',
    accepted: 'Five. Not four. I will be counting even if you are not.',
    progress: (done, target) =>
      done === 0
        ? `Not one yet. Five to find.`
        : `${done} of ${target}. ${target - done} to go, and no, the ones you nearly had do not count.`,
    done: 'Five. I watched every one of them. Take this.',
    afterwards: 'You have had that off me once. Go and find something harder.'
  },

  // -------------------------------------------------------------------------
  // The ones that unlock stock
  //
  // Each of these is the gate on an item in the catalogue, matched by id: the
  // shop's unlock says quest('three-aces') and this row is 'three-aces'. The
  // item becomes buyable when the quest is handed in, so the points below are
  // on top of the club, not instead of it.
  //
  // All four are target 1 and read the finished card, so they cannot be worked
  // at over several rounds by accident — it happened in one round or it did
  // not.
  // -------------------------------------------------------------------------
  {
    id: 'three-aces',
    name: 'Three Aces',
    giver: 'quartermaster',
    objective: 'Hole three in one in a single round',
    target: 1,
    counts: (e) => e.kind === 'roundComplete' && e.card.filter((s) => s === 1).length >= 3,
    reward: 300,
    offer:
      'Three holes in one. Same round, not three afternoons of one apiece. ' +
      'Do that and there is a club on the wall with a flag on it that is yours.',
    accepted: 'Three. In one round. I will know.',
    progress: () => 'Still three in one round. No, the practice green does not count.',
    done: 'Three. In one round. The Flag Club is yours.',
    afterwards: 'You carry the flag now. Nothing more to say about it.'
  },
  {
    id: 'under-par',
    name: 'Under Par',
    giver: 'quartermaster',
    objective: 'Finish the nine under par',
    target: 1,
    counts: (e) => e.kind === 'roundComplete' && e.toPar < 0,
    reward: 250,
    offer:
      'The whole nine, under par. Not level. Under. ' +
      'Nobody here has managed it this month and I would like that to change.',
    accepted: 'Under. Level is not under.',
    progress: () => 'Under par on the nine. Level par is the one that catches people out.',
    done: 'Under par. On this course. I will be telling people about that.',
    afterwards: 'You went under par once. I have not forgotten and neither have you.'
  },
  {
    id: 'all-eights',
    name: 'All Eights',
    giver: 'quartermaster',
    objective: 'Take exactly eight shots on every hole',
    target: 1,
    // Exactly eight, nine times. Deliberately awkward: it is as hard to do on
    // purpose as a good round, and impossible to do by accident.
    counts: (e) =>
      e.kind === 'roundComplete' && e.card.length > 0 && e.card.every((s) => s === 8),
    reward: 200,
    offer:
      'Eight shots. Every hole. Not seven on the easy one, not nine when it gets away from you. ' +
      'Eight, nine times. There is a ball behind the bar for anyone who can.',
    accepted: 'Eight. Every one. I will be counting those too.',
    progress: () => 'Eight on every hole. One seven ruins it, and so does one nine.',
    done: 'Nine eights. That is worse than playing well and much harder. The 8 Ball is yours.',
    afterwards: 'You did the eights. Once is plenty.'
  },
  {
    id: 'all-nine-lost',
    name: 'Every Last One',
    giver: 'quartermaster',
    objective: 'Run out of shots on all nine holes',
    target: 1,
    // The pick-up limit, on every hole. RULES.maxStrokes is the number the game
    // stops you at, so a hole that reached it reads as exactly that.
    counts: (e) =>
      e.kind === 'roundComplete' &&
      e.card.length > 0 &&
      e.card.every((s) => s >= RULES.maxStrokes),
    reward: 100,
    offer:
      'Here is one nobody asks for. Lose your ball on all nine. Every hole, shots gone. ' +
      'Do that and I will find you something round and heavy to play with.',
    accepted: 'All nine. Try not to enjoy it.',
    progress: () => 'All nine, shots gone on every one. Holing one out spoils it.',
    done: 'Not one of them finished. Here. It is a cannon ball. It suits you.',
    afterwards: 'You lost all nine once. Let us leave it there.'
  },

  {
    id: 'shell-hoard',
    name: 'The Hundred',
    giver: 'shellman',
    objective: `Hand Shellman ${SHELLS.forTheClub} shells`,
    target: SHELLS.forTheClub,
    // Counted from what he actually took, so shells turned away at the daily
    // limit do not quietly count towards the hundred as well. He takes ten a
    // day, so this is ten days whatever else happens — which is the point of
    // it being the club nobody has.
    counts: (e) => e.kind === 'shells' && e.handed > 0,
    amount: (e) => (e.kind === 'shells' ? e.handed : 0),
    reward: 500,

    offer:
      'You have hands. Good. I need one hundred shells and I have counted these ones already, so do not ' +
      'offer me those. One hundred. Not ninety-nine. I have been ninety-nine before and I do not care for it.',
    accepted: 'One hundred. I will keep the tally. I always keep the tally.',
    progress: (done, target) =>
      done === 0
        ? 'Nought. A clean nought. There is something almost restful about a clean nought.'
        : `${done}. ${target - done} short. I say them out loud at night, so I would know if you were lying.`,
    done: 'One hundred. One hundred exactly. Take the club, it has been leaning there since before you came.',
    afterwards: 'You did the hundred. We do not speak of the hundred. Bring me more shells.'
  },

  // -------------------------------------------------------------------------
  // Cave Explorer Sally
  //
  // One long thread rather than five errands. Each stage wants more scrap than
  // the last and answers one more piece of why anybody is on this island, and
  // the last one is not a question at all — it is her building something out of
  // the pile. That is where the Mechanical Club comes from now.
  //
  // They are listed in order and gated by QUEST_LIMIT.perGiver, so she offers
  // the next one only once the one before is handed in.
  // -------------------------------------------------------------------------
  {
    id: 'scrap-wreck',
    name: 'What Sank Us',
    giver: 'sally',
    objective: 'Bring Sally 8 scrap',
    target: 8,
    counts: (e) => e.kind === 'scrap' && e.handed > 0,
    amount: (e) => (e.kind === 'scrap' ? e.handed : 0),
    reward: 120,
    offer:
      'You have hands and I have a spare detector. There is metal under this floor and I want all of it. ' +
      'Eight pieces to start. I have a theory about how we ended up here and it needs evidence, not opinions.',
    accepted: 'Eight. Sweep slowly. The thing clicks faster the closer you are, and people always walk too fast.',
    progress: (done, target) => `${done} of ${target}. Keep sweeping — it is under you somewhere.`,
    done:
      'Hull plate. Rivets sheared clean, not torn — that is not rocks, that is something that hit us. ' +
      'We did not run aground. Somebody put us here.',
    afterwards: 'The plate is on the shelf. I look at it more than is healthy.'
  },
  {
    id: 'scrap-golf',
    name: 'Where The Course Came From',
    giver: 'sally',
    objective: 'Bring Sally 12 scrap',
    target: 12,
    counts: (e) => e.kind === 'scrap' && e.handed > 0,
    amount: (e) => (e.kind === 'scrap' ? e.handed : 0),
    reward: 180,
    offer:
      'Next question, and it is the one that keeps me up. Nine holes, trimmed, flagged, maintained. ' +
      'Nobody builds that by accident after a shipwreck. Twelve more pieces.',
    accepted: 'Twelve. And look for anything stamped — stamps have dates on them.',
    progress: (done, target) => `${done} of ${target}. Stamped pieces especially.`,
    done:
      'A flag bracket. Same alloy as the hull. They built the course out of the ship, which means they were ' +
      'not waiting to be rescued. They were settling in.',
    afterwards: 'The course is made of the ship. I have not decided how I feel about playing it.'
  },
  {
    id: 'scrap-others',
    name: 'The Ones Before',
    giver: 'sally',
    objective: 'Bring Sally 16 scrap',
    target: 16,
    counts: (e) => e.kind === 'scrap' && e.handed > 0,
    amount: (e) => (e.kind === 'scrap' ? e.handed : 0),
    reward: 240,
    offer:
      'There are bones on this island and none of them are recent. Sixteen pieces. ' +
      'I want to know whether we are the first crew this happened to, and I am fairly sure of the answer.',
    accepted: 'Sixteen. If you find anything with a name on it, do not read it out. Just bring it.',
    progress: (done, target) => `${done} of ${target}. Bring it, do not read it.`,
    done:
      'Three name tags. Three different ships. Forty years apart. ' +
      'We are not the first and on current form we will not be the last.',
    afterwards: 'Three ships. I keep the tags separate from everything else.'
  },
  {
    id: 'scrap-signal',
    name: 'Something To Shout With',
    giver: 'sally',
    objective: 'Bring Sally 20 scrap',
    target: 20,
    counts: (e) => e.kind === 'scrap' && e.handed > 0,
    amount: (e) => (e.kind === 'scrap' ? e.handed : 0),
    reward: 320,
    offer:
      'Enough history. Twenty pieces and I can put a transmitter together out of what is down there — ' +
      'the lighthouse has power and nobody has ever asked it for anything but light.',
    accepted: 'Twenty. Copper if you can tell the difference, and you probably cannot, so bring everything.',
    progress: (done, target) => `${done} of ${target}. Everything. I will sort it.`,
    done:
      'It transmits. Nothing has answered, but it transmits, and that is the first honest bit of hope ' +
      'this island has produced.',
    afterwards: 'It is still transmitting. Somebody will hear it. Somebody has to.'
  },
  {
    id: 'scrap-mechanism',
    name: 'The Mechanism',
    giver: 'sally',
    objective: 'Bring Sally 25 scrap',
    target: 25,
    counts: (e) => e.kind === 'scrap' && e.handed > 0,
    amount: (e) => (e.kind === 'scrap' ? e.handed : 0),
    reward: 500,
    offer:
      'Last one, and it is for you rather than for me. Twenty-five pieces and I will build you a club out of it. ' +
      'Gears, a proper weighted head, the lot. Consider it wages.',
    accepted: 'Twenty-five. I have wanted to build this since the day I got here.',
    progress: (done, target) => `${done} of ${target}. It will click when you line it up. That is intentional.`,
    done:
      'There. Every part of that came out of the ground you have been walking over. ' +
      'It is the best thing I have made and I made it out of a shipwreck. Take it.',
    afterwards: 'You are carrying my finest work. Try not to lose it in the water on the fifth.'
  },

  // -------------------------------------------------------------------------
  // Coconutty
  //
  // Two threads from one man. The hundred coconuts is the long errand and pays
  // in a ball; the blender is a three-stage build that pays in something you
  // can buy afterwards, which is the only reward in the scene that runs out.
  //
  // Listed in order and gated by QUEST_LIMIT.perGiver, so he offers two at a
  // time — the hundred and whichever blender stage is next — and the rest
  // arrive as the ones before them are handed in.
  //
  // The blender's parts deliberately come from three different places: scrap
  // out of Sally's cave, coconuts off his own trees, and one motor that has to
  // be dug up. Three errands to the same NPC would be one errand three times.
  // -------------------------------------------------------------------------
  {
    id: 'coconut-hundred',
    name: 'Windfall',
    giver: 'coconutty',
    objective: `Hand Coconutty ${COCONUTS.forTheBall} fallen coconuts`,
    target: COCONUTS.forTheBall,
    // Counted from what he actually took, so coconuts turned away once he has
    // had his fill for the day do not quietly count towards the hundred as
    // well. He takes twelve a day, so this is nine days at the very fastest.
    counts: (e) => e.kind === 'coconuts' && e.handed > 0,
    amount: (e) => (e.kind === 'coconuts' ? e.handed : 0),
    reward: 400,
    offer:
      `A hundred. Off the ground, mind — I will not have anyone up my trees, they are old and I am fond of them. ` +
      'Do that and I will make you a ball out of one. It goes further than it has any right to and it smells incredible.',
    accepted: 'A hundred. Under the palms, on the ground, in your hands, into mine. That is the whole method.',
    progress: (done, target) =>
      done === 0
        ? 'None yet. They are under the trees. That is where they go when they stop being in the trees.'
        : `${done}. ${target - done} to go. Six trees. They are not shy.`,
    done:
      'A hundred exactly, and I have not had to climb once. Here — one ball, husk on. ' +
      'It will not roll straight and I would not want it to.',
    afterwards: 'You did the hundred. Keep bringing them anyway, I will still pay.'
  },
  {
    id: 'blender-blades',
    name: 'Something To Chop With',
    giver: 'coconutty',
    objective: 'Get Sally to part with 10 scrap',
    // Counts scrap Sally accepted, because that is where the metal is. It is
    // an errand to another NPC rather than another errand to this one, which
    // is the only reason the blender arc is not just the coconut arc again.
    target: 10,
    counts: (e) => e.kind === 'scrap' && e.handed > 0,
    amount: (e) => (e.kind === 'scrap' ? e.handed : 0),
    reward: 150,
    offer:
      'Right. Blades. There is a woman in the cave up the beach sat on more cut-up metal than anyone needs, ' +
      'and she owes me for a hat. Ten pieces through her hands and she will know which ten I mean.',
    accepted: 'Ten. Tell her it is for the drink and she will stop asking questions.',
    progress: (done, target) => `${done} of ${target}. She is in the cave. She is always in the cave.`,
    done: 'Blades. Sharp ones. Do not put your hand in it, and I should not have to say that.',
    afterwards: 'The blades are in. That was the easy part, which is a thing people say before the hard part.'
  },
  {
    id: 'blender-vessel',
    name: 'Something To Chop In',
    giver: 'coconutty',
    objective: 'Bring Coconutty 12 more coconuts for the jug',
    target: 12,
    counts: (e) => e.kind === 'coconuts' && e.handed > 0,
    amount: (e) => (e.kind === 'coconuts' ? e.handed : 0),
    reward: 150,
    offer:
      'Now something to chop in. Twelve more, and I will hollow out the biggest and keep the rest for the mix. ' +
      'A glass jug on an island is a jug you sweep up. A coconut, you drop it and it bounces.',
    accepted: 'Twelve. I will be picking through them, so do not bring me the split ones.',
    progress: (done, target) => `${done} of ${target}. One of these is going to be a jug and it does not know yet.`,
    done: 'That is the jug. Look at it. That is a better jug than anything I owned before the boat sank.',
    afterwards: 'Blades and a jug. Which leaves the part that actually spins.'
  },
  {
    id: 'blender-motor',
    name: 'The Old Motor',
    giver: 'coconutty',
    objective: 'Dig the old motor out of the cave floor',
    target: 1,
    // The only quest in the scene that counts a single specific object. The
    // motor is one buried find in the cave that appears while this is running
    // and never comes back, so there is nothing to tally — it either came out
    // of the ground or it did not.
    counts: (e) => e.kind === 'motor',
    reward: 600,
    offer:
      'Last piece, and it is the one nobody has. There is a motor in that cave — off the ship, off something, ' +
      'I do not care — and it is under the floor with everything else. Take the detector. Bring me the heavy thing.',
    accepted: 'A motor. You will know it when you dig it. It will not sound like the rest of the rubbish.',
    progress: () =>
      'Still down there. Sweep the far end of the cave, away from where she has been picking it over.',
    done:
      'That is it. That is the one. Give me an hour.\n\n' +
      'There. Blades, a jug, and something to turn them. Come back when you are thirsty — ' +
      'first one is on the house and every one after that is not.',
    afterwards: 'Bar is open. Ask me for a drink and mind how you go afterwards, it gets away from people.'
  },

  // -------------------------------------------------------------------------
  // Salt
  //
  // One quest, and the only one that is about a place rather than an errand.
  // It is also the answer to the two Neon items, which have been sitting in the
  // catalogue marked PENDING since the art arrived.
  //
  // Gated twice on purpose: Salt will not mention it below SECRET_QUEST.
  // needsLevel, and the hole itself does not open until FREE.secretLevel two
  // levels above that. So it arrives as something to climb towards rather than
  // as a locked door with no sign on it.
  // -------------------------------------------------------------------------
  {
    id: 'secret-eight',
    name: 'The Tenth',
    giver: 'shopkeeper',
    objective: `Hole the secret hole in ${SECRET_QUEST.strokes} or fewer`,
    target: 1,
    needsLevel: SECRET_QUEST.needsLevel,
    // Any round on it counts — it is a free hole with no card, so there is
    // nothing to bank and nothing to farm. The number is the whole test.
    counts: (e) => e.kind === 'holed' && e.where === 'secret' && e.strokes <= SECRET_QUEST.strokes,
    reward: SECRET_QUEST.reward,

    offer:
      'Right. There is a tenth hole. Past the ninth, round the back, and no, it is not on the card. ' +
      `Hole it in ${SECRET_QUEST.strokes} and I will hand over the two things in this shop I have never been able to put a price on. ` +
      `You will not get out there until you are level ${FREE.secretLevel}, mind. Consider that the point.`,
    accepted: `${SECRET_QUEST.strokes} or fewer. I will know, and do not ask me how.`,
    progress: () =>
      'Still standing. Go and look past the ninth — you will know it when the ground stops being a golf course.',
    done:
      'You found it and you beat it. Nobody does both.\n\n' +
      'Here. The Neon Club and the Neon Ball, and I want it on record that I did not sell them to you.',
    afterwards: 'You hole the tenth. There is nothing left in here you have not earned.'
  }
]
// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

type Live = { status: QuestStatus; done: number }

const live = new Map<string, Live>()

function stateOf(id: string): Live {
  let s = live.get(id)
  if (!s) {
    s = { status: 'offered', done: 0 }
    live.set(id, s)
  }
  return s
}

export function questById(id: string): Quest | undefined {
  return QUESTS.find((q) => q.id === id)
}

export function questStatus(id: string): QuestStatus {
  return stateOf(id).status
}

export function questProgress(id: string): number {
  return stateOf(id).done
}

/** Every quest a given character hands out. */
export function questsFrom(giver: string): Quest[] {
  return QUESTS.filter((q) => q.giver === giver)
}

/** The ones running right now, for the tracker. */
export function trackedQuests(): { quest: Quest; done: number; status: QuestStatus }[] {
  return QUESTS.filter((q) => {
    const st = stateOf(q.id).status
    return st === 'active' || st === 'complete'
  }).map((q) => ({ quest: q, done: stateOf(q.id).done, status: stateOf(q.id).status }))
}

export function acceptQuest(id: string): void {
  const s = stateOf(id)
  if (s.status !== 'offered') return
  s.status = 'active'
  // Taking it is worth telling the server about immediately: it is the one
  // thing a player would be annoyed to have to do twice.
  reportQuestProgress(id, s.done)
}

/**
 * Takes the progress the server was holding when this player arrived.
 *
 * Anything with a count against it has plainly been accepted, and anything at
 * or past its target is finished and waiting to be handed in — so the status
 * is worked out from the number rather than stored separately. Anything
 * already collected is marked claimed so a finished quest is not offered back
 * as though it were new.
 */
export function seedQuests(): void {
  const stored = storedQuestProgress()
  for (const q of QUESTS) {
    const s = stateOf(q.id)
    if (alreadyClaimed(`quest:${q.id}`)) {
      s.status = 'claimed'
      s.done = q.target
      continue
    }
    const done = stored[q.id]
    if (typeof done !== 'number' || done < 0) continue
    s.done = Math.min(done, q.target)
    s.status = s.done >= q.target ? 'complete' : 'active'
  }
}

/**
 * Tells every running quest what just happened.
 *
 * Called from the game layer, which knows nothing about quests beyond this one
 * function — the coupling is a single import, and a quest that counts
 * something new needs a new QuestEvent rather than a new hook.
 */
export function report(e: QuestEvent): void {
  for (const q of QUESTS) {
    const s = stateOf(q.id)
    if (s.status !== 'active') continue
    if (!q.counts(e)) continue
    s.done += q.amount ? Math.max(0, Math.floor(q.amount(e))) : 1
    if (s.done > q.target) s.done = q.target
    if (s.done >= q.target) s.status = 'complete'
    // The server coalesces these into a write every few seconds, so a message
    // per event is cheap and losing one costs nothing — the next carries the
    // running total rather than an increment.
    reportQuestProgress(q.id, s.done)
  }
}

/**
 * Hands a finished quest in.
 *
 * The amount is named here only so the dialogue can talk about it. What is
 * actually paid is decided by the endpoint against the 'quest:<id>' key, so a
 * reward cannot be inflated from this side and cannot be collected twice.
 */
export function claimQuest(id: string): void {
  const q = questById(id)
  const s = stateOf(id)
  if (!q || s.status !== 'complete') return

  s.status = 'claimed'
  claimOnce(`quest:${id}`)
}

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

/**
 * The quest's own dialog node, ready to drop into a character's Dialog.
 *
 * One node covers all four states rather than four nodes with jumps between
 * them, because the text and the choices are both functions — so what the
 * character says and what you can say back are read fresh every frame. That is
 * what makes this a template: a new quest is a row in QUESTS and one line
 * wiring this into whoever gives it out.
 *
 * `back` is the node to return to, normally 'start'.
 *
 * Handing in is fire and forget. The server decides whether it pays, and says
 * so with its own callout — so there is no reward number to thread back
 * through here and no chance of the dialogue claiming a payment that did not
 * happen.
 */
export function questNode(quest: Quest, back: string) {
  return {
    text: () => {
      const s = stateOf(quest.id)
      if (s.status === 'offered') return quest.offer
      if (s.status === 'active') return quest.progress(s.done, quest.target)
      if (s.status === 'complete') return quest.done
      return quest.afterwards
    },
    choices: (): DialogChoice[] => {
      const s = stateOf(quest.id)

      if (s.status === 'offered') {
        return [
          { label: 'I will take it', goto: quest.id, act: () => acceptQuest(quest.id) },
          { label: 'Not just now', goto: back }
        ]
      }

      if (s.status === 'complete') {
        return [
          {
            label: `Collect ${quest.reward} ${POINTS.short}`,
            goto: quest.id,
            act: () => claimQuest(quest.id)
          },
          { label: 'In a minute', goto: back }
        ]
      }

      return [{ label: 'Right you are', goto: back }]
    }
  }
}

/** Adds every quest a character gives out to their dialog, under its own id. */
export function addQuests(dialog: Dialog, giver: string, back: string): Dialog {
  // Every quest they give, not just the ones currently offered: a node has to
  // exist for anything reachable, and questsAvailable is about what is *shown*.
  for (const q of questsFrom(giver)) dialog[q.id] = questNode(q, QUEST_HUB)

  // The tab. Both halves are functions, so the list is read fresh each time it
  // is opened rather than baked when the character is built.
  dialog[QUEST_HUB] = {
    text: () => {
      const open = questsAvailable(giver)
      const ready = open.filter((q) => stateOf(q.id).status === 'complete').length
      if (ready > 0) return `${ready === 1 ? 'One of those is' : `${ready} of those are`} done, if you want paying.`
      const running = open.filter((q) => stateOf(q.id).status === 'active').length
      if (running === open.length && running > 0) return 'You are in the middle of all of those.'
      return 'Here is what I have.'
    },
    choices: () => hubChoices(giver, back)
  }

  return dialog
}

/**
 * The quests a character will talk about right now.
 *
 * Two rules, and both are about the conversation staying short.
 *
 * A claimed quest is gone. Not greyed out, not listed as done — absent. It has
 * been finished and paid, and leaving it on the list turns a character into a
 * receipt. `afterwards` still exists for anyone who reaches that node another
 * way, but nothing offers it any more.
 *
 * And a character holds only QUEST_LIMIT.perGiver at a time. Anything already
 * accepted keeps its slot until it is handed in, so the cap is on what you are
 * carrying rather than on what exists — finish one and the next on their list
 * appears. Work in progress is listed before anything new, so a full slate is
 * never all offers with the thing you are halfway through pushed off the end.
 */
export function questsAvailable(giver: string): Quest[] {
  const level = playerStanding().level
  const mine = questsFrom(giver).filter((q) => {
    if (stateOf(q.id).status === 'claimed') return false
    // A level gate hides the offer but never takes back something already
    // taken: somebody who accepted it and then had the curve retuned under
    // them should not find it has vanished mid-run.
    if (q.needsLevel && level < q.needsLevel && stateOf(q.id).status === 'offered') return false
    return true
  })

  const order = { complete: 0, active: 1, offered: 2, claimed: 3 } as const
  const sorted = mine.slice().sort((a, b) => order[stateOf(a.id).status] - order[stateOf(b.id).status])

  return sorted.slice(0, QUEST_LIMIT.perGiver)
}

/**
 * Who hands a quest out, by the name they are called in the world.
 *
 * The giver on a Quest is an id, and an id is not a thing to say to somebody.
 * Kept here rather than in the two places that need it — the board and the
 * panel — because both were writing their own version and the board's had
 * fallen behind: it still answered "the Quartermaster" for anything that was
 * not Shellman, which was true when there were two characters and has been
 * wrong since Sally arrived.
 */
export function giverName(giver: string): string {
  if (giver === QUARTERMASTER.id) return QUARTERMASTER.name
  if (giver === SHELLMAN.id) return SHELLMAN.name
  if (giver === SALLY.id) return SALLY.name
  if (giver === COCONUTTY.id) return COCONUTTY.name
  if (giver === SHOPKEEPER.id) return SHOPKEEPER.name
  return 'somebody on the island'
}

/**
 * The same person, in as few characters as still names them.
 *
 * For the sign out on the decking, which is 1.9m of parchment and takes 36
 * characters on its detail line. "Completed — Speak to Cave Explorer Sally" is
 * forty of them, so the full name comes back cut mid-word — and a sign that
 * tells you to speak to "Cave Explorer" is a sign that has failed at its one
 * job. The panel has room for the whole name and uses giverName.
 */
export function giverShortName(giver: string): string {
  if (giver === QUARTERMASTER.id) return 'Quartermaster'
  if (giver === SALLY.id) return 'Sally'
  return giverName(giver)
}

/**
 * Every quest split the three ways the panel shows them.
 *
 * Running, on offer, and finished with. The middle one is not simply "every
 * quest nobody has taken": a giver only ever offers QUEST_LIMIT.perGiver at a
 * time, so listing the rest would be a to-do list of things nobody will talk
 * to you about yet. It asks questsAvailable, which is the same function the
 * dialogue asks, so the panel and the character cannot disagree about what is
 * on the table.
 */
export function questsByStatus(): {
  active: { quest: Quest; done: number; status: QuestStatus }[]
  available: Quest[]
  done: Quest[]
} {
  const active: { quest: Quest; done: number; status: QuestStatus }[] = []
  const done: Quest[] = []

  for (const q of QUESTS) {
    const s = stateOf(q.id)
    if (s.status === 'active' || s.status === 'complete') {
      active.push({ quest: q, done: s.done, status: s.status })
    } else if (s.status === 'claimed') {
      done.push(q)
    }
  }

  // Ready to hand in first — that is the one with something to do about it.
  active.sort((a, b) => (a.status === b.status ? 0 : a.status === 'complete' ? -1 : 1))

  const available: Quest[] = []
  const givers: string[] = []
  for (const q of QUESTS) if (givers.indexOf(q.giver) < 0) givers.push(q.giver)
  for (const giver of givers) {
    for (const q of questsAvailable(giver)) {
      if (stateOf(q.id).status === 'offered') available.push(q)
    }
  }

  return { active, available, done }
}

/**
 * The one entry a character's opening node needs, or nothing.
 *
 * A tab rather than a list. The quests used to sit directly on the greeting,
 * which meant an offered one showed up as "Anything needs doing?" — a question
 * that reads as flavour rather than as a menu, appeared once per quest, and
 * pushed the character's actual conversation down the list. One entry that
 * says how many are waiting keeps the greeting about the person.
 *
 * Empty when they have nothing, so nobody is offered a tab into a blank room.
 */
export function questChoices(giver: string): DialogChoice[] {
  const open = questsAvailable(giver)
  if (open.length === 0) return []

  // The count is on the tab because the reason to open it is usually to check
  // on something, and knowing there is something to check is half of that.
  const done = open.filter((q) => stateOf(q.id).status === 'complete').length
  // "Completed" rather than "ready", and the same word the panel uses. A quest
  // that has hit its target is completed — what is left is collecting for it,
  // which is what talking to this character is for.
  const label = done > 0 ? `Quests (${done} Completed)` : `Quests (${open.length})`

  return [{ label, goto: QUEST_HUB }]
}

/** The node id the tab opens. One per character, so two givers cannot collide. */
const QUEST_HUB = 'quests'

/**
 * The rows inside the tab, one per quest.
 *
 * Offered quests show their name here rather than a coy question. By this
 * point the player has chosen to look at the list, so naming the thing is more
 * use than teasing it — the giver's own line still does the teasing when the
 * quest is opened.
 */
function hubChoices(giver: string, back: string): DialogChoice[] {
  const rows = questsAvailable(giver).map((q) => {
    const s = stateOf(q.id)
    const label =
      s.status === 'offered'
        ? `${q.name} — new`
        : s.status === 'complete'
          ? `${q.name} — ready to hand in`
          : `${q.name} — ${s.done}/${q.target}`
    return { label, goto: q.id }
  })
  rows.push({ label: 'Never mind', goto: back })
  return rows
}

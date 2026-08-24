import { Dialog, DialogChoice } from './npc'
import { alreadyClaimed, claimOnce, reportQuestProgress, storedQuestProgress } from './points'
import { POINTS } from './config'

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
  | { kind: 'roundComplete'; strokes: number; toPar: number }

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
  reward: number

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
    s.done++
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
  for (const q of questsFrom(giver)) dialog[q.id] = questNode(q, back)
  return dialog
}

/** The choices to offer on a character's opening node, one per quest. */
export function questChoices(giver: string): DialogChoice[] {
  return questsFrom(giver).map((q) => {
    const s = stateOf(q.id)
    const label =
      s.status === 'offered'
        ? 'Anything needs doing?'
        : s.status === 'complete'
          ? `${q.name} — done`
          : s.status === 'claimed'
            ? q.name
            : `${q.name} — ${s.done}/${q.target}`
    return { label, goto: q.id }
  })
}

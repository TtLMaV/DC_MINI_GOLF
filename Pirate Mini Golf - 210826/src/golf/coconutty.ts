import { COCONUTS, DRINK } from './config'
import { coconutsCarried } from './coconuts'
import { buyDrink, drinkLeft, drinkPending } from './drink'
import { Dialog } from './npc'
import {
  balance,
  blenderIsBuilt,
  coconuttyHasAnswered,
  coconutsToday,
  coconutsTotal,
  handCoconuts,
  handJugCoconuts,
  jugStillWants
} from './points'
import { addQuests, questChoices, questIsRunning, questRemaining, report } from './quests'

/**
 * What Coconutty says.
 *
 * He is two errands and a bar. The hundred coconuts is the long one and pays
 * in a ball; the blender is a three-part build that pays in something you can
 * buy afterwards and which then runs out — the only thing in the scene that
 * does.
 *
 * On the writing: he is the one character here who is fine. Sally is working
 * something out, Shellman is somewhere else, the Quartermaster is running a
 * business, and Coconutty has decided that being shipwrecked is a posting. He
 * is not in denial about it. He has simply got on with the bit he can control,
 * which is drinks, and he would like some help with the equipment.
 *
 * The hand-over is fire and forget, like every other payment in the scene. The
 * server decides how many he accepts — the daily limit is his, not the
 * client's — and answers with a coconutsTaken message, which is what actually
 * moves the quest along.
 */
export function coconuttyDialog(): Dialog {
  const held = () => coconutsCarried()
  const roomLeft = () => Math.max(0, COCONUTS.dailyLimit - coconutsToday())

  const greeting = () => {
    if (drinkLeft() > 0) {
      return (
        `You have got one in you already — ${Math.ceil(drinkLeft() / 60)} minute${
          Math.ceil(drinkLeft() / 60) === 1 ? '' : 's'
        } of it left, near enough. ` + 'Go and enjoy it. Standing still is a waste of a colada.'
      )
    }
    const n = held()
    if (n === 0) {
      return (
        "Where's my sweet sweet coconuts man, you dont seem to have any on you? There are loads of palm trees on this island and every one of them is dropping them faster " +
        'than I can pick them up, which is the only labour shortage I have ever been glad about.'
      )
    }
    if (roomLeft() === 0) {
      return (
        `${n} on you and nowhere to put them. I have had my ${COCONUTS.dailyLimit} today. ` +
        'Any more and they go off before I get to them, and a coconut that has gone off is a smell you remember.'
      )
    }
    return (
      `${n} coconut${n === 1 ? '' : 's'}. I can take ${roomLeft()} more today. ` +
      'Off the ground, I hope. I meant that about the trees.'
    )
  }

  /**
   * How many of what you are carrying he would take for the jug.
   *
   * Nothing unless the quest is actually running: this is a second hand-over
   * button beside the first, and one that appears before you have been asked
   * for a jug is a button with no story attached to it.
   *
   * Counted off the quest rather than off the server's last answer, because
   * the quest's own progress is right from the moment the ledger seeds it and
   * the server's answer does not exist until the first hand-over. They agree
   * afterwards; this is simply the one that is right first.
   */
  const forJug = () =>
    questIsRunning('blender-vessel')
      ? Math.min(held(), questRemaining('blender-vessel'))
      : 0

  const dialog: Dialog = {
    start: {
      // A function, not a string: he is built once at startup, so fixed text
      // would have him reporting whatever was in your hands when the scene
      // loaded for the rest of the session.
      text: greeting,
      choices: () => {
        const options = []

        // Only offered when it would do something. A button that hands over
        // nothing is a button that teaches people not to press buttons.
        if (held() > 0 && roomLeft() > 0) {
          const taking = Math.min(held(), roomLeft())
          options.push({
            label: `Hand over ${taking}`,
            goto: 'handed',
            act: () => handCoconuts()
          })
        }

        // The jug's own line, above the daily one when both are going, because
        // it is the one with a deadline on it — his appetite comes back
        // tomorrow and the quest is sat there either way.
        if (forJug() > 0) {
          options.push({
            label: `${forJug()} for the jug`,
            goto: 'jug',
            act: () => handJugCoconuts()
          })
        }

        // The bar only exists once the blender does, which is the whole point
        // of the three-part build — the reward is a shop that was not there
        // before rather than an object in a bag.
        if (blenderIsBuilt()) {
          options.push({
            label: `Pina colada (${DRINK.price} PP)`,
            goto: 'poured',
            act: () => buyDrink()
          })
        }

        options.push(...questChoices('coconutty'))
        options.push({ label: 'Why coconuts?', goto: 'why' })
        options.push({ label: 'How many have I brought you?', goto: 'tally' })
        options.push({ label: 'Cya later!', goto: '' })
        return options
      }
    },

    jug: {
      /**
       * Read fresh, like the hand-over above and for the same reason: the
       * server answers a moment after this node is drawn.
       */
      /**
       * The server's number, not the quest's, and here it is the right one:
       * this node is read after a hand-over, so it is reporting what he
       * actually took. Negative means he has not answered yet, which is a
       * couple of frames and is worth saying vaguely rather than wrongly.
       */
      text: () => {
        const left = jugStillWants()
        if (left < 0) return 'He starts sorting through them, and does not look up.'
        return left > 0
          ? 'He turns each one over, taps it, and sets it down in a separate pile. ' +
            `"${left} more and I have got a jug."`
          : 'He picks through them, holds one up, and stops talking for a moment. ' +
            '"That is the one. That is a jug."'
      },
      choices: [
        { label: 'Why a coconut?', goto: 'building' },
        { label: 'Right', goto: '' }
      ]
    },

    handed: {
      /**
       * Read fresh, so it can tell the truth about what actually happened.
       *
       * The hand-over is a message to the server and the answer comes back a
       * moment later, so this node is drawn before the outcome is known. The
       * silent-ledger case is worth saying out loud rather than cheerfully
       * claiming he counted them — a broken ledger otherwise looks exactly
       * like a working one.
       */
      text: () =>
        coconuttyHasAnswered()
          ? 'He takes them two at a time, knocks each one against the next, and listens. ' +
            '"That one is full," he says. Not specifing which.'
          : 'He puts his hands out and leaves them out. Nothing changes hands. ' +
            '(The server has not answered — check the console for "[golf] LEDGER SILENT".)',
      choices: [
        { label: 'What do you do with them?', goto: 'why' },
        { label: 'Right', goto: '' }
      ]
    },

    poured: {
      /**
       * Also read fresh, and for a sharper reason than the hand-over.
       *
       * The drink is the one purchase that can be refused for three different
       * reasons — no blender, not enough points, pressed twice — and the
       * refusal arrives after this node is drawn. So it reports what actually
       * happened rather than what was asked for.
       */
      text: () => {
        if (drinkLeft() > 0) {
          return (
            'He makes the drink it in the coconut, and hands it over without a straw. ' +
            '"No straws," he says. "Straws are the one thing the sea never gives back."'
          )
        }
        // Still waiting on the server. Said out loud rather than left blank,
        // because the alternative is a frame of "that did not work" every time
        // one does.
        if (drinkPending()) return 'He turns on the blender. The motor takes a moment to run.'
        if (balance() < DRINK.price) {
          return `He looks at you, then at the blender, then at you. "${DRINK.price}," he says. "I did say."`
        }
        return 'He reaches for the jug and stops. (Nothing came back from the server — check the console.)'
      },
      choices: [
        { label: 'What is in it?', goto: 'recipe' },
        { label: 'Thanks', goto: '' }
      ]
    },

    recipe: {
      text:
        'Coconut, obviously. Pineapple, which I am not going to tell you where I get. ' +
        'Ice, which is the part that should worry you, and rum, which is the part that does not worry me at all. ' +
        'You will find you get about the place quicker afterwards. Have fun.',
      choices: [
        { label: 'That is not how any of that works', goto: 'works' },
        { label: 'Fair enough', goto: '' }
      ]
    },

    works: {
      text:
        'No. It is not. And yet.\n\n' +
        'Look, I have been on this island eleven months, there is a woman in a cave who talks to metal, ' +
        'and a man on the south beach who has named some of the shells. The drink is the least of it.',
      choices: [{ label: 'Good point', goto: '' }]
    },

    why: {
      text:
        'Because they are free, they are everywhere, and they are the only thing here that is both food and a cup. ' +
        'Show me a shell that does that. Shellman cannot, and I have asked him, at length, more than once.',
      choices: [
        { label: 'What are you building?', goto: 'building' },
        { label: 'Fair enough', goto: '' }
      ]
    },

    building: {
      text: () =>
        blenderIsBuilt()
          ? 'Built it. Blades off a shipwreck, a jug out of a coconut, and a motor from the cave. ' +
            'It sounds like a war and it makes a beautiful drink.'
          : 'A blender. Three parts and I have got none of them: something to chop with, something to chop in! ' +
            'Can you help me get them please.',
      choices: [
        { label: 'Why coconuts?', goto: 'why' },
        { label: 'Right', goto: '' }
      ]
    },

    tally: {
      text: () => {
        const total = coconutsTotal()
        if (total === 0) return 'None. You have brought me none. I am not counting that against you yet.'
        const left = Math.max(0, COCONUTS.forTheBall - total)
        return left > 0
          ? `${total}. ${left} short of the hundred, and the hundred is where the ball is.`
          : `${total}. Past the hundred. You are now bringing me coconuts for the love of it, which I respect.`
      },
      choices: [
        { label: 'Why a hundred?', goto: 'why' },
        { label: 'Thanks', goto: '' }
      ]
    }
  }

  return addQuests(dialog, 'coconutty', 'start')
}

/**
 * Tells the quest engine what Coconutty actually accepted.
 *
 * Wired to the server's answer rather than to the button, because the two can
 * differ — he turns coconuts away once he has had his fill for the day, and
 * those must not count towards the hundred.
 */
export function coconutsAccepted(taken: number): void {
  if (taken <= 0) return
  report({ kind: 'coconuts', handed: taken })
}

/**
 * The same, for the ones that went into the jug.
 *
 * A separate event so it reaches the jug quest and only the jug quest. The
 * hundred counts 'coconuts' and this is not one of those: it did not go
 * against his daily twelve, and it does not go towards the ball.
 */
export function jugCoconutsAccepted(taken: number): void {
  if (taken <= 0) return
  report({ kind: 'jugCoconuts', handed: taken })
}

/** Tells the quest engine the motor came out of the ground. Once, ever. */
export function motorDug(): void {
  report({ kind: 'motor' })
}

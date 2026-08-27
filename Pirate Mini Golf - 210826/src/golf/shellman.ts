import { SHELLS } from './config'
import { Dialog } from './npc'
import { handShells, shellmanHasAnswered, shellsToday, shellsTotal } from './points'
import { addQuests, questChoices, report } from './quests'
import { shellsCarried } from './shells'

/**
 * What Shellman says.
 *
 * He is the daily errand and the hundred-shell club in one character, which
 * works because both are the same action: you give him shells, he takes what he
 * is allowed to take that day, and every one he takes counts towards both.
 *
 * The hand-over is fire and forget, like every other payment in the scene. The
 * server decides how many he accepts — the daily limit is his, not the
 * client's — and answers with a shellsTaken message, which is what actually
 * moves the quest along. Nothing here decides anything; it only asks, and then
 * says something about the answer.
 *
 * On the writing: he counts things. That is the whole character. He is not
 * unkind, he is simply somewhere else, and the shells are the only subject on
 * which he is completely present.
 */
export function shellmanDialog(): Dialog {
  const held = () => shellsCarried()
  const roomLeft = () => Math.max(0, SHELLS.dailyLimit - shellsToday())

  const greeting = () => {
    const n = held()
    if (n === 0) {
      return (
        'No shells. You are carrying no shells at all. ' +
        'They are on the sand, which is where they have always been, and I have told you now.'
      )
    }
    if (roomLeft() === 0) {
      return (
        `You have ${n}. I have had my ${SHELLS.dailyLimit} today and I have written them down. ` +
        'Come back when it is tomorrow. It usually is, eventually.'
      )
    }
    return (
      `${n} shell${n === 1 ? '' : 's'}. I can take ${roomLeft()} more today. ` +
      'I will not tell you what for. You would only ask again.'
    )
  }

  const dialog: Dialog = {
    start: {
      // A function, not a string: he is built once at startup, so fixed text
      // would have him reporting the shells you were carrying when the scene
      // loaded for the rest of the session.
      text: greeting,
      choices: () => {
        const options = []

        // Only offered when it would do something. A button that says "hand
        // over 0 shells" is a button that teaches people not to press buttons.
        if (held() > 0 && roomLeft() > 0) {
          const taking = Math.min(held(), roomLeft())
          options.push({
            label: `Hand over ${taking}`,
            goto: 'handed',
            act: () => handShells()
          })
        }

        options.push(...questChoices('shellman'))
        options.push({ label: 'Why shells?', goto: 'why' })
        options.push({ label: 'How many have I given you?', goto: 'tally' })
        options.push({ label: 'I will leave you to it', goto: '' })
        return options
      }
    },

    handed: {
      /**
       * Read fresh, so it can tell the truth about what actually happened.
       *
       * The hand-over is a message to the server and the answer comes back a
       * moment later, so this node is drawn before the outcome is known. If
       * the server never answers at all the old version of this line still
       * cheerfully said he had counted them, which is how a broken ledger
       * looked exactly like a working one.
       */
      text: () =>
        shellmanHasAnswered()
          ? 'He takes them without looking, turns each one over once, and puts it somewhere you cannot see. ' +
            '"Counted," he says. "All of them counted."'
          : 'He holds his hands out, and keeps holding them out. Nothing passes between you. ' +
            '(The server has not answered — check the console for "[golf] LEDGER SILENT".)',
      choices: [
        { label: 'What do you do with them?', goto: 'why' },
        { label: 'Right', goto: '' }
      ]
    },

    why: {
      text:
        'A shell is a house somebody finished with. Somebody very small, who did not leave a note. ' +
        'I keep them because it seems rude that nobody else does. That is the entire reason and I have never had a better one.',
      choices: [
        { label: 'Do you ever stop?', goto: 'stop' },
        { label: 'Fair enough', goto: '' }
      ]
    },

    stop: {
      text: () =>
        `I take ${SHELLS.dailyLimit} a day. Not because I want ${SHELLS.dailyLimit}. Because past ${SHELLS.dailyLimit} ` +
        'I stop seeing them, and a shell you have stopped seeing may as well still be on the beach.',
      choices: [{ label: 'That is... reasonable', goto: '' }]
    },

    tally: {
      text: () => {
        const total = shellsTotal()
        if (total === 0) return 'None. Not one. I would remember.'
        const left = Math.max(0, SHELLS.forTheClub - total)
        return left > 0
          ? `${total}. I know it is ${total} because I counted it ${total} times. ${left} short of the hundred.`
          : `${total}. Past the hundred. We agreed not to speak of the hundred.`
      },
      choices: [
        { label: 'Why a hundred?', goto: 'why' },
        { label: 'Thanks', goto: '' }
      ]
    }
  }

  return addQuests(dialog, 'shellman', 'start')
}

/**
 * Tells the quest engine what Shellman actually accepted.
 *
 * Wired to the server's answer rather than to the button, because the two can
 * differ — he turns shells away once he has had his fill for the day, and those
 * must not count towards the hundred. This is the only thing that moves it.
 */
export function shellsAccepted(taken: number): void {
  if (taken <= 0) return
  report({ kind: 'shells', handed: taken })
}

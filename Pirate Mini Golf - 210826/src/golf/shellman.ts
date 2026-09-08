import { SHELLS } from './config'
import { Dialog } from './npc'
import { handShells, shellmanHasAnswered, shellsToday, shellsTotal } from './points'
import { addQuests, questChoices, report } from './quests'
import { shellsCarried } from './shells'
import { t } from './strings'

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
      return t('shellman.greet.none')
    }
    if (roomLeft() === 0) {
      return t('shellman.greet.full', { n, limit: SHELLS.dailyLimit })
    }
    return t(n === 1 ? 'shellman.greet.one' : 'shellman.greet.many', { n, room: roomLeft() })
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
            label: t('shellman.handOver', { n: taking }),
            goto: 'handed',
            act: () => handShells()
          })
        }

        options.push(...questChoices('shellman'))
        options.push({ label: t('shellman.whyShells'), goto: 'why' })
        options.push({ label: t('shellman.howMany'), goto: 'tally' })
        options.push({ label: t('shellman.leaveYou'), goto: '' })
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
        shellmanHasAnswered() ? t('shellman.handed') : t('shellman.handedSilent'),
      choices: [
        { label: t('shellman.whatDoYouDo'), goto: 'why' },
        { label: t('shellman.right'), goto: '' }
      ]
    },

    why: {
      text: () => t('shellman.why'),
      choices: [
        { label: t('shellman.doYouStop'), goto: 'stop' },
        { label: t('shellman.fairEnough'), goto: '' }
      ]
    },

    stop: {
      text: () => t('shellman.stop', { limit: SHELLS.dailyLimit }),
      choices: [{ label: t('shellman.reasonable'), goto: '' }]
    },

    tally: {
      text: () => {
        const total = shellsTotal()
        if (total === 0) return t('shellman.tally.none')
        const left = Math.max(0, SHELLS.forTheClub - total)
        return left > 0
          ? t('shellman.tally.short', { total, left })
          : t('shellman.tally.past', { total })
      },
      choices: [
        { label: t('shellman.whyHundred'), goto: 'why' },
        { label: t('shellman.thanks'), goto: '' }
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

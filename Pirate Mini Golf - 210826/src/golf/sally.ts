import { DETECTOR } from './config'
import { giveDetector, hasDetector, scrapCarried } from './detector'
import { Dialog, onPhone } from './npc'
import { handScrap, scrapTotal } from './points'
import { addQuests, questChoices, report } from './quests'
import { t } from './strings'

/**
 * What Cave Explorer Sally says.
 *
 * She is the only character here who is trying to work something out rather
 * than run something. The Quartermaster manages a golf course and Shellman
 * counts shells; Sally is stood in a cave with three questions and no way to
 * answer them without somebody willing to dig.
 *
 * The three questions are why the ship went down, where a nine-hole course came
 * from, and how anybody gets off this island. Her quest arc answers them in
 * that order, so what she says here is deliberately short on detail — the
 * findings belong to the quests, and repeating them in the small talk would
 * spoil the only story the scene has.
 *
 * The detector is handed over on first meeting rather than earned. A mechanic
 * you cannot try until you have completed something is a mechanic most people
 * never see.
 */
export function sallyDialog(): Dialog {
  const held = () => scrapCarried()

  const greeting = () => {
    if (!hasDetector()) {
      return t('sally.greet.noDetector')
    }
    const n = held()
    if (n === 0) {
      return t('sally.greet.none')
    }
    return t(n === 1 ? 'sally.greet.one' : 'sally.greet.many', { n })
  }

  const dialog: Dialog = {
    start: {
      text: greeting,
      choices: () => {
        const options = []

        if (!hasDetector()) {
          options.push({
            label: t('sally.takeDetector'),
            goto: 'given',
            act: () => giveDetector()
          })
        } else if (held() > 0) {
          options.push({
            label: t('sally.handOver', { n: held() }),
            goto: 'handed',
            act: () => handScrap()
          })
        }

        options.push(...questChoices('sally'))
        options.push({ label: t('sally.whatDoing'), goto: 'why' })
        options.push({ label: t('sally.howWorks'), goto: 'howto' })
        options.push({ label: t('sally.letYouGetOn'), goto: '' })
        return options
      }
    },

    given: {
      // A function now. It was a fixed string, which is baked when the
      // character is built, and a language chosen afterwards would never reach
      // it.
      text: () => t('sally.given') + t(onPhone() ? 'sally.givenPhone' : 'sally.givenKey'),
      choices: [
        { label: t('sally.whatLooking'), goto: 'why' },
        { label: t('sally.right'), goto: '' }
      ]
    },

    handed: {
      text: () => t('sally.handed', { total: scrapTotal() }),
      choices: [
        { label: t('sally.whatWorkedOut'), goto: 'why' },
        { label: t('sally.backToIt'), goto: '' }
      ]
    },

    why: {
      text: () => t('sally.why'),
      choices: [
        { label: t('sally.anyAnswers'), goto: 'answers' },
        { label: t('sally.howWorks'), goto: 'howto' },
        { label: t('sally.grim'), goto: '' }
      ]
    },

    answers: {
      // Reads the arc rather than restating it, so she cannot claim to know
      // something the player has not dug up yet.
      text: () => {
        const total = scrapTotal()
        if (total === 0) return t('sally.answers.none')
        if (total < 20) return t('sally.answers.early')
        if (total < 50) return t('sally.answers.some')
        return t('sally.answers.most')
      },
      choices: [
        { label: t('sally.anythingIcanDo'), goto: 'start' },
        { label: t('sally.fairEnough'), goto: '' }
      ]
    },

    howto: {
      text: () => t('sally.howto', { range: DETECTOR.senseRange, dig: DETECTOR.digRange }),
      choices: [
        { label: t('sally.whatLooking'), goto: 'why' },
        { label: t('sally.gotIt'), goto: '' }
      ]
    }
  }

  return addQuests(dialog, 'sally', 'start')
}

/**
 * Tells the quest engine what Sally actually took.
 *
 * Wired to the server's answer rather than the button, for the same reason as
 * the shells: what she accepted is the only number that should move an arc.
 */
export function scrapAccepted(taken: number): void {
  if (taken <= 0) return
  report({ kind: 'scrap', handed: taken })
}

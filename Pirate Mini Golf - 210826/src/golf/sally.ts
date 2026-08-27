import { DETECTOR } from './config'
import { giveDetector, hasDetector, scrapCarried } from './detector'
import { Dialog } from './npc'
import { handScrap, scrapTotal } from './points'
import { addQuests, questChoices, report } from './quests'

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
      return (
        'You are the first person to come this far up the beach in months. ' +
        'Good. I need someone with a strong back and no strong opinions about digging.'
      )
    }
    const n = held()
    if (n === 0) {
      return (
        'Nothing on you. The floor here is full of it — sweep slowly and let the thing click. ' +
        'People always walk too fast and then tell me the cave is empty.'
      )
    }
    return `${n} piece${n === 1 ? '' : 's'} on you. Hand it over and I will see what it wants to be.`
  }

  const dialog: Dialog = {
    start: {
      text: greeting,
      choices: () => {
        const options = []

        if (!hasDetector()) {
          options.push({
            label: 'Take the detector',
            goto: 'given',
            act: () => giveDetector()
          })
        } else if (held() > 0) {
          options.push({
            label: `Hand over ${held()}`,
            goto: 'handed',
            act: () => handScrap()
          })
        }

        options.push(...questChoices('sally'))
        options.push({ label: 'What are you doing out here?', goto: 'why' })
        options.push({ label: 'How does the detector work?', goto: 'howto' })
        options.push({ label: 'I will let you get on', goto: '' })
        return options
      }
    },

    given: {
      text:
        'Sling it low and walk. It clicks when there is metal within about fifteen metres and it clicks faster ' +
        'the closer you get — when it turns into one noise rather than a lot of noises, you are stood on it. ' +
        'Press E and dig. Three puts it away when the clicking gets on your nerves, which it will.',
      choices: [
        { label: 'What are you looking for?', goto: 'why' },
        { label: 'Right', goto: '' }
      ]
    },

    handed: {
      text: () =>
        `That is the lot. ${scrapTotal()} through my hands now, all told. ` +
        'Some of it is rubbish. Some of it is not, and telling the difference is the only thing I am good at.',
      choices: [
        { label: 'What have you worked out?', goto: 'why' },
        { label: 'Back to it', goto: '' }
      ]
    },

    why: {
      text:
        'Three things, in order. Why a ship that size went down in water this calm. ' +
        'Where a full nine-hole golf course came from on an island with no port. ' +
        'And how anybody gets off it, because in eleven months I have not seen one boat that was not already wrecked.',
      choices: [
        { label: 'Do you have any answers?', goto: 'answers' },
        { label: 'How does the detector work?', goto: 'howto' },
        { label: 'Grim', goto: '' }
      ]
    },

    answers: {
      // Reads the arc rather than restating it, so she cannot claim to know
      // something the player has not dug up yet.
      text: () => {
        const total = scrapTotal()
        if (total === 0) return 'None whatsoever. That is rather the problem, and why you are holding a detector.'
        if (total < 20) return 'Pieces of one. The metal down there did not get bent by rocks, I will say that much.'
        if (total < 50) return 'Enough to know the course and the ship are the same metal, which raises worse questions than it settles.'
        return 'More than I want. Ask me over a proper drink and I will tell you the lot.'
      },
      choices: [
        { label: 'Anything I can do?', goto: 'start' },
        { label: 'Fair enough', goto: '' }
      ]
    },

    howto: {
      text: () =>
        `It reaches about ${DETECTOR.senseRange} metres and you can dig once you are within ${DETECTOR.digRange} of a thing. ` +
        'Slow clicks mean something is out there, fast clicks mean it is under your boots. ' +
        'A dug spot fills back in after a while — the sea keeps putting things back, which is either lucky or sinister.',
      choices: [
        { label: 'What are you looking for?', goto: 'why' },
        { label: 'Got it', goto: '' }
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

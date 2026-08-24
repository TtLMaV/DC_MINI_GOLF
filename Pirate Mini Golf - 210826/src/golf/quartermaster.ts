import { Dialog } from './npc'
import { addQuests, questChoices } from './quests'
import { Game } from './game'
import { roster } from './net'
import { HOLES, TOTAL_PAR } from './course'

/**
 * What the Quartermaster says.
 *
 * Kept as data rather than code so lines can be edited without touching the
 * dialog machinery, and so the upgrade and achievement branches can be bolted
 * on as extra nodes later without restructuring anything.
 *
 * The lines read the live game state rather than being fixed text, so he tells
 * you where you actually are — before you have signed on, mid-round, and once
 * the card has some holes on it.
 */
export function quartermasterDialog(game: Game): Dialog {
  const stats = () => {
    const s = game.state
    if (s.practising) {
      return s.practicePutts > 0
        ? `You've holed ${s.practicePutts} on the practice green.`
        : `You've not signed on yet.`
    }

    const holes = s.card.filter((n) => n >= 0).length
    if (holes === 0) return `You're on hole ${s.holeIndex + 1} and yet to hole one out.`

    const total = s.card.reduce((n, sc) => (sc >= 0 ? n + sc : n), 0)
    const par =
      game.toPar === 0 ? 'level par' : game.toPar > 0 ? `${game.toPar} over` : `${-game.toPar} under`
    return `${holes} hole${holes === 1 ? '' : 's'} down, ${total} shots, ${par}.`
  }

  const field = () => {
    const n = roster().length
    if (n === 0) return 'Nobody signed up at the moment. The course is yours.'
    if (n === 1) return game.state.joined ? 'Just you out there so far.' : 'One player out on the course.'
    return `${n} out on the course right now.`
  }

  const dialog: Dialog = {
    start: {
      // A function, not a template string: the dialog object is built once when
      // he is created, so a plain string would have him reporting whatever was
      // true the moment the scene loaded for the rest of the session.
      text: () => `Welcome to the Shack. ${stats()} ${field()}`,
      choices: () => [
        ...questChoices('quartermaster'),
        { label: 'How do I play?', goto: 'howto' },
        { label: "What's the course like?", goto: 'course' },
        { label: 'Nothing for now', goto: '' }
      ]
    },

    howto: {
      text:
        'Walk to your ball and press E to stand over it. Look where you want it to go — the ring and line on the floor follow your eye. ' +
        'Press E to start the meter, E again to set the power, then E on the white line to strike it. Miss the line and it goes off left or right.',
      choices: [
        { label: 'What if I make a mess of it?', goto: 'cancel' },
        { label: 'Where do I start?', goto: 'where' },
        { label: 'Got it', goto: '' }
      ]
    },

    cancel: {
      text:
        'F backs you out of a swing before it counts, and again to step away from the ball altogether. ' +
        'Nothing is on your card until the ball is struck. If it ends up somewhere daft, R puts it back where it last sat, no penalty.',
      choices: [
        { label: 'Where do I start?', goto: 'where' },
        { label: 'Thanks', goto: '' }
      ]
    },

    where: {
      text:
        'The practice green is right here — hole it and the ball comes straight back, putt at it all day if you like. ' +
        'When you fancy it properly, sign on at the board by the first tee and play the nine.',
      choices: [
        { label: "What's the course like?", goto: 'course' },
        { label: 'Right you are', goto: '' }
      ]
    },

    course: {
      text: `${HOLES.length} holes, par ${TOTAL_PAR}. Ramps, a barrel that will not sit still, a lift on the last that waits for nobody, and a lighthouse that has ruined better players than you.`,
      choices: [
        { label: 'How do I play?', goto: 'howto' },
        { label: 'I will take my chances', goto: '' }
      ]
    }
  }

  // Everything he hands out, added under its own id. A second quest given by
  // him needs nothing here — it is picked up from QUESTS by its giver.
  return addQuests(dialog, 'quartermaster', 'start')
}

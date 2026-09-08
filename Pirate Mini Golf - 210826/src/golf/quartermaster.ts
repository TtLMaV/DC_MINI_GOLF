import { Dialog, onPhone } from './npc'
import { addQuests, questChoices } from './quests'
import { Game } from './game'
import { roster } from './net'
import { HOLES, TOTAL_PAR } from './course'
import { t } from './strings'

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
        ? t('qm.stats.practiceSome', { n: s.practicePutts })
        : t('qm.stats.notSignedOn')
    }

    const holes = s.card.filter((n) => n >= 0).length
    if (holes === 0) return t('qm.stats.noHoles', { n: s.holeIndex + 1 })

    const total = s.card.reduce((n, sc) => (sc >= 0 ? n + sc : n), 0)
    const par =
      game.toPar === 0
        ? t('qm.par.level')
        : game.toPar > 0
          ? t('qm.par.over', { n: game.toPar })
          : t('qm.par.under', { n: -game.toPar })
    return t(holes === 1 ? 'qm.stats.oneHole' : 'qm.stats.holes', { holes, total, par })
  }

  const field = () => {
    const n = roster().length
    if (n === 0) return t('qm.field.none')
    if (n === 1) return game.state.joined ? t('qm.field.justYou') : t('qm.field.onePlayer')
    return t('qm.field.many', { n })
  }

  const dialog: Dialog = {
    start: {
      // A function, not a template string: the dialog object is built once when
      // he is created, so a plain string would have him reporting whatever was
      // true the moment the scene loaded for the rest of the session.
      text: () => t('qm.greet', { stats: stats(), field: field() }),
      choices: () => [
        ...questChoices('quartermaster'),
        { label: t('qm.howDoIPlay'), goto: 'howto' },
        { label: t('qm.whatsCourse'), goto: 'course' },
        { label: t('qm.nothingForNow'), goto: '' }
      ]
    },

    howto: {
      // Same lesson twice, once per set of controls. He is the tutorial, so
      // this is the one place where naming the wrong button costs a player the
      // whole game rather than a moment's confusion.
      text: () => t(onPhone() ? 'qm.howtoPhone' : 'qm.howtoKey'),
      choices: [
        { label: t('qm.messUp'), goto: 'cancel' },
        { label: t('qm.whereStart'), goto: 'where' },
        { label: t('qm.gotIt'), goto: '' }
      ]
    },

    cancel: {
      text: () => t(onPhone() ? 'qm.cancelPhone' : 'qm.cancelKey'),
      choices: [
        { label: t('qm.whereStart'), goto: 'where' },
        { label: t('qm.thanks'), goto: '' }
      ]
    },

    where: {
      text: () => t('qm.where'),
      choices: [
        { label: t('qm.whatsCourse'), goto: 'course' },
        { label: t('qm.rightYouAre'), goto: '' }
      ]
    },

    course: {
      text: () => t('qm.course', { holes: HOLES.length, par: TOTAL_PAR }),
      choices: [
        { label: t('qm.howDoIPlay'), goto: 'howto' },
        { label: t('qm.takeChances'), goto: '' }
      ]
    }
  }

  // Everything he hands out, added under its own id. A second quest given by
  // him needs nothing here — it is picked up from QUESTS by its giver.
  return addQuests(dialog, 'quartermaster', 'start')
}

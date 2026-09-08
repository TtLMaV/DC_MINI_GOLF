import { Dialog } from './npc'
import { currentSkin } from './ball'
import { balance } from './points'
import { openShop } from './shop'
import { POINTS } from './config'
import { addQuests, questChoices } from './quests'
import { t } from './strings'
import { Game } from './game'

/**
 * Salt, behind the Putts 'n' Balls counter.
 *
 * He no longer reads the stock out. A list of clubs and balls read aloud as
 * dialogue choices was fine when everything was free and there were five of
 * them; with prices, an owned/not-owned state and two kinds of thing, it wants
 * to be looked at rather than listened to. So he opens the inventory and gets
 * out of the way.
 *
 * What he still does is the part a panel is bad at: telling you where you
 * stand, and being rude about it.
 *
 * He also gives out exactly one quest, and it is the right one for him: the
 * secret hole, which pays in the two Neon items. A chandler who stocks
 * everything, admitting there are two things on his own shelf he has never
 * been able to price, says "not for sale" better than a locked row does.
 */
export function shopkeeperDialog(game: Game): Dialog {
  void game

  const dialog: Dialog = {
    start: {
      // Fetched rather than written, so switching language in the settings
      // panel changes what he says the next time he opens his mouth. A node
      // whose text is a function is read fresh every time it is drawn, which
      // this file was already relying on for the balance and the ball.
      text: () =>
        t('salt.greeting', {
          ball: currentSkin().name.toLowerCase(),
          pp: balance(),
          ppShort: POINTS.short
        }),
      // A function now rather than a fixed list, because the quest tab only
      // exists once he has something to offer — below the level gate he has
      // nothing to say about the tenth and should not be hinting at it.
      choices: () => [
        { label: t('salt.showBalls'), goto: '', act: () => openShop('ball') },
        { label: t('salt.showClubs'), goto: '', act: () => openShop('club') },
        ...questChoices('shopkeeper'),
        { label: t('salt.wherePoints'), goto: 'points' },
        { label: t('salt.justPassing'), goto: '' }
      ]
    },

    points: {
      // A function rather than a string, which it did not need to be before:
      // a fixed string is baked at start-up, and this one has to be able to
      // change language mid-session like everything else he says.
      //
      // It also gained a space. "hole in one.Points" ran together in every
      // build this scene has ever had.
      text: () => t('salt.points', { ppLong: POINTS.name }),
      choices: [
        { label: t('salt.showBalls'), goto: '', act: () => openShop('ball') },
        { label: t('salt.fairEnough'), goto: '' }
      ]
    }
  }

  return addQuests(dialog, 'shopkeeper', 'start')
}

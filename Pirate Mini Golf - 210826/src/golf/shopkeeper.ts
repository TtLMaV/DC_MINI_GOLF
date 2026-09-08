import { Dialog } from './npc'
import { currentSkin } from './ball'
import { balance } from './points'
import { openShop } from './shop'
import { POINTS } from './config'
import { addQuests, questChoices } from './quests'
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
      text: () =>
        `Hi, the names Salt, I've been running Putts 'n' Balls for years! Mini golf on an Island? Bit weird... but lets not ask questions. ` +
        `You're using a ${currentSkin().name.toLowerCase()}, and you've ${balance()} ${POINTS.short} to your name. Feel free to get new gear here, once you level up!`,
      // A function now rather than a fixed list, because the quest tab only
      // exists once he has something to offer — below the level gate he has
      // nothing to say about the tenth and should not be hinting at it.
      choices: () => [
        { label: 'Show me the balls', goto: '', act: () => openShop('ball') },
        { label: 'Show me the clubs', goto: '', act: () => openShop('club') },
        ...questChoices('shopkeeper'),
        { label: 'Where do points come from?', goto: 'points' },
        { label: 'Just passing', goto: '' }
      ]
    },

    points: {
      text:
        'Play the nine. Finishing pays, and playing well pays better: pars, birdies, and the odd hole in one.' +
        'Points are called Pixel Points and can be used to upgrade your gear or spent elsewhere within the Pixel Arcade ecosystem.',
      choices: [
        { label: 'Show me the balls', goto: '', act: () => openShop('ball') },
        { label: 'Fair enough', goto: '' }
      ]
    }
  }

  return addQuests(dialog, 'shopkeeper', 'start')
}

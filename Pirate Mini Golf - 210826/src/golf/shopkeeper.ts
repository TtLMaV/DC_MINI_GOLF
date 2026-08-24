import { Dialog } from './npc'
import { currentSkin } from './ball'
import { balance } from './points'
import { openShop } from './shop'
import { POINTS } from './config'
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
 */
export function shopkeeperDialog(game: Game): Dialog {
  void game

  return {
    start: {
      text: () =>
        `Salt, ships' chandler, retired. Putts 'n' Balls is mine — clubs, crate, the lot. ` +
        `You're playing ${currentSkin().name.toLowerCase()}, and you've ${balance()} ${POINTS.short} to your name.`,
      choices: [
        { label: 'Show me the crate', goto: '', act: () => openShop('ball') },
        { label: 'What about clubs?', goto: '', act: () => openShop('club') },
        { label: 'Where do points come from?', goto: 'points' },
        { label: 'Just passing', goto: '' }
      ]
    },

    points: {
      text:
        'Play the nine. Finishing pays, and playing well pays better — pars, birdies, the odd one you hole from nowhere. ' +
        'Beat your own best and there is something in that too. The practice green pays nothing, before you ask.',
      choices: [
        { label: 'Show me the crate', goto: '', act: () => openShop('ball') },
        { label: 'Fair enough', goto: '' }
      ]
    }
  }
}

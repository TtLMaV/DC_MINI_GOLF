import { getExplorerInformation } from '~system/Runtime'

import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, PositionUnit, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { COCONUTS, POINTS, SHOT, SWING, SHELLS } from './config'
import { HOLES, SECRET, TOTAL_PAR } from './course'
import { shellsCarried } from './shells'
import { coconutsCarried } from './coconuts'
import { drinkIsUp, drinkLeft } from './drink'
import { levelUpBanner } from './levelup'
import { detectorHeat, detectorIsOut, detectorNearest, overFind, scrapCarried } from './detector'
import { Game } from './game'
import { myUserId, roster } from './net'
import { choose, currentNode, nodeChoices, nodeText, speakerName } from './npc'
import { balance, grantPoints, pointsAreLocal, pointsStatus, pointsVisible,
  claimedKeys,
  coconutsToday,
  playerStanding,
  shellsToday
} from './points'
import { giverName, questById, questsByStatus } from './quests'
import {
  BAD,
  CREAM,
  DIM,
  GOLD,
  GOOD,
  INK,
  INK_SOFT,
  PICKED,
  SHADOW,
  button,
  chip,
  face,
  panel
} from './theme'
import {
  Item,
  ItemKind,
  buy,
  closeShop,
  equip,
  equippedId,
  isOwned,
  isUnlocked,
  itemsOfKind,
  unlockLabel,
  setShopTab,
  shopOpen,
  shopTab
} from './shop'
import { GOOD_OFFSET, PERFECT_OFFSET } from './swing'

/**
 * Screen UI. Deliberately thin: hole and score in one strip, the swing meter,
 * and a reset button. The club panel, the penalty counter and the slope and
 * wall callouts are all gone — they were noise around the two numbers anyone
 * actually plays off, which are the stroke count and the meter.
 *
 * Against a 1920x1080 virtual canvas so it scales the same on a phone as on a
 * desktop. Every absolutely-positioned panel carries an explicit width and
 * height: Decentraland collapses an absolutely-positioned element with no
 * height of its own and takes its children with it, so "size to contents"
 * silently renders nothing.
 */

/**
 * Layout anchors.
 *
 * The screen inset handles the edges of the canvas, but there are two places
 * it cannot help with. The explorer's interaction button sits bottom centre
 * and its action buttons bottom right, and the docs are explicit that they
 * overlap the UI area deliberately — so anything the player has to tap is kept
 * away from that corner and the bottom cluster is lifted clear of the button.
 *
 * Vertical anchors are percentages rather than pixels because the virtual
 * canvas is not the same shape on both: a 16:9 size is overridden to 1600x720
 * on mobile, so a panel pinned 300px down sits at 28% of the height on desktop
 * and 42% on a phone. Percentages land in the same place on both.
 */
const SAFE = {
  /** Gap from the edge of the canvas for the corner panels. */
  edge: 24,
  /** Bottom cluster, lifted above the interaction button. */
  bottom: '14%',
  /** Callouts, high enough to miss the meter and low enough to miss the strips. */
  toastTop: '24%'
} as const


let game: Game

/**
 * The Pixel Points chip, sat on the end of whichever top strip is showing.
 *
 * A guest gets a star on the label. Their balance is real for the visit and
 * gone afterwards, because a guest address is not stable between visits — and
 * a number that looks banked and is not is worse than one that is obviously
 * not.
 */
function pointsChip() {
  if (!pointsVisible()) return null

  return (
    <UiEntity
      uiTransform={{
        width: 128,
        height: 62,
        margin: { left: 10 },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: 16, right: 16 }
      }}
      uiBackground={panel()}
    >
      <Label
        value={pointsAreLocal() ? `${POINTS.short}*` : POINTS.short}
        fontSize={16}
        color={DIM}
        uiTransform={{ width: 30, height: 30 }}
        textAlign="middle-left"
      />
      <Bold value={pointsStatus() === 'loading' ? '\u2014' : `${balance()}`} fontSize={24} color={GOLD} outline={SHADOW} spread={1} width={66} height={30} textAlign="middle-right" />
    </UiEntity>
  )
}

/**
 * The level chip, sat beside the points chip and built the same way.
 *
 * Same shape as pointsChip on purpose: a small dim label on the left, the
 * number in gold on the right, in the same panel at the same height. Two
 * chips that mean "here is a number about you" should not be two different
 * shapes.
 *
 * The rank name is the label. It costs nothing to show — the chip needs a
 * label either way, and "Deckhand 7" says more than "LV 7" for the same room.
 *
 * Nothing here is stored: standing() is a function of lifetime points, so this
 * cannot fall out of step with the balance next to it.
 */
function levelChip() {
  if (!pointsVisible()) return null

  const loading = pointsStatus() === 'loading'
  const me = playerStanding()

  return (
    <UiEntity
      uiTransform={{
        width: 186,
        height: 62,
        margin: { left: 10 },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: 16, right: 16 }
      }}
      uiBackground={panel()}
    >
      <Label
        value={loading ? '' : me.rank.name}
        fontSize={16}
        color={DIM}
        uiTransform={{ width: 106, height: 30 }}
        textAlign="middle-left"
      />
      <Bold
        value={loading ? '\u2014' : `${me.level}`}
        fontSize={24}
        color={GOLD}
        outline={SHADOW}
        spread={1}
        width={48}
        height={30}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

/**
 * Shells in hand, shown only while there are any.
 *
 * A chip that reads zero for the whole round is a chip nobody looks at, and the
 * top strip is already carrying a scorecard, a balance and a rank. This one
 * turns up when you pick a shell up and goes away when you hand them over,
 * which is exactly the window in which the number matters.
 *
 * The daily figure sits alongside it because the two are only useful together:
 * eight in hand means one thing when Shellman will take ten more and another
 * when he is done for the day.
 */
function shellChip() {
  const held = shellsCarried()
  if (held <= 0) return null

  const left = Math.max(0, SHELLS.dailyLimit - shellsToday())

  return (
    <UiEntity
      uiTransform={{
        width: 150,
        height: 62,
        margin: { left: 10 },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: 16, right: 16 }
      }}
      uiBackground={panel()}
    >
      <Label
        value={left > 0 ? 'SHELLS' : 'SHELLS*'}
        fontSize={16}
        color={DIM}
        uiTransform={{ width: 72, height: 30 }}
        textAlign="middle-left"
      />
      <Bold
        value={`${held}`}
        fontSize={24}
        color={left > 0 ? GOLD : DIM}
        outline={SHADOW}
        spread={1}
        width={46}
        height={30}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

/**
 * Coconuts in hand, on the same terms as the shells.
 *
 * Deliberately the same chip rather than a shared one that switches: they are
 * two separate errands with two separate daily limits, and somebody walking
 * back from the palms with a pocket of each wants to see both numbers rather
 * than watch one label change.
 */
function coconutChip() {
  const held = coconutsCarried()
  if (held <= 0) return null

  const left = Math.max(0, COCONUTS.dailyLimit - coconutsToday())

  return (
    <UiEntity
      uiTransform={{
        width: 176,
        height: 62,
        margin: { left: 10 },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: 16, right: 16 }
      }}
      uiBackground={panel()}
    >
      <Label
        value={left > 0 ? 'COCONUTS' : 'COCONUTS*'}
        fontSize={16}
        color={DIM}
        uiTransform={{ width: 98, height: 30 }}
        textAlign="middle-left"
      />
      <Bold
        value={`${held}`}
        fontSize={24}
        color={left > 0 ? GOLD : DIM}
        outline={SHADOW}
        spread={1}
        width={46}
        height={30}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

/**
 * How long is left on a pina colada.
 *
 * The only countdown in the scene, and the only thing anybody buys that runs
 * out — which is exactly why it needs saying. Minutes and seconds rather than
 * a bar: a bar answers "roughly how much" and the useful question here is
 * whether there is time to get to the ninth.
 *
 * Turns amber under the last thirty seconds, since that is the point at which
 * the answer changes from "plenty" to "go now".
 */
function drinkChip() {
  if (!drinkIsUp()) return null

  const left = Math.max(0, Math.ceil(drinkLeft()))
  const mm = Math.floor(left / 60)
  const ss = left % 60
  const ending = left <= 30

  return (
    <UiEntity
      uiTransform={{
        width: 168,
        height: 62,
        margin: { left: 10 },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: 16, right: 16 }
      }}
      uiBackground={panel()}
    >
      <Label
        value="COLADA"
        fontSize={16}
        color={DIM}
        uiTransform={{ width: 82, height: 30 }}
        textAlign="middle-left"
      />
      <Bold
        value={`${mm}:${ss < 10 ? '0' : ''}${ss}`}
        fontSize={24}
        color={ending ? BAD : GOOD}
        outline={SHADOW}
        spread={1}
        width={56}
        height={30}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

/**
 * The metal detector's read-out, shown only while it is out.
 *
 * A bar rather than a number, because a number would be a distance and a
 * distance is a map. The bar says warmer or colder and nothing else, which is
 * the entire game of sweeping — you learn whether the last two steps helped,
 * not where the thing is.
 *
 * It turns gold and says DIG when you are stood on one, since at that point the
 * guessing is over and the only question left is whether you noticed.
 */
function detectorChip() {
  if (!detectorIsOut()) return null

  const heat = detectorHeat()
  const on = overFind()
  const carried = scrapCarried()
  const something = detectorNearest() < Number.POSITIVE_INFINITY

  return (
    <UiEntity
      uiTransform={{
        width: 190,
        height: 62,
        margin: { left: 10 },
        flexDirection: 'column',
        justifyContent: 'center',
        padding: { left: 16, right: 16, top: 8, bottom: 8 }
      }}
      uiBackground={panel()}
    >
      <UiEntity uiTransform={{ width: '100%', height: 26, flexDirection: 'row', alignItems: 'center' }}>
        <Label
          value={on ? 'DIG  (E)' : something ? 'SWEEPING' : 'NOTHING'}
          fontSize={15}
          color={on ? GOOD : DIM}
          uiTransform={{ width: 118, height: 26 }}
          textAlign="middle-left"
        />
        <Label
          value={`${carried}`}
          fontSize={17}
          color={GOLD}
          uiTransform={{ width: 40, height: 26 }}
          textAlign="middle-right"
        />
      </UiEntity>

      <UiEntity uiTransform={{ width: '100%', height: 6 }} uiBackground={{ color: SHADOW }}>
        <UiEntity
          uiTransform={{ width: `${Math.round(heat * 100)}%`, height: 6 }}
          uiBackground={{ color: on ? GOOD : GOLD }}
        />
      </UiEntity>
    </UiEntity>
  )
}

/**
 * The quest panel: open or shut, and which tab.
 *
 * Kept here rather than in quests.ts because nothing outside the HUD opens it.
 * The shop's state lives in shop.ts for the opposite reason — an NPC opens
 * that one, so it needs a handle the dialogue can reach.
 */
type QuestTab = 'active' | 'available' | 'done'
let questsOpen = false
let questTab: QuestTab = 'active'

/**
 * The quest button, opposite the address prompt.
 *
 * This replaces a strip of chips that sat under the top bar listing every
 * running quest at once. That was fine with two quests and unreadable with
 * seven — and by the time Sally and Coconutty were both handing work out,
 * seven was ordinary. A wall of text you cannot dismiss is worse than no
 * tracker at all.
 *
 * What survives of it is the count on the button, which is the part anybody
 * was actually reading: how many are running, and whether one is ready to hand
 * in. The button goes gold and says READY when something is, because that is
 * the only state that wants you to do something.
 */
function questButton(alone: boolean) {
  const { active } = questsByStatus()
  const ready = active.filter((a) => a.status === 'complete').length
  const label =
    ready > 0
      ? `QUESTS (${ready} COMPLETED)`
      : active.length > 0
        ? `QUESTS  ${active.length}`
        : 'QUESTS'

  return (
    <UiEntity
      uiTransform={{
        width: QUEST_BUTTON_W,
        height: 52,
        // The gap belongs between this and whatever is beside it. With nothing
        // beside it, the gap is what stops it being centred.
        margin: { left: alone ? 0 : 14 },
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={button(questsOpen ? PICKED : undefined)}
      onMouseDown={() => {
        questsOpen = !questsOpen
      }}
    >
      <Bold
        value={label}
        fontSize={16}
        color={ready > 0 ? GOOD : GOLD}
        outline={SHADOW}
        spread={1}
        width={QUEST_BUTTON_W - 20}
        height={28}
      />
    </UiEntity>
  )
}

/**
 * Fixed, because the opposite side of the prompt reserves the same width.
 *
 * 250 rather than 190. "QUESTS (1 COMPLETED)" is twenty characters and needed
 * about 188 pixels at the old size, against 170 of usable width — so it
 * wrapped onto a second line and spilled out of the frame. Sized off the
 * longest thing the button ever says rather than off the shortest, with the
 * text a couple of points down as well; "QUESTS (12 COMPLETED)" is the true
 * worst case and lands around 175 of the 230 now available.
 */
const QUEST_BUTTON_W = 250

/**
 * The most rows the panel will draw.
 *
 * There are fifteen quests in the scene and the explorer's UI has no scrolling
 * to offer, so a COMPLETED tab with all of them on it came out 1116 pixels tall
 * against a 1080 canvas — the bottom rows simply off the screen, with nothing
 * saying so. Eight fits with room to spare and the overflow is stated in a line
 * underneath rather than silently dropped.
 */
const MAX_QUEST_ROWS = 8

function questTabButton(tab: QuestTab, label: string, count: number) {
  const here = questTab === tab
  return (
    <UiEntity
      uiTransform={{ width: 176, height: 40, margin: { right: 8 }, alignItems: 'center', justifyContent: 'center' }}
      uiBackground={button(here ? PICKED : undefined)}
      onMouseDown={() => {
        questTab = tab
      }}
    >
      <Label
        value={count > 0 ? `${label}  ${count}` : label}
        fontSize={17}
        color={here ? GOLD : DIM}
        uiTransform={{ width: 166, height: 26 }}
        textAlign="middle-center"
      />
    </UiEntity>
  )
}

/**
 * One quest, as a row in the panel.
 *
 * Read-only on purpose. Taking a quest and handing one in stay with the
 * character who gave it — that conversation is the only reason the characters
 * exist, and a panel that let you collect a reward from anywhere on the island
 * would quietly delete them. So a finished quest says who to go and see, and
 * an offered one says who is holding it.
 */
function questRow(
  key: string,
  name: string,
  detail: string,
  right: string,
  rightColour: Color4,
  nameColour: Color4
) {
  return (
    <UiEntity
      key={key}
      uiTransform={{
        width: '100%',
        height: 62,
        margin: { bottom: 6 },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: 16, right: 16 }
      }}
      uiBackground={button()}
    >
      {/*
        430 and 246 rather than 500 and 208, and the two now add up.
        The panel is 760 wide with 26 of padding each side and the row takes
        another 16 each side, which leaves 676 — the old pair came to 708, so
        the right-hand column had been hanging 32 pixels off the end of every
        row since it was written. Widening it was needed anyway: "Speak to Cave
        Explorer Sally" is the longest thing that column ever has to say.
      */}
      <UiEntity uiTransform={{ width: 430, height: 52, flexDirection: 'column', justifyContent: 'center' }}>
        <Label value={name} fontSize={19} color={nameColour} uiTransform={{ width: 430, height: 26 }} textAlign="middle-left" />
        <Label value={detail} fontSize={15} color={DIM} uiTransform={{ width: 430, height: 22 }} textAlign="middle-left" />
      </UiEntity>
      <Label
        value={right}
        fontSize={16}
        color={rightColour}
        uiTransform={{ width: 246, height: 30 }}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

/**
 * The panel itself.
 *
 * Same furniture as the shop — a panel, a title row, a row of tabs, a list —
 * because they are the same kind of thing and a scene with two different
 * full-screen list layouts is a scene that looks like two people built it.
 *
 * Height is worked out from the longest tab rather than the tab showing, so
 * the panel does not jump about as you click between them.
 */
function questPanel() {
  // Shut by anything that takes the screen for itself. A conversation and a
  // full-screen list at once is two things wanting the same attention, and the
  // flag is cleared rather than just the drawing skipped so the button does not
  // sit there lit up over a panel nobody can see.
  if (currentNode() || shopOpen()) questsOpen = false
  if (!questsOpen) return null

  const { active, available, done } = questsByStatus()
  const tallest = Math.min(
    MAX_QUEST_ROWS,
    Math.max(active.length, available.length, done.length, 1)
  )
  // How many this tab is not showing, said out loud below the list.
  const shown = questTab === 'active' ? active.length : questTab === 'available' ? available.length : done.length
  const hidden = Math.max(0, shown - MAX_QUEST_ROWS)

  const rows =
    questTab === 'active'
      ? active.slice(0, MAX_QUEST_ROWS).map(({ quest, done: got, status }) =>
          questRow(
            quest.id,
            quest.name,
            // A finished quest stops describing the job and starts describing
            // the errand. The objective is answered by then; who to go and see
            // is the only thing left, so it takes the wide line and the count
            // gives way to what collecting is worth.
            status === 'complete'
              ? `Completed — Speak to ${giverName(quest.giver)}`
              : quest.objective,
            status === 'complete' ? `+${quest.reward} ${POINTS.short}` : `${got} / ${quest.target}`,
            status === 'complete' ? GOOD : GOLD,
            status === 'complete' ? GOOD : CREAM
          )
        )
      : questTab === 'available'
        ? available.slice(0, MAX_QUEST_ROWS).map((quest) =>
            questRow(quest.id, quest.name, quest.objective, `Speak to ${giverName(quest.giver)}`, GOLD, CREAM)
          )
        : done.slice(0, MAX_QUEST_ROWS).map((quest) =>
            questRow(quest.id, quest.name, quest.objective, `+${quest.reward} ${POINTS.short}`, DIM, DIM)
          )

  const nothing =
    questTab === 'active'
      ? 'Nothing on the go. Have a word with somebody.'
      : questTab === 'available'
        ? 'Nothing on offer. Finish what you have started.'
        : 'Nothing finished yet.'

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0 },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: 760,
          height: 96 + tallest * 68 + (hidden > 0 ? 28 : 0),
          flexDirection: 'column',
          padding: { top: 22, bottom: 22, left: 26, right: 26 }
        }}
        uiBackground={panel()}
      >
        <UiEntity uiTransform={{ width: '100%', height: 40, flexDirection: 'row', alignItems: 'center' }}>
          <Bold value="QUESTS" fontSize={20} color={GOLD} outline={SHADOW} spread={1} width={300} height={30} textAlign="middle-left" />
          <Label
            value="Click QUESTS again to close"
            fontSize={15}
            color={DIM}
            uiTransform={{ width: 424, height: 30 }}
            textAlign="middle-right"
          />
        </UiEntity>

        <UiEntity uiTransform={{ width: '100%', height: 48, flexDirection: 'row', alignItems: 'center' }}>
          {questTabButton('active', 'ACTIVE', active.length)}
          {questTabButton('available', 'AVAILABLE', available.length)}
          {questTabButton('done', 'COMPLETED', done.length)}
        </UiEntity>

        {rows.length > 0 ? (
          rows
        ) : (
          <Label
            value={nothing}
            fontSize={16}
            color={DIM}
            uiTransform={{ width: '100%', height: 62 }}
            textAlign="middle-center"
          />
        )}

        {hidden > 0 ? (
          <Label
            value={`and ${hidden} more`}
            fontSize={15}
            color={DIM}
            uiTransform={{ width: '100%', height: 26 }}
            textAlign="middle-center"
          />
        ) : null}
      </UiEntity>
    </UiEntity>
  )
}

/**
 * The level-up banner.
 *
 * Bigger than a toast and in the middle of the screen, because it happens a
 * handful of times in a player's whole history with the scene and the rest of
 * the callouts happen several times a round. Sharing the toast channel would
 * let "LEVEL 12" be wiped a second later by a note about shells.
 *
 * Three lines at most, and the third only when there is something to say. The
 * rank line is the promotion; the club line is the reason to walk to the
 * shack. A level that stays inside the same band gets neither, and says so by
 * simply being shorter.
 */
function levelUp() {
  const up = levelUpBanner()
  if (!up) return null

  const under = up.newRank
    ? `${up.rank.toUpperCase()}${up.unlocked ? `  ·  ${up.unlocked} on the shelf` : ''}`
    : up.rank.toUpperCase()

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        // 38%, not 34%. The toast sits at 24% and is 128 tall, so it runs to
        // 387 on a 1080 canvas; a banner starting at 367 overlapped it by 20
        // pixels, and a round that finishes and levels you up at the same
        // moment shows both.
        position: { top: '38%' },
        width: '100%',
        height: 190,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: 760,
          height: 168,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: { top: 18, bottom: 18, left: 24, right: 24 }
        }}
        uiBackground={panel()}
      >
        <Bold
          value={up.gained > 1 ? `LEVEL ${up.level}  (+${up.gained})` : `LEVEL ${up.level}`}
          fontSize={44}
          color={GOLD}
          outline={SHADOW}
          spread={3}
          width={700}
          height={54}
        />
        <Bold
          value={under}
          fontSize={20}
          color={up.newRank ? GOOD : CREAM}
          outline={SHADOW}
          spread={1}
          width={700}
          height={30}
        />
        {up.bonus > 0 ? (
          <Label
            value={`+${up.bonus} ${POINTS.short}`}
            fontSize={22}
            color={GOOD}
            uiTransform={{ width: 700, height: 32 }}
            textAlign="middle-center"
          />
        ) : (
          <Label
            value="Connect a wallet to be paid for these"
            fontSize={15}
            color={DIM}
            uiTransform={{ width: 700, height: 32 }}
            textAlign="middle-center"
          />
        )}
      </UiEntity>
    </UiEntity>
  )
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/**
 * What a locked row says on the right.
 *
 * Level and pending rows come straight from the catalogue, but a quest row
 * used to read "Earned, not bought", which says what it is not rather than
 * what to do — it reads like something already earned and still waiting to be
 * paid for. Naming the quest turns it into an instruction: the same words are
 * on the quest board and in the giver's Quests tab, so there is one string to
 * go looking for rather than a riddle.
 */
function lockedLabel(item: Item): string {
  if (item.unlock.kind === 'quest') {
    const quest = questById(item.unlock.quest)
    return quest ? `Quest: ${quest.name}` : 'Quest reward'
  }
  return unlockLabel(item)
}

/**
 * The shop, laid out as an inventory rather than read aloud.
 *
 * Centred, because every square inch of it is tappable and the middle is the
 * one place the explorer keeps nothing of its own. One row per item so a phone
 * gets a target it can actually hit — a grid of tiles looks better on a
 * desktop and is miserable with a thumb.
 *
 * Owned, equipped and affordable are all read live: buying sends a request and
 * the row changes when the server answers, so a click that cannot be paid for
 * simply does not change anything.
 */
function itemRow(item: Item, canAfford: boolean) {
  const owned = isOwned(item.id)
  const worn = equippedId(item.kind) === item.id
  // Locked rows are shown rather than hidden. Half the point of a ladder is
  // seeing the rung above you, and a shop that silently grows is a shop nobody
  // knows they are working towards.
  const unlocked = isUnlocked(item, playerStanding().level, claimedKeys())

  const action = !unlocked
    ? lockedLabel(item)
    : worn
      ? 'HOLDING'
      : owned
        ? 'EQUIP'
        : `${item.price}`
  const actionColour = !unlocked ? DIM : worn ? GOOD : owned ? GOLD : canAfford ? GOLD : BAD

  return (
    <UiEntity
      key={item.id}
      uiTransform={{
        width: '100%',
        height: 62,
        margin: { bottom: 6 },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: 16, right: 16 }
      }}
      uiBackground={button(worn ? PICKED : undefined)}
      onMouseDown={() => {
        // A locked row is inert. The server refuses it as well — this only
        // saves the round trip and the refusal toast.
        if (!unlocked) return
        if (owned) equip(item.id)
        else buy(item.id)
      }}
    >
      <UiEntity uiTransform={{ width: 560, height: 52, flexDirection: 'column', justifyContent: 'center' }}>
        <Label
          value={item.name}
          fontSize={19}
          color={owned && unlocked ? CREAM : DIM}
          uiTransform={{ width: 560, height: 26 }}
          textAlign="middle-left"
        />
        <Label
          value={item.blurb}
          fontSize={14}
          color={DIM}
          uiTransform={{ width: 560, height: 20 }}
          textAlign="middle-left"
        />
      </UiEntity>
      <Label
        value={action}
        fontSize={owned ? 15 : 20}
        color={actionColour}
        uiTransform={{ width: 130, height: 30 }}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

function tabButton(kind: ItemKind, label: string) {
  const here = shopTab() === kind
  return (
    <UiEntity
      uiTransform={{ width: 150, height: 40, margin: { right: 8 }, alignItems: 'center', justifyContent: 'center' }}
      uiBackground={button(here ? PICKED : undefined)}
      onMouseDown={() => setShopTab(kind)}
    >
      <Label value={label} fontSize={17} color={here ? GOLD : DIM} uiTransform={{ width: 140, height: 26 }} textAlign="middle-center" />
    </UiEntity>
  )
}

function inventory() {
  if (!shopOpen()) return null
  const kind = shopTab()
  const stock = itemsOfKind(kind)
  const purse = balance()

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0 },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: 760,
          height: 96 + stock.length * 68,
          flexDirection: 'column',
          padding: { top: 22, bottom: 22, left: 26, right: 26 }
        }}
        uiBackground={panel()}
      >
        {/* title row */}
        <UiEntity uiTransform={{ width: '100%', height: 40, flexDirection: 'row', alignItems: 'center' }}>
          <Bold value="PUTTS 'N' BALLS" fontSize={20} color={GOLD} outline={SHADOW} spread={1} width={300} height={30} textAlign="middle-left" />
          <Bold value={`${purse}  ${POINTS.short}`} fontSize={20} color={CREAM} outline={SHADOW} spread={1} width={424} height={30} textAlign="middle-right" />
        </UiEntity>

        {/* tabs */}
        <UiEntity uiTransform={{ width: '100%', height: 48, flexDirection: 'row', alignItems: 'center' }}>
          {tabButton('ball', 'BALLS')}
          {tabButton('club', 'CLUBS')}
        </UiEntity>

        {stock.map((item) => itemRow(item, purse >= item.price))}
      </UiEntity>

      <Label
        value="Walk away to close"
        fontSize={15}
        color={DIM}
        uiTransform={{ width: 760, height: 24 }}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

// ---------------------------------------------------------------------------
// Bold
// ---------------------------------------------------------------------------

/**
 * Text with weight, and optionally an outline.
 *
 * The engine gives three fonts and no bold, no weight and no outline — a UI
 * label has a value, a colour, a size, an alignment and a font, and that is
 * the whole of it. So both are faked the only way they can be: the same string
 * is drawn several times, a pixel apart, and the overlap thickens the strokes.
 * Dark copies first for the outline, then the fill on top.
 *
 * It costs an entity per stamp, which is why this is not simply what every
 * Label does. Worth it on the numbers and headings people read at a glance;
 * not worth it on a paragraph of dialogue nobody is squinting at.
 *
 * The stamps are absolutely positioned, so the container needs an explicit
 * width and height — Decentraland collapses an absolutely-positioned element
 * with no height of its own and takes its children with it.
 */
function Bold(props: {
  value: string
  fontSize: number
  color: Color4
  width: PositionUnit
  height: number
  textAlign?: 'middle-left' | 'middle-center' | 'middle-right' | 'top-left'
  font?: 'sans-serif' | 'serif' | 'monospace'
  /** Draw a dark ring behind it as well. */
  outline?: Color4
  /** How far the ring sits out. Scale it with the text or it disappears. */
  spread?: number
}) {
  const align = props.textAlign ?? 'middle-center'
  const font = props.font ?? 'serif'
  const spread = props.spread ?? 2

  const stamp = (dx: number, dy: number, color: Color4, key: string) => (
    <Label
      key={key}
      value={props.value}
      fontSize={props.fontSize}
      color={color}
      font={font}
      textAlign={align}
      uiTransform={{
        positionType: 'absolute',
        position: { left: dx, top: dy },
        width: props.width,
        height: props.height
      }}
    />
  )

  const ring: [number, number][] = props.outline
    ? [
        [-spread, 0],
        [spread, 0],
        [0, -spread],
        [0, spread],
        [-spread, -spread],
        [spread, -spread],
        [-spread, spread],
        [spread, spread]
      ]
    : []

  return (
    <UiEntity uiTransform={{ width: props.width, height: props.height }}>
      {ring.map(([dx, dy], i) => stamp(dx, dy, props.outline!, `o${i}`))}
      {/* The weight itself: three fills, half a pixel apart in effect. */}
      {stamp(1, 0, props.color, 'w1')}
      {stamp(0, 1, props.color, 'w2')}
      {stamp(0, 0, props.color, 'w0')}
    </UiEntity>
  )
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

/**
 * The conversation panel. Sits where the swing meter goes, because the meter is
 * never running while you are talking — and it is where the eye already is.
 */
function dialog() {
  const node = currentNode()
  if (!node) return null

  return (
    <UiEntity
      uiTransform={{
        // Centred rather than along the bottom: every line of it is tappable,
        // and the bottom of a phone screen is where the explorer's own buttons
        // live. Middle of the screen is the one place nothing competes.
        positionType: 'absolute',
        position: { top: 0 },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: 900,
          height: 262,
          flexDirection: 'column',
          padding: { top: 24, bottom: 24, left: 30, right: 30 }
        }}
        uiBackground={panel()}
      >
        <Bold value={speakerName()} fontSize={20} color={GOLD} width="100%" height={28} textAlign="middle-left" />
        <Label
          value={nodeText(node)}
          fontSize={18}
          color={CREAM}
          uiTransform={{ width: '100%', height: 92 }}
          textAlign="top-left"
        />
        {nodeChoices(node).map((c, i) => (
          <UiEntity
            key={`${i}-${c.label}`}
            uiTransform={{
              width: '100%',
              height: 38,
              margin: { top: 4 },
              justifyContent: 'flex-start',
              alignItems: 'center',
              // Real padding rather than two spaces glued to the front of the
              // label. The row is a nine-slice frame with an 8px border, so
              // text at zero inset sits on top of its own edge — which is what
              // made the first character look clipped.
              padding: { left: 18, right: 18 }
            }}
            uiBackground={chip()}
            onMouseDown={() => choose(i)}
          >
            <Label
              value={c.label}
              fontSize={17}
              color={GOLD}
              uiTransform={{ width: '100%', height: 26 }}
              textAlign="middle-left"
            />
          </UiEntity>
        ))}
      </UiEntity>
      <Label
        value="Walk away to close"
        fontSize={15}
        color={DIM}
        uiTransform={{ width: 900, height: 24 }}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

/**
 * Where the UI is allowed to draw.
 *
 * 'device' keeps clear of the hardware — notch, status bar, home indicator,
 * rounded corners. 'interactable' additionally keeps clear of the explorer's
 * own HUD: on a phone that is the joystick, chat, profile and emote controls
 * down the left and the camera controls top right, which is most of what makes
 * a desktop-shaped layout unusable on mobile.
 *
 * It is not simply set to 'interactable' everywhere because on desktop that
 * reserves the left quarter of the screen, and this HUD has nothing to gain
 * from a 25% margin nobody is tapping through.
 *
 * The renderer is set twice on purpose. getPlatform() is filled in
 * asynchronously — it is null for the first frames while the explorer answers
 * — so asking at start-up would quietly get 'desktop' on every phone. So the
 * HUD goes up immediately inside the device safe area, which is right on both,
 * and moves in to the interactable area a moment later if this turns out to be
 * a phone.
 */
export function setupHud(g: Game): void {
  game = g
  const size = { virtualWidth: 1920, virtualHeight: 1080 }
  ReactEcsRenderer.setUiRenderer(hud, { ...size, screenInset: 'device' })

  void getExplorerInformation({}).then((info) => {
    if (info.platform?.toLowerCase() !== 'mobile') return
    ReactEcsRenderer.setUiRenderer(hud, { ...size, screenInset: 'interactable' })
  })
}

const toPar = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`)
const metres = (m: number) => (m < 10 ? `${m.toFixed(1)}m` : `${Math.round(m)}m`)

function powerColour(p: number): Color4 {
  if (p < 0.5) {
    const k = p / 0.5
    return Color4.create(0.4 + 0.55 * k, 0.9, 0.45 - 0.1 * k, 1)
  }
  const k = (p - 0.5) / 0.5
  return Color4.create(0.95, 0.9 - 0.55 * k, 0.35 - 0.3 * k, 1)
}

/**
 * What to press, or nothing at all.
 *
 * Deliberately not a pure function of the phase any more. 'walking' is the
 * resting state of the whole scene — you are in it from the moment you load,
 * and you go back to it after every shot — so keying the banner off the phase
 * alone left "Walk up to your ball" on screen permanently, including while
 * picking coconuts on the far side of the island. It reads as a fault rather
 * than as help.
 *
 * Two things switch it off. Being nowhere near the ball, because then it is
 * not advice about anything you are doing; and having the detector out,
 * because that is unambiguously a different activity and the club is not even
 * in your hand. 'ready' and 'address' need no distance test — you cannot be in
 * either from more than SHOT.reach away.
 */
function prompt(phase: string, distanceToBall: number): string {
  if (detectorIsOut()) return ''
  if (phase === 'walking') {
    return distanceToBall <= SHOT.promptRange ? 'Walk up to your ball' : ''
  }
  if (phase === 'ready') return 'Press  E  to address the ball'
  if (phase === 'address') return 'Look where you want it to go,  then  E'
  return ''
}

// ---------------------------------------------------------------------------
// Swing meter
// ---------------------------------------------------------------------------

/**
 * Colours the meter owns.
 *
 * Kept here rather than in theme.ts because none of them are part of the
 * skin — they are the grammar of the swing, and a re-skin that changed what
 * "perfect" looks like would be changing the game rather than the paint.
 */
const CLEAR = Color4.create(0, 0, 0, 0)
const TRACK = Color4.create(0.05, 0.07, 0.1, 0.75)
const BAND_GOOD = Color4.create(0.42, 0.88, 0.5, 0.35)
const BAND_PERFECT = Color4.create(0.55, 1, 0.6, 0.75)
const IMPACT = Color4.create(1, 1, 1, 0.95)
const LOCK = Color4.create(0.98, 0.85, 0.4, 1)

const METER_W = 1000
const METER_H = 38
/** The impact line sits in from the left so an overrun is visible. */
const IMPACT_AT = 0.28

/** Meter x-position, 0..1, for a cursor value where 0 is the impact line. */
const meterAt = (cursor: number) => IMPACT_AT + cursor * (1 - IMPACT_AT)
/** Fraction of the bar -> pixels, clamped inside it. */
const px = (v: number) => Math.max(0, Math.min(METER_W, Math.round(v * METER_W)))

/** Half-width of a grade band, in bar fractions. */
const band = (offset: number) => offset * SWING.impactWindow * (1 - IMPACT_AT)

function meter() {
  const sw = game.swing
  const live = sw.phase === 'power' || sw.phase === 'accuracy'
  const fillTo = sw.phase === 'power' ? sw.power || sw.cursor : sw.power
  const cursorX = meterAt(sw.cursor)
  const goodHalf = band(GOOD_OFFSET)
  const perfectHalf = band(PERFECT_OFFSET)

  return (
    <UiEntity uiTransform={{ width: METER_W, height: 74, flexDirection: 'column', alignItems: 'center' }}>
      <UiEntity uiTransform={{ width: METER_W, height: 28, flexDirection: 'row' }}>
        <Label
          value={sw.phase === 'power' ? 'SET POWER' : sw.phase === 'accuracy' ? 'HIT THE LINE' : ''}
          fontSize={18}
          color={sw.phase === 'accuracy' ? GOLD : CREAM}
          uiTransform={{ width: 400, height: 28 }}
          textAlign="middle-left"
        />
        <Label
          value={live ? `${Math.round(fillTo * 100)}%` : ''}
          fontSize={18}
          color={CREAM}
          uiTransform={{ width: 300, height: 28 }}
          textAlign="middle-center"
        />
        <Label
          value={live ? 'F  cancel' : ''}
          fontSize={16}
          color={DIM}
          uiTransform={{ width: 300, height: 28 }}
          textAlign="middle-right"
        />
      </UiEntity>

      <UiEntity uiTransform={{ width: METER_W, height: METER_H }} uiBackground={{ color: TRACK }}>
        {/* the zone you are trying to stop in, drawn so there is something to aim at */}
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { left: px(IMPACT_AT - goodHalf), top: 0 },
            width: px(goodHalf * 2),
            height: METER_H
          }}
          uiBackground={{ color: BAND_GOOD }}
        />
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { left: px(IMPACT_AT - perfectHalf), top: 0 },
            width: px(perfectHalf * 2),
            height: METER_H
          }}
          uiBackground={{ color: BAND_PERFECT }}
        />
        {/* power fill, grown from the impact line */}
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { left: px(IMPACT_AT), top: METER_H - 10 },
            width: px(fillTo * (1 - IMPACT_AT)),
            height: 10
          }}
          uiBackground={{ color: powerColour(fillTo) }}
        />
        {/* locked power marker, once power is set */}
        {sw.phase === 'accuracy' ? (
          <UiEntity
            uiTransform={{ positionType: 'absolute', position: { left: px(meterAt(sw.power)), top: 0 }, width: 5, height: METER_H }}
            uiBackground={{ color: LOCK }}
          />
        ) : null}
        {/* the impact line */}
        <UiEntity
          uiTransform={{ positionType: 'absolute', position: { left: px(IMPACT_AT), top: 0 }, width: 4, height: METER_H }}
          uiBackground={{ color: IMPACT }}
        />
        {/* the sweeping cursor */}
        {live ? (
          <UiEntity
            uiTransform={{ positionType: 'absolute', position: { left: px(cursorX), top: -6 }, width: 7, height: METER_H + 12 }}
            uiBackground={{ color: CREAM }}
          />
        ) : null}
      </UiEntity>
    </UiEntity>
  )
}


// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/**
 * The leaderboard reserves room for this many, whoever has turned up.
 *
 * Sizing it to the field meant a box round one name at the start of a round
 * that grew and shoved itself about every time somebody joined or left. A
 * board that is the same shape all evening is easier to read and easier to
 * ignore.
 */
const BOARD_ROWS = 6
const ROW_H = 30

/**
 * Live standings, always on. Play is continuous, so this is the results screen
 * — there is no separate one. Sorted by score, but only counting holes actually
 * played, otherwise anyone who has barely started sits top of the table.
 */
function leaderboard() {
  const meId = myUserId()
  const field = roster()
    .map((p) => {
      const played = p.card.filter((sc) => sc >= 0).length
      const total = p.card.reduce((n, sc) => (sc >= 0 ? n + sc : n), 0)
      let par = 0
      for (let i = 0; i < HOLES.length; i++) if (p.card[i] >= 0) par += HOLES[i].par
      return { id: p.userId, name: p.name, played, total, diff: total - par, hole: p.holeIndex + 1 }
    })
    .sort((a, b) => (a.diff !== b.diff ? a.diff - b.diff : b.played - a.played))

  if (field.length === 0) return null

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 138, right: SAFE.edge },
        width: 360,
        height: 48 + BOARD_ROWS * ROW_H,
        flexDirection: 'column',
        padding: { top: 14, bottom: 14, left: 20, right: 20 }
      }}
      uiBackground={panel()}
    >
      <Label
        value={`PLAYING  ${field.length}`}
        font="serif"
        fontSize={15}
        color={GOLD}
        uiTransform={{ width: '100%', height: 22, margin: { bottom: 2 } }}
        textAlign="middle-left"
      />
      {field.slice(0, BOARD_ROWS).map((p, i) => (
        <UiEntity
          key={p.id}
          uiTransform={{ width: '100%', height: ROW_H, flexDirection: 'row', alignItems: 'center' }}
          uiBackground={p.id === meId ? { color: PICKED } : undefined}
        >
          <Label
            value={`${i + 1}`}
            fontSize={15}
            color={DIM}
            uiTransform={{ width: 22, height: ROW_H }}
            textAlign="middle-left"
          />
          {/* The player's own avatar. A column of faces reads as people; a
              column of names reads as a table. */}
          <UiEntity
            uiTransform={{ width: 24, height: 24, margin: { right: 8 } }}
            uiBackground={face(p.id)}
          />
          <Label
            value={p.name.length > 12 ? `${p.name.slice(0, 12)}\u2026` : p.name}
            fontSize={16}
            color={p.id === meId ? GOLD : CREAM}
            uiTransform={{ width: 140, height: ROW_H }}
            textAlign="middle-left"
          />
          <Label
            value={`H${p.hole}`}
            fontSize={14}
            color={DIM}
            uiTransform={{ width: 38, height: ROW_H }}
            textAlign="middle-center"
          />
          <UiEntity
            uiTransform={{ width: 56, height: 24, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={
              p.played === 0
                ? undefined
                : { color: p.diff <= 0 ? Color4.create(0.42, 0.88, 0.5, 0.18) : Color4.create(0.96, 0.44, 0.4, 0.18) }
            }
          >
            <Label
              value={p.played === 0 ? '-' : toPar(p.diff)}
              fontSize={15}
              color={p.played === 0 ? DIM : p.diff <= 0 ? GOOD : BAD}
              uiTransform={{ width: 56, height: 24 }}
              textAlign="middle-center"
            />
          </UiEntity>
        </UiEntity>
      ))}
    </UiEntity>
  )
}


// ---------------------------------------------------------------------------
// Test panel
// ---------------------------------------------------------------------------

/**
 * Hole picker for testing. Opens on the key bound below and takes over the
 * controls while it is up, so clicking a hole cannot also swing the club.
 */
function adminPanel() {
  const s = game.state
  if (!s.adminOpen) return null

  const played = s.card.filter((n) => n >= 0).length
  const total = s.card.reduce((n, sc) => (sc >= 0 ? n + sc : n), 0)

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.55) }}
    >
      <UiEntity
        uiTransform={{
          width: 720,
          height: 800,
          flexDirection: 'column',
          padding: { top: 26, bottom: 26, left: 30, right: 30 }
        }}
        uiBackground={panel()}
      >
        <UiEntity uiTransform={{ width: '100%', height: 34, flexDirection: 'row' }}>
          <Label
            value="TEST PANEL"
            fontSize={20}
            color={GOLD}
            uiTransform={{ width: 400, height: 34 }}
            textAlign="middle-left"
          />
          <Label
            value={`thru ${played}   ${total} shots`}
            fontSize={16}
            color={DIM}
            uiTransform={{ width: 272, height: 34 }}
            textAlign="middle-right"
          />
        </UiEntity>

        <Label
          value="Pick a hole to jump straight to its tee."
          fontSize={15}
          color={DIM}
          uiTransform={{ width: '100%', height: 26 }}
          textAlign="middle-left"
        />

        {/* The two that are not on the card. Both are a long walk otherwise —
            the practice green is back at the Shack and the secret hole is out
            past the end of the course — and both drop you out of the round,
            because free play only runs while you are not signed on. */}
        <UiEntity
          uiTransform={{ width: '100%', height: 40, margin: { top: 6 }, flexDirection: 'row' }}
        >
          <UiEntity
            uiTransform={{ width: 330, height: 38, margin: { right: 12 }, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={button(s.practising && s.freeHole === 'practice' ? PICKED : undefined)}
            onMouseDown={() => game.gotoFree('practice')}
          >
            <Label
              value="PRACTICE GREEN"
              fontSize={16}
              color={s.practising && s.freeHole === 'practice' ? GOLD : CREAM}
              uiTransform={{ width: 310, height: 28 }}
              textAlign="middle-center"
            />
          </UiEntity>
          <UiEntity
            uiTransform={{ width: 330, height: 38, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={button(s.practising && s.freeHole === 'secret' ? PICKED : undefined)}
            onMouseDown={() => game.gotoFree('secret')}
          >
            <Label
              value="SECRET HOLE"
              fontSize={16}
              color={s.practising && s.freeHole === 'secret' ? GOLD : CREAM}
              uiTransform={{ width: 310, height: 28 }}
              textAlign="middle-center"
            />
          </UiEntity>
        </UiEntity>

        {/* ---- stock ----------------------------------------------------
            Two columns of everything in the catalogue. Tapping one puts it in
            your hands on the spot — locally and visually only, so nothing is
            granted and the server is not told. It is for seeing a club, not
            for having one.

            The points button is the opposite: it changes a real balance, so it
            goes through the server and is refused unless the wallet is named
            in ADMIN.allow. Opening this panel is not enough. ------------- */}
        <UiEntity uiTransform={{ width: '100%', height: 26, margin: { top: 8 }, flexDirection: 'row' }}>
          <Label
            value="STOCK  \u2014  tap to equip"
            fontSize={14}
            color={DIM}
            uiTransform={{ width: 440, height: 22 }}
            textAlign="middle-left"
          />
          <UiEntity
            uiTransform={{ width: 220, height: 24, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={button()}
            onMouseDown={() => grantPoints(1000)}
          >
            <Label value={`+1000 ${POINTS.short}`} font="serif" fontSize={14} color={GOLD} uiTransform={{ width: 200, height: 20 }} textAlign="middle-center" />
          </UiEntity>
        </UiEntity>

        <UiEntity uiTransform={{ width: '100%', height: 150, flexDirection: 'row' }}>
          {(['ball', 'club'] as ItemKind[]).map((kind) => (
            <UiEntity
              key={`stock-${kind}`}
              uiTransform={{ width: 330, height: 150, margin: { right: 8 }, flexDirection: 'column' }}
            >
              {itemsOfKind(kind).map((item) => {
                const worn = equippedId(kind) === item.id
                return (
                  <UiEntity
                    key={`admin-${item.id}`}
                    uiTransform={{
                      width: '100%',
                      height: 26,
                      margin: { bottom: 2 },
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    uiBackground={{ color: worn ? PICKED : INK_SOFT }}
                    onMouseDown={() => equip(item.id)}
                  >
                    <Label
                      value={item.name}
                      fontSize={14}
                      color={worn ? GOLD : CREAM}
                      uiTransform={{ width: 300, height: 22 }}
                      textAlign="middle-center"
                    />
                  </UiEntity>
                )
              })}
            </UiEntity>
          ))}
        </UiEntity>

        {HOLES.map((h, i) => {
          const here = i === s.holeIndex
          const score = s.card[i]
          return (
            <UiEntity
              key={`admin-${h.number}`}
              uiTransform={{
                width: '100%',
                height: 38,
                margin: { top: 4 },
                flexDirection: 'row',
                alignItems: 'center'
              }}
              uiBackground={button(here ? PICKED : undefined)}
              onMouseDown={() => game.gotoHole(i)}
            >
              <Label
                value={`  ${h.number}`}
                fontSize={18}
                color={here ? GOLD : CREAM}
                uiTransform={{ width: 44, height: 30 }}
                textAlign="middle-left"
              />
              <Label
                value={h.name}
                fontSize={17}
                color={here ? GOLD : CREAM}
                uiTransform={{ width: 300, height: 30 }}
                textAlign="middle-left"
              />
              <Label
                value={`par ${h.par}`}
                fontSize={15}
                color={DIM}
                uiTransform={{ width: 150, height: 30 }}
                textAlign="middle-center"
              />
              <Label
                value={score >= 0 ? `${score}` : '-'}
                fontSize={17}
                color={score < 0 ? DIM : score - h.par <= 0 ? GOOD : BAD}
                uiTransform={{ width: 78, height: 30 }}
                textAlign="middle-right"
              />
            </UiEntity>
          )
        })}

        <UiEntity uiTransform={{ width: '100%', height: 44, margin: { top: 10 }, flexDirection: 'row' }}>
          <UiEntity
            uiTransform={{ width: 200, height: 40, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={chip()}
            onMouseDown={() => game.clearCard()}
          >
            <Label value="CLEAR CARD" fontSize={16} color={CREAM} uiTransform={{ width: 180, height: 28 }} textAlign="middle-center" />
          </UiEntity>
          <UiEntity uiTransform={{ width: 272, height: 40 }} />
          <UiEntity
            uiTransform={{ width: 200, height: 40, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={chip()}
            onMouseDown={() => game.closeAdmin()}
          >
            <Label value="CLOSE" fontSize={16} color={GOLD} uiTransform={{ width: 180, height: 28 }} textAlign="middle-center" />
          </UiEntity>
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// ---------------------------------------------------------------------------

const hud = () => {
  if (!game) return <UiEntity uiTransform={{ width: 1, height: 1 }} />
  const s = game.state
  const hole = game.hole
  const finished = s.phase === 'finished'
  const playing = s.joined && !finished

  // What the bottom band is carrying, worked out once because the layout
  // depends on it in two places.
  const hint = prompt(s.phase, s.distanceToBall)
  /**
   * True when the quest button is the only thing down there.
   *
   * Off the course and away from your ball there is no reset button, no meter
   * and nothing to prompt — so the band would otherwise hold a spacer and a
   * button and centre the pair, leaving QUESTS sitting to the right of centre.
   */
  const alone = !playing && s.phase !== 'swinging' && hint === ''

  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      {/* ---- one strip: hole, stroke, distance ---- */}
      {playing ? (
      <UiEntity
        uiTransform={{
          // Top centre, not top left. The explorer keeps its own furniture down
          // the left on both platforms — the scene panel and icon rail on
          // desktop, chat and the joystick on a phone — and a strip pinned into
          // that corner reads as two UIs arguing. Top centre is the one strip
          // of screen neither client uses.
          positionType: 'absolute',
          position: { top: SAFE.edge },
          width: '100%',
          height: 62,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
      <UiEntity
        uiTransform={{
          width: 470,
          height: 62,
          flexDirection: 'row',
          alignItems: 'center',
          padding: { left: 30, right: 30 }
        }}
        uiBackground={panel()}
      >
        <Bold value={`${hole.number}`} fontSize={30} color={GOLD} outline={SHADOW} spread={2} width={34} height={40} textAlign="middle-left" />
        <Bold value={hole.name} fontSize={20} color={CREAM} width={210} height={40} textAlign="middle-left" />
        <Label
          value={`PAR ${hole.par}`}
          fontSize={17}
          color={DIM}
          uiTransform={{ width: 90, height: 40 }}
          textAlign="middle-center"
        />
        <Bold value={`${s.strokes + 1}`} fontSize={30} color={s.strokes >= hole.par ? BAD : CREAM} outline={SHADOW} spread={2} width={46} height={40} textAlign="middle-right" />
        <Bold value={metres(s.distanceToPin)} fontSize={20} color={GOLD} width={84} height={40} textAlign="middle-right" />
      </UiEntity>
      {pointsChip()}
      {levelChip()}
      {shellChip()}
      {coconutChip()}
      {drinkChip()}
      {detectorChip()}
      </UiEntity>
      ) : null}

      {/* ---- practice strip: what the hole strip becomes between rounds ---- */}
      {!s.joined ? (
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: SAFE.edge },
          width: '100%',
          height: 62,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
      <UiEntity
        uiTransform={{
          width: 470,
          height: 62,
          flexDirection: 'row',
          alignItems: 'center',
          padding: { left: 30, right: 30 }
        }}
        uiBackground={panel()}
      >
        <Bold value={s.freeHole === 'secret' ? 'SECRET' : 'PRACTICE'} fontSize={20} color={GOLD} outline={SHADOW} spread={1} width={128} height={40} textAlign="middle-left" />
        <Label
          value={
            s.freeHole === 'secret'
              ? `Shot ${s.strokes + 1} of ${SECRET.maxStrokes}  ·  ${metres(s.distanceToPin)}`
              : s.practicePutts > 0
                ? `${s.practicePutts} holed  ·  shot ${s.strokes + 1}`
                : `Shot ${s.strokes + 1}`
          }
          fontSize={17}
          color={CREAM}
          uiTransform={{ width: 216, height: 40 }}
          textAlign="middle-left"
        />
        <Label
          value={s.toBoard <= 6 ? 'E  to join' : `Board ${metres(s.toBoard)}`}
          fontSize={17}
          color={s.toBoard <= 6 ? GOLD : DIM}
          uiTransform={{ width: 126, height: 40 }}
          textAlign="middle-right"
        />
      </UiEntity>
      {pointsChip()}
      {levelChip()}
      {shellChip()}
      {coconutChip()}
      {drinkChip()}
      {detectorChip()}
      </UiEntity>
      ) : null}

      {/* ---- scorecard ---- */}
      {playing ? (
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: SAFE.edge, right: SAFE.edge },
          width: 452,
          height: 108,
          flexDirection: 'column',
          padding: { top: 16, bottom: 16, left: 26, right: 26 }
        }}
        uiBackground={panel()}
      >
        <UiEntity uiTransform={{ width: '100%', height: 22, flexDirection: 'row' }}>
          {HOLES.map((h) => (
            <Label
              key={`n${h.number}`}
              value={`${h.number}`}
              fontSize={13}
              color={h.number === hole.number ? GOLD : DIM}
              uiTransform={{ width: 34, height: 22 }}
              textAlign="middle-center"
            />
          ))}
          <Label value="TOT" fontSize={13} color={DIM} uiTransform={{ width: 52, height: 22 }} textAlign="middle-center" />
        </UiEntity>
        <UiEntity uiTransform={{ width: '100%', height: 32, flexDirection: 'row' }}>
          {HOLES.map((h, i) => {
            const played = s.card[i] >= 0
            const diff = played ? s.card[i] - h.par : 0
            return (
              <UiEntity
                key={`s${h.number}`}
                uiTransform={{ width: 34, height: 32 }}
                uiBackground={{ color: h.number === hole.number ? PICKED : CLEAR }}
              >
                <Label
                  value={played ? `${s.card[i]}` : '-'}
                  fontSize={18}
                  color={!played ? DIM : diff < 0 ? GOOD : diff > 0 ? BAD : CREAM}
                  uiTransform={{ width: 34, height: 32 }}
                  textAlign="middle-center"
                />
              </UiEntity>
            )
          })}
          <Label value={`${game.playedTotal}`} fontSize={18} color={CREAM} uiTransform={{ width: 52, height: 32 }} textAlign="middle-center" />
        </UiEntity>
        <Label
          value={`Par ${TOTAL_PAR}    ${toPar(game.toPar)}`}
          fontSize={14}
          color={game.toPar <= 0 ? GOOD : BAD}
          uiTransform={{ width: '100%', height: 22, margin: { top: 2 } }}
          textAlign="middle-center"
        />
      </UiEntity>
      ) : null}

      {leaderboard()}

      {/* ---- callout ---- */}
      {s.toast ? (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: SAFE.toastTop },
            width: '100%',
            height: 128,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <UiEntity
            uiTransform={{
              // The frame's border overlaps the box by its own thickness, so a
              // panel sized to exactly fit its text loses a slice of the last
              // line under the bottom edge. Padding is not optional on a
              // framed panel — it is what keeps the content inside the frame.
              width: 700,
              height: 108,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: { top: 16, bottom: 16, left: 20, right: 20 }
            }}
            uiBackground={panel()}
          >
            <Bold
              value={s.toast.title}
              fontSize={30}
              color={s.toast.tone === 'good' ? GOLD : s.toast.tone === 'bad' ? BAD : CREAM}
              outline={SHADOW}
              spread={2}
              width={640}
              height={38}
            />
            <Label value={s.toast.detail} fontSize={16} color={DIM} uiTransform={{ width: 640, height: 24 }} textAlign="middle-center" />
          </UiEntity>
        </UiEntity>
      ) : null}

      {/* ---- bottom centre: dialog, the meter, or what to press ---- */}
      {currentNode() ? (
        dialog()
      ) : finished ? (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { bottom: SAFE.bottom },
            width: '100%',
            height: 96,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <UiEntity
            uiTransform={{ width: 780, height: 80, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            uiBackground={panel()}
          >
            <Label
              value={`ROUND COMPLETE    ${game.playedTotal}  (${toPar(game.toPar)})`}
              fontSize={26}
              color={GOLD}
              uiTransform={{ width: 760, height: 36 }}
              textAlign="middle-center"
            />
            <Label value="Press E to play the course again" fontSize={17} color={CREAM} uiTransform={{ width: 760, height: 26 }} textAlign="middle-center" />
          </UiEntity>
        </UiEntity>
      ) : (
        <UiEntity
          uiTransform={{
            // One band across the bottom rather than a button in the corner and
            // a prompt in the middle. Reset sits beside the meter with a
            // matching spacer opposite, so the meter stays dead centre whether
            // the button is there or not.
            positionType: 'absolute',
            position: { bottom: SAFE.bottom },
            width: '100%',
            height: 110,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
        >
          {/*
            One band, three slots: reset on the left, the prompt or the meter in
            the middle, quests on the right.

            The left slot keeps its width when there is no reset button to put
            in it, so the middle stays the middle whether you are signed on or
            not — the quest button is always there, and without a matching space
            opposite it everything drifts left.

            Except when quests is the only thing in the band. Walking about the
            island off the course, there is no reset button and nothing to
            prompt, so the row held one spacer and one button and centred the
            pair — which put QUESTS half a spacer to the right of centre and
            looked like a mistake, because it was one. With nothing to balance
            against, the spacer goes and the button centres on its own.
          */}
          {alone ? null : playing ? (
            <UiEntity
              uiTransform={{
                width: QUEST_BUTTON_W,
                height: 52,
                margin: { right: 14 },
                alignItems: 'center',
                justifyContent: 'center'
              }}
              uiBackground={panel()}
              onMouseDown={() => game.resetBall()}
            >
              <Bold value="RESET BALL" fontSize={18} color={GOLD} outline={SHADOW} spread={1} width={QUEST_BUTTON_W - 20} height={28} />
            </UiEntity>
          ) : (
            <UiEntity uiTransform={{ width: QUEST_BUTTON_W + 14, height: 52 }} />
          )}

          {s.phase === 'swinging' ? (
            meter()
          ) : hint ? (
            <UiEntity
              uiTransform={{ width: 480, height: 46, alignItems: 'center', justifyContent: 'center' }}
              uiBackground={chip()}
            >
              <Label
                value={hint}
                fontSize={18}
                color={s.phase === 'address' ? GOLD : CREAM}
                uiTransform={{ width: 430, height: 28 }}
                textAlign="middle-center"
              />
            </UiEntity>
          ) : null}

          {questButton(alone)}
        </UiEntity>
      )}

      {inventory()}

      {questPanel()}

      {adminPanel()}

      {/*
        Last, so nothing draws over it. Later siblings sit on top, and the shop
        and the quest panel are both full-screen — a level-up that arrived while
        one was open would otherwise happen behind it.
      */}
      {levelUp()}
    </UiEntity>
  )
}

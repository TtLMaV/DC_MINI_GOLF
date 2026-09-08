import { isMobile } from '@dcl/sdk/platform'

import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, PositionUnit, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { COCONUTS, COCONUTTY, POINTS, SALLY, SHELLMAN, SHOT, SWING, SHELLS } from './config'
import { HOLES, SECRET, TOTAL_PAR } from './course'
import { shellsCarried } from './shells'
import { coconutsCarried } from './coconuts'
import { drinkIsUp, drinkLeft } from './drink'
import { levelUpBanner } from './levelup'
import { detectorHeat, detectorIsOut, detectorNearest, overFind, scrapCarried } from './detector'
import { Game } from './game'
import { setting, toggleSetting } from './settings'
import { myUserId, roster } from './net'
import { choose, currentNode, nodeChoices, nodeText, speakerName } from './npc'
import { balance, grantPoints, pointsAreLocal, pointsStatus, pointsVisible,
  claimedKeys,
  coconutsToday,
  playerStanding,
  shellsToday
} from './points'
import { adminFinish, adminTake, allQuests, giverName, questById, questsByStatus } from './quests'
import {
  BAD,
  BORDER,
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
 * The canvas is set to the 'device' inset on both platforms, so it is the
 * usable screen and nothing is held back for us. Keeping clear of the
 * explorer's own controls is therefore done here: its interaction button sits
 * bottom centre and its action buttons bottom right, and the docs are explicit
 * that they overlap the UI area deliberately — so anything the player has to
 * tap is kept away from that corner, edgeGap() holds the columns off the
 * sides, and bottomGap() lifts the bottom cluster clear of the button.
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
 * Whether this is a phone, asked once and remembered.
 *
 * Called from inside the render, which runs every frame, so it is cached
 * rather than asked each time. isMobile() is cheap but the answer cannot
 * change mid-session, and a try/catch in a hot path is worth avoiding.
 */
/**
 * The gap between two chips in the top strip.
 *
 * Wider on a phone. Ten pixels reads as a hairline on a screen where the
 * canvas is squeezed into a third of the physical width, and five panels
 * separated by hairlines read as one long panel with lines drawn on it.
 */
const chipGap = () => (onPhone() ? 18 : 10)

/**
 * How far the corner panels sit in from the edge.
 *
 * More on a phone. 24 was chosen against a desktop canvas with room to spare;
 * on a phone it puts a framed panel hard against the edge of the screen with
 * its own border doing the job of a margin, which is what makes the left-hand
 * column look jammed rather than placed.
 *
 * 56 rather than 40 since the canvas went to 'device': the left edge is now
 * the actual edge of the glass instead of a quarter of the way in, so this is
 * the only thing holding the column off it.
 */
const edgeGap = () => (onPhone() ? 56 : SAFE.edge)

/**
 * How far the bottom cluster sits above the foot of the screen.
 *
 * Higher on a phone, and for a reason that only applies there: the explorer
 * draws its interaction button bottom centre and its action buttons bottom
 * right, deliberately over the UI area. 'interactable' used to hold us clear
 * of them by shrinking the whole canvas; on 'device' nothing does, so this
 * does it — locally, and without moving anything else.
 */
const bottomGap = () => (onPhone() ? '22%' : SAFE.bottom)

/**
 * How tall a chip in the top strip is.
 *
 * 88, up from 62, and every pixel of the difference is the frame's. The panel
 * frame draws 24 pixels of carved border on every side (theme's BORDER), so a
 * 62-tall chip had fourteen pixels of clear middle for a 24-point number to
 * live in — which is why the strip read as text jammed between two gold rules
 * rather than text inside a frame. 88 leaves forty, which is room for the
 * number and room around it.
 */
const STRIP_H = 88

/**
 * The band the strip is allowed to occupy: two rows of chips and a gap.
 *
 * The strip wraps, and does so in earnest once a colada and the detector are
 * both up. A container shorter than what wraps into it clips the second row.
 */
const STRIP_BAND = STRIP_H * 2 + 12

/**
 * Padding inside a panel-framed box: the frame's own 24, plus 10 to breathe.
 *
 * Used sideways, where there is always room for it. FRAME_PAD_Y is the bare
 * border with nothing added, for boxes stacking two rows inside a strip chip
 * where those ten pixels are the difference between fitting and not.
 */
const FRAME_PAD = BORDER.panel + 10
const FRAME_PAD_Y = BORDER.panel

let phone: boolean | null = null

function onPhone(): boolean {
  if (phone === null) {
    try {
      phone = isMobile()
    } catch {
      phone = false
    }
  }
  return phone
}

/**
 * The E key, drawn the way this device actually offers it.
 *
 * A phone has no keyboard. The client draws an action button down the
 * right-hand side instead, and index.ts dresses that button in the scene's
 * own putter art rather than a letter. So "press E" on a phone points at a
 * key that is not there, next to a button wearing a picture nobody has been
 * told the meaning of.
 *
 * Every prompt that would name the key shows this instead on a phone: the
 * same picture, in the sentence, so the instruction and the thing you tap
 * look like each other. Desktop keeps the letter, because desktop has one.
 *
 * The size is passed in rather than fixed. These sit in lines of type at
 * three different sizes, and an icon that ignores the line it is in reads as
 * a sticker rather than as a word.
 */
const E_ICON = 'assets/scene/ui/icons/swing.png'

function eIcon(size: number, margin: { left?: number; right?: number } = {}) {
  return (
    <UiEntity
      uiTransform={{ width: size, height: size, margin }}
      uiBackground={{ texture: { src: E_ICON }, textureMode: 'stretch' }}
    />
  )
}

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
        // 172, not 128: the label and the number come to 104 and the frame
        // takes 34 a side. It was 128 with 16 a side, so the P of PP was under
        // the border art and the number was sitting on the opposite rule.
        width: 178,
        height: STRIP_H,
        margin: { left: chipGap() },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: FRAME_PAD, right: FRAME_PAD }
      }}
      uiBackground={panel()}
    >
      <Label
        value={pointsAreLocal() ? `${POINTS.short}*` : POINTS.short}
        fontSize={16}
        color={DIM}
        uiTransform={{ width: 34, height: 36 }}
        textAlign="middle-left"
      />
      <Bold value={pointsStatus() === 'loading' ? '\u2014' : `${balance()}`} fontSize={24} color={GOLD} outline={SHADOW} spread={1} width={70} height={36} textAlign="middle-right" />
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

  // Never quite empty. A bar showing a hair of progress reads as a bar; one
  // showing none reads as a line under the text, and the first thing a new
  // player sees would be the version that looks like a mistake.
  const filled = loading ? 0 : Math.max(3, Math.round(me.fraction * 100))

  return (
    <UiEntity
      uiTransform={{
        // Two rows inside a frame that takes 24 off the top and 24 off the
        // bottom, so the vertical padding here is the bare border and the 40
        // that is left is spent exactly: 30 of row, 4 of gap, 6 of bar.
        width: 236,
        height: STRIP_H,
        margin: { left: chipGap() },
        flexDirection: 'column',
        justifyContent: 'center',
        padding: { left: FRAME_PAD, right: FRAME_PAD, top: FRAME_PAD_Y, bottom: FRAME_PAD_Y }
      }}
      uiBackground={panel()}
    >
      <UiEntity uiTransform={{ width: '100%', height: 30, flexDirection: 'row', alignItems: 'center' }}>
        <Label
          value={loading ? '' : me.rank.name}
          fontSize={16}
          color={DIM}
          uiTransform={{ width: 116, height: 30 }}
          textAlign="middle-left"
        />
        <Bold
          value={loading ? '\u2014' : `${me.level}`}
          fontSize={24}
          color={GOLD}
          outline={SHADOW}
          spread={1}
          width={46}
          height={30}
          textAlign="middle-right"
        />
      </UiEntity>

      {/*
        How far into this level, not how far up the ladder.

        standing() has carried `fraction` since it was written and nothing has
        ever drawn it. Same 6px bar as the detector's heat, because they are the
        same idea and two differently-shaped bars in one strip would read as two
        different meanings.

        At the cap it goes green and stays full: there is no next level to fill,
        and a gold bar sitting at 100 forever looks like something is stuck.
      */}
      <UiEntity
        uiTransform={{ width: '100%', height: 6, margin: { top: 4 } }}
        uiBackground={{ color: SHADOW }}
      >
        <UiEntity
          uiTransform={{ width: `${filled}%`, height: 6 }}
          uiBackground={{ color: me.capped ? GOOD : GOLD }}
        />
      </UiEntity>
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
        width: 212,
        height: STRIP_H,
        margin: { left: chipGap() },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: FRAME_PAD, right: FRAME_PAD }
      }}
      uiBackground={panel()}
    >
      <Label
        value="COLADA"
        fontSize={16}
        color={DIM}
        uiTransform={{ width: 82, height: 36 }}
        textAlign="middle-left"
      />
      <Bold
        value={`${mm}:${ss < 10 ? '0' : ''}${ss}`}
        fontSize={24}
        color={ending ? BAD : GOOD}
        outline={SHADOW}
        spread={1}
        width={56}
        height={36}
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
        width: 232,
        height: STRIP_H,
        margin: { left: chipGap() },
        flexDirection: 'column',
        justifyContent: 'center',
        padding: { left: FRAME_PAD, right: FRAME_PAD, top: FRAME_PAD_Y, bottom: FRAME_PAD_Y }
      }}
      uiBackground={panel()}
    >
      <UiEntity uiTransform={{ width: '100%', height: 30, flexDirection: 'row', alignItems: 'center' }}>
        {/*
          The key it names is the one you have. A phone has no E, and this chip
          is only on screen while the detector is out, which is the one activity
          where you are being told to press something every few seconds.
        */}
        <UiEntity uiTransform={{ width: 118, height: 30, flexDirection: 'row', alignItems: 'center' }}>
          <Label
            value={on ? (onPhone() ? 'DIG' : 'DIG  (E)') : something ? 'SWEEPING' : 'NOTHING'}
            fontSize={15}
            color={on ? GOOD : DIM}
            uiTransform={{ width: on && onPhone() ? 40 : 118, height: 30 }}
            textAlign="middle-left"
          />
          {on && onPhone() ? eIcon(22) : null}
        </UiEntity>
        <Label
          value={`${carried}`}
          fontSize={17}
          color={GOLD}
          uiTransform={{ width: 40, height: 30 }}
          textAlign="middle-right"
        />
      </UiEntity>

      <UiEntity uiTransform={{ width: '100%', height: 6, margin: { top: 4 } }} uiBackground={{ color: SHADOW }}>
        <UiEntity
          uiTransform={{ width: `${Math.round(heat * 100)}%`, height: 6 }}
          uiBackground={{ color: on ? GOOD : GOLD }}
        />
      </UiEntity>
    </UiEntity>
  )
}

/**
 * The hub: open or shut, which top tab, and which quest sub-tab.
 *
 * Kept here rather than in quests.ts because nothing outside the HUD opens it.
 * The shop's state lives in shop.ts for the opposite reason: an NPC opens that
 * one, so it needs a handle the dialogue can reach.
 *
 * The tab is remembered between openings rather than reset. Somebody who came
 * in to swap a club is usually coming back to swap it again, and starting on
 * QUESTS every time makes the panel feel like it forgot.
 */
type QuestTab = 'active' | 'available' | 'done'
type HubTab = 'quests' | 'gear' | 'stash' | 'settings'
/**
 * The backpack on the hub button.
 *
 * It said HUB in gold, which is a word for a thing rather than the thing. The
 * bag is what the panel actually is — your quests, your clubs and balls, and
 * whatever you are carrying — and it survives being 30 pixels wide on a phone
 * in a way a five-letter word does not.
 *
 * White art, tinted at the point of use rather than in the file, so one PNG
 * covers both the resting state and the one that wants your attention.
 */
const HUB_ICON = 'assets/scene/ui/icons/backpack.png'

/**
 * The chevrons on the cards button.
 *
 * Same treatment as the backpack: white art, one file, tinted or lit at the
 * point of use. It points the way the tray comes out of.
 */
const CARDS_ICON = 'assets/scene/ui/icons/cards.png'

let hubOpen = false
/**
 * Whether the phone's card tray is out.
 *
 * Phones only. On a desktop the scorecard and the standings live in the top
 * right corner permanently and there is room for them; on a phone there is
 * not, and the version where they sat down the left was the whole of the
 * screen you are trying to putt through. So they come out on a button and go
 * away again, and the default is away.
 */
let cardsOpen = false
/**
 * Whether LEAVE ROUND has been pressed once.
 *
 * Leaving tears the card up, and a card is twenty minutes of somebody's
 * evening. One press arms it and a second does it, and anything that shuts the
 * panel disarms it again — so the dangerous press is never the one your thumb
 * lands on by accident on the way to the X.
 */
let leaveArmed = false
let hubTab: HubTab = 'quests'
/**
 * Which half of the test panel is showing.
 *
 * The panel was full before the quests arrived: the title, two free holes, the
 * whole catalogue and nine hole rows already come to more than its 800. Two
 * tabs rather than a taller panel, because a panel taller than the canvas does
 * not scroll, it squeezes.
 */
type AdminTab = 'holes' | 'stock' | 'quests'
let adminTab: AdminTab = 'holes'
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
/**
 * The one way into the hub.
 *
 * It still leads with the quests when there are any, because a finished quest
 * is the only thing in here that is worth interrupting a round for. With
 * nothing outstanding it goes back to saying HUB, which is what it is.
 */
/**
 * What the hub button is showing, and how wide that makes it.
 *
 * The count is the one thing the old HUB wording carried that a picture
 * cannot, so it survives as a digit beside the bag and only when there is a
 * number to say. With nothing running the button is the backpack and nothing
 * else, which is the whole point of it being a backpack.
 *
 * Square at 62 without the digit, because 62 is the height of every chip in
 * the strip it lives in.
 */
function hubState(): { ready: number; badge: string; width: number } {
  const { active } = questsByStatus()
  const ready = active.filter((a) => a.status === 'complete').length
  const badge = ready > 0 ? `${ready}` : active.length > 0 ? `${active.length}` : ''
  return { ready, badge, width: badge ? STRIP_H + 34 : STRIP_H }
}

/**
 * The bag, on the end of the top strip next to the player's rank.
 *
 * It was in the bottom band with the shot controls, which is the wrong company
 * for it: reset, the meter and the prompt are all about the ball in front of
 * you and go away between shots, and the hub is everything that is not this
 * shot. Beside the rank it is with the rest of what you have got — points,
 * level, what you are carrying — and it is in the same place in a round, on
 * the practice green and standing about, which is what makes it findable.
 *
 * Chip-height and chip-spaced so it sits in the row rather than on the end of
 * it, but drawn on the button frame rather than the panel one, because every
 * other thing in this HUD you can press is drawn that way and it is the only
 * thing in the strip that does anything when you press it.
 */
function hubButton() {
  const { ready, badge, width } = hubState()

  return (
    <UiEntity
      uiTransform={{
        width,
        height: STRIP_H,
        margin: { left: chipGap() },
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={button(hubOpen ? PICKED : undefined)}
      onMouseDown={() => {
        hubOpen = !hubOpen
        leaveArmed = false
        // One panel at a time on a phone. The hub is 800 tall and the tray
        // reaches half way down the right-hand side; both up at once is the
        // whole screen covered, which is not a state worth being able to
        // reach by accident.
        if (hubOpen) cardsOpen = false
      }}
    >
      <UiEntity
        uiTransform={{ width: 38, height: 38 }}
        // Tinted green when something is waiting to be handed in, which is the
        // only state in here worth interrupting a round for. The art is white,
        // so the tint multiplies cleanly; if an explorer ignores the tint the
        // worst case is a white bag next to a green number.
        uiBackground={
          ready > 0
            ? { texture: { src: HUB_ICON }, textureMode: 'stretch', color: GOOD }
            : { texture: { src: HUB_ICON }, textureMode: 'stretch' }
        }
      />
      {badge ? (
        <Bold
          value={badge}
          fontSize={17}
          color={ready > 0 ? GOOD : GOLD}
          outline={SHADOW}
          spread={1}
          width={26}
          height={28}
        />
      ) : null}
    </UiEntity>
  )
}

/**
 * The cards button, next to the bag. Phones only.
 *
 * It opens the tray on the right holding the scorecard and the standings —
 * the two panels that are permanently on screen on a desktop and cannot be on
 * a phone. Both are things you look at between shots and neither is something
 * you need while the ball is moving, which is what makes them a tray rather
 * than furniture.
 *
 * Drawn as the twin of the hub button on purpose: same 62-pixel box, same
 * button frame, same lit background when its panel is open. Two buttons that
 * do the same kind of thing should not look like two different kinds of
 * control.
 *
 * Nothing to show, no button. Off the course with nobody playing the tray is
 * empty, and a button that opens an empty panel is a button that teaches
 * people not to press buttons.
 */
function cardsButton() {
  if (!onPhone()) return null
  if (!hasCards()) return null

  return (
    <UiEntity
      uiTransform={{
        width: STRIP_H,
        height: STRIP_H,
        margin: { left: chipGap() },
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={button(cardsOpen ? PICKED : undefined)}
      onMouseDown={() => {
        cardsOpen = !cardsOpen
        if (cardsOpen) hubOpen = false
      }}
    >
      <UiEntity
        uiTransform={{ width: 38, height: 38 }}
        uiBackground={
          cardsOpen
            ? { texture: { src: CARDS_ICON }, textureMode: 'stretch', color: GOLD }
            : { texture: { src: CARDS_ICON }, textureMode: 'stretch' }
        }
      />
    </UiEntity>
  )
}

/** Whether the tray has anything in it: a card of your own, or a field. */
function hasCards(): boolean {
  const playing = game.state.joined && game.state.phase !== 'finished'
  return playing || roster().length > 0
}

/**
 * The most rows the panel will draw.
 *
 * There are fifteen quests in the scene and the explorer's UI has no scrolling
 * to offer, so a COMPLETED tab with all of them on it came out 1116 pixels tall
 * against a 1080 canvas — the bottom rows simply off the screen, with nothing
 * saying so. The overflow is stated in a line underneath rather than silently
 * dropped.
 *
 * Different on the two platforms, because the canvases are: a desktop draws
 * 1080 of height and a phone 720, and a number tuned for one of those is the
 * wrong number for the other. Five phone rows plus the panel's furniture is
 * 628; six would be 706, which fits only until anything else is ever added.
 * Seven on a desktop comes to 784 of 1080.
 */
function maxQuestRows(): number {
  return onPhone() ? 5 : 7
}

/**
 * A row, and everything above the rows.
 *
 * Worked out rather than guessed, because a panel an inch too short does not
 * clip its last row, it squeezes all of them: every child of a flex column
 * shrinks to fit, so the 62 of row becomes 54 and the detail line under each
 * name gets sliced through the middle. The rows looked wrong and the height
 * was what was wrong.
 *
 * PANEL_CHROME is 22 of padding top and bottom, the 40 title row, the 48 of
 * top tabs and the 48 of the second row, which every tab has: sub-tabs on two
 * of them and a line of explanation on the third.
 */
// LIST_ROW_H rather than ROW_H: the leaderboard further down this file has a
// ROW_H of its own, at 30, and two constants with one name in one module is a
// build error rather than a subtle bug, which at least says so plainly.
/**
 * A row you press, and the gap under it.
 *
 * LIST_ROW is 48 of content inside the button frame's 12-pixel bevel, top and
 * bottom. It was 62 with 52 of content, which put the name and the line under
 * it seven pixels into the carved border at each end — every row in every menu
 * had its text crossing its own frame.
 *
 * GEAR_ROW keeps its 40 and pays for the room a different way; see itemRow.
 */
const LIST_ROW = 48 + 2 * BORDER.button
const GEAR_ROW = 40
const LIST_ROW_GAP = 6
const LIST_ROW_H = LIST_ROW + LIST_ROW_GAP
const GEAR_ROW_H = GEAR_ROW + LIST_ROW_GAP
/**
 * Everything above the rows: the padding, the title row and the two rows of
 * tabs. Each of those grew with the buttons in it, for the same reason the
 * rows did.
 */
/**
 * The speaker's name in a conversation, and the gap under it.
 *
 * Written down rather than typed into both the layout and the height sum,
 * because the two disagreeing is precisely the bug this pair was added to fix.
 */
const NAME_H = 28
const NAME_GAP = 10

const TITLE_ROW_H = 26 + 2 * BORDER.button
const TAB_ROW_H = TITLE_ROW_H + 8
const PANEL_CHROME = 22 + TITLE_ROW_H + TAB_ROW_H + TAB_ROW_H + 22
/** The crate has no second row of tabs, so it is one row shorter. */
const CRATE_CHROME = 22 + TITLE_ROW_H + TAB_ROW_H + 22

/**
 * A top-level tab. Same furniture as the quest sub-tabs on purpose: two rows
 * of buttons that looked different would read as two unrelated controls.
 */
/**
 * One setting: a name, a line saying what it does, and its state on the right.
 *
 * Built like itemRow rather than like a checkbox, because the panel already
 * has a language for "a row you press to change something" and a second one
 * would be a second thing to learn for no gain. The whole row is the control.
 */
function toggleRow(id: string, label: string, detail: string, on: boolean, flip: () => void) {
  return (
    <UiEntity
      key={`set-${id}`}
      uiTransform={{
        width: '100%',
        height: LIST_ROW,
        flexShrink: 0,
        margin: { bottom: LIST_ROW_GAP },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: BORDER.button + 10, right: BORDER.button + 10 }
      }}
      uiBackground={button(on ? PICKED : undefined)}
      onMouseDown={flip}
    >
      <UiEntity uiTransform={{ width: 534, height: 48, flexDirection: 'column', justifyContent: 'center' }}>
        <Label value={label} fontSize={19} color={CREAM} uiTransform={{ width: 534, height: 26 }} textAlign="middle-left" />
        <Label value={detail} fontSize={14} color={DIM} uiTransform={{ width: 534, height: 20 }} textAlign="middle-left" />
      </UiEntity>
      <Label
        value={on ? 'ON' : 'OFF'}
        fontSize={15}
        color={on ? GOOD : DIM}
        uiTransform={{ width: 130, height: 30 }}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

function hubTabButton(tab: HubTab, label: string, count: number) {
  const here = hubTab === tab
  return (
    <UiEntity
      key={`bag-${tab}`}
      // 168 rather than the 176 it was. A fourth tab arrived and four at the
      // old width came to 736 against 708 of usable panel, which flex answers
      // by shrinking all of them and clipping the words inside.
      //
      // The gap is 4 either side rather than 8 on the right. A trailing margin
      // on the last tab is half a gap of dead space on one end of the row and
      // none on the other, which is what stopped a centred row looking centred.
      uiTransform={{ width: 168, height: TITLE_ROW_H, margin: { left: 4, right: 4 }, alignItems: 'center', justifyContent: 'center' }}
      uiBackground={button(here ? PICKED : undefined)}
      onMouseDown={() => {
        hubTab = tab
        leaveArmed = false
      }}
    >
      <Label
        value={count > 0 ? `${label}  ${count}` : label}
        fontSize={16}
        color={here ? GOLD : DIM}
        uiTransform={{ width: 144, height: 26 }}
        textAlign="middle-center"
      />
    </UiEntity>
  )
}

function questTabButton(tab: QuestTab, label: string, count: number) {
  const here = questTab === tab
  return (
    <UiEntity
      // 226 so that three of these come to the same 704 as the four tabs above
      // them. They were 176, which left the sub-row 152 short and sitting hard
      // against the left edge under a row that filled the panel.
      uiTransform={{ width: 226, height: TITLE_ROW_H, margin: { left: 4, right: 4 }, alignItems: 'center', justifyContent: 'center' }}
      uiBackground={button(here ? PICKED : undefined)}
      onMouseDown={() => {
        questTab = tab
      }}
    >
      <Label
        value={count > 0 ? `${label}  ${count}` : label}
        fontSize={17}
        color={here ? GOLD : DIM}
        uiTransform={{ width: 202, height: 26 }}
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
function listRow(
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
        height: LIST_ROW,
        // Never squashed to make a too-small panel fit. If the sums above are
        // ever wrong again the panel overflows, which is visible and fixable,
        // rather than every row quietly losing eight pixels of text.
        flexShrink: 0,
        margin: { bottom: LIST_ROW_GAP },
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: BORDER.button + 10, right: BORDER.button + 10 }
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
      <UiEntity uiTransform={{ width: 400, height: 48, flexDirection: 'column', justifyContent: 'center' }}>
        <Label value={name} fontSize={19} color={nameColour} uiTransform={{ width: 400, height: 26 }} textAlign="middle-left" />
        <Label value={detail} fontSize={15} color={DIM} uiTransform={{ width: 400, height: 20 }} textAlign="middle-left" />
      </UiEntity>
      <Label
        value={right}
        fontSize={16}
        color={rightColour}
        uiTransform={{ width: 264, height: 30 }}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

/**
 * What is in the stash, as rows.
 *
 * All three are listed whether or not you have any. An empty line that names
 * the thing and says who wants it is how somebody finds out coconuts are worth
 * picking up; a list that hides what you have none of only ever tells you
 * things you already know.
 *
 * The daily limit is on the right rather than buried in the detail, because it
 * is the one fact that changes what you do next: past it, another armful is
 * worth nothing until tomorrow.
 */
function carried() {
  const shells = shellsCarried()
  const coconuts = coconutsCarried()
  const scrap = scrapCarried()

  const shellsLeft = Math.max(0, SHELLS.dailyLimit - shellsToday())
  const coconutsLeft = Math.max(0, COCONUTS.dailyLimit - coconutsToday())

  return [
    {
      key: 'stash-shells',
      name: 'Shells',
      detail: `${SHELLMAN.name} wants them, down on the south beach.`,
      right: shellsLeft > 0 ? `${shells}` : `${shells}  ·  limit reached today`,
      held: shells
    },
    {
      key: 'stash-coconuts',
      name: 'Coconuts',
      detail: `${COCONUTTY.name} wants them, up by the palms.`,
      right: coconutsLeft > 0 ? `${coconuts}` : `${coconuts}  ·  limit reached today`,
      held: coconuts
    },
    {
      key: 'stash-scrap',
      name: 'Scrap',
      detail: `Dug up with the detector. ${SALLY.name} can use it.`,
      right: `${scrap}`,
      held: scrap
    }
  ]
}

/**
 * The hub.
 *
 * Same furniture as the crate: a panel, a title row, a row of tabs, a list.
 * They are the same kind of thing, and a scene with two different full-screen
 * list layouts is a scene that looks like two people built it.
 *
 * Three tabs, and the split is by what you would do rather than by where the
 * thing came from. QUESTS is what you owe somebody, GEAR is what you swing,
 * STASH is what you are carrying to hand in. Clubs and balls stay behind the
 * sub-tabs they already had rather than being flattened into one long list,
 * because the explorer's UI has no scrolling and a list that runs past the
 * bottom of the canvas simply loses its last rows with nothing saying so.
 *
 * Height is worked out per tab and the tallest one wins, so the panel does not
 * jump about as you click between them.
 */
function hubPanel() {
  // Shut by anything that takes the screen for itself. A conversation and a
  // full-screen list at once is two things wanting the same attention, and the
  // flag is cleared rather than just the drawing skipped so the button does not
  // sit there lit up over a panel nobody can see.
  if (currentNode() || shopOpen()) {
    hubOpen = false
    leaveArmed = false
  }
  if (!hubOpen) return null

  const { active, available, done } = questsByStatus()
  const ready = active.filter((a) => a.status === 'complete').length

  // ---- quests ------------------------------------------------------------
  const questRows =
    questTab === 'active'
      ? active.slice(0, maxQuestRows()).map(({ quest, done: got, status }) =>
          listRow(
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
        ? available.slice(0, maxQuestRows()).map((quest) =>
            listRow(quest.id, quest.name, quest.objective, `Speak to ${giverName(quest.giver)}`, GOLD, CREAM)
          )
        : done.slice(0, maxQuestRows()).map((quest) =>
            listRow(quest.id, quest.name, quest.objective, `+${quest.reward} ${POINTS.short}`, DIM, DIM)
          )

  const shown =
    questTab === 'active' ? active.length : questTab === 'available' ? available.length : done.length
  const hidden = Math.max(0, shown - maxQuestRows())

  const nothing =
    questTab === 'active'
      ? 'Nothing on the go. Have a word with somebody.'
      : questTab === 'available'
        ? 'Nothing on offer. Finish what you have started.'
        : 'Nothing finished yet.'

  // ---- gear --------------------------------------------------------------
  const kind = shopTab()
  const stock = itemsOfKind(kind)
  const purse = balance()

  // ---- stash -------------------------------------------------------------
  const stash = carried()

  // ---- settings ----------------------------------------------------------
  const settingRows = [
    toggleRow(
      'prompts',
      'Hide prompts',
      'Turns off the line at the bottom of the screen telling you what to do next.',
      setting('hidePrompts'),
      () => toggleSetting('hidePrompts')
    ),
    toggleRow(
      'talk',
      'Talk during rounds',
      'Lets the characters stop you for a word mid-round. Never during a shot.',
      setting('talkInRounds'),
      () => toggleSetting('talkInRounds')
    )
  ]

  // ---- the title row ------------------------------------------------------
  // RESET and LEAVE come and go, and the two labels to their left give up the
  // room. Written as three cases rather than a sum because the sum was wrong
  // twice: 708 is all there is inside the padding, and a title row that
  // overruns it does not clip, it squeezes every child including the X.
  const phase = game.state.phase
  // Signed on, and in a phase where a reset would actually move the ball. It
  // used to be the phase test alone, which put it on the practice green as
  // well: there is nothing to rescue a ball from out there and no stroke worth
  // paying to do it, so it was a control offering to fix a problem that green
  // does not have.
  const canReset =
    game.state.joined && phase !== 'sinking' && phase !== 'between' && phase !== 'finished'
  const actions = (canReset ? 1 : 0) + (game.state.joined ? 1 : 0)
  const titleW = actions === 2 ? 190 : actions === 1 ? 240 : 300
  const purseW = actions === 2 ? 190 : actions === 1 ? 236 : 340

  // ---- how tall ----------------------------------------------------------
  // Tabs row, sub-tabs row, then the list. Worked out for the tab on show.
  const listHeight =
    hubTab === 'quests'
      ? Math.max(1, Math.min(maxQuestRows(), questRows.length)) * LIST_ROW_H
      + (hidden > 0 ? 28 : 0)
      : hubTab === 'gear'
        ? stock.length * GEAR_ROW_H + 30
        : hubTab === 'settings'
          ? settingRows.length * LIST_ROW_H
          : stash.length * LIST_ROW_H

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
          height: PANEL_CHROME + listHeight,
          flexDirection: 'column',
          padding: { top: 22, bottom: 22, left: 26, right: 26 }
        }}
        uiBackground={panel()}
      >
        {/* title row */}
        <UiEntity uiTransform={{ width: '100%', height: TITLE_ROW_H, flexDirection: 'row', alignItems: 'center' }}>
          <Bold value="HUB" fontSize={20} color={GOLD} outline={SHADOW} spread={1} width={titleW} height={30} textAlign="middle-left" />
          <Label
            value={hubTab === 'gear' ? `${purse}  ${POINTS.short}` : ''}
            fontSize={20}
            color={CREAM}
            uiTransform={{ width: purseW, height: 30 }}
            textAlign="middle-right"
          />
          {/*
            Reset, which used to be a 250-wide button parked in the bottom band
            for the whole of every round. It is pressed a handful of times an
            hour and it was taking permanent screen for it, so it lives up here
            with the other thing you do to a round rather than in it.

            Shown only when it would do something: mid-drop, between holes and
            at the end of the nine it returns without acting, and a button that
            sometimes silently does nothing is worse than one that is not there.
          */}
          {canReset ? (
            <UiEntity
              uiTransform={{ width: 116, height: TITLE_ROW_H, margin: { left: 8 }, alignItems: 'center', justifyContent: 'center' }}
              uiBackground={button()}
              onMouseDown={() => {
                hubOpen = false
                leaveArmed = false
                game.resetBall()
              }}
            >
              <Bold value="RESET" fontSize={16} color={GOLD} outline={SHADOW} spread={1} width={92} height={26} />
            </UiEntity>
          ) : null}
          {/*
            Leaving the course. Only while there is a round to leave, so it is
            not an inert control on the practice green — and armed by the first
            press rather than done by it, because the second press throws a card
            away and the X is right beside it.
          */}
          {game.state.joined ? (
            <UiEntity
              uiTransform={{ width: 116, height: TITLE_ROW_H, margin: { left: 8 }, alignItems: 'center', justifyContent: 'center' }}
              uiBackground={button(leaveArmed ? PICKED : undefined)}
              onMouseDown={() => {
                if (!leaveArmed) {
                  leaveArmed = true
                  return
                }
                leaveArmed = false
                hubOpen = false
                game.leaveRound()
              }}
            >
              <Bold
                value={leaveArmed ? 'SURE?' : 'LEAVE'}
                fontSize={16}
                color={leaveArmed ? BAD : GOLD}
                outline={SHADOW}
                spread={1}
                width={92}
                height={26}
              />
            </UiEntity>
          ) : null}
          {/*
            A close button as well as the HUB button, because the two are not
            the same gesture. The button that opened it is at the bottom of the
            screen and the panel is in the middle: having read a quest, the hand
            is already up here, and being sent back down to the thing you
            pressed a moment ago to undo it is the sort of small tax that makes
            a panel feel like hard work.
          */}
          <UiEntity
            uiTransform={{ width: 52, height: TITLE_ROW_H, margin: { left: 8 }, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={button()}
            onMouseDown={() => {
              hubOpen = false
              leaveArmed = false
            }}
          >
            <Bold value="X" fontSize={19} color={GOLD} outline={SHADOW} spread={1} width={28} height={26} textAlign="middle-center" />
          </UiEntity>
        </UiEntity>

        {/* top tabs */}
        <UiEntity uiTransform={{ width: '100%', height: TAB_ROW_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {hubTabButton('quests', 'QUESTS', ready)}
          {hubTabButton('gear', 'GEAR', 0)}
          {hubTabButton('stash', 'STASH', 0)}
          {hubTabButton('settings', 'SETTINGS', 0)}
        </UiEntity>

        {/* sub-tabs, which only two of the three want */}
        {hubTab === 'quests' ? (
          <UiEntity uiTransform={{ width: '100%', height: TAB_ROW_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {questTabButton('active', 'ACTIVE', active.length)}
            {questTabButton('available', 'AVAILABLE', available.length)}
            {questTabButton('done', 'COMPLETED', done.length)}
          </UiEntity>
        ) : hubTab === 'gear' ? (
          <UiEntity uiTransform={{ width: '100%', height: TAB_ROW_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {tabButton('club', 'CLUBS')}
            {tabButton('ball', 'BALLS')}
          </UiEntity>
        ) : (
          <UiEntity uiTransform={{ width: '100%', height: 48, alignItems: 'center' }}>
            <Label
              value={
                hubTab === 'settings'
                  ? 'How the game looks to you. Nobody else is affected.'
                  : 'What you are carrying. Hand it in to the person who wants it.'
              }
              fontSize={15}
              color={DIM}
              uiTransform={{ width: '100%', height: 26 }}
              textAlign="middle-left"
            />
          </UiEntity>
        )}

        {/* the list */}
        {hubTab === 'quests' ? (
          questRows.length > 0 ? (
            questRows
          ) : (
            <Label
              value={nothing}
              fontSize={16}
              color={DIM}
              uiTransform={{ width: '100%', height: 62 }}
              textAlign="middle-center"
            />
          )
        ) : hubTab === 'gear' ? (
          stock.map((item) => itemRow(item, purse >= item.price, false, true))
        ) : hubTab === 'settings' ? (
          settingRows
        ) : (
          stash.map((row) => listRow(row.key, row.name, row.detail, row.right, row.held > 0 ? GOLD : DIM, row.held > 0 ? CREAM : DIM))
        )}

        {/* footers */}
        {hubTab === 'quests' && hidden > 0 ? (
          <Label
            value={`and ${hidden} more`}
            fontSize={15}
            color={DIM}
            uiTransform={{ width: '100%', height: 26 }}
            textAlign="middle-center"
          />
        ) : null}

        {hubTab === 'gear' ? (
          <Label
            value="Tap an owned club or ball to hold it. Salt sells the rest, at the crate in the shack."
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
        height: 190 + 2 * BORDER.panel,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: 760,
          // 54 of the number, 30 of the rank and 32 of the line under them,
          // inside the frame's 24 top and bottom, plus 6 so the column is not
          // full to the millimetre. It was 168 with 18 of padding, so the big
          // number crossed the top border and the bottom line crossed the
          // other one.
          height: 122 + 2 * BORDER.panel,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: { top: FRAME_PAD_Y, bottom: FRAME_PAD_Y, left: FRAME_PAD, right: FRAME_PAD }
        }}
        uiBackground={panel()}
      >
        <Bold
          value={up.gained > 1 ? `LEVEL ${up.level}  (+${up.gained})` : `LEVEL ${up.level}`}
          fontSize={44}
          color={GOLD}
          outline={SHADOW}
          spread={3}
          width={692}
          height={54}
        />
        <Bold
          value={under}
          fontSize={20}
          color={up.newRank ? GOOD : CREAM}
          outline={SHADOW}
          spread={1}
          width={692}
          height={30}
        />
        {up.bonus > 0 ? (
          <Label
            value={`+${up.bonus} ${POINTS.short}`}
            fontSize={22}
            color={GOOD}
            uiTransform={{ width: 692, height: 32 }}
            textAlign="middle-center"
          />
        ) : (
          <Label
            value="Connect a wallet to be paid for these"
            fontSize={15}
            color={DIM}
            uiTransform={{ width: 692, height: 32 }}
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
/**
 * How wide the right-hand column of an item row is.
 *
 * 280, not the 130 it was, and the number comes from the longest thing that
 * column ever has to say rather than from the shortest. A price is four
 * characters and EQUIPPED is eight, but a club locked behind a quest says
 * "Quest: Where The Course Came From" — thirty-three characters, about 250
 * pixels, in a box built for 130. A Label does not clip, so the overflow was
 * simply drawn leftwards across the item's own name.
 */
const ACTION_W = 280
/** What fits in ACTION_W at this size, with a character to spare. */
const ACTION_CHARS = 34

function lockedLabel(item: Item): string {
  if (item.unlock.kind === 'quest') {
    const quest = questById(item.unlock.quest)
    if (!quest) return 'Quest reward'
    const line = `Quest: ${quest.name}`
    // Belt as well as braces: the column is sized for the longest quest in the
    // scene today, and this keeps it honest about the one written tomorrow.
    return line.length > ACTION_CHARS ? `${line.slice(0, ACTION_CHARS - 1)}\u2026` : line
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
/**
 * One club or ball.
 *
 * `canBuy` is what separates the crate from the bag. Standing in front of Salt
 * an unowned row is a price you can pay; in the bag it is a price you cannot,
 * because buying is a conversation with him and moving that into a panel would
 * quietly delete the reason he and the shack exist. Equipping is free of that:
 * it is your own kit, and being made to walk to a shop to change club is an
 * errand with nothing at the end of it.
 */
function itemRow(item: Item, canAfford: boolean, canBuy: boolean = true, compact: boolean = false) {
  const owned = isOwned(item.id)
  const worn = equippedId(item.kind) === item.id
  // Locked rows are shown rather than hidden. Half the point of a ladder is
  // seeing the rung above you, and a shop that silently grows is a shop nobody
  // knows they are working towards.
  const unlocked = isUnlocked(item, playerStanding().level, claimedKeys())

  const action = !unlocked
    ? lockedLabel(item)
    : worn
      ? 'EQUIPPED'
      : owned
        ? 'EQUIP'
        : canBuy
          ? `${item.price}`
          : `${item.price}  ·  SALT`
  const actionColour = !unlocked
    ? DIM
    : worn
      ? GOOD
      : owned
        ? GOLD
        : !canBuy
          ? DIM
          : canAfford
            ? GOLD
            : BAD

  return (
    <UiEntity
      key={item.id}
      uiTransform={{
        width: '100%',
        height: compact ? GEAR_ROW : LIST_ROW,
        flexShrink: 0,
        margin: { bottom: LIST_ROW_GAP },
        flexDirection: 'row',
        alignItems: 'center',
        // A compact row keeps the 40 it always had, because ten of them plus
        // the panel's furniture is already 700 of a phone's 720 — there is no
        // room to grow it. What changes is the frame: the chip's rule reaches
        // 8 in where the button's bevel reaches 12, which is the difference
        // between a 22-tall name fitting and sitting on the border.
        padding: compact
          ? { left: BORDER.chip + 10, right: BORDER.chip + 10 }
          : { left: BORDER.button + 10, right: BORDER.button + 10 }
      }}
      uiBackground={
        compact ? chip(worn ? PICKED : undefined) : button(worn ? PICKED : undefined)
      }
      onMouseDown={() => {
        // A locked row is inert. The server refuses it as well — this only
        // saves the round trip and the refusal toast.
        if (!unlocked) return
        if (owned) equip(item.id)
        else if (canBuy) buy(item.id)
      }}
    >
      {/*
        The blurb is worth a line at the crate, where you are deciding whether
        to part with the points, and is not worth one in the hub, where you are
        picking a club you already own by name. Dropping it is also what keeps
        ten clubs inside a phone's shorter canvas: at the full height the list
        came to 860 against the 720 a phone has to draw in.
      */}
      <UiEntity
        uiTransform={{
          // The two columns add up to what the row leaves: 672 in a compact
          // row on the chip frame, 664 in a full one on the button frame.
          width: (compact ? 672 : 664) - ACTION_W,
          height: compact ? 22 : 48,
          flexDirection: 'column',
          justifyContent: 'center'
        }}
      >
        <Label
          value={item.name}
          fontSize={compact ? 18 : 19}
          color={owned && unlocked ? CREAM : DIM}
          uiTransform={{ width: (compact ? 672 : 664) - ACTION_W, height: compact ? 22 : 26 }}
          textAlign="middle-left"
        />
        {compact ? null : (
          <Label
            value={item.blurb}
            fontSize={14}
            color={DIM}
            uiTransform={{ width: 664 - ACTION_W, height: 20 }}
            textAlign="middle-left"
          />
        )}
      </UiEntity>
      <Label
        value={action}
        // Smaller when it is a sentence rather than a number. "Quest: Where The
        // Course Came From" at 20 point is wider than any column this panel can
        // give it, and it is a note rather than a headline.
        fontSize={!unlocked ? 14 : owned ? 15 : 20}
        color={actionColour}
        uiTransform={{ width: ACTION_W, height: 30 }}
        textAlign="middle-right"
      />
    </UiEntity>
  )
}

function tabButton(kind: ItemKind, label: string) {
  const here = shopTab() === kind
  return (
    <UiEntity
      // Two tabs, so they are not stretched to the panel's width the way the
      // rows of three and four are. Wide enough to read as the same family,
      // centred rather than run to the edges.
      uiTransform={{ width: 240, height: TITLE_ROW_H, margin: { left: 4, right: 4 }, alignItems: 'center', justifyContent: 'center' }}
      uiBackground={button(here ? PICKED : undefined)}
      onMouseDown={() => setShopTab(kind)}
    >
      <Label value={label} fontSize={17} color={here ? GOLD : DIM} uiTransform={{ width: 216, height: 26 }} textAlign="middle-center" />
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
          // Same sum as the hub, and it was wrong here first: 96 never covered
          // the 44 of padding, the 40 title and the 48 of tabs, so every row in
          // the crate has been quietly squeezed by the difference.
          width: 760,
          height: CRATE_CHROME + stock.length * (onPhone() ? GEAR_ROW_H : LIST_ROW_H),
          flexDirection: 'column',
          padding: { top: 22, bottom: 22, left: 26, right: 26 }
        }}
        uiBackground={panel()}
      >
        {/* title row */}
        <UiEntity uiTransform={{ width: '100%', height: TITLE_ROW_H, flexDirection: 'row', alignItems: 'center' }}>
          <Bold value="PUTTS 'N' BALLS" fontSize={20} color={GOLD} outline={SHADOW} spread={1} width={300} height={30} textAlign="middle-left" />
          <Bold value={`${purse}  ${POINTS.short}`} fontSize={20} color={CREAM} outline={SHADOW} spread={1} width={400} height={30} textAlign="middle-right" />
        </UiEntity>

        {/* tabs */}
        <UiEntity uiTransform={{ width: '100%', height: TAB_ROW_H, flexDirection: 'row', alignItems: 'center' }}>
          {tabButton('ball', 'BALLS')}
          {tabButton('club', 'CLUBS')}
        </UiEntity>

        {/*
          Compact on a phone, which costs the one-line blurb and buys the
          whole list. Ten full rows are 780 tall before the panel's furniture
          and a phone canvas is 720, so the crate has been drawing its last
          three clubs off the bottom of the screen with nothing saying so.
          Compact rows come to 460 and every club is reachable again.
        */}
        {stock.map((item) => itemRow(item, purse >= item.price, true, onPhone()))}
      </UiEntity>

      <Label
        value="Walk away to close"
        fontSize={15}
        color={CREAM}
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

  /*
    A phone gets one stamp instead of eleven.

    This is the most expensive thing in the HUD by a distance. Faking weight and
    an outline costs a Label per stamp, eight for the ring and three for the
    fill, and the whole tree is rebuilt and diffed every frame. Eighteen Bolds
    on screen is around two hundred UI entities being reconciled every frame on
    a device that is also trying to run a physics loop.

    Desktop keeps the fake weight, because it can afford it and the numbers look
    better for it. On mobile the outline goes, the triple fill goes, and what is
    left is a single Label, which is what a Label was in the first place. The
    text comes out very slightly thinner and the frame is worth more than that.
  */
  const cheap = onPhone()

  const ring: [number, number][] =
    props.outline && !cheap
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

  /*
    flexShrink: 0, and it is not a nicety.

    Every stamp inside this container is absolutely positioned, so none of them
    shrink with it — squeeze the container and the text carries on being drawn
    at full size outside it, on top of whatever comes next. A Bold in a flex
    column that overruns by a hair is therefore the one child that gets crushed
    and the one child whose text does not go with it, which is exactly how a
    speaker's name ends up printed across the first line of their own dialogue.

    Unshrinkable, an overrun pushes the panel out of shape instead: visible,
    obviously wrong, and fixable. That is the trade this whole file makes.
  */
  return (
    <UiEntity uiTransform={{ width: props.width, height: props.height, flexShrink: 0 }}>
      {ring.map(([dx, dy], i) => stamp(dx, dy, props.outline!, `o${i}`))}
      {/* The weight itself: three fills, half a pixel apart in effect. */}
      {cheap ? null : stamp(1, 0, props.color, 'w1')}
      {cheap ? null : stamp(0, 1, props.color, 'w2')}
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

  const choices = nodeChoices(node)
  const text = nodeText(node)

  /**
   * How wide the box is.
   *
   * Narrower on a phone, and the number is chosen against the explorer's own
   * controls rather than against the text. 900 centred on a 1600 canvas runs
   * to 1250 and the action buttons start around 1220, so the last inch of
   * every choice row was under a thumb; 820 stops at 1210 and clears them.
   */
  const boxW = onPhone() ? 820 : 900

  /**
   * How tall this particular conversation is.
   *
   * It was a flat 262 whatever was in it. Sally's opening node is two lines of
   * text and five choices, which comes to 330 of content: everything inside
   * shrank to fit, the choices climbed over the second line of her speech, and
   * the sentence was cut off mid-word. The panel was not clipping, it was
   * squeezing.
   *
   * The line count is estimated rather than measured, because the engine will
   * not tell us how tall a wrapped label came out — so it is worked out from
   * the width actually available and deliberately pessimistic about how much
   * fits on a line. Eleven pixels a character at this size is more than any
   * character really takes, which is the point: over-estimating costs a strip
   * of empty frame and under-estimating costs the panel its shape.
   *
   * SLACK is the same insurance one step further out. A column that comes to
   * exactly its parent's height is one rounding error away from overflowing,
   * and an overflowing column shrinks whichever child is willing to — which,
   * for as long as this panel has existed, was the speaker's name.
   */
  const perLine = Math.max(20, Math.floor((boxW - 2 * FRAME_PAD) / 11))
  const lines = Math.max(1, Math.min(6, Math.ceil(text.length / perLine)))
  const textHeight = lines * 28
  const SLACK = 8
  const height =
    2 * BORDER.panel +
    NAME_H +
    NAME_GAP +
    textHeight +
    choices.length * (26 + 2 * BORDER.chip + 4) +
    SLACK

  return (
    <UiEntity
      uiTransform={{
        /*
          Low, not centred.

          It was centred, on the reasoning that every line of it is tappable
          and the bottom of a phone screen belongs to the explorer's own
          buttons. What that missed is where the character is: the
          conversation camera does not reframe anything, it locks the view
          exactly where you were standing, and you are stood 1.2 metres from
          somebody's face. Dead centre of the screen is precisely where they
          are, so the panel was drawn across the person talking.

          Sat low it clears their head and shoulders and still keeps its rows
          off the button cluster, which is what the 150 is for: a two- or
          three-choice conversation, which is nearly all of them, leaves the
          top half of the screen to the character.
        */
        positionType: 'absolute',
        position: { top: 0 },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: { bottom: onPhone() ? 96 : 120 }
      }}
    >
      <UiEntity
        uiTransform={{
          width: boxW,
          height,
          flexDirection: 'column',
          padding: { top: FRAME_PAD_Y, bottom: FRAME_PAD_Y, left: FRAME_PAD, right: FRAME_PAD }
        }}
        uiBackground={panel()}
      >
        {/* The name, and a gap under it that is counted in the height above.
            It had neither: it sat directly on the first line of speech with
            nothing between them, so even upright the two were touching. */}
        <UiEntity uiTransform={{ width: '100%', height: NAME_H, flexShrink: 0, margin: { bottom: NAME_GAP } }}>
          <Bold value={speakerName()} fontSize={20} color={GOLD} width="100%" height={NAME_H} textAlign="middle-left" />
        </UiEntity>
        <Label
          value={text}
          fontSize={18}
          color={CREAM}
          uiTransform={{ width: '100%', height: textHeight, flexShrink: 0 }}
          textAlign="top-left"
        />
        {choices.map((c, i) => (
          <UiEntity
            key={`${i}-${c.label}`}
            uiTransform={{
              width: '100%',
              height: 26 + 2 * BORDER.chip,
              flexShrink: 0,
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
      {/*
        Centred rather than right-aligned. The right-hand end of a phone screen
        is where the explorer keeps its own buttons, and a line of ours tucked
        in beside the F button reads as part of their UI rather than ours.
      */}
      <UiEntity
        uiTransform={{
          width: 300,
          height: 22 + 2 * BORDER.chip,
          margin: { top: 10 },
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={chip()}
      >
        <Label
          value="Walk away to close"
          fontSize={15}
          color={CREAM}
          uiTransform={{ width: 300 - 2 * BORDER.chip, height: 22 }}
          textAlign="middle-center"
        />
      </UiEntity>
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

  /**
   * One call, one inset, the same on both platforms.
   *
   * It used to set the renderer twice — 'device' at start-up, then again with
   * 'interactable' once the explorer answered — and two insets is the one
   * thing the docs tell you not to do. That was fixed by asking isMobile(),
   * which answers synchronously, and setting the renderer once.
   *
   * The remaining half of that bug was choosing 'interactable' on a phone.
   * It sounds right — keep the UI out from under the joystick and the action
   * buttons — but the inset it applies is nothing like the size of those
   * controls. Measured off a phone screenshot, the canvas it hands back starts
   * about 27% of the way across the display, so a panel anchored at left: 40
   * draws a third of the way in and the whole left-hand column lands in the
   * middle of the screen. That is exactly the "everything sits to the left,
   * not the centre" complaint, seen from the other side.
   *
   * 'device' is the honest answer on both. It is the usable screen minus the
   * notch and nothing else, which is what an anchor of "left" should mean. The
   * price is that keeping clear of the explorer's own furniture is now our job
   * rather than the inset's, and it is done where it belongs: edgeGap() holds
   * the columns off the sides, and bottomGap() lifts the bottom cluster above
   * the interaction button and the joystick.
   */
  ReactEcsRenderer.setUiRenderer(hud, {
    virtualWidth: 1920,
    virtualHeight: 1080,
    screenInset: 'device'
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
  // Off at the player's request. Only this line: the meter is not a prompt,
  // it is the shot itself, and hiding it would be hiding the game.
  if (setting('hidePrompts')) return ''
  if (detectorIsOut()) return ''
  if (phase === 'walking') {
    return distanceToBall <= SHOT.promptRange ? 'Walk up to your ball' : ''
  }
  // {E} is a slot for the key, filled in at render: the letter on desktop,
  // the putter icon on a phone. It is a marker rather than two whole strings
  // so that the wording stays in one place and only the key moves.
  if (phase === 'ready') {
    return onPhone() ? '{E}  to address the ball' : 'Press  E  to address the ball'
  }
  if (phase === 'address') {
    return onPhone()
      ? 'Look where you want it to go,  then  {E}'
      : 'Look where you want it to go,  then  E'
  }
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

/**
 * The swing meter, stood on its end, for a phone.
 *
 * The horizontal bar is 1000 wide. That is most of a desktop canvas and more
 * than a phone has: the right half of it ran under the explorer's own action
 * buttons, so the half of the sweep that decides the shot was the half you
 * could not see. Widening the canvas is not an option and shrinking the bar to
 * fit would make a game of timing into a game of squinting.
 *
 * So on a phone it turns ninety degrees and lives up the left edge, which is
 * the one strip of a phone screen that neither the explorer nor a thumb wants:
 * the joystick is bottom left, the action buttons are bottom right, and the
 * chat and compass are along the top.
 *
 * Every number is the same number. IMPACT_AT, meterAt and band are shared with
 * the desktop bar, so the window you are aiming at is identical and only the
 * axis has changed — a shot that is perfect on a laptop is perfect on a phone.
 * Bottom to top, because a power bar that fills downward reads as draining.
 */
/**
 * The left-hand column on a phone: the bag, and the meter under it.
 *
 * Below the explorer's chat and compass, above its joystick, and clear of the
 * bottom band. The bag is always there and the meter only during a swing, so
 * they never both want the same pixels for long, but they are stacked rather
 * than overlaid so that they do not when they do.
 */
/**
 * Where the meter stands, right of the middle of the screen.
 *
 * Not centred, because centred is on top of the ball you are aiming at, and
 * not hard right, because that is where the explorer puts its own action
 * buttons. The gap between the two is this.
 *
 * A percentage rather than pixels so it lands in the same place whatever the
 * explorer decides the canvas is that day, which is the same reason the
 * vertical anchors in SAFE are percentages.
 */
const PHONE_METER_LEFT = '56%'
const PHONE_METER_TOP = '28%'

const PHONE_METER_W = 56
const PHONE_METER_H = 300
/** Fraction of the bar -> pixels up from its foot, clamped inside it. */
const py = (v: number) => Math.max(0, Math.min(PHONE_METER_H, Math.round(v * PHONE_METER_H)))

function phoneMeter() {
  const sw = game.swing
  const live = sw.phase === 'power' || sw.phase === 'accuracy'
  const fillTo = sw.phase === 'power' ? sw.power || sw.cursor : sw.power
  const cursorY = meterAt(sw.cursor)
  const goodHalf = band(GOOD_OFFSET)
  const perfectHalf = band(PERFECT_OFFSET)

  const confirm =
    sw.phase === 'power' ? 'to lock the power' : sw.phase === 'accuracy' ? 'on the white line' : ''

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { left: PHONE_METER_LEFT, top: PHONE_METER_TOP },
        width: 320,
        height: PHONE_METER_H + 34,
        flexDirection: 'column',
        alignItems: 'flex-start'
      }}
    >
      <Label
        value={sw.phase === 'power' ? 'SET POWER' : sw.phase === 'accuracy' ? 'HIT THE LINE' : ''}
        fontSize={17}
        color={sw.phase === 'accuracy' ? GOLD : CREAM}
        uiTransform={{ width: 320, height: 28 }}
        textAlign="middle-left"
      />

      <UiEntity uiTransform={{ width: 320, height: PHONE_METER_H, flexDirection: 'row' }}>
        <UiEntity
          uiTransform={{ width: PHONE_METER_W, height: PHONE_METER_H }}
          uiBackground={{ color: TRACK }}
        >
          {/* the zone you are trying to stop in */}
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: { bottom: py(IMPACT_AT - goodHalf), left: 0 },
              width: PHONE_METER_W,
              height: py(goodHalf * 2)
            }}
            uiBackground={{ color: BAND_GOOD }}
          />
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: { bottom: py(IMPACT_AT - perfectHalf), left: 0 },
              width: PHONE_METER_W,
              height: py(perfectHalf * 2)
            }}
            uiBackground={{ color: BAND_PERFECT }}
          />
          {/* power fill, grown from the impact line. Up the left-hand side of
              the track rather than across its foot, which is the same 10px
              strip the desktop bar draws, turned with everything else. */}
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: { bottom: py(IMPACT_AT), left: 0 },
              width: 10,
              height: py(fillTo * (1 - IMPACT_AT))
            }}
            uiBackground={{ color: powerColour(fillTo) }}
          />
          {sw.phase === 'accuracy' ? (
            <UiEntity
              uiTransform={{
                positionType: 'absolute',
                position: { bottom: py(meterAt(sw.power)), left: 0 },
                width: PHONE_METER_W,
                height: 5
              }}
              uiBackground={{ color: LOCK }}
            />
          ) : null}
          {/* the impact line */}
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: { bottom: py(IMPACT_AT), left: 0 },
              width: PHONE_METER_W,
              height: 4
            }}
            uiBackground={{ color: IMPACT }}
          />
          {/* the sweeping cursor, overhanging both sides so it reads against
              the bands rather than disappearing into them */}
          {live ? (
            <UiEntity
              uiTransform={{
                positionType: 'absolute',
                position: { bottom: py(cursorY), left: -6 },
                width: PHONE_METER_W + 12,
                height: 7
              }}
              uiBackground={{ color: CREAM }}
            />
          ) : null}
        </UiEntity>

        {/* the reading, beside the bar rather than under it */}
        <UiEntity
          uiTransform={{
            width: 240,
            height: PHONE_METER_H,
            margin: { left: 14 },
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start'
          }}
        >
          <Label
            value={live ? `${Math.round(fillTo * 100)}%` : ''}
            fontSize={22}
            color={CREAM}
            uiTransform={{ width: 240, height: 30 }}
            textAlign="middle-left"
          />
          <UiEntity uiTransform={{ width: 240, height: 28, flexDirection: 'row', alignItems: 'center' }}>
            {confirm ? eIcon(22, { right: 8 }) : null}
            <Label
              value={confirm}
              fontSize={16}
              color={sw.phase === 'accuracy' ? GOLD : CREAM}
              uiTransform={{ width: 200, height: 26 }}
              textAlign="middle-left"
            />
          </UiEntity>
          <Label
            value={live ? 'the cross cancels' : ''}
            fontSize={14}
            color={DIM}
            uiTransform={{ width: 240, height: 24 }}
            textAlign="middle-left"
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

function meter() {
  const sw = game.swing
  const live = sw.phase === 'power' || sw.phase === 'accuracy'

  /*
    What to press, under the bar.

    The header above says what the stage IS — SET POWER, HIT THE LINE — and
    said nothing about how to end it. A meter filling on its own with no
    instruction under it reads as something happening to you rather than
    something you are doing, and the second press is the one nobody guesses.

    On a phone the letter is the putter, the same swap every other prompt in
    here makes. The words are sized to their own length so the icon sits beside
    them rather than a hand's width away, for the reason written on the prompt
    band's hintWordsW.
  */
  const confirm =
    sw.phase === 'power'
      ? onPhone()
        ? 'to lock the power'
        : 'Press  E  to lock the power'
      : sw.phase === 'accuracy'
        ? onPhone()
          ? 'again on the white line'
          : 'Press  E  on the white line'
        : ''
  const confirmW = Math.min(460, Math.max(90, confirm.length * 10))
  const fillTo = sw.phase === 'power' ? sw.power || sw.cursor : sw.power
  const cursorX = meterAt(sw.cursor)
  const goodHalf = band(GOOD_OFFSET)
  const perfectHalf = band(PERFECT_OFFSET)

  return (
    <UiEntity uiTransform={{ width: METER_W, height: 104, flexDirection: 'column', alignItems: 'center' }}>
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
          value={live ? (onPhone() ? 'cross cancels' : 'F  cancel') : ''}
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

      {confirm ? (
        <UiEntity
          uiTransform={{
            width: METER_W,
            height: 26,
            margin: { top: 6 },
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {onPhone() ? eIcon(22, { right: 8 }) : null}
          <Label
            value={confirm}
            fontSize={17}
            color={sw.phase === 'accuracy' ? GOLD : CREAM}
            uiTransform={{ width: onPhone() ? confirmW : METER_W, height: 24 }}
            textAlign={onPhone() ? 'middle-left' : 'middle-center'}
          />
        </UiEntity>
      ) : null}
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
/** Two fewer on a phone, to pay for starting lower down the screen. */
const PHONE_BOARD_ROWS = 4
const ROW_H = 30
/** Taller on a phone. Four rows with room around them beat six crammed. */
const rowH = () => (onPhone() ? 36 : ROW_H)

/**
 * Live standings, always on. Play is continuous, so this is the results screen
 * — there is no separate one. Sorted by score, but only counting holes actually
 * played, otherwise anyone who has barely started sits top of the table.
 */
/**
 * How many rows the standings show, and where the right-hand column starts.
 *
 * A phone's canvas is about 1600 by 720 rather than 1920 by 1080, so it is
 * relatively wider and a great deal shorter. Wider is the problem: the top
 * strip is centred and grows rightwards as chips are added, and at four chips
 * it runs under a scorecard pinned to the top right. Both are drawn on a
 * 93%-opaque frame, so instead of one hiding the other you get the points and
 * level chips showing faintly through the scorecard, which reads as a broken
 * panel rather than as two things in one place.
 *
 * So on a phone the column below the scorecard starts under the strip instead
 * of beside it, and the standings lose two rows to pay for the drop.
 */
/**
 * The left-hand column on a phone: the scorecard, and the standings under it.
 *
 * Both were pinned to the top right, opposite a top strip that is centred and
 * grows rightwards, so by four chips the strip was running under the card and
 * showing through it. Down the left they have a side of the screen to
 * themselves and the strip has the top of it.
 *
 * The standings sit under the card while there is one and take its place when
 * there is not, which off the course is most of the time. There is no reason
 * for them to sit halfway down an empty screen waiting for a card that is not
 * coming.
 */
// 22 of hole numbers, 32 of scores, 22 of the par line and 2 of gap, plus the
// frame's 24 top and bottom. It was 108 with 16 of padding, which ran the top
// row of numbers into the border.
const PHONE_CARD_H = 84 + 2 * BORDER.panel
/** Between the two panels. 20 rather than the old 8: they are separate things. */
const PHONE_COLUMN_GAP = 20
/**
 * How wide the tray is, and where its top edge sits.
 *
 * The width is the scorecard's, because that is the panel with fixed columns
 * in it and no give — nine hole numbers and a total. The standings are widened
 * to match rather than the card being squeezed, so the tray has one straight
 * left edge instead of two ragged ones.
 *
 * The top clears the strip: the strip is pinned at edgeGap() and is 132 tall
 * with its second row, and 20 is the same gap the two tray panels keep from
 * each other.
 */
const TRAY_W = 452
const TRAY_TOP = () => edgeGap() + STRIP_H + PHONE_COLUMN_GAP

/**
 * The callout, measured rather than guessed.
 *
 * It was one fixed height with the detail in a 28-tall box, which is a line
 * and a bit of one. On a desktop that box is 632 wide and every callout in the
 * scene fits it; narrowed for a phone's right-hand column it does not, and the
 * second line of "Have a putt on the practice green. Join a round at the board
 * when you are ready." had nowhere to go.
 *
 * Same pessimistic arithmetic as the dialogue box: work out what fits on a
 * line from the width actually available, assume rather less fits than really
 * does, and let the panel be a little too tall rather than a little too short.
 */
const CALLOUT_LINE = 26
const calloutW = () => (onPhone() ? 520 : 700)

function calloutLines(detail: string): number {
  const perLine = Math.max(20, Math.floor((calloutW() - 2 * FRAME_PAD) / 8))
  return Math.max(1, Math.min(3, Math.ceil(detail.length / perLine)))
}

function calloutH(detail: string): number {
  return 42 + 6 + calloutLines(detail) * CALLOUT_LINE + 6 + 2 * BORDER.panel
}

/**
 * The standings.
 *
 * On a desktop this is pinned under the scorecard in the top right corner. On
 * a phone it is a passenger in the tray, which positions it — so `inTray`
 * turns the absolute anchor off and lets the tray's column do the placing.
 */
function leaderboard(inTray = false) {
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

  // As many rows as there are people, up to what the panel is allowed. It was
  // always the maximum, so a course with one player on it drew a name and then
  // five rows of empty frame underneath — a panel sized for a crowd that had
  // not turned up.
  const rows = Math.max(1, Math.min(onPhone() ? PHONE_BOARD_ROWS : BOARD_ROWS, field.length))

  return (
    <UiEntity
      uiTransform={{
        positionType: inTray ? 'relative' : 'absolute',
        position: inTray ? undefined : { top: 138, right: SAFE.edge },
        width: inTray ? TRAY_W : 372,
        // The title and its gap, the rows, and the frame's 24 top and bottom.
        height: 24 + 2 * BORDER.panel + rows * rowH(),
        flexDirection: 'column',
        padding: { top: FRAME_PAD_Y, bottom: FRAME_PAD_Y, left: FRAME_PAD, right: FRAME_PAD }
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
      {field.slice(0, rows).map((p, i) => (
        <UiEntity
          key={p.id}
          uiTransform={{ width: '100%', height: rowH(), flexDirection: 'row', alignItems: 'center' }}
          uiBackground={p.id === meId ? { color: PICKED } : undefined}
        >
          <Label
            value={`${i + 1}`}
            fontSize={15}
            color={DIM}
            uiTransform={{ width: 22, height: rowH() }}
            textAlign="middle-left"
          />
          {/* The player's own avatar. A column of faces reads as people; a
              column of names reads as a table. */}
          <UiEntity
            uiTransform={{ width: 24, height: 24, margin: { right: 8 } }}
            uiBackground={face(p.id)}
          />
          <Label
            value={
              p.name.length > (inTray ? 20 : 12)
                ? `${p.name.slice(0, inTray ? 20 : 12)}\u2026`
                : p.name
            }
            fontSize={16}
            color={p.id === meId ? GOLD : CREAM}
            uiTransform={{ width: inTray ? 232 : 140, height: rowH() }}
            textAlign="middle-left"
          />
          <Label
            value={`H${p.hole}`}
            fontSize={14}
            color={DIM}
            uiTransform={{ width: 38, height: rowH() }}
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
 * The test panel, in three tabs.
 *
 * It was two, and the first of them carried the holes, the free-play shortcuts
 * and the whole catalogue at once. That came to about 900 pixels of content in
 * a panel declared as 800, and a flex column that overruns does not clip — it
 * squeezes every child, which is why the hole rows and the stock lists were
 * both drawn shorter than the text inside them. Splitting stock out of holes
 * gives each tab a page that fits, on a phone as well as a desktop.
 *
 * Every row here is sized the same way as the rest of the HUD: content plus
 * the frame's own border, so nothing is drawn across its own edge.
 */

/** A row in the test panel: content plus the frame it is wearing. */
const ADMIN_ROW = 26 + 2 * BORDER.chip
const ADMIN_ROW_GAP = 2
const ADMIN_BTN = 28 + 2 * BORDER.button

/**
 * The most quests the panel will list.
 *
 * There are fifteen, and fifteen rows plus the panel's furniture is 810 on a
 * canvas a phone gives 720 of. The rest are named in a line underneath rather
 * than drawn off the bottom of the screen.
 */
function maxAdminQuests(): number {
  return onPhone() ? 9 : 15
}

/**
 * One quest in the test panel: where it is, and the two things worth doing to it.
 *
 * TAKE for testing what a quest turns on while it runs — the bones only exist
 * while Sally's is live — and FINISH for testing what it turns on when it is
 * over, which is how you get the bar to appear without hunting a hundred
 * coconuts.
 */
function adminQuestRows() {
  return allQuests()
    .slice(0, maxAdminQuests())
    .map(({ quest, done, status }) => {
      const colour =
        status === 'claimed' ? DIM : status === 'complete' ? GOOD : status === 'active' ? GOLD : CREAM
      const where =
        status === 'claimed'
          ? 'collected'
          : status === 'complete'
            ? `${done}/${quest.target} ready`
            : status === 'active'
              ? `${done}/${quest.target}`
              : 'not taken'

      return (
        <UiEntity
          key={`admin-quest-${quest.id}`}
          uiTransform={{
            width: '100%',
            height: ADMIN_ROW,
            flexShrink: 0,
            margin: { bottom: ADMIN_ROW_GAP },
            flexDirection: 'row',
            alignItems: 'center',
            padding: { left: BORDER.chip + 8, right: BORDER.chip + 8 }
          }}
          uiBackground={chip()}
        >
          <Label value={quest.name} fontSize={14} color={colour} uiTransform={{ width: 232, height: 26 }} textAlign="middle-left" />
          <Label value={where} fontSize={13} color={DIM} uiTransform={{ width: 122, height: 26 }} textAlign="middle-center" />
          <UiEntity
            uiTransform={{ width: 130, height: 26, margin: { right: 6 }, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={{ color: status === 'offered' ? PICKED : INK_SOFT }}
            onMouseDown={() => adminTake(quest.id)}
          >
            <Label value="TAKE" fontSize={13} color={status === 'offered' ? CREAM : DIM} uiTransform={{ width: 122, height: 22 }} textAlign="middle-center" />
          </UiEntity>
          <UiEntity
            uiTransform={{ width: 130, height: 26, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={{ color: INK_SOFT }}
            onMouseDown={() => adminFinish(quest.id)}
          >
            <Label value="FINISH" fontSize={13} color={status === 'claimed' ? DIM : GOLD} uiTransform={{ width: 122, height: 22 }} textAlign="middle-center" />
          </UiEntity>
        </UiEntity>
      )
    })
}

function adminTabButton(tab: AdminTab, label: string) {
  const here = adminTab === tab
  return (
    <UiEntity
      key={`admin-tab-${tab}`}
      uiTransform={{
        width: 208,
        height: ADMIN_BTN,
        margin: { right: 8 },
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={button(here ? PICKED : undefined)}
      onMouseDown={() => {
        adminTab = tab
      }}
    >
      <Label value={label} fontSize={15} color={here ? GOLD : DIM} uiTransform={{ width: 184, height: 26 }} textAlign="middle-center" />
    </UiEntity>
  )
}

/** A wide button in the test panel: the free-play jumps and the points grant. */
function adminWideButton(label: string, lit: boolean, colour: Color4, press: () => void, width: number, trailing = 0) {
  return (
    <UiEntity
      uiTransform={{
        width,
        height: ADMIN_BTN,
        margin: { right: trailing },
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={button(lit ? PICKED : undefined)}
      onMouseDown={press}
    >
      <Label
        value={label}
        fontSize={16}
        color={colour}
        uiTransform={{ width: width - 2 * BORDER.button, height: 28 }}
        textAlign="middle-center"
      />
    </UiEntity>
  )
}

function adminPanel() {
  const s = game.state
  if (!s.adminOpen) return null

  const played = s.card.filter((n) => n >= 0).length
  const total = s.card.reduce((n, sc) => (sc >= 0 ? n + sc : n), 0)

  // ---- how tall ----------------------------------------------------------
  // Stated rather than fixed at 800, so a tab that grows makes the panel grow
  // with it instead of squeezing every row inside it.
  const quests = Math.min(allQuests().length, maxAdminQuests())
  const hiddenQuests = Math.max(0, allQuests().length - quests)
  const body =
    adminTab === 'holes'
      ? ADMIN_BTN + 6 + HOLES.length * (ADMIN_ROW + ADMIN_ROW_GAP)
      : adminTab === 'stock'
        ? itemsOfKind('ball').length * (ADMIN_ROW + ADMIN_ROW_GAP)
        : quests * (ADMIN_ROW + ADMIN_ROW_GAP) + (hiddenQuests > 0 ? 24 : 0)
  const chrome =
    2 * BORDER.panel + 34 + (ADMIN_BTN + 8) + (ADMIN_BTN + 8) + body + 8 + ADMIN_BTN

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
          height: chrome,
          flexDirection: 'column',
          padding: { top: FRAME_PAD_Y, bottom: FRAME_PAD_Y, left: FRAME_PAD, right: FRAME_PAD }
        }}
        uiBackground={panel()}
      >
        {/* 652 of usable width inside 720 with 34 of padding: every row below
            adds up to that and not to the 660 the old 30 of padding gave. */}
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
            uiTransform={{ width: 252, height: 34 }}
            textAlign="middle-right"
          />
        </UiEntity>

        <UiEntity uiTransform={{ width: '100%', height: ADMIN_BTN + 8, flexDirection: 'row', alignItems: 'center' }}>
          {adminTabButton('holes', 'HOLES')}
          {adminTabButton('stock', 'STOCK')}
          {adminTabButton('quests', 'QUESTS')}
        </UiEntity>

        <UiEntity
          uiTransform={{
            width: '100%',
            height: ADMIN_BTN,
            margin: { bottom: 8 },
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <Label
            value={
              adminTab === 'holes'
                ? 'Pick a hole to jump straight to its tee.'
                : adminTab === 'stock'
                  ? 'Tap to hold one. Nothing is granted, the server is not told.'
                  : 'TAKE starts one. FINISH fills it and collects the reward.'
            }
            fontSize={15}
            color={DIM}
            uiTransform={{ width: adminTab === 'stock' ? 444 : 652, height: 26 }}
            textAlign="middle-left"
          />
          {adminTab === 'stock'
            ? adminWideButton(`+1000 ${POINTS.short}`, false, GOLD, () => grantPoints(1000), 208)
            : null}
        </UiEntity>

        {/* ---- holes ---------------------------------------------------- */}
        {adminTab === 'holes' ? (
          <UiEntity uiTransform={{ width: '100%', height: ADMIN_BTN + 6, flexDirection: 'row' }}>
            {adminWideButton(
              'PRACTICE GREEN',
              s.practising && s.freeHole === 'practice',
              s.practising && s.freeHole === 'practice' ? GOLD : CREAM,
              () => game.gotoFree('practice'),
              322,
              8
            )}
            {adminWideButton(
              'SECRET HOLE',
              s.practising && s.freeHole === 'secret',
              s.practising && s.freeHole === 'secret' ? GOLD : CREAM,
              () => game.gotoFree('secret'),
              322
            )}
          </UiEntity>
        ) : null}

        {adminTab === 'holes'
          ? HOLES.map((h, i) => {
              const here = i === s.holeIndex
              const score = s.card[i]
              return (
                <UiEntity
                  key={`admin-${h.number}`}
                  uiTransform={{
                    width: '100%',
                    height: ADMIN_ROW,
                    flexShrink: 0,
                    margin: { bottom: ADMIN_ROW_GAP },
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: { left: BORDER.chip + 8, right: BORDER.chip + 8 }
                  }}
                  uiBackground={chip(here ? PICKED : undefined)}
                  onMouseDown={() => game.gotoHole(i)}
                >
                  <Label value={`${h.number}`} fontSize={18} color={here ? GOLD : CREAM} uiTransform={{ width: 44, height: 26 }} textAlign="middle-left" />
                  <Label value={h.name} fontSize={17} color={here ? GOLD : CREAM} uiTransform={{ width: 350, height: 26 }} textAlign="middle-left" />
                  <Label value={`par ${h.par}`} fontSize={15} color={DIM} uiTransform={{ width: 150, height: 26 }} textAlign="middle-center" />
                  <Label
                    value={score >= 0 ? `${score}` : '-'}
                    fontSize={17}
                    color={score < 0 ? DIM : score - h.par <= 0 ? GOOD : BAD}
                    uiTransform={{ width: 76, height: 26 }}
                    textAlign="middle-right"
                  />
                </UiEntity>
              )
            })
          : null}

        {/* ---- stock ----------------------------------------------------
            Two columns of the catalogue, on a page of their own now. Tapping
            one puts it in your hands on the spot — locally and visually only,
            so nothing is granted and the server is not told.

            The points button is the opposite: it changes a real balance, so it
            goes through the server and is refused unless the wallet is named
            in ADMIN.allow. Opening this panel is not enough. ------------- */}
        {adminTab === 'stock' ? (
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'row' }}>
            {(['ball', 'club'] as ItemKind[]).map((kind) => (
              <UiEntity
                key={`stock-${kind}`}
                uiTransform={{
                  width: 322,
                  // Stated, so ten rows are ten rows. It was a flat 150 for a
                  // list that came to 280, and every row lost half its height.
                  height: itemsOfKind(kind).length * (ADMIN_ROW + ADMIN_ROW_GAP),
                  margin: { right: kind === 'ball' ? 8 : 0 },
                  flexDirection: 'column'
                }}
              >
                {itemsOfKind(kind).map((item) => {
                  const worn = equippedId(kind) === item.id
                  return (
                    <UiEntity
                      key={`admin-${item.id}`}
                      uiTransform={{
                        width: '100%',
                        height: ADMIN_ROW,
                        flexShrink: 0,
                        margin: { bottom: ADMIN_ROW_GAP },
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: { left: BORDER.chip + 8, right: BORDER.chip + 8 }
                      }}
                      uiBackground={chip(worn ? PICKED : undefined)}
                      onMouseDown={() => equip(item.id)}
                    >
                      <Label
                        value={item.name}
                        fontSize={14}
                        color={worn ? GOLD : CREAM}
                        uiTransform={{ width: 290, height: 26 }}
                        textAlign="middle-center"
                      />
                    </UiEntity>
                  )
                })}
              </UiEntity>
            ))}
          </UiEntity>
        ) : null}

        {/* ---- quests ---------------------------------------------------- */}
        {adminTab === 'quests' ? adminQuestRows() : null}
        {adminTab === 'quests' && hiddenQuests > 0 ? (
          <Label
            value={`+${hiddenQuests} more, off the bottom of a phone screen`}
            fontSize={13}
            color={DIM}
            uiTransform={{ width: '100%', height: 24 }}
            textAlign="middle-left"
          />
        ) : null}

        <UiEntity uiTransform={{ width: '100%', height: ADMIN_BTN, margin: { top: 8 }, flexDirection: 'row' }}>
          {adminWideButton('CLEAR CARD', false, CREAM, () => game.clearCard(), 200, 252)}
          {adminWideButton('CLOSE', false, GOLD, () => game.closeAdmin(), 200)}
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// ---------------------------------------------------------------------------

/**
 * Your own card for the round.
 *
 * Pinned top right on a desktop and carried by the tray on a phone, which is
 * what `inTray` switches between: in the tray it is a child of a column and
 * lets that column place it, everywhere else it anchors itself.
 *
 * It reads game.state directly rather than taking the render's locals, because
 * it is now called from two places and one of them is not inside the render.
 */
function scorecard(inTray = false) {
  const s = game.state
  const hole = game.hole
  if (!s.joined || s.phase === 'finished') return null

  return (
    <UiEntity
      uiTransform={{
        positionType: inTray ? 'relative' : 'absolute',
        position: inTray ? undefined : { top: SAFE.edge, right: SAFE.edge },
        width: TRAY_W,
        height: PHONE_CARD_H,
        margin: inTray ? { bottom: PHONE_COLUMN_GAP } : undefined,
        flexDirection: 'column',
        padding: { top: FRAME_PAD_Y, bottom: FRAME_PAD_Y, left: FRAME_PAD, right: FRAME_PAD }
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
  )
}

/**
 * The tray: the scorecard and the standings, out on the right, on a button.
 *
 * A column rather than two anchored panels. Pinned to the right edge and
 * growing downwards and leftwards, so it comes out of the side of the screen
 * the button is on and covers the part of the view you are least likely to be
 * aiming through.
 *
 * It closes itself when there is nothing left in it — you leave the round, the
 * last player logs off — because otherwise the button disappears from the
 * strip and takes the only way of closing the tray with it.
 */
function cardsTray() {
  if (!onPhone()) return null
  if (!hasCards()) {
    cardsOpen = false
    return null
  }
  if (!cardsOpen) return null

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        // Below the callout when there is one. They share the right-hand
        // column, and the callout is the one that goes away on its own — so it
        // takes the top of the column for its few seconds and the tray steps
        // down rather than the two being drawn on top of each other.
        position: {
          top:
            TRAY_TOP() +
            (game.state.toast ? calloutH(game.state.toast.detail) + PHONE_COLUMN_GAP : 0),
          right: edgeGap()
        },
        width: TRAY_W,
        // Both panels plus the gap between them, stated rather than measured:
        // an absolutely-positioned element with no height of its own collapses
        // and takes its children with it.
        height:
          PHONE_CARD_H +
          PHONE_COLUMN_GAP +
          24 +
          2 * BORDER.panel +
          Math.max(1, Math.min(PHONE_BOARD_ROWS, roster().length)) * rowH(),
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}
    >
      {scorecard(true)}
      {leaderboard(true)}
    </UiEntity>
  )
}

const hud = () => {
  if (!game) return <UiEntity uiTransform={{ width: 1, height: 1 }} />
  const s = game.state
  const hole = game.hole
  const finished = s.phase === 'finished'
  const playing = s.joined && !finished

  // What the bottom band is carrying, worked out once because the layout
  // depends on it in two places.
  const hint = prompt(s.phase, s.distanceToBall)
  // Where the key sits in the line, if the line names one at all.
  const hintLeadsWithE = hint.startsWith('{E}')
  const hintEndsWithE = hint.endsWith('{E}')
  const hintText = hint.replace('{E}', '').trim()
  /*
    How wide to draw the prompt's words.

    It was the full 430 with the text centred inside it, which put the icon
    hard against the left edge of the chip and the words in the middle, a
    hand's width apart, reading as two unrelated things. A Label cannot be
    asked how wide its text came out, so this is the same sort of estimate the
    3D lettering uses: about ten pixels a character at this size, floored so a
    two-word prompt is not squeezed and capped so a long one still fits.
  */
  const hintWordsW =
    hintLeadsWithE || hintEndsWithE
      ? Math.min(460, Math.max(90, hintText.length * 10))
      : 500

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
          position: { top: edgeGap() },
          width: '100%',
          height: STRIP_BAND,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'center'
        }}
      >
      {/*
        The children add up to the frame now.

        They did not: 34 + 210 + 90 + 46 + 84 is 464 against the 410 of usable
        width inside a 470 frame with 30 of padding each side, so every one of
        them was shrunk by a tenth and the text inside them clipped. Wider
        frame, narrower name, and the five come to 434 of 440.
      */}
      <UiEntity
        uiTransform={{
          // 520 and 34 a side, so the five children still add up: 434 of the
          // 452 the frame leaves. It was 500 and 30, which put the hole number
          // half under the left bracket and the distance under the right one.
          width: 520,
          height: STRIP_H,
          flexDirection: 'row',
          alignItems: 'center',
          padding: { left: FRAME_PAD, right: FRAME_PAD }
        }}
        uiBackground={panel()}
      >
        <Bold value={`${hole.number}`} fontSize={30} color={GOLD} outline={SHADOW} spread={2} width={34} height={40} textAlign="middle-left" />
        <Bold value={hole.name} fontSize={20} color={CREAM} width={180} height={40} textAlign="middle-left" />
        <Label
          value={`PAR ${hole.par}`}
          fontSize={17}
          color={DIM}
          uiTransform={{ width: 90, height: 40 }}
          textAlign="middle-center"
        />
        <Bold value={`${s.strokes}`} fontSize={30} color={s.strokes >= hole.par ? BAD : CREAM} outline={SHADOW} spread={2} width={46} height={40} textAlign="middle-right" />
        <Bold value={metres(s.distanceToPin)} fontSize={20} color={GOLD} width={84} height={40} textAlign="middle-right" />
      </UiEntity>
      {pointsChip()}
      {levelChip()}
      {hubButton()}
      {cardsButton()}
      {drinkChip()}
      {detectorChip()}
      </UiEntity>
      ) : null}

      {/* ---- practice strip: what the hole strip becomes between rounds ---- */}
      {!s.joined ? (
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: edgeGap() },
          width: '100%',
          height: STRIP_BAND,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'center'
        }}
      >
      <UiEntity
        uiTransform={{
          // 520 and 34 a side, so the five children still add up: 434 of the
          // 452 the frame leaves. It was 500 and 30, which put the hole number
          // half under the left bracket and the distance under the right one.
          width: 520,
          height: STRIP_H,
          flexDirection: 'row',
          alignItems: 'center',
          padding: { left: FRAME_PAD, right: FRAME_PAD }
        }}
        uiBackground={panel()}
      >
        <Bold value={s.freeHole === 'secret' ? 'SECRET' : 'PRACTICE'} fontSize={20} color={GOLD} outline={SHADOW} spread={1} width={120} height={40} textAlign="middle-left" />
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
          uiTransform={{ width: 210, height: 40 }}
          textAlign="middle-left"
        />
        {s.toBoard <= 6 && onPhone() ? (
          <UiEntity
            uiTransform={{
              width: 110,
              height: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end'
            }}
          >
            {eIcon(24, { right: 6 })}
            <Label
              value="to join"
              fontSize={17}
              color={GOLD}
              uiTransform={{ width: 62, height: 40 }}
              textAlign="middle-right"
            />
          </UiEntity>
        ) : (
          <Label
            value={s.toBoard <= 6 ? 'E  to join' : `Board ${metres(s.toBoard)}`}
            fontSize={17}
            color={s.toBoard <= 6 ? GOLD : DIM}
            uiTransform={{ width: 110, height: 40 }}
            textAlign="middle-right"
          />
        )}
      </UiEntity>
      {pointsChip()}
      {levelChip()}
      {hubButton()}
      {cardsButton()}
      {drinkChip()}
      {detectorChip()}
      </UiEntity>
      ) : null}

      {/* ---- scorecard and standings: corner on a desktop, tray on a phone ---- */}
      {onPhone() ? null : scorecard()}
      {onPhone() ? null : leaderboard()}
      {cardsTray()}

      {/* ---- callout ---- */}
      {s.toast ? (
        <UiEntity
          uiTransform={{
            /*
              Out of the way on a phone, centred on a desktop.

              A callout is the scene talking: the hole you have just walked
              onto, the round you have just joined, the welcome when you
              arrive. None of it is worth putting in front of the ball, and on
              a phone the middle of the screen is the ball — it is where you
              aim, where you watch the putt run, and where the character you
              are talking to is stood. So on a phone it goes into the same
              right-hand column the card tray uses, under the top strip, and
              leaves the middle alone.

              A desktop has room to spare and keeps the centre, which is where
              a player's eye already is on a big screen.
            */
            positionType: 'absolute',
            position: onPhone()
              ? { top: TRAY_TOP(), right: edgeGap() }
              : { top: SAFE.toastTop },
            width: onPhone() ? calloutW() : '100%',
            height: calloutH(s.toast.detail),
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
              width: calloutW(),
              height: calloutH(s.toast.detail),
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: { top: FRAME_PAD_Y, bottom: FRAME_PAD_Y, left: FRAME_PAD, right: FRAME_PAD }
            }}
            uiBackground={panel()}
          >
            <Bold
              value={s.toast.title}
              fontSize={onPhone() ? 26 : 30}
              color={s.toast.tone === 'good' ? GOLD : s.toast.tone === 'bad' ? BAD : CREAM}
              outline={SHADOW}
              spread={2}
              width={'100%'}
              height={42}
            />
            <Label
              value={s.toast.detail}
              fontSize={onPhone() ? 15 : 16}
              color={DIM}
              uiTransform={{
                width: '100%',
                height: calloutLines(s.toast.detail) * CALLOUT_LINE,
                margin: { top: 6 }
              }}
              textAlign="top-center"
            />
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
            position: { bottom: bottomGap() },
            width: '100%',
            height: 140,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <UiEntity
            uiTransform={{
              width: 780,
              height: 42 + 32 + 6 + 2 * BORDER.panel,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: { top: FRAME_PAD_Y, bottom: FRAME_PAD_Y, left: FRAME_PAD, right: FRAME_PAD }
            }}
            uiBackground={panel()}
          >
            <Label
              value={`ROUND COMPLETE    ${game.playedTotal}  (${toPar(game.toPar)})`}
              fontSize={26}
              color={GOLD}
              uiTransform={{ width: '100%', height: 42 }}
              textAlign="middle-center"
            />
            {onPhone() ? (
              <UiEntity
                uiTransform={{
                  width: '100%',
                  height: 32,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {eIcon(24, { right: 10 })}
                <Label value="to play the course again" fontSize={17} color={CREAM} uiTransform={{ width: 240, height: 32 }} textAlign="middle-left" />
              </UiEntity>
            ) : (
              <Label value="Press E to play the course again" fontSize={17} color={CREAM} uiTransform={{ width: '100%', height: 32 }} textAlign="middle-center" />
            )}
          </UiEntity>
        </UiEntity>
      ) : (
        <UiEntity
          uiTransform={{
            // One row, and 110 tall to match it. It was two rows and 172 while
            // the hub was a word on a line of its own; a column taller than
            // what it holds is invisible until something lands in the gap.
            positionType: 'absolute',
            position: { bottom: bottomGap() },
            width: '100%',
            height: 110,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end'
          }}
        >
          <UiEntity
            uiTransform={{
              width: '100%',
              height: 110,
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'center'
            }}
          >
            {/*
              The prompt or the meter, and nothing else.

              Reset used to sit on the left of it with an empty slot of its own
              width on the right to keep the middle in the middle. Both have
              gone with it into the hub, so there is nothing either side to push
              the prompt about and it centres on its own.
            */}
            {s.phase === 'swinging' ? (
              // A phone draws it up the left edge instead, outside this band.
              onPhone() ? null : meter()
            ) : hint ? (
              <UiEntity
                uiTransform={{
                  // 68 tall, not 52, and the words get a 44-tall box inside it
                  // rather than a 28-tall one. A Label centres its text in the
                  // box it is given, and a box barely taller than the type has
                  // nowhere to centre it — which is why the line sat on the
                  // bottom rule with its descenders under the frame.
                  width: 580,
                  height: 68,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: { left: BORDER.chip + 16, right: BORDER.chip + 16 }
                }}
                uiBackground={chip()}
              >
                {hintLeadsWithE ? eIcon(28, { right: 12 }) : null}
                <Label
                  value={hintText}
                  fontSize={18}
                  color={s.phase === 'address' ? GOLD : CREAM}
                  uiTransform={{ width: hintWordsW, height: 40 }}
                  textAlign="middle-center"
                />
                {hintEndsWithE ? eIcon(28, { left: 12 }) : null}
              </UiEntity>
            ) : null}

          </UiEntity>
        </UiEntity>
      )}

      {onPhone() && s.phase === 'swinging' ? phoneMeter() : null}

      {inventory()}

      {hubPanel()}

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

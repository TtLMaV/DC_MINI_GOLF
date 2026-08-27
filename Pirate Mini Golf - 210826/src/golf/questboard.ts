import {
  engine,
  Entity,
  Material,
  MeshRenderer,
  Name,
  TextShape,
  Transform,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import { QUEST_BOARD } from './config'
import { giverShortName, trackedQuests } from './quests'

/**
 * The quest board.
 *
 * Lettering and progress bars painted onto a sign that is part of the scene,
 * the same arrangement as the sign-up board by the first tee — this module
 * draws no sign of its own.
 *
 * Where it differs, and it is the better way round: the sign is found at
 * runtime by its entity name rather than by coordinates written into config.
 * Move it in Creator Hub, turn it, scale it, and the board goes with it with no
 * code change. The first-tee board has its position baked in and needed three
 * separate corrections to get right; this one cannot be wrong about where it is
 * because it never decides.
 *
 * Rows are built once and then only updated. A TextShape is cheap to write to
 * and expensive to create, and this refreshes twice a second.
 */

/**
 * Roughly how wide one character is, per point of fontSize, in metres.
 *
 * Measured off the first-tee sign rather than derived — SDK7 exposes no way to
 * ask how wide a string will render, and fontAutoSize fits a box rather than
 * telling you anything. It is an approximation over a proportional font, so it
 * is used to decide where to cut a line, never to claim an exact width.
 */
const PER_CHARACTER = 0.065

/** How many characters of this size fit in that many metres. */
function fits(size: number, metres: number): number {
  return Math.max(1, Math.floor(metres / (PER_CHARACTER * size)))
}

/**
 * Shortens a line to what the parchment will take.
 *
 * The objectives are written for the quest, not for this sign, and several run
 * past 2m at any size worth reading. Cutting here rather than rewriting them
 * keeps one wording for the board, the HUD tracker and the dialogue — and means
 * a new quest cannot silently overflow the sign.
 */
function fit(text: string, size: number, metres: number): string {
  const max = fits(size, metres)
  if (text.length <= max) return text
  return text.slice(0, Math.max(1, max - 1)).trimEnd() + '\u2026'
}

const GOLD = Color4.create(0.95, 0.78, 0.33, 1)
const CREAM = Color4.create(0.93, 0.92, 0.88, 1)
const DIM = Color4.create(0.62, 0.6, 0.56, 1)

type Row = {
  name: Entity
  detail: Entity
  /** The unfilled bar. */
  track: Entity
  /** The filled part, scaled along x from the left edge. */
  fill: Entity
}

let anchor: Entity | undefined
let heading: Entity | undefined
let empty: Entity | undefined
const rows: Row[] = []

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

/**
 * Where a line sits on the sign, given how far right and how high it should be.
 *
 * The offsets are applied *along the text's own axes* rather than the sign's.
 * That is the whole point of this function, and it exists because doing it the
 * other way cost four attempts: standoff was measured down the sign's local Z
 * and textX across its local X, so every change to textYaw silently invalidated
 * both, and each rotation needed two more signs worked out by hand and got at
 * least one of them wrong.
 *
 * Now textYaw is the only dial. Whatever it is set to, standoff means "out of
 * the front of the sign" and textX means "to the right as you read it".
 *
 * Left-handed, Y up: rotating (x, z) by yaw t gives x cos t + z sin t and
 * -x sin t + z cos t. So local +Z (forward) becomes (sin t, cos t) and local
 * +X (right) becomes (cos t, -sin t).
 */
function place(right: number, height: number): Vector3.MutableVector3 {
  const t = (QUEST_BOARD.textYaw * Math.PI) / 180
  const sin = Math.sin(t)
  const cos = Math.cos(t)
  return Vector3.create(
    right * cos + QUEST_BOARD.standoff * sin,
    QUEST_BOARD.textY + height,
    -right * sin + QUEST_BOARD.standoff * cos
  )
}

function text(parent: Entity, y: number, size: number, colour: Color4): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    position: place(QUEST_BOARD.textX, y),
    rotation: Quaternion.fromEulerDegrees(0, QUEST_BOARD.textYaw, 0),
    parent
  })
  TextShape.create(e, {
    text: '',
    fontSize: size,
    /*
     * A box far larger than any line, so it can never be the thing that cuts
     * one off.
     *
     * These are not optional. Leaving them out does not mean "no box" — it
     * means the proto default of 1, which is narrower than the 2.4 that was
     * already truncating QUESTS to QUE, and is why the next attempt showed a
     * sliver instead. Whatever unit this is in, 40 is past every line on the
     * sign, and the lines are kept to the parchment by fontSize and fit()
     * rather than by fencing them in here.
     */
    width: 40,
    height: 40,
    textWrapping: false,
    textColor: colour,
    outlineWidth: 0.12,
    outlineColor: Color3.Black()
  })
  return e
}

/**
 * A bar segment.
 *
 * Built as a box scaled thin rather than a plane, because a plane has a facing
 * and would need to agree with whichever way the sign is turned. A box looks
 * the same from the front however this ends up oriented.
 *
 * The fill is parented to its own left edge so scaling x grows it rightwards
 * instead of outwards from the middle — an origin-centred bar that fills from
 * the centre is the classic way to make a progress bar look broken.
 */
function bar(parent: Entity, y: number, colour: Color4, atLeftEdge: boolean): Entity {
  // The holder carries the same flip as the text. Without it the bars would
  // stay on the sign's other face while the lettering moved, and the left edge
  // a fill grows from would be the right edge as you look at it.
  const holder = engine.addEntity()
  Transform.create(holder, {
    position: place(QUEST_BOARD.textX - (atLeftEdge ? QUEST_BOARD.barWidth / 2 : 0), y),
    rotation: Quaternion.fromEulerDegrees(0, QUEST_BOARD.textYaw, 0),
    parent
  })

  const e = engine.addEntity()
  MeshRenderer.setBox(e)
  Material.setPbrMaterial(e, {
    albedoColor: colour,
    emissiveColor: Color3.create(colour.r, colour.g, colour.b),
    emissiveIntensity: 0.35,
    roughness: 1
  })
  Transform.create(e, {
    // Offset by half its own width so the box's left edge sits on the holder.
    position: Vector3.create(atLeftEdge ? 0.5 : 0, 0, 0),
    scale: Vector3.create(atLeftEdge ? 1 : QUEST_BOARD.barWidth, QUEST_BOARD.barHeight, 0.01),
    parent: holder
  })
  return e
}

/**
 * Finds the sign, without being fussy about exactly what it was called.
 *
 * getEntityOrNullByName is an exact match, and the difference between "Quests",
 * "quests" and "Quests.glb" is not a difference anybody means. Tries the exact
 * name first, then falls back to a case-insensitive scan that ignores a .glb
 * suffix — cheap, runs once, and saves a round trip every time the sign is
 * renamed.
 */
function findSign(): Entity | null {
  const exact = engine.getEntityOrNullByName(QUEST_BOARD.entityName)
  if (exact !== null) return exact

  const want = QUEST_BOARD.entityName.toLowerCase()
  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    const n = name.value.toLowerCase().replace(/\.glb$/, '')
    if (n === want) return entity
  }
  return null
}

/**
 * One label per quarter turn, all four at once.
 *
 * Deliberately does not reuse text(): every probe needs its *own* yaw, where
 * the real board reads a single one out of config. Stacked vertically so they
 * cannot hide behind each other, and each one says its own angle, so reading
 * the answer off a screenshot takes no interpretation at all.
 */
function probe(parent: Entity): void {
  const angles = [0, 90, 180, 270]
  const colours = [GOLD, CREAM, DIM, GOLD]

  angles.forEach((yaw, i) => {
    const t = (yaw * Math.PI) / 180
    const sin = Math.sin(t)
    const cos = Math.cos(t)
    const height = 0.45 - i * 0.3

    const e = engine.addEntity()
    Transform.create(e, {
      position: Vector3.create(
        QUEST_BOARD.standoff * sin,
        QUEST_BOARD.textY + height,
        QUEST_BOARD.standoff * cos
      ),
      rotation: Quaternion.fromEulerDegrees(0, yaw, 0),
      parent
    })
    TextShape.create(e, {
      text: `YAW ${yaw}`,
      fontSize: 1.6,
      width: 40,
      height: 40,
      textWrapping: false,
      textColor: colours[i],
      outlineWidth: 0.14,
      outlineColor: Color3.Black()
    })
  })
}

export function setupQuestBoard(): void {
  const sign = findSign()
  if (sign === null) {
    console.log(
      `[golf] QUEST BOARD: no entity named "${QUEST_BOARD.entityName}" in the scene, so there is ` +
        'nothing to write on. Name the sign in Creator Hub and save, or change ' +
        'QUEST_BOARD.entityName in config.ts to match what it is called.'
    )
    return
  }

  const on = Transform.getOrNull(sign)
  if (!on) {
    console.log(`[golf] QUEST BOARD: "${QUEST_BOARD.entityName}" has no transform`)
    return
  }

  // Parented to the sign, with its scale divided back out. Everything below is
  // then in metres regardless of what the sign itself is scaled to, and the
  // whole board still follows the sign if it is moved.
  anchor = engine.addEntity()
  Transform.create(anchor, {
    position: Vector3.Zero(),
    scale: Vector3.create(1 / (on.scale.x || 1), 1 / (on.scale.y || 1), 1 / (on.scale.z || 1)),
    parent: sign
  })

  if (QUEST_BOARD.probeOrientation) {
    probe(anchor)
    console.log(
      '[golf] QUEST BOARD: orientation probe is on. Four labels are drawn, one per ' +
        'quarter turn. Whichever reads correctly facing you is the value for ' +
        'QUEST_BOARD.textYaw — set it, then set probeOrientation to false.'
    )
    return
  }

  heading = text(anchor, QUEST_BOARD.headingY, QUEST_BOARD.headingSize, GOLD)
  TextShape.getMutable(heading).text = 'QUESTS'

  empty = text(anchor, QUEST_BOARD.headingY - QUEST_BOARD.rowHeight, QUEST_BOARD.detailSize, DIM)

  for (let i = 0; i < QUEST_BOARD.maxRows; i++) {
    const top = QUEST_BOARD.headingY - QUEST_BOARD.rowHeight * (i + 1)
    rows.push({
      name: text(anchor, top, QUEST_BOARD.nameSize, CREAM),
      detail: text(anchor, top - QUEST_BOARD.detailDrop, QUEST_BOARD.detailSize, DIM),
      track: bar(anchor, top - QUEST_BOARD.barDrop, Color4.create(0.16, 0.14, 0.11, 1), false),
      fill: bar(anchor, top - QUEST_BOARD.barDrop, GOLD, true)
    })
  }

  engine.addSystem(updateQuestBoard)
  console.log(`[golf] quest board on "${QUEST_BOARD.entityName}", ${QUEST_BOARD.maxRows} rows`)
}

// ---------------------------------------------------------------------------
// Updating
// ---------------------------------------------------------------------------

function show(e: Entity, visible: boolean): void {
  VisibilityComponent.createOrReplace(e, { visible })
}

let refresh = 0

export function updateQuestBoard(dt: number): void {
  if (!anchor || !empty) return
  refresh -= dt
  if (refresh > 0) return
  refresh = QUEST_BOARD.refreshInterval

  // Only what is running. A board listing every quest in the game would be a
  // catalogue; this is meant to answer "what am I in the middle of".
  const live = trackedQuests().slice(0, QUEST_BOARD.maxRows)

  const none = live.length === 0
  show(empty, none)
  // Short on purpose. The old line was 56 characters, which at any size that
  // fits the parchment is too small to read from where you stand.
  TextShape.getMutable(empty).text = none ? 'Nothing on. Ask around.' : ''

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const entry = live[i]

    if (!entry) {
      show(row.name, false)
      show(row.detail, false)
      show(row.track, false)
      show(row.fill, false)
      continue
    }

    const { quest, done, status } = entry
    const finished = status === 'complete'

    show(row.name, true)
    show(row.detail, true)
    show(row.track, true)
    show(row.fill, true)

    TextShape.getMutable(row.name).text = fit(quest.name, QUEST_BOARD.nameSize, QUEST_BOARD.width)
    TextShape.getMutable(row.name).textColor = finished ? GOLD : CREAM

    // A finished quest says who to see, because at that point the number is no
    // longer the useful part — going back to the giver is.
    // The count is written first and the objective given whatever room is
    // left, so the number a player is actually watching is never the part that
    // gets cut.
    const count = `  ${done}/${quest.target}`
    TextShape.getMutable(row.detail).text = finished
      ? fit(`Completed — Speak to ${giverShortName(quest.giver)}`, QUEST_BOARD.detailSize, QUEST_BOARD.width)
      : fit(quest.objective, QUEST_BOARD.detailSize, QUEST_BOARD.width - count.length * PER_CHARACTER * QUEST_BOARD.detailSize) + count

    const fraction = Math.max(0, Math.min(1, done / Math.max(1, quest.target)))
    // Never a sliver of nothing: a bar at zero reads as a broken bar, so an
    // untouched quest still shows a hairline.
    const width = QUEST_BOARD.barWidth * Math.max(0.012, fraction)
    const fill = Transform.getMutable(row.fill)
    fill.scale = Vector3.create(width, QUEST_BOARD.barHeight, 0.012)
    fill.position = Vector3.create(width / 2, 0, 0)
  }
}

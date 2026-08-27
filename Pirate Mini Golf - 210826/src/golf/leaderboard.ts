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

import { LEADER_BOARD } from './config'
import { standingsHeard, standingsPage } from './standings'

/**
 * The leaderboard sign.
 *
 * Built the same way as the quest board, deliberately: found at runtime by
 * entity name, parented to whatever it finds with the sign's own scale divided
 * back out, and every offset applied along the text's own axes so textYaw is
 * the only orientation dial. That process took the quest board four attempts to
 * get right and this one none, which is the whole argument for reusing it.
 *
 * The difference is that this sign has three things to say and one parchment to
 * say them on. Rather than shrink all three to a third of the sign, it shows
 * one at a time and cycles: a page every LEADER_BOARD.pageSeconds, in the order
 * LEADER_BOARD.pages lists them. Somebody who wants a particular table waits a
 * few seconds; somebody walking past reads whichever one is up, at a size that
 * can actually be read from the decking.
 *
 * Rows are built once and then only written to. A TextShape is cheap to update
 * and expensive to create, and this refreshes twice a second.
 */

/**
 * Roughly how wide one character is, per point of fontSize, in metres.
 *
 * The quest board's figure, measured off the first-tee sign rather than
 * derived — SDK7 exposes no way to ask how wide a string will render. It is an
 * approximation over a proportional font, so it decides where to cut a line and
 * never claims an exact width.
 */
const PER_CHARACTER = 0.065

function fit(text: string, size: number, metres: number): string {
  const max = Math.max(1, Math.floor(metres / (PER_CHARACTER * size)))
  if (text.length <= max) return text
  return text.slice(0, Math.max(1, max - 1)).trimEnd() + '…'
}

const GOLD = Color4.create(0.95, 0.78, 0.33, 1)
const CREAM = Color4.create(0.93, 0.92, 0.88, 1)
const DIM = Color4.create(0.62, 0.6, 0.56, 1)

type Line = {
  /** The position, 1 through maxRows. Its own TextShape so the names line up. */
  place: Entity
  who: Entity
  /** The figure, in its own column at a fixed offset. */
  figure: Entity
  /** The portrait plane. Its texture is rewritten when the row changes hands. */
  face: Entity
  /** Whose face is currently on it, so it is not rebuilt every refresh. */
  facing: string
}

let anchor: Entity | undefined
let heading: Entity | undefined
let note: Entity | undefined
let empty: Entity | undefined
const lines: Line[] = []

/** Which page is up, and how long it has been up for. */
let page = 0
let onPage = 0

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

/**
 * Where a line sits on the sign, given how far right and how high.
 *
 * The offsets are applied along the text's own axes rather than the sign's,
 * which is what makes textYaw the only orientation dial. Left-handed, Y up:
 * rotating (x, z) by yaw t gives x cos t + z sin t and -x sin t + z cos t, so
 * local +Z becomes (sin t, cos t) and local +X becomes (cos t, -sin t).
 */
function place(right: number, height: number): Vector3.MutableVector3 {
  const t = (LEADER_BOARD.textYaw * Math.PI) / 180
  const sin = Math.sin(t)
  const cos = Math.cos(t)
  return Vector3.create(
    right * cos + LEADER_BOARD.standoff * sin,
    LEADER_BOARD.textY + height,
    -right * sin + LEADER_BOARD.standoff * cos
  )
}

/**
 * One TextShape, centred on its own entity.
 *
 * No textAlign, on purpose, and it is worth writing down why rather than
 * leaving it looking like an oversight. Alignment is relative to the width and
 * height box, and the quest board established that those are in some unit the
 * scene cannot relate to metres — 40 is used there simply because it is past
 * every line. Asking for top-left inside a box of unknown size would put the
 * text at the left edge of that box, which could be twenty units away from
 * where the entity is.
 *
 * So each column is its own entity at its own offset and every line is centred
 * on it, which is exactly what the quest board does and is known to land where
 * it is put. Columns line up because the entities do, not because the text
 * agrees to align.
 */
function text(parent: Entity, right: number, y: number, size: number, colour: Color4): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    position: place(right, y),
    rotation: Quaternion.fromEulerDegrees(0, LEADER_BOARD.textYaw, 0),
    parent
  })
  TextShape.create(e, {
    text: '',
    fontSize: size,
    // A box far larger than any line, so it can never be the thing that cuts
    // one off. Not optional: leaving them out means the proto default of 1,
    // which is narrower than a heading and shows a sliver instead of a word.
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
 * The portrait plane for one row.
 *
 * A player's actual face, and it costs nothing to get: AvatarTexture takes a
 * userId and the explorer resolves the picture itself. No profile fetch, no
 * content-server URL to chase, no allowedMediaHostnames entry in scene.json,
 * and nothing to break when a catalyst moves. That is the whole reason this is
 * a texture rather than an image downloaded and pasted on.
 *
 * Unlit rather than PBR on purpose. A PBR material would take the scene's
 * afternoon sun across it, so five portraits on a sign facing away from the
 * light would all be in shadow. A face is a picture of a person, not a surface
 * in the world, and should read the same at any time of day.
 *
 * It carries the same textYaw as the lettering because it starts out facing
 * the same way: setPlane makes a plane in XY looking down +Z, which is where a
 * TextShape looks too. So whatever turns the words to face out of the sign
 * turns the pictures with them, and there is no second orientation to keep in
 * step with the first.
 */
function portrait(parent: Entity, right: number, y: number): Entity {
  const e = engine.addEntity()
  MeshRenderer.setPlane(e)
  Transform.create(e, {
    position: place(right, y),
    rotation: Quaternion.fromEulerDegrees(0, LEADER_BOARD.textYaw, 0),
    scale: Vector3.create(LEADER_BOARD.portraitSize, LEADER_BOARD.portraitSize, 1),
    parent
  })
  VisibilityComponent.create(e, { visible: false })
  return e
}

/**
 * Finds the sign, without being fussy about exactly what it was called.
 *
 * getEntityOrNullByName is an exact match, and the difference between
 * "LeaderBoard", "leaderboard" and "LeaderBoard.glb" is not a difference
 * anybody means. Exact first, then a case-insensitive scan that ignores a .glb
 * suffix.
 */
function findSign(): Entity | null {
  const exact = engine.getEntityOrNullByName(LEADER_BOARD.entityName)
  if (exact !== null) return exact

  const want = LEADER_BOARD.entityName.toLowerCase()
  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    const n = name.value.toLowerCase().replace(/\.glb$/, '')
    if (n === want) return entity
  }
  return null
}

/**
 * One label per quarter turn, all four at once.
 *
 * The quest board's probe, kept because the same sign in the same scene can
 * still be turned in Creator Hub and this is how you read the answer off a
 * screenshot rather than guessing it from a description.
 */
function probe(parent: Entity): void {
  const angles = [0, 90, 180, 270]
  const colours = [GOLD, CREAM, DIM, GOLD]

  angles.forEach((yaw, i) => {
    const t = (yaw * Math.PI) / 180
    const e = engine.addEntity()
    Transform.create(e, {
      position: Vector3.create(
        LEADER_BOARD.standoff * Math.sin(t),
        LEADER_BOARD.textY + 0.45 - i * 0.3,
        LEADER_BOARD.standoff * Math.cos(t)
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

export function setupLeaderBoard(): void {
  const sign = findSign()
  if (sign === null) {
    console.log(
      `[golf] LEADERBOARD: no entity named "${LEADER_BOARD.entityName}" in the scene, so there is ` +
        'nothing to write on. Name the sign in Creator Hub and save, or change ' +
        'LEADER_BOARD.entityName in config.ts to match what it is called.'
    )
    return
  }

  const on = Transform.getOrNull(sign)
  if (!on) {
    console.log(`[golf] LEADERBOARD: "${LEADER_BOARD.entityName}" has no transform`)
    return
  }

  // Parented to the sign with its scale divided back out, so everything below
  // is in metres whatever the sign is scaled to, and the board follows it if it
  // is ever moved.
  anchor = engine.addEntity()
  Transform.create(anchor, {
    position: Vector3.Zero(),
    scale: Vector3.create(1 / (on.scale.x || 1), 1 / (on.scale.y || 1), 1 / (on.scale.z || 1)),
    parent: sign
  })

  if (LEADER_BOARD.probeOrientation) {
    probe(anchor)
    console.log(
      '[golf] LEADERBOARD: orientation probe is on. Four labels are drawn, one per ' +
        'quarter turn. Whichever reads correctly facing you is the value for ' +
        'LEADER_BOARD.textYaw — set it, then set probeOrientation to false.'
    )
    return
  }

  // The heading and its note are centred on the parchment; the three row
  // columns sit at their own offsets from its left edge.
  const middle = LEADER_BOARD.textX
  const left = LEADER_BOARD.textX - LEADER_BOARD.width / 2

  heading = text(anchor, middle, LEADER_BOARD.headingY, LEADER_BOARD.headingSize, GOLD)
  note = text(anchor, middle, LEADER_BOARD.headingY - LEADER_BOARD.noteDrop, LEADER_BOARD.noteSize, DIM)
  empty = text(anchor, middle, LEADER_BOARD.rowsTop, LEADER_BOARD.noteSize, DIM)

  for (let i = 0; i < LEADER_BOARD.maxRows; i++) {
    const y = LEADER_BOARD.rowsTop - LEADER_BOARD.rowHeight * i
    lines.push({
      place: text(anchor, left + LEADER_BOARD.placeX, y, LEADER_BOARD.rowSize, DIM),
      who: text(anchor, left + LEADER_BOARD.nameX, y, LEADER_BOARD.rowSize, CREAM),
      figure: text(anchor, left + LEADER_BOARD.valueX, y, LEADER_BOARD.rowSize, GOLD),
      // Nudged down by portraitDrop: a TextShape is centred on its entity, and
      // a plane is too, but the glyphs sit high inside their own line box, so
      // the two do not read as level without it.
      face: portrait(anchor, left + LEADER_BOARD.portraitX, y + LEADER_BOARD.portraitDrop),
      facing: ''
    })
  }

  engine.addSystem(updateLeaderBoard)
  console.log(
    `[golf] leaderboard on "${LEADER_BOARD.entityName}", ${LEADER_BOARD.pages.length} pages ` +
      `of ${LEADER_BOARD.maxRows}, ${LEADER_BOARD.pageSeconds}s each`
  )
}

// ---------------------------------------------------------------------------
// Updating
// ---------------------------------------------------------------------------

function show(e: Entity, visible: boolean): void {
  VisibilityComponent.createOrReplace(e, { visible })
}

let refresh = 0

export function updateLeaderBoard(dt: number): void {
  if (!anchor || !heading || !note || !empty) return

  // The page turns on its own clock rather than the refresh clock, so changing
  // how often the sign redraws never changes how long a page is up for.
  onPage += dt
  if (onPage >= LEADER_BOARD.pageSeconds && LEADER_BOARD.pages.length > 0) {
    onPage = 0
    page = (page + 1) % LEADER_BOARD.pages.length
  }

  refresh -= dt
  if (refresh > 0) return
  refresh = LEADER_BOARD.refreshInterval

  const current = LEADER_BOARD.pages[page]
  if (!current) return

  TextShape.getMutable(heading).text = current.heading
  TextShape.getMutable(note).text = fit(current.note, LEADER_BOARD.noteSize, LEADER_BOARD.width)

  const rows = standingsPage(current.key).slice(0, LEADER_BOARD.maxRows)
  const none = rows.length === 0

  show(empty, none)
  // Three different silences, and they mean different things. Worth saying
  // which, because "nobody has done this yet" and "the server has not answered"
  // look identical on a blank sign and only one of them is a fault.
  TextShape.getMutable(empty).text = !standingsHeard()
    ? 'Waiting for the ledger…'
    : none
      ? 'Nobody yet. Be the first.'
      : ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const row = rows[i]

    if (!row) {
      show(line.place, false)
      show(line.who, false)
      show(line.figure, false)
      show(line.face, false)
      continue
    }

    show(line.place, true)
    show(line.who, true)
    show(line.figure, true)
    // A row without a userId still shows a name — it is a row from an older
    // server, not a broken one — so the portrait is hidden rather than the row.
    show(line.face, row.userId.length > 0)

    // Only when the face on it is not already the right one. The board
    // refreshes twice a second and the tables move every fifteen; replacing a
    // Material every frame would have the explorer re-resolving five avatar
    // textures a hundred and twenty times a minute for a picture that has not
    // changed.
    if (row.userId.length > 0 && line.facing !== row.userId) {
      line.facing = row.userId
      Material.setBasicMaterial(line.face, {
        texture: Material.Texture.Avatar({ userId: row.userId }),
        castShadows: false
      })
    }

    const number = `${i + 1}`
    TextShape.getMutable(line.place).text = number

    // The name is centred on nameX, so it runs half its width *each way* and
    // has two things to avoid, not one: the figure on its right and the
    // position number on its left. Bounding only the right was the first
    // version, and with a sixteen-character name it reached back over the
    // number. So the room it gets is twice the smaller of the two gaps, each
    // measured to the near edge of whatever is sitting there.
    const half = (s: string) => (s.length * PER_CHARACTER * LEADER_BOARD.rowSize) / 2
    const toFigure = LEADER_BOARD.valueX - LEADER_BOARD.nameX - half(row.figure)
    const toNumber = LEADER_BOARD.nameX - LEADER_BOARD.placeX - half(number)
    const room = 2 * Math.min(toFigure, toNumber)
    TextShape.getMutable(line.who).text = fit(row.name, LEADER_BOARD.rowSize, Math.max(0.2, room))
    TextShape.getMutable(line.figure).text = row.figure
    // Gold for the top line, cream for everyone else. The board is short
    // enough that a full gradient would be fussy; one highlight says which row
    // is the answer to the heading.
    TextShape.getMutable(line.who).textColor = i === 0 ? GOLD : CREAM
  }
}

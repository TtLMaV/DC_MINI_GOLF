import { Color4 } from '@dcl/sdk/math'
import { UiBackgroundProps } from '@dcl/sdk/react-ecs'

/**
 * The look of the HUD, in one place.
 *
 * Every panel in hud.tsx asks this module what it should be drawn with, so the
 * whole interface can be re-skinned without touching a single layout.
 *
 * ---------------------------------------------------------------------------
 * Frames
 * ---------------------------------------------------------------------------
 * Decentraland's UI has no rounded corners, no border, no shadow and no
 * gradient. Anything that is not a flat rectangle has to be a texture, and the
 * way to make one texture fit panels of every size is nine-slicing: the four
 * corners are drawn at their own size, the four edges stretch along their run,
 * and the middle stretches to fill. So one carved frame with gold brackets
 * serves the scorecard, the inventory and a 46-pixel chip alike.
 *
 * `textureSlices` are fractions of the texture, not pixels — 48px of border on
 * a 256px image is 0.1875.
 *
 * Until the art exists, `useTextures` is false and every frame falls back to
 * the flat colour it was before. Nothing looks broken while the PNGs are being
 * painted, and turning them on is one boolean.
 */

export const THEME = {
  /** The frames exist. Set false to fall back to flat colour everywhere. */
  useTextures: true,
  /** Where the frame art lives. */
  path: 'assets/scene/ui'
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/** Panel ground: dark, warm, and opaque enough to read white text on grass. */
export const INK = Color4.create(0.09, 0.07, 0.06, 0.88)
/** A softer ground for rows and secondary plates. */
export const INK_SOFT = Color4.create(0.09, 0.07, 0.06, 0.62)
/** Rules, brackets and anything that wants to look like brass. */
export const GOLD = Color4.create(0.95, 0.78, 0.33, 1)
export const CREAM = Color4.create(0.97, 0.96, 0.92, 1)
export const DIM = Color4.create(0.68, 0.63, 0.56, 1)
export const GOOD = Color4.create(0.42, 0.88, 0.5, 1)
export const BAD = Color4.create(0.96, 0.44, 0.4, 1)
/** Behind the label that is drawn twice, to fake an outline. */
export const SHADOW = Color4.create(0.04, 0.03, 0.02, 0.9)
/** The wash behind a highlighted row. */
export const PICKED = Color4.create(0.95, 0.78, 0.33, 0.2)

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

type Frame = {
  file: string
  /** Border inset as a fraction of the texture, per the SDK's units. */
  slice: number
  /** What to draw while the texture does not exist. */
  fallback: Color4
}

/**
 * The four frames the HUD needs.
 *
 * Four rather than one because a 48-pixel border looks right around a 400px
 * scorecard and swallows a 46px chip whole — the corner art has to be cut for
 * roughly the size it will be drawn at.
 */
export const FRAMES = {
  /**
   * Big panels: scorecard, inventory, dialogue, the test panel.
   *
   * 24px of border on a 256px file. The first cut was 48 and it was far too
   * much — the strips at the top of the screen are only 62 tall, so a heavy
   * border leaves almost no middle and the text ends up under the brackets.
   */
  panel: { file: 'frame-panel.png', slice: 0.09375, fallback: INK } as Frame,
  /** The same, lit — for the panel or row that currently matters. */
  panelLit: { file: 'frame-panel-lit.png', slice: 0.09375, fallback: INK } as Frame,
  /** Anything you press: buttons, tabs, inventory rows. 12px on 96. */
  button: { file: 'frame-button.png', slice: 0.125, fallback: INK_SOFT } as Frame,
  /** Small plates: the points counter, tracker rows. 8px on 64. */
  chip: { file: 'frame-chip.png', slice: 0.125, fallback: INK_SOFT } as Frame
}

/**
 * A background for a panel.
 *
 * `tint` recolours the texture, so a single grey-brown frame can be washed
 * gold for the row you are on rather than needing a second file.
 */
export function frame(of: Frame, tint?: Color4): UiBackgroundProps {
  if (!THEME.useTextures) return { color: tint ?? of.fallback }

  return {
    texture: { src: `${THEME.path}/${of.file}` },
    textureMode: 'nine-slices',
    textureSlices: { top: of.slice, right: of.slice, bottom: of.slice, left: of.slice },
    // A tint MULTIPLIES the texture, alpha included — so the washes used as
    // flat fills, which are deliberately faint, would drop a whole frame to a
    // fifth of its opacity. Opaque here, and let the colour do the tinting
    // rather than the transparency.
    color: tint ? Color4.create(tint.r, tint.g, tint.b, 1) : Color4.White()
  }
}

export const panel = (tint?: Color4) => frame(FRAMES.panel, tint)
export const panelLit = (tint?: Color4) => frame(FRAMES.panelLit, tint)
export const button = (tint?: Color4) => frame(FRAMES.button, tint)
export const chip = (tint?: Color4) => frame(FRAMES.chip, tint)

// ---------------------------------------------------------------------------
// Faces
// ---------------------------------------------------------------------------

/**
 * A player's own avatar, as a background.
 *
 * Better than a set of drawn portraits would be: it is the person actually
 * standing on the course, so a scorecard of four reads as four people rather
 * than four rows.
 */
export function face(userId: string): UiBackgroundProps {
  return { avatarTexture: { userId }, textureMode: 'stretch' }
}

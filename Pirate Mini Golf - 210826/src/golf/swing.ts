import { SWING } from './config'

/**
 * The three-click swing meter.
 *
 * This is the mechanic from Everybody's Golf and it replaces hold-to-charge,
 * which gave you no way to be precise and no way to miss interestingly:
 *
 *   click 1  the cursor starts sweeping right along the bar
 *   click 2  locks power wherever the cursor is
 *   click 3  the cursor sweeps back to the impact line; how close you stop it
 *            to that line decides how straight the ball goes
 *
 * Stopping late pushes the shot one way, early pushes it the other, and letting
 * the cursor run off the end is the worst miss available. Power and direction
 * are set separately, so a soft shot can be struck perfectly and a full-blooded
 * one can be sprayed — which is the whole point of a golf swing.
 */

export type SwingPhase = 'idle' | 'power' | 'accuracy' | 'struck'

export type Swing = {
  phase: SwingPhase
  /** Cursor position along the bar, 0 at the impact line, 1 at the far end. */
  cursor: number
  /** Locked power, 0..1. Meaningful from the accuracy phase onwards. */
  power: number
  /**
   * Signed miss on the impact click, -1..1. Zero is a pure strike; positive
   * means the cursor was stopped past the line, negative means short of it.
   */
  offset: number
}

export function createSwing(): Swing {
  return { phase: 'idle', cursor: 0, power: 0, offset: 0 }
}

export function resetSwing(swing: Swing): void {
  swing.phase = 'idle'
  swing.cursor = 0
  swing.power = 0
  swing.offset = 0
}

/**
 * Advances the meter. `click` is true on the frame the button went down.
 * Returns true on the frame the swing completes, i.e. hit the ball now.
 */
export function updateSwing(swing: Swing, dt: number, click: boolean): boolean {
  switch (swing.phase) {
    case 'idle':
      if (click) {
        swing.phase = 'power'
        swing.cursor = 0
        swing.power = 0
        swing.offset = 0
      }
      return false

    case 'power': {
      if (click) {
        swing.power = Math.max(SWING.minPower, swing.cursor)
        swing.phase = 'accuracy'
        return false
      }
      swing.cursor = Math.min(1, swing.cursor + dt / SWING.powerSweepTime)
      // Held at the top rather than wrapping: running out of bar is a decision
      // point, not a punishment.
      return false
    }

    case 'accuracy': {
      if (click) {
        swing.offset = clampOffset(swing.cursor)
        swing.phase = 'struck'
        return true
      }
      swing.cursor -= dt / SWING.accuracySweepTime
      if (swing.cursor <= -SWING.overrun) {
        // Never clicked: the worst miss the meter can give.
        swing.offset = -1
        swing.phase = 'struck'
        return true
      }
      return false
    }

    default:
      return false
  }
}

/** Cursor position at the impact click -> signed miss in -1..1. */
function clampOffset(cursor: number): number {
  const raw = cursor / SWING.impactWindow
  return Math.max(-1, Math.min(1, raw))
}

/** How far off line the shot goes, in degrees. */
export function deviationDegrees(swing: Swing): number {
  return swing.offset * SWING.maxDeviationDegrees
}

/** Miss sizes, in offset units, that separate the strike grades. */
export const PERFECT_OFFSET = 0.15
export const GOOD_OFFSET = 0.4

/** 0..1, how clean the strike was. 1 is dead on the line. */
export function strikeQuality(swing: Swing): number {
  return Math.max(0, 1 - Math.abs(swing.offset))
}

/** Label for the HUD after the ball is struck. */
export function strikeLabel(swing: Swing): string {
  const miss = Math.abs(swing.offset)
  if (miss <= PERFECT_OFFSET) return 'PERFECT'
  if (miss <= GOOD_OFFSET) return 'GOOD'
  if (miss <= 0.75) return swing.offset > 0 ? 'PUSHED' : 'PULLED'
  return swing.offset > 0 ? 'SLICED' : 'HOOKED'
}

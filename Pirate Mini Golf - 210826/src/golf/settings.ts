/**
 * What the player has changed about their own game.
 *
 * A module of its own rather than a couple of flags in hud.tsx, because the
 * HUD is not the only thing that has to read them: the panel that sets them is
 * in hud.tsx and the code that obeys them is in game.ts, and having game.ts
 * import from the HUD to find out whether somebody minds being spoken to is
 * exactly the sort of dependency that turns two modules into one.
 *
 * ---------------------------------------------------------------------------
 * Where they are kept
 * ---------------------------------------------------------------------------
 * On the server, in the same wallet that holds quest progress, points and kit.
 * A setting that forgets itself between visits is worse than no setting: the
 * player turns it on, comes back, finds it off, and concludes the switch does
 * not work rather than that it was never saved.
 *
 * This module knows nothing about rooms or messages. points.ts owns the
 * connection, so it hands the saved values in through applySavedSettings and
 * takes changes back out through onSettingChanged. That keeps the dependency
 * pointing one way — points.ts imports this, this imports nothing — and means
 * a settings read costs nothing at the point of use, which matters because
 * game.ts reads one of them every frame.
 *
 * Read through setting() rather than by exporting the object, so a caller
 * cannot quietly write to it from somewhere that is not the settings tab.
 */
export type Settings = {
  /** Hide the line at the bottom of the screen saying what to do next. */
  hidePrompts: boolean
  /** Let characters start a conversation while a round is on. */
  talkInRounds: boolean
}

const settings: Settings = {
  hidePrompts: false,
  talkInRounds: false
}

/** The keys the server is allowed to set, so a stale save cannot invent one. */
const KEYS: (keyof Settings)[] = ['hidePrompts', 'talkInRounds']

let push: ((key: string, on: boolean) => void) | null = null

export function setting<K extends keyof Settings>(key: K): Settings[K] {
  return settings[key]
}

export function toggleSetting(key: keyof Settings): void {
  settings[key] = !settings[key]
  push?.(key, settings[key])
}

/**
 * What the server was holding when this player arrived.
 *
 * Only the keys this build knows about are taken. A wallet saved by an older
 * or newer build can carry anything, and a setting the code has never heard of
 * is not something to start honouring on the strength of a stored string.
 */
export function applySavedSettings(saved: Record<string, unknown>): void {
  for (const key of KEYS) {
    const value = saved[key]
    if (typeof value === 'boolean') settings[key] = value
  }
}

/** Registered by points.ts, so a change made in the panel gets sent on. */
export function onSettingChanged(fn: (key: string, on: boolean) => void): void {
  push = fn
}

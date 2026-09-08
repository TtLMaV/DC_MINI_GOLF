import { UI } from './strings-ui'
import { NPCS } from './strings-npc'
import { QUEST_TEXT } from './strings-quests'

/**
 * The engine behind everything the game says.
 *
 * ---------------------------------------------------------------------------
 * Why the writing is not where it is used
 * ---------------------------------------------------------------------------
 * There are about 4,600 words of player-facing writing in this scene, and
 * before this file they were literals spread over a dozen modules, most of
 * them built out of live numbers inside functions. A second language is
 * impossible while that is true: you cannot translate a sentence that only
 * exists for the frame it is drawn in.
 *
 * So the sentences live under ids and the code asks for them by id. English is
 * the source of truth and every other table may be incomplete: a missing line
 * falls back to English rather than to a blank panel, which is what makes
 * translating a thing you can do a character at a time.
 *
 * ---------------------------------------------------------------------------
 * Where the tables are
 * ---------------------------------------------------------------------------
 * Split by area rather than kept in one file, because one file would be four
 * thousand lines and nobody would ever read it, least of all a translator:
 *
 *   strings-ui.ts      the HUD, the panels, the boards and the signs
 *   strings-npc.ts     the five characters
 *   strings-quests.ts  the fifteen quests
 *
 * Those files import nothing. They are data, and keeping them that way is what
 * makes it safe for this module to pull them all in without a cycle.
 *
 * ---------------------------------------------------------------------------
 * Placeholders
 * ---------------------------------------------------------------------------
 * `{name}` in a line, `t('id', { name: value })` at the point of use. Named
 * rather than numbered, because word order is not a constant: a translator who
 * cannot move the number around the sentence will write a bad sentence to keep
 * the code happy.
 */

export type Lang = 'en' | 'es' | 'de' | 'fr'

/** One area's tables. Every area file exports exactly this shape. */
export type Tables = Record<Lang, Record<string, string>>

/**
 * The languages on offer, in the order the picker shows them.
 *
 * `name` is written in its own language, because somebody looking for their
 * language is looking for the word they would use for it. `short` is what the
 * picker actually draws: four full names will not fit across the width the
 * settings panel has for a row's answer, and a two-letter code is a thing
 * everybody already reads without being taught.
 */
export const LANGUAGES: { code: Lang; name: string; short: string }[] = [
  { code: 'en', name: 'EN', short: 'EN' },
  { code: 'es', name: 'ES', short: 'ES' },
  { code: 'de', name: 'DE', short: 'DE' },
  { code: 'fr', name: 'FR', short: 'FR' }
]

export function isLang(code: string): code is Lang {
  return LANGUAGES.some((l) => l.code === code)
}

// ---------------------------------------------------------------------------
// Assembling
// ---------------------------------------------------------------------------

function merge(...areas: Tables[]): Tables {
  const out = { en: {}, es: {}, de: {}, fr: {} } as Tables
  for (const area of areas) {
    for (const lang of ['en', 'es', 'de', 'fr'] as Lang[]) {
      for (const id in area[lang]) out[lang][id] = area[lang][id]
    }
  }
  return out
}

const TABLES = merge(UI as Tables, NPCS as Tables, QUEST_TEXT as Tables)

// ---------------------------------------------------------------------------
// Asking for a line
// ---------------------------------------------------------------------------

let active: Lang = 'en'

export function language(): Lang {
  return active
}

/**
 * Switches language.
 *
 * Nothing is redrawn or rebuilt. The HUD calls t() every frame, the dialogue
 * nodes call it every time they are shown, and the signs are rewritten on
 * their own clock, so the change is on screen within a frame and inside the
 * next sentence anybody says. That is the whole reason every line is fetched
 * rather than baked.
 */
export function setActiveLanguage(code: Lang): void {
  active = code
}

/**
 * One line, in the current language, with its blanks filled.
 *
 * A missing id falls back to English, and an id in no table at all comes back
 * as itself. Both are deliberate: the first means a half-finished translation
 * is usable, and the second means a typo shows up on screen as `hud.parLine`
 * rather than as an empty panel nobody can explain.
 */
export function t(id: string, vars?: Record<string, string | number>): string {
  const line = TABLES[active][id] ?? TABLES.en[id]
  if (line === undefined) return id
  if (!vars) return line
  let out = line
  for (const key in vars) out = out.split(`{${key}}`).join(String(vars[key]))
  return out
}

/**
 * A line whose English lives in the data rather than in here.
 *
 * The quests are the case this exists for. QUESTS in quests.ts carries the
 * English for every field already, and it is the right place for it: that
 * array is the definition of a quest and reads as one. So the table here holds
 * the other three languages, this hands back the English when there is no row,
 * and neither copy has to be kept in step with the other.
 *
 * It leans on t() returning the id it was given when it finds nothing, which
 * is the same behaviour that makes a typo visible on screen.
 */
export function tOr(id: string, fallback: string, vars?: Record<string, string | number>): string {
  const line = t(id, vars)
  return line === id ? fallback : line
}

/**
 * A name that lives in the data rather than in here.
 *
 * Hole names, rank names, item names: things written into course.ts, ranks.ts
 * and shop.ts as part of a record, where pulling the string out would mean
 * inventing an id field on every row and editing every row to carry it.
 *
 * Instead the English IS the id, slugged. `tName('hole', "Anchor's Rest")`
 * looks for `hole.anchors-rest`, and hands back the English it was given if
 * there is nothing there. So a hole nobody has translated reads in English, a
 * hole renamed in English falls back rather than breaking, and adding a
 * language is adding rows to a table and touching no data at all.
 */
export function tName(prefix: string, english: string): string {
  return t(`${prefix}.${slug(english)}`, {}) === `${prefix}.${slug(english)}`
    ? english
    : t(`${prefix}.${slug(english)}`)
}

/** Lowercase, apostrophes dropped, everything else that is not a letter or a digit becomes a dash. */
export function slug(text: string): string {
  let out = ''
  let dash = false
  for (const ch of text.toLowerCase()) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      out += ch
      dash = false
    } else if (ch === "'" || ch === '’') {
      // Dropped rather than turned into a dash, so "Anchor's Rest" is
      // anchors-rest and not anchor-s-rest.
      continue
    } else if (!dash && out.length > 0) {
      out += '-'
      dash = true
    }
  }
  return dash ? out.slice(0, -1) : out
}

/**
 * What is still in English, for whoever is doing the next language.
 *
 * Not called anywhere. It is here so that "how much is left" is a question the
 * code can answer rather than one somebody counts by hand and gets wrong.
 */
export function untranslated(code: Lang): string[] {
  return Object.keys(TABLES.en).filter((id) => TABLES[code][id] === undefined)
}

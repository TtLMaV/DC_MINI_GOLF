/**
 * Pixel Points — the ledger.
 *
 * Drop this into the dcl-leaderboard Vercel project. It expects three routes,
 * all POST, all called with Decentraland's signed fetch:
 *
 *   /api/points/balance   what this player has, and which once-ever awards
 *                         they have already collected
 *   /api/points/round     a finished nine-hole card, in exchange for an award
 *   /api/points/claim     a once-ever award — the secret hole, a finished
 *                         quest — named by key, priced by CLAIMS below
 *
 * ---------------------------------------------------------------------------
 * The wallet is keyed on the player, never on the game
 * ---------------------------------------------------------------------------
 * pp:wallet:<address> is a single balance for a person, and every credit
 * carries a source. Right now the only source is 'golf'. When a second scene
 * pays in it writes to the same key with its own source, and nobody's balance
 * has to be migrated, merged, or explained to them. Keying this on the game
 * would be the one decision here that is expensive to undo, because by the
 * time you want to undo it the numbers are real to people.
 *
 * ---------------------------------------------------------------------------
 * What this can and cannot promise
 * ---------------------------------------------------------------------------
 * It recomputes the award from the card, so the payout table cannot be forged
 * from the scene and can be retuned here without redeploying the scene.
 *
 * It cannot know the card itself is honest. Knowing that would mean simulating
 * golf on the server, and the scene would have to send every shot — which is
 * exactly the write volume this design exists to avoid. So instead: the card
 * must be well formed, and a player may only bank a round every so often.
 * That is the actual guarantee. It is worth being straight about rather than
 * calling it secure.
 *
 * ---------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------
 * One write per completed round, plus one per once-ever award — the secret
 * hole, each quest — and that is per player, ever. Reads are one per arrival.
 * Quest progress is deliberately never written: that would be a request per
 * putt. This is deliberately frugal — the in-scene
 * leaderboard went down once already on a free-tier command cap, and a
 * currency crediting shot by shot would be that mistake with more traffic.
 *
 * Environment: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.
 */

import { Authenticator } from '@dcl/crypto'

// ---------------------------------------------------------------------------
// The table. This copy is the one that pays.
// ---------------------------------------------------------------------------

const PARS = [2, 3, 3, 3, 4, 3, 4, 4, 6]
const TOTAL_PAR = PARS.reduce((n, p) => n + p, 0)

const AWARD = {
  finish: 50,
  par: 5,
  birdie: 15,
  eagle: 40,
  holeInOne: 50,
  personalBest: 30,
  firstOfDay: 25,
  secretHole: 150
}

/**
 * Everything that can be earned exactly once, and what it pays.
 *
 * The client names a key, never an amount. An unknown key pays nothing, so a
 * quest that has not been added here cannot be handed in — which is the right
 * failure: no points invented, and obvious the moment it is tested.
 */
const CLAIMS: Record<string, number> = {
  secret: 150,
  'quest:five-aces': 150
}

/** Ten is the in-scene pick-up limit; a card claiming more is not a card. */
const MAX_STROKES = 10
/** A round cannot be banked more often than this. Nine holes take longer. */
const ROUND_COOLDOWN_SECONDS = 240

// ---------------------------------------------------------------------------
// Upstash
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL ?? ''
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? ''

async function redis(command: (string | number)[]): Promise<any> {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  })
  if (!res.ok) throw new Error(`upstash ${res.status}`)
  const json = (await res.json()) as { result?: unknown; error?: string }
  if (json.error) throw new Error(json.error)
  return json.result
}

/**
 * Several commands down one connection.
 *
 * Upstash bills by command, not by request, so this saves nothing on the quota
 * — but it does save round trips, and it keeps a read-then-write from being
 * two separate chances to fail halfway.
 */
async function pipeline(commands: (string | number)[][]): Promise<any[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  })
  if (!res.ok) throw new Error(`upstash ${res.status}`)
  const json = (await res.json()) as { result: unknown }[]
  return json.map((r) => r.result)
}

const walletKey = (address: string) => `pp:wallet:${address.toLowerCase()}`
const metaKey = (address: string) => `pp:meta:${address.toLowerCase()}`

// ---------------------------------------------------------------------------
// Who is asking
// ---------------------------------------------------------------------------

/**
 * Verifies Decentraland's signed fetch and returns the signing address.
 *
 * The scene cannot say who it is; the explorer signs the request with the
 * player's own key and the auth chain travels in the headers. Without this
 * step every route here is a free points faucet for anyone with curl, which is
 * the failure mode worth caring about — cheating at golf is a game problem,
 * minting currency without playing is not.
 */
async function addressFrom(req: Request, path: string, body: string): Promise<string | null> {
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v))

  const chain: unknown[] = []
  for (let i = 0; ; i++) {
    const raw = headers[`x-identity-auth-chain-${i}`]
    if (!raw) break
    try {
      chain.push(JSON.parse(raw))
    } catch {
      return null
    }
  }
  if (chain.length === 0) return null

  const timestamp = Number(headers['x-identity-timestamp'] ?? '0')
  const metadata = headers['x-identity-metadata'] ?? '{}'

  // Five minutes either way. A replayed request older than that is refused, so
  // a captured round cannot be banked over and over.
  if (!timestamp || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) return null

  const payload = [path.toLowerCase(), timestamp, metadata].join(':')
  const result = await Authenticator.validateSignature(payload, chain as any, null as any, timestamp)
  if (!result.ok) return null

  void body
  return (chain[0] as { payload: string }).payload.toLowerCase()
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

type Line = { label: string; points: number }

function cardIsWellFormed(card: unknown): card is number[] {
  if (!Array.isArray(card) || card.length !== PARS.length) return false
  return card.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_STROKES)
}

/**
 * What a card is worth.
 *
 * A hole in one pays holeInOne and nothing else — on a par 3 it is an eagle as
 * well, and paying twice for one swing reads as a bug to the player even when
 * it is generous.
 */
function scoreCard(card: number[]): { lines: Line[]; total: number } {
  const lines: Line[] = [{ label: 'Round complete', points: AWARD.finish }]

  let pars = 0
  let birdies = 0
  let eagles = 0
  let aces = 0
  for (let i = 0; i < PARS.length; i++) {
    const strokes = card[i]
    if (strokes === 1) aces++
    else if (strokes - PARS[i] <= -2) eagles++
    else if (strokes - PARS[i] === -1) birdies++
    else if (strokes === PARS[i]) pars++
  }

  if (pars) lines.push({ label: `${pars} par${pars === 1 ? '' : 's'}`, points: pars * AWARD.par })
  if (birdies) lines.push({ label: `${birdies} birdie${birdies === 1 ? '' : 's'}`, points: birdies * AWARD.birdie })
  if (eagles) lines.push({ label: `${eagles} eagle${eagles === 1 ? '' : 's'}`, points: eagles * AWARD.eagle })
  if (aces) lines.push({ label: `${aces} hole in one`, points: aces * AWARD.holeInOne })

  return { lines, total: lines.reduce((n, l) => n + l.points, 0) }
}

const today = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

export async function balanceRoute(req: Request): Promise<Response> {
  const body = await req.text()
  const address = await addressFrom(req, '/api/points/balance', body)
  if (!address) return json({ error: 'unauthorised' }, 401)

  const [bal, meta] = await pipeline([
    ['GET', walletKey(address)],
    ['HGETALL', metaKey(address)]
  ])

  // Which one-time things this player has already had, so the scene does not
  // offer a finished quest back to them as though it were new.
  const claims: string[] = []
  const flat = Array.isArray(meta) ? (meta as string[]) : []
  for (let i = 0; i < flat.length; i += 2) {
    if (flat[i]?.startsWith('claim:') && flat[i + 1] === '1') claims.push(flat[i].slice(6))
  }

  return json({ balance: Number(bal ?? 0), claims })
}

export async function roundRoute(req: Request): Promise<Response> {
  const body = await req.text()
  const address = await addressFrom(req, '/api/points/round', body)
  if (!address) return json({ error: 'unauthorised' }, 401)

  let parsed: { card?: unknown; source?: unknown }
  try {
    parsed = JSON.parse(body)
  } catch {
    return json({ error: 'bad body' }, 400)
  }
  if (!cardIsWellFormed(parsed.card)) return json({ error: 'bad card' }, 400)
  const card = parsed.card
  const source = typeof parsed.source === 'string' ? parsed.source : 'golf'

  const meta = metaKey(address)
  const [lastRaw, bestRaw, dayRaw] = await pipeline([
    ['HGET', meta, 'lastRound'],
    ['HGET', meta, 'best'],
    ['HGET', meta, 'lastDay']
  ])

  // The rate limit is the honest half of the anti-farm story: the card cannot
  // be verified, but it can only be banked as fast as a round can be played.
  const now = Math.floor(Date.now() / 1000)
  const last = Number(lastRaw ?? 0)
  if (last && now - last < ROUND_COOLDOWN_SECONDS) {
    return json({ error: 'too soon', balance: Number((await redis(['GET', walletKey(address)])) ?? 0) }, 429)
  }

  const { lines, total } = scoreCard(card)
  let awarded = total

  const strokes = card.reduce((n, s) => n + s, 0)
  const best = Number(bestRaw ?? 0)
  if (!best || strokes < best) {
    lines.push({ label: 'Personal best', points: AWARD.personalBest })
    awarded += AWARD.personalBest
  }

  const day = today()
  if (dayRaw !== day) {
    lines.push({ label: 'First round today', points: AWARD.firstOfDay })
    awarded += AWARD.firstOfDay
  }

  const [balAfter] = await pipeline([
    ['INCRBY', walletKey(address), awarded],
    ['HSET', meta, 'lastRound', now, 'lastDay', day, 'best', !best || strokes < best ? strokes : best],
    // A short ledger of the last few credits, so a player asking "where did
    // this come from" can be answered without guessing.
    ['LPUSH', `pp:log:${address.toLowerCase()}`, JSON.stringify({ at: now, source, awarded, strokes, par: TOTAL_PAR })],
    ['LTRIM', `pp:log:${address.toLowerCase()}`, 0, 19]
  ])

  return json({ balance: Number(balAfter ?? 0), awarded, lines })
}

/**
 * Claims a once-ever award: the secret hole, a finished quest.
 *
 * HSETNX is what makes it once-ever rather than once-a-visit — it returns 0 if
 * the flag is already there, and a second attempt credits nothing.
 */
export async function claimRoute(req: Request): Promise<Response> {
  const body = await req.text()
  const address = await addressFrom(req, '/api/points/claim', body)
  if (!address) return json({ error: 'unauthorised' }, 401)

  let parsed: { key?: unknown }
  try {
    parsed = JSON.parse(body)
  } catch {
    return json({ error: 'bad body' }, 400)
  }
  const key = typeof parsed.key === 'string' ? parsed.key : ''
  const amount = CLAIMS[key]
  if (!amount) return json({ error: 'unknown claim' }, 400)

  const meta = metaKey(address)
  const first = await redis(['HSETNX', meta, `claim:${key}`, '1'])
  if (Number(first) !== 1) {
    const bal = await redis(['GET', walletKey(address)])
    return json({ balance: Number(bal ?? 0), awarded: 0, alreadyClaimed: true })
  }

  const bal = await redis(['INCRBY', walletKey(address), amount])
  return json({ balance: Number(bal ?? 0), awarded: amount })
}

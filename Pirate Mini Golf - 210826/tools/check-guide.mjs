/**
 * Checks the aim guide against the real collision mesh.
 *
 * The guide drapes itself by casting straight down at intervals along the aim
 * line. This runs exactly that walk from every tee, towards that hole's pin, and
 * reports how much of the guide finds ground and what slope it reads — which is
 * what the HUD shows the player. Run with: node tools/check-guide.mjs
 */
import { readFileSync } from 'fs'

function load(file, name) {
  const s = readFileSync(new URL(`../src/collisionData/${file}`, import.meta.url), 'utf8')
  return JSON.parse(s.slice(s.indexOf('{')).trim().replace(/;$/, ''))
}
const course = load('course_collision.ts')
const V = course.vertices
const I = course.indices

// Same idea as the cannon downward ray, done directly against the triangles.
function probe(x, z, aroundY, up = 0.6, down = 2.5) {
  const hi = aroundY + up
  const lo = aroundY - down
  let best = null
  let bestNy = 1
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3
    const ax = V[a], ay = V[a + 1], az = V[a + 2]
    const bx = V[b], by = V[b + 1], bz = V[b + 2]
    const cx = V[c], cy = V[c + 1], cz = V[c + 2]
    const v0x = cx - ax, v0z = cz - az
    const v1x = bx - ax, v1z = bz - az
    const v2x = x - ax, v2z = z - az
    const d00 = v0x * v0x + v0z * v0z
    const d01 = v0x * v1x + v0z * v1z
    const d11 = v1x * v1x + v1z * v1z
    const d02 = v2x * v0x + v2z * v0z
    const d12 = v2x * v1x + v2z * v1z
    const den = d00 * d11 - d01 * d01
    if (Math.abs(den) < 1e-12) continue
    const u = (d11 * d02 - d01 * d12) / den
    const v = (d00 * d12 - d01 * d02) / den
    if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    if (Math.abs(ny) < 1e-7) continue
    const y = ay - ((x - ax) * nx + (z - az) * nz) / ny
    if (y > hi || y < lo) continue
    if (best === null || y > best) {
      best = y // closest to the ray origin above
      bestNy = Math.abs(ny) / Math.hypot(nx, ny, nz)
    }
  }
  return best === null ? null : { y: best, ny: bestNy }
}

const MAX_STEP_UP = 0.14
const MAX_STEP_DOWN = 0.45
const HARD_STEP_UP = 0.4
const FLAT_NY = 0.97

/** The same walk src/golf/aim.ts does: drape, but stop at a wall or a ledge. */
function walk(x0, z0, y0, ux, uz, step, count) {
  const ys = []
  let lastY = y0
  let blocked = 'none'
  for (let i = 0; i <= count; i++) {
    const hit = probe(x0 + ux * i * step, z0 + uz * i * step, lastY)
    if (hit === null) { blocked = 'edge'; break }
    if (ys.length > 0) {
      const rise = hit.y - lastY
      const landsFlat = hit.ny > FLAT_NY
      if (rise > HARD_STEP_UP || (rise > MAX_STEP_UP && landsFlat)) { blocked = 'wall'; break }
      if (rise < -MAX_STEP_DOWN && landsFlat) { blocked = 'edge'; break }
    }
    ys.push(hit.y)
    lastY = hit.y
  }
  return { ys, blocked }
}

const HOLES = [
  { n: 1, tee: [5.05, 0.2, 14.89], cup: [8.55, 0.2, 10.45] },
  { n: 2, tee: [21.05, 0.4, 17.89], cup: [21.05, 1.0, 12.45] },
  { n: 3, tee: [32.05, 2.0, 16.89], cup: [28.05, 1.0, 16.45] },
  { n: 4, tee: [32.05, 0.2, 30.49], cup: [26.05, 1.0, 30.05] },
  { n: 5, tee: [37.05, 2.4, 34.61], cup: [33.05, 0.8, 41.55] },
  { n: 6, tee: [38.45, 3.2, 57.61], cup: [41.45, 4.52, 62.05] },
  { n: 7, tee: [10.05, 0.2, 50.89], cup: [10.02, 1.6, 42.45] },
  { n: 8, tee: [18.948, 0.4, 25.608], cup: [4.948, 0.4, 26.548] },
  { n: 9, tee: [4.749, 2.0, 59.81], cup: [34.7, 1.0, 75.25] }
]

const SEGMENTS = 16
const LENGTH = 3.4
let bad = 0
console.log('Aim guide check — walking the guide from each tee towards the pin\n')
console.log('     hole | tee y    | guide straight at pin  | best line from tee    | slope on that line')
for (const h of HOLES) {
  const [tx, ty, tz] = h.tee
  const dx = h.cup[0] - tx, dz = h.cup[2] - tz
  const l = Math.hypot(dx, dz)
  const ux = dx / l, uz = dz / l
  const step = LENGTH / SEGMENTS

  const teeHit = probe(tx, tz, ty + 0.2)
  const teeY = teeHit ? +teeHit.y.toFixed(3) : null

  // Straight at the pin, which on a dog-leg runs into the back rail.
  const direct = walk(tx, tz, ty, ux, uz, step, SEGMENTS)

  // Best line available from the tee: the direction the guide runs furthest.
  let best = { ys: [], blocked: 'edge' }, bestA = 0
  for (let a = 0; a < 72; a++) {
    const th = (a / 72) * Math.PI * 2
    const w = walk(tx, tz, ty, Math.sin(th), Math.cos(th), step, SEGMENTS)
    if (w.ys.length > best.ys.length) { best = w; bestA = th }
  }

  const look = Math.min(best.ys.length - 1, Math.max(1, Math.round(1 / step)))
  const slope = look > 0 ? ((best.ys[look] - best.ys[0]) / (look * step)) * 100 : 0
  const deg = (Math.atan(slope / 100) * 180) / Math.PI
  const reads = Math.abs(deg) < 4 ? 'flat' : slope > 0 ? `UPHILL ${Math.round(Math.abs(slope))}%` : `DOWNHILL ${Math.round(Math.abs(slope))}%`
  const ok = teeY !== null && Math.abs(teeY - ty) < 0.05 && best.ys.length > SEGMENTS * 0.6
  if (!ok) bad++
  console.log(
    `${ok ? ' ok ' : 'FAIL'} ${String(h.n).padStart(2)} | ${String(teeY).padStart(8)} | ` +
    `at pin ${String(direct.ys.length).padStart(2)}/${SEGMENTS + 1} ${direct.blocked.padEnd(5)} | ` +
    `best ${String(best.ys.length).padStart(2)}/${SEGMENTS + 1} @ ${String(Math.round(bestA * 180 / Math.PI)).padStart(3)}deg | ` +
    `${slope.toFixed(1).padStart(6)}% ${reads}`
  )
}
console.log(bad === 0 ? '\nGuide finds ground on every tee.' : `\n${bad} hole(s) need a look.`)

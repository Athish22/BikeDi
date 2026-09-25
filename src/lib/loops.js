import { fetchRoundTrip } from './ors.js'

// ORS round trips only aim for a length, and don't control climbing at all.
// So we ask for several candidates with different seeds, calibrate the length
// after a first wave, then score everything against the brief.
const FIRST_WAVE = 5
const SECOND_WAVE = 5
const RESULTS = 3

// ORS surface codes: paved, asphalt, concrete, cobblestone, metal, wood, paving stones
const PAVED = new Set([1, 3, 4, 5, 6, 7, 14])
const UNKNOWN_SURFACE = 0

export async function generateLoops(brief) {
  const target = brief.distanceKm * 1000
  const baseSeed = Math.floor(Math.random() * 100000)

  const wave = (lengthM, count, offset) =>
    Promise.allSettled(
      Array.from({ length: count }, (_, i) =>
        fetchRoundTrip({
          profile: brief.profile,
          start: brief.start,
          lengthM,
          seed: baseSeed + offset + i,
          points: 3 + ((offset + i) % 3),
        }),
      ),
    )

  const first = await wave(target, FIRST_WAVE, 0)
  const firstOk = fulfilled(first)
  if (firstOk.length === 0) throw first[0].reason

  // ORS loops often come out longer or shorter than asked; correct for that.
  const ratio = clamp(median(firstOk.map((r) => r.distanceM / target)), 0.5, 2)
  const second = await wave(target / ratio, SECOND_WAVE, FIRST_WAVE)

  const scored = [...firstOk, ...fulfilled(second)]
    .map((route) => score(route, brief))
    .sort((a, b) => a.score - b.score)

  return pickDistinct(scored, RESULTS)
}

function score(route, brief) {
  const target = brief.distanceKm * 1000
  const distErr = Math.abs(route.distanceM - target) / target

  const { climbMin, climbMax } = brief
  let climbOff = 0 // metres outside the wanted range: negative = too flat, positive = too hilly
  if (route.ascent < climbMin) climbOff = route.ascent - climbMin
  else if (route.ascent > climbMax) climbOff = route.ascent - climbMax
  const climbErr = Math.abs(climbOff) / Math.max(climbMax, 100)

  const retrace = retraceShare(route.coords)

  return {
    ...route,
    distErr,
    climbOff,
    retrace,
    pavedShare: pavedShare(route.surface),
    score: distErr + 1.5 * climbErr + 0.5 * retrace,
  }
}

// Share of the loop that rides the same stretch twice (out-and-back sections).
function retraceShare(coords) {
  const counts = new Map()
  const keys = []
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1][0].toFixed(4) + ',' + coords[i - 1][1].toFixed(4)
    const b = coords[i][0].toFixed(4) + ',' + coords[i][1].toFixed(4)
    if (a === b) continue
    const key = a < b ? a + '|' + b : b + '|' + a
    keys.push(key)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (keys.length === 0) return 0
  return keys.filter((k) => counts.get(k) > 1).length / keys.length
}

function pavedShare(surface) {
  let known = 0
  let paved = 0
  for (const { value, distance } of surface) {
    if (value === UNKNOWN_SURFACE) continue
    known += distance
    if (PAVED.has(value)) paved += distance
  }
  const total = surface.reduce((sum, s) => sum + s.distance, 0)
  // Not enough surface data to say anything useful.
  if (total === 0 || known / total < 0.5) return null
  return paved / known
}

// Different seeds sometimes produce nearly the same loop; keep only distinct ones.
function pickDistinct(routes, count) {
  const picked = []
  for (const route of routes) {
    const cells = cellSet(route.coords)
    if (picked.every((p) => similarity(p.cells, cells) < 0.7)) {
      picked.push({ ...route, cells })
      if (picked.length === count) break
    }
  }
  return picked.map(({ cells, ...route }) => route)
}

function cellSet(coords) {
  return new Set(coords.map(([lng, lat]) => lng.toFixed(3) + ',' + lat.toFixed(3)))
}

function similarity(a, b) {
  let shared = 0
  for (const cell of a) if (b.has(cell)) shared++
  return shared / Math.min(a.size, b.size)
}

function fulfilled(results) {
  return results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value))
}

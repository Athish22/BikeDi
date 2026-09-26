const EARTH_RADIUS_M = 6371000

function haversine([lng1, lat1], [lng2, lat2]) {
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLng = (lng2 - lng1) * toRad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

// Cumulative distance (m) at each coordinate.
export function cumulativeDistances(coords) {
  const dist = [0]
  for (let i = 1; i < coords.length; i++) {
    dist.push(dist[i - 1] + haversine(coords[i - 1], coords[i]))
  }
  return dist
}

// A point counts as a bad elevation reading (e.g. 0 m in the middle of a hill)
// when it jumps away from both neighbours in the same direction, by more than
// SPIKE_MIN_M and steeper than SPIKE_MIN_GRADE on both sides. No road does that.
const SPIKE_MIN_M = 20
const SPIKE_MIN_GRADE = 0.25

function isSpike(prev, cur, next) {
  const up = cur[2] - prev[2]
  const down = cur[2] - next[2]
  if (Math.sign(up) !== Math.sign(down)) return false
  if (Math.abs(up) < SPIKE_MIN_M || Math.abs(down) < SPIKE_MIN_M) return false
  const gradeIn = Math.abs(up) / Math.max(1, haversine(prev, cur))
  const gradeOut = Math.abs(down) / Math.max(1, haversine(cur, next))
  return gradeIn > SPIKE_MIN_GRADE && gradeOut > SPIKE_MIN_GRADE
}

// Replaces single-point elevation spikes with the average of the points
// before and after. Returns a new array; untouched points are shared.
export function fixElevationSpikes(coords) {
  const fixed = coords.slice()
  for (let i = 1; i < coords.length - 1; i++) {
    const [prev, cur, next] = [fixed[i - 1], coords[i], coords[i + 1]]
    if (cur[2] == null || prev[2] == null || next[2] == null) continue
    if (isSpike(prev, cur, next)) fixed[i] = [cur[0], cur[1], (prev[2] + next[2]) / 2]
  }
  return fixed
}

// Total metres climbed and descended between consecutive points.
export function elevationGain(coords) {
  let ascent = 0
  let descent = 0
  for (let i = 1; i < coords.length; i++) {
    const d = coords[i][2] - coords[i - 1][2]
    if (d > 0) ascent += d
    else descent -= d
  }
  return { ascent, descent }
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

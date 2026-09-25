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

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

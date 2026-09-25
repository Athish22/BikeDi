import { useMemo, useState } from 'react'
import { cumulativeDistances } from '../lib/geo.js'

const W = 1000
const H = 100
const MAX_PATH_POINTS = 400
const MIN_RANGE_M = 60 // keeps flat routes from looking like mountains

export default function ElevationProfile({ coords, onHover }) {
  const [cursor, setCursor] = useState(null)

  const profile = useMemo(() => {
    const dist = cumulativeDistances(coords)
    const total = dist[dist.length - 1]
    let lo = Infinity
    let hi = -Infinity
    for (const c of coords) {
      lo = Math.min(lo, c[2])
      hi = Math.max(hi, c[2])
    }
    const pad = Math.max(0, MIN_RANGE_M - (hi - lo)) / 2
    const yLo = lo - pad
    const yHi = hi + pad

    const step = Math.max(1, Math.floor(coords.length / MAX_PATH_POINTS))
    const pts = []
    for (let i = 0; i < coords.length; i += step) pts.push(i)
    if (pts[pts.length - 1] !== coords.length - 1) pts.push(coords.length - 1)

    const x = (i) => (dist[i] / total) * W
    const y = (i) => H - ((coords[i][2] - yLo) / (yHi - yLo)) * H
    const line = pts.map((i, n) => `${n ? 'L' : 'M'}${x(i).toFixed(1)},${y(i).toFixed(1)}`).join('')
    return { dist, total, lo, hi, line, area: `${line}L${W},${H}L0,${H}Z` }
  }, [coords])

  function nearestIndex(d) {
    const { dist } = profile
    let a = 0
    let b = dist.length - 1
    while (a < b) {
      const m = (a + b) >> 1
      if (dist[m] < d) a = m + 1
      else b = m
    }
    return a
  }

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const share = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const i = nearestIndex(share * profile.total)
    setCursor({ share, i })
    onHover([coords[i][0], coords[i][1]])
  }

  function handleLeave() {
    setCursor(null)
    onHover(null)
  }

  return (
    <div className="profile">
      <div className="profile-labels">
        <span>{Math.round(profile.hi)} m</span>
        <span>{Math.round(profile.lo)} m</span>
      </div>
      <div className="profile-plot" onPointerMove={handleMove} onPointerLeave={handleLeave}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Elevation profile">
          <path d={profile.area} className="profile-area" />
          <path d={profile.line} className="profile-line" vectorEffect="non-scaling-stroke" />
        </svg>
        {cursor && (
          <>
            <div className="profile-cursor" style={{ left: `${cursor.share * 100}%` }} />
            <div
              className="profile-tip"
              style={{ left: `${Math.min(85, Math.max(15, cursor.share * 100))}%` }}
            >
              km {(profile.dist[cursor.i] / 1000).toFixed(1)} · {Math.round(coords[cursor.i][2])} m
            </div>
          </>
        )}
      </div>
      <div className="profile-axis">
        <span>0 km</span>
        <span>{(profile.total / 1000).toFixed(1)} km</span>
      </div>
    </div>
  )
}

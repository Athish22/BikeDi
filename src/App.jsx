import { useCallback, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView.jsx'
import ElevationProfile from './components/ElevationProfile.jsx'
import { BIKES, DURATIONS, MOODS, buildBrief } from './lib/brief.js'
import { generateLoops } from './lib/loops.js'
import { downloadGpx } from './lib/gpx.js'
import { formatDuration } from './lib/geo.js'

const STUTTGART = [9.18, 48.7784] // Schlossplatz
const LETTERS = ['A', 'B', 'C']

function positiveNumber(text) {
  const n = Number(text)
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

export default function App() {
  const [start, setStart] = useState(STUTTGART)
  const [mood, setMood] = useState('steady')
  const [bike, setBike] = useState('road')
  const [minutes, setMinutes] = useState(60)
  const [showMore, setShowMore] = useState(false)
  const [customKm, setCustomKm] = useState('')
  const [maxClimb, setMaxClimb] = useState('')

  const [routes, setRoutes] = useState([])
  const [selected, setSelected] = useState(0)
  const [hoverPoint, setHoverPoint] = useState(null)
  const [status, setStatus] = useState({ state: 'idle' })
  const requestId = useRef(0)

  const brief = useMemo(
    () =>
      buildBrief({
        start,
        mood,
        bike,
        minutes,
        customKm: positiveNumber(customKm),
        maxClimb: positiveNumber(maxClimb),
      }),
    [start, mood, bike, minutes, customKm, maxClimb],
  )

  const pickStart = useCallback((point) => {
    requestId.current++ // drop results for the old start point
    setStart(point)
    setRoutes([])
    setHoverPoint(null)
    setStatus({ state: 'idle' })
  }, [])

  async function generate() {
    const id = ++requestId.current
    setStatus({ state: 'loading' })
    setHoverPoint(null)
    try {
      const loops = await generateLoops(brief)
      if (id !== requestId.current) return
      setRoutes(loops)
      setSelected(0)
      setStatus({ state: 'done', brief })
    } catch (err) {
      if (id !== requestId.current) return
      setStatus({ state: 'error', message: err.message })
    }
  }

  const route = routes[selected]
  const noClimbFit = routes.length > 0 && routes.every((r) => r.climbOff !== 0)

  return (
    <div className="app">
      <aside className="panel">
        <header className="brand">
          <span className="brand-mark">↻</span>
          <div>
            <h1>Loop Planner</h1>
            <p>Tell us how you feel. We'll find the ride.</p>
          </div>
        </header>

        <section className="field">
          <h2>Start &amp; finish</h2>
          <p className="hint">Click the map, drag the pin, or use the locate button.</p>
        </section>

        <section className="field">
          <h2>How are you feeling?</h2>
          <div className="moods">
            {Object.entries(MOODS).map(([key, m]) => (
              <button
                key={key}
                className={`mood mood-${key}`}
                aria-pressed={mood === key}
                onClick={() => setMood(key)}
              >
                <span className="mood-emoji">{m.emoji}</span>
                <span className="mood-label">{m.label}</span>
                <span className="mood-blurb">{m.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="field">
          <h2>How long?</h2>
          <div className="chips">
            {DURATIONS.map((d) => (
              <button
                key={d}
                className="chip"
                aria-pressed={minutes === d && !positiveNumber(customKm)}
                onClick={() => {
                  setMinutes(d)
                  setCustomKm('')
                }}
              >
                {d < 120 ? formatDuration(d) : '2h+'}
              </button>
            ))}
          </div>
        </section>

        <section className="field">
          <h2>Bike</h2>
          <div className="chips">
            {Object.entries(BIKES).map(([key, b]) => (
              <button key={key} className="chip" aria-pressed={bike === key} onClick={() => setBike(key)}>
                {b.label}
              </button>
            ))}
          </div>
        </section>

        <button className="more-toggle" onClick={() => setShowMore(!showMore)} aria-expanded={showMore}>
          {showMore ? '▾' : '▸'} More options
        </button>
        {showMore && (
          <section className="more">
            <label>
              Exact distance
              <span className="input-unit">
                <input
                  type="number"
                  min="5"
                  max="150"
                  inputMode="decimal"
                  placeholder={String(brief.distanceKm)}
                  value={customKm}
                  onChange={(e) => setCustomKm(e.target.value)}
                />
                km
              </span>
            </label>
            <label>
              Max climbing
              <span className="input-unit">
                <input
                  type="number"
                  min="0"
                  step="50"
                  inputMode="numeric"
                  placeholder="none"
                  value={maxClimb}
                  onChange={(e) => setMaxClimb(e.target.value)}
                />
                m
              </span>
            </label>
          </section>
        )}

        <div className="brief">
          ≈ <strong>{brief.distanceKm} km</strong> with{' '}
          <strong>
            {brief.climbMin}–{brief.climbMax} m
          </strong>{' '}
          of climbing
        </div>

        <button className="generate" onClick={generate} disabled={status.state === 'loading'}>
          {status.state === 'loading' ? 'Finding loops…' : routes.length ? 'Try new loops' : 'Generate my loop'}
        </button>

        {status.state === 'error' && <p className="error">{status.message}</p>}

        {routes.length > 0 && (
          <section className="results">
            {noClimbFit && (
              <p className="notice">
                No loop from here hit your climbing range, so these are the closest.
                {routes.every((r) => r.climbOff > 0)
                  ? ' For flatter rides in Stuttgart, try starting along the Neckar.'
                  : ' Try a longer ride or a start closer to the hills.'}
              </p>
            )}
            {routes.map((r, i) => (
              <RouteCard
                key={i}
                letter={LETTERS[i]}
                route={r}
                speedKmh={status.brief.speedKmh}
                active={i === selected}
                onSelect={() => setSelected(i)}
              />
            ))}
            {route && (
              <div className="detail">
                <ElevationProfile coords={route.coords} onHover={setHoverPoint} />
                <button
                  className="gpx"
                  onClick={() =>
                    downloadGpx(route.coords, `Loop ${LETTERS[selected]} ${(route.distanceM / 1000).toFixed(0)}km`)
                  }
                >
                  ⤓ Download GPX
                </button>
              </div>
            )}
          </section>
        )}

        <footer className="credits">
          Routing by{' '}
          <a href="https://openrouteservice.org" target="_blank" rel="noreferrer">
            openrouteservice
          </a>{' '}
          · Map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>
        </footer>
      </aside>

      <main className="map-wrap">
        <MapView
          start={start}
          onPickStart={pickStart}
          routes={routes}
          selected={selected}
          onSelect={setSelected}
          hoverPoint={hoverPoint}
        />
      </main>
    </div>
  )
}

function RouteCard({ letter, route, speedKmh, active, onSelect }) {
  const km = route.distanceM / 1000
  const climb =
    route.climbOff === 0
      ? { cls: 'ok', text: 'climb on target' }
      : route.climbOff > 0
        ? { cls: 'warn', text: `${Math.round(route.climbOff)} m more climbing` }
        : { cls: 'warn', text: `${Math.round(-route.climbOff)} m less climbing` }

  return (
    <button className="route-card" aria-pressed={active} onClick={onSelect}>
      <span className="route-letter">{letter}</span>
      <span className="route-body">
        <span className="route-stats">
          <strong>{km.toFixed(1)} km</strong>
          <span>↑ {Math.round(route.ascent)} m</span>
          <span>~{formatDuration((km / speedKmh) * 60)}</span>
        </span>
        <span className="route-tags">
          <span className={`tag ${climb.cls}`}>{climb.text}</span>
          {route.pavedShare != null && <span className="tag">{Math.round(route.pavedShare * 100)}% paved</span>}
          {route.retrace > 0.15 && <span className="tag warn">some back-tracking</span>}
        </span>
      </span>
    </button>
  )
}

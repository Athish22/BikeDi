// OpenRouteService client. Requests go through the dev server's /ors proxy,
// which adds the API key (see vite.config.js).

import { elevationGain, fixElevationSpikes } from './geo.js'

export class OrsError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function describeError(status, body) {
  const detail =
    typeof body?.error === 'string' ? body.error : body?.error?.message ?? body?.message
  if (status === 401 || status === 403) {
    return 'OpenRouteService rejected the API key. Check ORS_API_KEY in .env and restart the dev server.'
  }
  if (status === 429) {
    return 'OpenRouteService rate limit reached (free tier: 40 routes/minute). Wait a minute and try again.'
  }
  if (detail && /routable point/i.test(detail)) {
    return 'The start point is too far from a road or path. Move it closer to a street.'
  }
  return detail ? `OpenRouteService: ${detail}` : `OpenRouteService request failed (${status}).`
}

export async function fetchRoundTrip({ profile, start, lengthM, seed, points }) {
  const res = await fetch(`/ors/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/geo+json, application/json',
    },
    body: JSON.stringify({
      coordinates: [start],
      elevation: true,
      extra_info: ['surface'],
      options: { round_trip: { length: Math.round(lengthM), points, seed } },
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new OrsError(res.status, describeError(res.status, body))
  }

  const feature = (await res.json()).features[0]
  const props = feature.properties
  const raw = feature.geometry.coordinates // [lng, lat, elevation]
  const coords = fixElevationSpikes(raw)

  // ORS's ascent/descent include the bogus climbs from spikes; take them back out.
  const before = elevationGain(raw)
  const after = elevationGain(coords)
  return {
    coords,
    distanceM: props.summary.distance,
    ascent: Math.max(0, (props.ascent ?? 0) - (before.ascent - after.ascent)),
    descent: Math.max(0, (props.descent ?? 0) - (before.descent - after.descent)),
    surface: props.extras?.surface?.summary ?? [],
  }
}

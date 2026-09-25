// Cloudflare Worker: serves the built site from ./dist and proxies /ors/* to
// OpenRouteService, adding the API key server-side (the Vite dev proxy does this locally).
// Only bike round-trip requests are let through, so visitors can't use the key for anything else.

const ORS = 'https://api.openrouteservice.org'
const ALLOWED_PATH = /^\/ors\/(v2\/directions\/cycling-(?:road|regular|mountain)\/geojson)$/
const MAX_BODY_BYTES = 2000
const MAX_LOOP_M = 150000

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/ors/')) return proxyOrs(request, url, env)
    return env.ASSETS.fetch(request)
  },
}

async function proxyOrs(request, url, env) {
  const match = url.pathname.match(ALLOWED_PATH)
  if (!match) return error(404, 'Not found')
  if (request.method !== 'POST') return error(405, 'Method not allowed')
  if (!env.ORS_API_KEY) return error(500, 'ORS_API_KEY is not configured on the server')

  const body = await request.text()
  if (body.length > MAX_BODY_BYTES) return error(413, 'Request too large')

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    return error(400, 'Invalid JSON')
  }
  const loop = parsed?.options?.round_trip
  if (parsed?.coordinates?.length !== 1 || !loop || !(loop.length > 0 && loop.length <= MAX_LOOP_M)) {
    return error(400, 'Only round trips up to 150 km are allowed')
  }

  const res = await fetch(`${ORS}/${match[1]}`, {
    method: 'POST',
    headers: {
      Authorization: env.ORS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/geo+json, application/json',
    },
    body,
  })

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  })
}

function error(status, message) {
  return Response.json({ error: message }, { status })
}

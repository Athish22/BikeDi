// Cloudflare Pages Function: proxies /ors/* to OpenRouteService and adds the API key
// server-side, like the Vite dev proxy does locally. Only bike round-trip requests
// are let through, so visitors can't use the key for anything else.

const ORS = 'https://api.openrouteservice.org'
const ALLOWED_PATH = /^v2\/directions\/cycling-(road|regular|mountain)\/geojson$/
const MAX_BODY_BYTES = 2000
const MAX_LOOP_M = 150000

export async function onRequestPost({ request, params, env }) {
  const path = (params.path ?? []).join('/')
  if (!ALLOWED_PATH.test(path)) return error(404, 'Not found')
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

  const res = await fetch(`${ORS}/${path}`, {
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

# Loop Planner

Generate bike loops from where you are, based on how you feel today.

Pick a start point, a mood (Easy spin / Steady / Push me), a ride time and a bike type.
The app turns that into a **ride brief** (target distance + climbing range), asks
OpenRouteService for ~10 candidate round trips, scores them against the brief, and shows
the 3 best with an elevation profile and GPX export.

## Setup

1. Get a free OpenRouteService key: https://openrouteservice.org/dev/#/signup
2. Paste it into `.env`:
   ```
   ORS_API_KEY=your_key_here
   ```
3. Install and run:
   ```
   npm install
   npm run dev
   ```
4. Open http://localhost:5173

The key stays on the dev server (requests go through the `/ors` proxy in `vite.config.js`)
and is never sent to the browser.

## Deploy (Cloudflare Workers, free)

In production, `worker/index.js` serves the site from `dist/` and takes over the dev proxy's
job: it adds the key server-side and only allows bike round-trip requests.

1. In `wrangler.jsonc`, set `"name"` to your Worker's name in the Cloudflare dashboard.
2. Push to GitHub (`.env` is git-ignored, so the key is not committed).
3. Worker → **Settings → Build**:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
4. After the first deploy, **Settings → Variables and Secrets** → add `ORS_API_KEY` as a *Secret*.

Every push redeploys automatically. To deploy from your own machine instead: `npx wrangler login`
once, then `npm run deploy`.

Test the Worker locally with `npm run build && npx wrangler dev` (it reads the key from `.env`).

## How it works

| File | Role |
|---|---|
| `src/lib/brief.js` | Mood/time/bike → ride brief (distance, climbing range). Tune the numbers here. |
| `src/lib/loops.js` | Candidate generation, length calibration, scoring, de-duplication |
| `src/lib/ors.js` | OpenRouteService round-trip requests |
| `src/components/MapView.jsx` | MapLibre map (OpenFreeMap tiles) |
| `src/components/ElevationProfile.jsx` | Interactive elevation chart |
| `worker/index.js` | Cloudflare Worker: serves the site and proxies the API in production |

Free ORS tier: 2,000 routes/day, 40/minute. Each "Generate" uses 10.

## Roadmap

- v2: chat that fills the ride brief ("I'm tired but want a view")
- Traffic/quiet-road preference, café stops, saved rides

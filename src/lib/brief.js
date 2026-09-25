// The "ride brief" is the contract between how the rider describes the ride
// and how loops are generated. v1 fills it from the picker; a chat can fill it later.

export const MOODS = {
  easy: { label: 'Easy spin', emoji: '😌', blurb: 'Flat and relaxed', climbPerKm: [0, 6] },
  steady: { label: 'Steady', emoji: '🙂', blurb: 'Some rolling hills', climbPerKm: [5, 12] },
  push: { label: 'Push me', emoji: '🔥', blurb: 'Seek out the climbs', climbPerKm: [12, 25] },
}

// Average speeds (km/h) per bike and mood, used to turn ride time into distance.
export const BIKES = {
  road: { label: 'Road', profile: 'cycling-road', speeds: { easy: 18, steady: 23, push: 26 } },
  gravel: { label: 'Gravel', profile: 'cycling-regular', speeds: { easy: 15, steady: 19, push: 22 } },
  mtb: { label: 'MTB', profile: 'cycling-mountain', speeds: { easy: 12, steady: 15, push: 17 } },
}

export const DURATIONS = [30, 60, 90, 120]

const MIN_KM = 5
const MAX_KM = 150

export function buildBrief({ start, mood, bike, minutes, customKm, maxClimb }) {
  const speedKmh = BIKES[bike].speeds[mood]
  const rawKm = customKm ?? (speedKmh * minutes) / 60
  const distanceKm = Math.round(Math.min(MAX_KM, Math.max(MIN_KM, rawKm)))

  const [lo, hi] = MOODS[mood].climbPerKm
  let climbMin = Math.round((lo * distanceKm) / 10) * 10
  let climbMax = Math.round((hi * distanceKm) / 10) * 10
  if (maxClimb != null) {
    climbMax = Math.min(climbMax, maxClimb)
    climbMin = Math.min(climbMin, climbMax)
  }

  return {
    start,
    mood,
    bike,
    profile: BIKES[bike].profile,
    speedKmh,
    distanceKm,
    climbMin,
    climbMax,
  }
}

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`)
}

export function toGpx(coords, name) {
  const points = coords
    .map(([lng, lat, ele]) => {
      const elevation = ele != null ? `<ele>${ele.toFixed(1)}</ele>` : ''
      return `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">${elevation}</trkpt>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Loop Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`
}

export function downloadGpx(coords, name) {
  const blob = new Blob([toGpx(coords, name)], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.replace(/[^\w-]+/g, '_')}.gpx`
  link.click()
  URL.revokeObjectURL(url)
}

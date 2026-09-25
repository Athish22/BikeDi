import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// MapLibre finds its worker relative to its own file, which breaks once Vite
// pre-bundles it. Let Vite bundle the worker and point MapLibre at it instead.
maplibregl.setWorkerUrl(workerUrl)

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const EMPTY = { type: 'FeatureCollection', features: [] }
const ROUTE_COLOR = '#e4572e'

export default function MapView({ start, onPickStart, routes, selected, onSelect, hoverPoint }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [ready, setReady] = useState(false)

  // Map listeners are registered once, so they read the latest callbacks from a ref.
  const handlers = useRef({ onPickStart, onSelect })
  handlers.current = { onPickStart, onSelect }

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: start,
      zoom: 12,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const locate = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } })
    map.addControl(locate, 'top-right')
    locate.on('geolocate', (e) =>
      handlers.current.onPickStart([e.coords.longitude, e.coords.latitude]),
    )

    map.on('load', () => {
      const line = { type: 'line', source: 'routes', layout: { 'line-join': 'round', 'line-cap': 'round' } }
      map.addSource('routes', { type: 'geojson', data: EMPTY })
      map.addLayer({
        ...line,
        id: 'routes-other',
        filter: ['!', ['get', 'selected']],
        paint: { 'line-color': '#4a5a73', 'line-width': 4, 'line-opacity': 0.5 },
      })
      map.addLayer({
        ...line,
        id: 'routes-casing',
        filter: ['get', 'selected'],
        paint: { 'line-color': '#ffffff', 'line-width': 9 },
      })
      map.addLayer({
        ...line,
        id: 'routes-selected',
        filter: ['get', 'selected'],
        paint: { 'line-color': ROUTE_COLOR, 'line-width': 5 },
      })

      map.addSource('hover', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'hover',
        type: 'circle',
        source: 'hover',
        paint: {
          'circle-radius': 7,
          'circle-color': ROUTE_COLOR,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      })

      map.on('mouseenter', 'routes-other', () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', 'routes-other', () => (map.getCanvas().style.cursor = ''))
      setReady(true)
    })

    // Clicking another loop selects it; clicking anywhere else moves the start.
    map.on('click', (e) => {
      const hit = map.getLayer('routes-other')
        ? map.queryRenderedFeatures(e.point, { layers: ['routes-other'] })
        : []
      if (hit.length) handlers.current.onSelect(hit[0].properties.idx)
      else handlers.current.onPickStart([e.lngLat.lng, e.lngLat.lat])
    })

    return () => {
      map.remove()
      setReady(false)
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!markerRef.current) {
      const el = document.createElement('div')
      el.className = 'start-marker'
      el.title = 'Start / finish (drag to move)'
      const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(start).addTo(map)
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat()
        handlers.current.onPickStart([lng, lat])
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLngLat(start)
    }
  }, [start])

  useEffect(() => {
    if (!ready) return
    mapRef.current.getSource('routes').setData({
      type: 'FeatureCollection',
      features: routes.map((route, i) => ({
        type: 'Feature',
        properties: { idx: i, selected: i === selected },
        geometry: { type: 'LineString', coordinates: route.coords.map(([lng, lat]) => [lng, lat]) },
      })),
    })
  }, [ready, routes, selected])

  useEffect(() => {
    if (!ready || routes.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    for (const route of routes) for (const [lng, lat] of route.coords) bounds.extend([lng, lat])
    mapRef.current.fitBounds(bounds, { padding: 60, duration: 800 })
  }, [ready, routes])

  useEffect(() => {
    if (!ready) return
    mapRef.current.getSource('hover').setData(
      hoverPoint
        ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: hoverPoint } }
        : EMPTY,
    )
  }, [ready, hoverPoint])

  return <div ref={containerRef} className="map" />
}

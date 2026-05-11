import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatPrice } from '../lib/parse.js';

// Token is read at module load — set VITE_MAPBOX_TOKEN in .env.local
// and restart Vite. Without a token the component renders a placeholder.
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

export function ListingMap({ properties, activeId, onPinClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map()); // id -> mapboxgl.Marker

  // Keep onPinClick stable for the long-lived event listener
  const onPinClickRef = useRef(onPinClick);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);

  // Init the map once
  useEffect(() => {
    if (!mapboxgl.accessToken || !containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-97.7431, 30.2672], // Austin default
      zoom: 10,
      attributionControl: false,
      cooperativeGestures: false,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Sync markers with `properties` — reuse existing pins, only add/remove what changed
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const points = properties.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const incoming = new Set(points.map(p => String(p.id)));

    for (const [id, marker] of markersRef.current.entries()) {
      if (!incoming.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const p of points) {
      const id = String(p.id);
      const isActive = id === String(activeId);
      let marker = markersRef.current.get(id);
      if (!marker) {
        const el = document.createElement("div");
        el.className = "map-pin" + (isActive ? " active" : "");
        el.textContent = formatPrice(p.price);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onPinClickRef.current?.(p);
        });
        marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        markersRef.current.set(id, marker);
      } else {
        marker.setLngLat([p.lng, p.lat]);
        marker.getElement().classList.toggle("active", isActive);
      }
    }

    if (points.length === 1) {
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 13, duration: 600 });
    } else if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach(p => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 36, duration: 700, maxZoom: 14 });
    }
  }, [properties]);

  // React to activeId — restyle pins and fly to the active one
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let active = null;
    for (const [id, marker] of markersRef.current.entries()) {
      const isActive = id === String(activeId);
      marker.getElement().classList.toggle("active", isActive);
      if (isActive) active = marker.getLngLat();
    }
    if (active) {
      map.flyTo({ center: [active.lng, active.lat], zoom: Math.max(map.getZoom(), 12), duration: 500 });
    }
  }, [activeId]);

  if (!mapboxgl.accessToken) {
    return (
      <div className="map-placeholder">
        <b>Map</b>
        Set <code>VITE_MAPBOX_TOKEN</code> in <code>.env.local</code> and restart Vite to enable. Free token at <code>account.mapbox.com</code>.
      </div>
    );
  }
  return <div className="map-wrap"><div ref={containerRef} className="map-container"/></div>;
}

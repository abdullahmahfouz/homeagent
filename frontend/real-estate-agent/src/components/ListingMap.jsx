import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatPrice } from '../lib/parse.js';

// Token is read at module load. Set VITE_MAPBOX_TOKEN in .env.local and
// restart Vite. Without a token the component renders a placeholder.
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

// The map is half the window. A light basemap beside a dark UI is the page
// splitting into two themes, so the basemap follows the same preference the
// rest of the app does, and keeps following it if the user flips it.
const DARK_QUERY = '(prefers-color-scheme: dark)';
const styleFor = (dark) =>
  dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';

export function ListingMap({ properties, activeId, onPinClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map()); // id -> mapboxgl.Marker
  const [initError, setInitError] = useState(null);

  // The framing the marker effect last asked for, replayed once the container
  // reports a real size. See the resize effect below.
  const lastFitRef = useRef(null);
  const sizedRef = useRef(false);

  // Keep onPinClick stable for the long-lived event listener
  const onPinClickRef = useRef(onPinClick);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);

  // Init the map once
  useEffect(() => {
    if (!mapboxgl.accessToken || !containerRef.current || mapRef.current) return;
    const media = window.matchMedia(DARK_QUERY);

    // mapboxgl throws synchronously when WebGL is unavailable (blocked by
    // policy, disabled in the browser, software rendering off). That throw
    // happens during commit, so without this guard it unmounts the whole app
    // and the user gets a blank page instead of a chat they can still use.
    let map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: styleFor(media.matches),
        center: [-97.7431, 30.2672], // Austin default
        zoom: 10,
        attributionControl: false,
        cooperativeGestures: false,
      });
    } catch (err) {
      setInitError(err);
      return;
    }
    mapRef.current = map;

    // Markers are DOM overlays rather than style layers, so they survive the
    // swap and keep their positions.
    const onSchemeChange = (e) => map.setStyle(styleFor(e.matches));
    media.addEventListener('change', onSchemeChange);

    return () => {
      media.removeEventListener('change', onSchemeChange);
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
      lastFitRef.current = { center: [points[0].lng, points[0].lat] };
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 13, duration: 600 });
    } else if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach(p => bounds.extend([p.lng, p.lat]));
      lastFitRef.current = { bounds };
      map.fitBounds(bounds, { padding: 36, duration: 700, maxZoom: 14 });
    }
  }, [properties]);

  // Mapbox measures the container once, in the constructor. On mobile the map is
  // built inside the hidden half of the Chat/Map switcher, so it measures 0 and
  // falls back to a 400x300 canvas that it keeps after the region is revealed —
  // the map paints a band across the top and leaves dead space below. Its own
  // trackResize observer does not recover from that, so observe the container
  // and resize on any non-zero change. This also covers rotation and the mobile
  // URL bar collapsing.
  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) return;
      map.resize();

      // Any framing computed against the 400x300 fallback was fitted to the
      // wrong aspect, so replay it once now that the real size is known.
      if (sizedRef.current) return;
      sizedRef.current = true;
      const fit = lastFitRef.current;
      if (fit?.bounds) map.fitBounds(fit.bounds, { padding: 36, duration: 0, maxZoom: 14 });
      else if (fit?.center) map.jumpTo({ center: fit.center, zoom: 13 });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
  if (initError) {
    return (
      <div className="map-placeholder">
        <b>Map unavailable</b>
        This browser could not start WebGL, so the map cannot draw. The chat and
        the listing results work as usual.
      </div>
    );
  }
  return <div className="map-wrap"><div ref={containerRef} className="map-container"/></div>;
}

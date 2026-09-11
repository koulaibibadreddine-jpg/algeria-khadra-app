import { useEffect, useRef, useState } from "react";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletLoadPromise = null;
function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("server-side"));
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

// مركز الجزائر تقريباً
const ALGERIA_CENTER = [28.0339, 1.6596];

export default function TreeMap({ points }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapElRef.current || mapRef.current) return;
        const map = L.map(mapElRef.current).setView(ALGERIA_CENTER, 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 18,
        }).addTo(map);
        mapRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);
        setReady(true);
      })
      .catch(() => setError("تعذّر تحميل الخريطة، تحقق من اتصالك بالإنترنت"));
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !window.L || !markersLayerRef.current) return;
    const L = window.L;
    markersLayerRef.current.clearLayers();
    points.forEach((p) => {
      if (!p.geo) return;
      const marker = L.circleMarker([p.geo.lat, p.geo.lng], {
        radius: 7,
        color: "#4C9A5B",
        fillColor: "#4C9A5B",
        fillOpacity: 0.85,
        weight: 2,
      });
      marker.bindPopup(
        `<b>${escapeHtml(p.name || "")}</b><br/>${escapeHtml(p.wilaya || "")}${
          p.note ? "<br/>" + escapeHtml(p.note) : ""
        }`
      );
      marker.addTo(markersLayerRef.current);
    });
  }, [ready, points]);

  return (
    <div className="gk-map-wrap">
      {error && <div className="gk-empty">{error}</div>}
      <div ref={mapElRef} className="gk-map" />
    </div>
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

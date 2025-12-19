// src/components/MapView.jsx
import React, { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import * as turf from "@turf/turf";
import { ROAD_TYPE_META_BY_VALUE, normaliseTypeName } from "../utils/roadTypes";

const TILE = {
  default: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  simple: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
};

function safeFeatures(gj) {
  if (!gj || typeof gj !== "object") return [];
  const feats = gj.features;
  if (!Array.isArray(feats)) return [];
  return feats.filter(Boolean);
}

function getLat(p) {
  if (!p) return null;
  const v = p.lat ?? p.Lat;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function getLng(p) {
  if (!p) return null;
  const v = p.long ?? p.Long ?? p.lng ?? p.Lng;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makePinIcon(fill, label) {
  const svg = `
    <svg width="34" height="42" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <path d="M12 22s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z"
        fill="${fill}" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="10" r="3.7" fill="white" fill-opacity="0.98"/>
      <text x="12" y="11.7" text-anchor="middle" dominant-baseline="middle"
        font-size="10.5" font-family="Arial" font-weight="800" fill="${fill}">

      </text>
    </svg>
  `;

  return L.divIcon({
    className: "sg-pin-icon",
    html: svg,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    tooltipAnchor: [0, -34],
  });
}

// Colours matching your working react-leaflet version
const ICON_START_SELECTED = makePinIcon("#ef4444", "S");
const ICON_END_SELECTED = makePinIcon("#ef4444", "E");
const ICON_START_NEAREST = makePinIcon("#0f172a", "S");
const ICON_END_NEAREST = makePinIcon("#0f172a", "E");

function pointTooltipHtml(title, pt) {
  const lat = pt ? getLat(pt) : null;
  const lng = pt ? getLng(pt) : null;
  const latText = lat === null ? "—" : lat.toFixed(6);
  const lngText = lng === null ? "—" : lng.toFixed(6);

  return `
    <div style="font-size:12px; line-height:1.25; padding:2px 2px;">
      <div style="font-weight:800; color:#0f172a; margin-bottom:4px;">${escapeHtml(
        title
      )}</div>
      <div style="display:grid; grid-template-columns:auto 1fr; gap:4px 10px;">
        <div style="color:#64748b;">lat</div>
        <div style="color:#0f172a; font-weight:700;">${escapeHtml(latText)}</div>
        <div style="color:#64748b;">long</div>
        <div style="color:#0f172a; font-weight:700;">${escapeHtml(lngText)}</div>
      </div>
    </div>
  `;
}

function buildSnapLine(routeGeoJson) {
  if (!routeGeoJson) return null;

  const lines = [];

  function pushGeom(geom) {
    if (!geom) return;

    if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
      lines.push(geom.coordinates);
      return;
    }

    if (geom.type === "MultiLineString" && Array.isArray(geom.coordinates)) {
      for (const line of geom.coordinates) {
        if (Array.isArray(line)) lines.push(line);
      }
    }
  }

  if (routeGeoJson.type === "FeatureCollection") {
    for (const f of routeGeoJson.features || []) {
      pushGeom(f && f.geometry);
    }
  } else if (routeGeoJson.type === "Feature") {
    pushGeom(routeGeoJson.geometry);
  } else {
    pushGeom(routeGeoJson);
  }

  if (lines.length === 0) return null;
  if (lines.length === 1) return turf.lineString(lines[0]);
  return turf.multiLineString(lines);
}

function computeBoundsFromGeoJson(geojson) {
  const feats = safeFeatures(geojson);
  if (feats.length === 0) return null;

  const coords = [];

  function pushCoordsFromGeom(geom) {
    if (!geom) return;

    if (geom.type === "Point" && Array.isArray(geom.coordinates)) {
      coords.push(geom.coordinates);
      return;
    }
    if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
      coords.push(...geom.coordinates);
      return;
    }
    if (geom.type === "MultiLineString" && Array.isArray(geom.coordinates)) {
      for (const line of geom.coordinates) {
        if (Array.isArray(line)) coords.push(...line);
      }
      return;
    }
    if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
      for (const ring of geom.coordinates) {
        if (Array.isArray(ring)) coords.push(...ring);
      }
      return;
    }
    if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
      for (const poly of geom.coordinates) {
        for (const ring of poly || []) {
          if (Array.isArray(ring)) coords.push(...ring);
        }
      }
    }
  }

  for (const f of feats) {
    pushCoordsFromGeom(f.geometry);
  }

  if (coords.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 2) continue;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  if (!Number.isFinite(minLat)) return null;

  return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
}

function roadTooltipHtml(props) {
  const p = props && typeof props === "object" ? props : {};
  const roadName =
    p.road_name || p.roadName || p.name || p.ROAD_NAME || p.road || "";

  const axisTypeRaw =
    p.__axisType || p.axisType || p.road_type || p.roadType || "";
  const axisType = String(axisTypeRaw || "").trim();

  const meta =
    ROAD_TYPE_META_BY_VALUE[String(axisType || "").trim()] ||
    ROAD_TYPE_META_BY_VALUE[normaliseTypeName(axisType)];

  const typeLabel =
    (meta && (meta.label || meta.name)) || (axisType ? String(axisType) : "");

  const safeName = roadName ? String(roadName) : "—";
  const safeType = typeLabel ? String(typeLabel) : "—";

  return `
    <div style="font-size:12px; line-height:1.25; padding:2px 2px;">
      <div style="display:grid; grid-template-columns:auto 1fr; gap:6px 10px;">
        <div style="color:#64748b;">road name</div>
        <div style="font-weight:700; color:#0f172a;">${escapeHtml(safeName)}</div>
        <div style="color:#64748b;">road type</div>
        <div style="font-weight:700; color:#0f172a;">${escapeHtml(safeType)}</div>
      </div>
    </div>
  `;
}

function routeTooltipHtml(props) {
  const p = props && typeof props === "object" ? props : {};
  const roadName =
    p.road_name || p.roadName || p.name || p.ROAD_NAME || p.road || "";
  if (!roadName) return null;

  return `
    <div style="font-size:12px; line-height:1.25; padding:2px 2px;">
      <div style="color:#64748b;">route segment</div>
      <div style="font-weight:700; color:#0f172a;">${escapeHtml(
        String(roadName)
      )}</div>
    </div>
  `;
}

export default function MapView({
  mapStyle,
  selectionMode,
  onPickPoint,
  startPoint,
  endPoint,
  routeGeoJson,
  axisTypeGeoJson,
  blockageGeoJson,
}) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);

  const routeLayerRef = useRef(null);
  const roadLayerRef = useRef(null);
  const blockageLayerRef = useRef(null);

  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);
  const nearestStartMarkerRef = useRef(null);
  const nearestEndMarkerRef = useRef(null);

  const selectionModeRef = useRef(selectionMode);
  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  const onPickPointRef = useRef(onPickPoint);
  useEffect(() => {
    onPickPointRef.current = onPickPoint;
  }, [onPickPoint]);

  const base = useMemo(() => {
    const k = mapStyle === "simple" ? "simple" : "default";
    return TILE[k];
  }, [mapStyle]);

  const routeBounds = useMemo(() => computeBoundsFromGeoJson(routeGeoJson), [routeGeoJson]);

  const snapLine = useMemo(() => buildSnapLine(routeGeoJson), [routeGeoJson]);

  const nearestPoints = useMemo(() => {
    const out = { start: null, end: null };
    if (!snapLine) return out;

    if (startPoint) {
      const selected = turf.point([startPoint.long, startPoint.lat]);
      const nearest = turf.nearestPointOnLine(snapLine, selected);
      out.start = {
        long: nearest.geometry.coordinates[0],
        lat: nearest.geometry.coordinates[1],
      };
    }

    if (endPoint) {
      const selected = turf.point([endPoint.long, endPoint.lat]);
      const nearest = turf.nearestPointOnLine(snapLine, selected);
      out.end = {
        long: nearest.geometry.coordinates[0],
        lat: nearest.geometry.coordinates[1],
      };
    }

    return out;
  }, [snapLine, startPoint, endPoint]);

  // INIT MAP ONCE (StrictMode-safe)
  useEffect(() => {
    const container = mapDivRef.current;
    if (!container) return;

    const existing = mapRef.current;
    if (existing && existing._container) return;

    const map = L.map(container, {
      center: [1.3521, 103.8198],
      zoom: 12,
      zoomControl: true,
    });

    const tile = L.tileLayer(base.url, { attribution: base.attribution });
    tile.addTo(map);

    tileLayerRef.current = tile;
    mapRef.current = map;

    map.createPane("route");
    map.getPane("route").style.zIndex = 420;

    map.createPane("roads");
    map.getPane("roads").style.zIndex = 430;

    map.createPane("blockages");
    map.getPane("blockages").style.zIndex = 440;

    map.createPane("markers");
    map.getPane("markers").style.zIndex = 450;

    const handleClick = (e) => {
      const mode = selectionModeRef.current;
      if (!mode) return;

      const cb = onPickPointRef.current;
      if (typeof cb !== "function") return;

      cb({ lat: e.latlng.lat, long: e.latlng.lng });
    };

    map.on("click", handleClick);

    return () => {
      try {
        map.off("click", handleClick);
        map.off();
        map.remove();
      } catch (e) {
        // ignore
      }

      mapRef.current = null;
      tileLayerRef.current = null;

      routeLayerRef.current = null;
      roadLayerRef.current = null;
      blockageLayerRef.current = null;

      startMarkerRef.current = null;
      endMarkerRef.current = null;
      nearestStartMarkerRef.current = null;
      nearestEndMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update basemap URL only (no recreate)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;

    tileLayerRef.current.setUrl(base.url);
    tileLayerRef.current.options.attribution = base.attribution;

    if (map.attributionControl) {
      map.attributionControl.setPrefix(false);
    }
  }, [base.url, base.attribution]);

  // Fit to route when it changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!routeBounds) return;

    map.fitBounds(routeBounds, { padding: [24, 24] });
  }, [routeBounds]);

  // Selected start marker (red) + tooltip
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }

    const lat = getLat(startPoint);
    const lng = getLng(startPoint);
    if (lat === null || lng === null) return;

    const marker = L.marker([lat, lng], {
      pane: "markers",
      icon: ICON_START_SELECTED,
      keyboard: false,
      zIndexOffset: 1000,
    });

    marker.bindTooltip(pointTooltipHtml("Selected Start", { lat, long: lng }), {
      permanent: false,
      sticky: true,
      opacity: 0.98,
      direction: "top",
      offset: [0, -18],
      className: "sg-tooltip",
    });

    marker.addTo(map);
    startMarkerRef.current = marker;
  }, [startPoint]);

  // Selected end marker (red) + tooltip
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (endMarkerRef.current) {
      map.removeLayer(endMarkerRef.current);
      endMarkerRef.current = null;
    }

    const lat = getLat(endPoint);
    const lng = getLng(endPoint);
    if (lat === null || lng === null) return;

    const marker = L.marker([lat, lng], {
      pane: "markers",
      icon: ICON_END_SELECTED,
      keyboard: false,
      zIndexOffset: 1000,
    });

    marker.bindTooltip(pointTooltipHtml("Selected End", { lat, long: lng }), {
      permanent: false,
      sticky: true,
      opacity: 0.98,
      direction: "top",
      offset: [0, -18],
      className: "sg-tooltip",
    });

    marker.addTo(map);
    endMarkerRef.current = marker;
  }, [endPoint]);

  // Nearest start (black) + tooltip
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (nearestStartMarkerRef.current) {
      map.removeLayer(nearestStartMarkerRef.current);
      nearestStartMarkerRef.current = null;
    }

    const pt = nearestPoints && nearestPoints.start ? nearestPoints.start : null;
    const lat = getLat(pt);
    const lng = getLng(pt);
    if (lat === null || lng === null) return;

    const marker = L.marker([lat, lng], {
      pane: "markers",
      icon: ICON_START_NEAREST,
      keyboard: false,
      zIndexOffset: 900,
    });

    marker.bindTooltip(
      pointTooltipHtml("Nearest Start on Route", { lat, long: lng }),
      {
        permanent: false,
        sticky: true,
        opacity: 0.98,
        direction: "top",
        offset: [0, -18],
        className: "sg-tooltip",
      }
    );

    marker.addTo(map);
    nearestStartMarkerRef.current = marker;
  }, [nearestPoints]);

  // Nearest end (black) + tooltip
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (nearestEndMarkerRef.current) {
      map.removeLayer(nearestEndMarkerRef.current);
      nearestEndMarkerRef.current = null;
    }

    const pt = nearestPoints && nearestPoints.end ? nearestPoints.end : null;
    const lat = getLat(pt);
    const lng = getLng(pt);
    if (lat === null || lng === null) return;

    const marker = L.marker([lat, lng], {
      pane: "markers",
      icon: ICON_END_NEAREST,
      keyboard: false,
      zIndexOffset: 900,
    });

    marker.bindTooltip(
      pointTooltipHtml("Nearest End on Route", { lat, long: lng }),
      {
        permanent: false,
        sticky: true,
        opacity: 0.98,
        direction: "top",
        offset: [0, -18],
        className: "sg-tooltip",
      }
    );

    marker.addTo(map);
    nearestEndMarkerRef.current = marker;
  }, [nearestPoints]);

  // Route layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const feats = safeFeatures(routeGeoJson);
    if (feats.length === 0) return;

    const layer = L.geoJSON(routeGeoJson, {
      pane: "route",
      style: function style() {
        return { color: "#2563eb", weight: 5, opacity: 0.9 };
      },
      pointToLayer: function pointToLayer(_feature, latlng) {
        // Hide route point features (prevents default Leaflet marker/shadows)
        return L.circleMarker(latlng, { radius: 0, opacity: 0, fillOpacity: 0 });
      },
      onEachFeature: function onEachFeature(feature, l) {
        const props = feature && feature.properties ? feature.properties : {};
        const html = routeTooltipHtml(props);
        if (!html) return;

        l.bindTooltip(html, {
          sticky: true,
          opacity: 0.95,
          direction: "top",
          className: "sg-tooltip",
        });
      },
    });

    layer.addTo(map);
    routeLayerRef.current = layer;
  }, [routeGeoJson]);

  // Road-types overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (roadLayerRef.current) {
      map.removeLayer(roadLayerRef.current);
      roadLayerRef.current = null;
    }

    const feats = safeFeatures(axisTypeGeoJson);
    if (feats.length === 0) return;

    const layer = L.geoJSON(axisTypeGeoJson, {
      pane: "roads",
      style: function style(feature) {
        const props = feature && feature.properties ? feature.properties : {};
        const t = String(props.__axisType || "");
        const meta =
          ROAD_TYPE_META_BY_VALUE[t] ||
          ROAD_TYPE_META_BY_VALUE[normaliseTypeName(t)];
        const colour = meta && meta.colour ? meta.colour : "#64748b";

        return {
          color: colour,
          weight: 3,
          opacity: 0.95,
        };
      },
      onEachFeature: function onEachFeature(feature, l) {
        const props = feature && feature.properties ? feature.properties : {};
        const html = roadTooltipHtml(props);

        l.bindTooltip(html, {
          sticky: true,
          opacity: 0.95,
          direction: "top",
          className: "sg-tooltip",
        });
      },
    });

    layer.addTo(map);
    roadLayerRef.current = layer;
  }, [axisTypeGeoJson]);

  // Blockages overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (blockageLayerRef.current) {
      map.removeLayer(blockageLayerRef.current);
      blockageLayerRef.current = null;
    }

    const feats = safeFeatures(blockageGeoJson);
    if (feats.length === 0) return;

    const layer = L.geoJSON(blockageGeoJson, {
      pane: "blockages",
      style: function style() {
        return { color: "#ef4444", weight: 2, opacity: 0.9 };
      },
      onEachFeature: function onEachFeature(feature, l) {
        const props = feature && feature.properties ? feature.properties : {};
        const name = props.name || props.id || "";
        if (!name) return;

        l.bindTooltip(`Blockage: ${escapeHtml(String(name))}`, {
          sticky: true,
          opacity: 0.95,
          direction: "top",
          className: "sg-tooltip",
        });
      },
    });

    layer.addTo(map);
    blockageLayerRef.current = layer;
  }, [blockageGeoJson]);

  return <div ref={mapDivRef} className="h-full w-full" />;
}
  
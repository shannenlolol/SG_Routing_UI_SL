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

function normaliseOptionalText(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (s.toLowerCase() === "null") return "";
  if (s.toLowerCase() === "undefined") return "";
  return s;
}

function makePinIcon(fill, label) {
  const svg = `
    <svg width="34" height="60" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <path d="M12 22s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z"
        fill="${fill}" stroke="${fill}" stroke-width="2"/>
      <circle cx="12" cy="10" r="8" fill="white" stroke="${fill}" fill-opacity="0.98"/>
      <text x="12" y="11.7" text-anchor="middle" dominant-baseline="middle"
        font-size="10.5" font-family="Calibri" font-weight="400" fill="${fill}">
        ${label}
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

const ICON_START_SELECTED = makePinIcon("#87CEEB", "S");
const ICON_END_SELECTED = makePinIcon("#ef4444", "E");
const ICON_START_NEAREST = makePinIcon("#0f172a", "S");
const ICON_END_NEAREST = makePinIcon("#0f172a", "E");
const ICON_BLOCKAGE_DRAFT = makePinIcon("#f97316", "B");
const ICON_BLOCKAGE = makePinIcon("#f59e0b", "B");

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
        <div style="color:#64748b;">Latitude: </div>
        <div style="color:#0f172a; font-weight:700;">${escapeHtml(latText)}</div>
        <div style="color:#64748b;">Longitude: </div>
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

function pickFirst(props, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    const v = props ? props[k] : undefined;
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function prettifyRoadType(raw) {
  const s = String(raw || "").trim();
  if (!s) return "—";

  const spaced = s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function routeTooltipHtml(props) {
  const p = props && typeof props === "object" ? props : {};

  const roadName = pickFirst(p, [
    "road name",
    "road_name",
    "roadName",
    "name",
    "ROAD_NAME",
    "road",
  ]);

  const roadTypeRaw = pickFirst(p, [
    "road type",
    "road_type",
    "roadType",
    "highway",
    "type",
    "ROAD_TYPE",
  ]);

  const roadType = prettifyRoadType(roadTypeRaw);

  return `
    <div style="font-size:12px; line-height:1.25; padding:2px 2px;">
      <div style="display:grid; grid-template-columns:auto 1fr; gap:6px 10px;">
        <div style="color:#64748b;">Road Name:</div>
        <div style="font-weight:700; color:#0f172a;">${escapeHtml(roadName || "—")}</div>
        <div style="color:#64748b;">Road Type:</div>
        <div style="font-weight:700; color:#0f172a;">${escapeHtml(roadType)}</div>
      </div>
    </div>
  `;
}

function getBlockageRadius(feature) {
  const props = feature && feature.properties ? feature.properties : {};
  const candidates = [
    props.radius,
    props.r,
    props.R,
    props["radius (m)"],
    props.radius_m,
    props.radiusM,
    feature && feature.radius,
    feature && feature.r,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const n = Number(candidates[i]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
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
  draftBlockage,
  focusTarget,
}) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);

  const routeLayerRef = useRef(null);
  const roadLayerRef = useRef(null);

  const existingBlockagesRef = useRef(null);
  const draftBlockageMarkerRef = useRef(null);
  const draftBlockageCircleRef = useRef(null);

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
      out.start = { long: nearest.geometry.coordinates[0], lat: nearest.geometry.coordinates[1] };
    }

    if (endPoint) {
      const selected = turf.point([endPoint.long, endPoint.lat]);
      const nearest = turf.nearestPointOnLine(snapLine, selected);
      out.end = { long: nearest.geometry.coordinates[0], lat: nearest.geometry.coordinates[1] };
    }

    return out;
  }, [snapLine, startPoint, endPoint]);

  // INIT MAP ONCE
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

      existingBlockagesRef.current = null;
      draftBlockageMarkerRef.current = null;
      draftBlockageCircleRef.current = null;

      startMarkerRef.current = null;
      endMarkerRef.current = null;
      nearestStartMarkerRef.current = null;
      nearestEndMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update basemap URL only
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

  // Focus to blockage selected from list
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!focusTarget) return;

    const lat = Number(focusTarget.lat);
    const lng = Number(focusTarget.long);
    const zoom = Number(focusTarget.zoom);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (Number.isFinite(zoom)) {
      map.setView([lat, lng], zoom, { animate: true });
      return;
    }

    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [focusTarget]);

  // Selected start marker
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

  // Selected end marker
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

  // Nearest start
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

    marker.bindTooltip(pointTooltipHtml("Nearest Start on Route", { lat, long: lng }), {
      permanent: false,
      sticky: true,
      opacity: 0.98,
      direction: "top",
      offset: [0, -18],
      className: "sg-tooltip",
    });

    marker.addTo(map);
    nearestStartMarkerRef.current = marker;
  }, [nearestPoints]);

  // Nearest end
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

    marker.bindTooltip(pointTooltipHtml("Nearest End on Route", { lat, long: lng }), {
      permanent: false,
      sticky: true,
      opacity: 0.98,
      direction: "top",
      offset: [0, -18],
      className: "sg-tooltip",
    });

    marker.addTo(map);
    nearestEndMarkerRef.current = marker;
  }, [nearestPoints]);

  // EXISTING BLOCKAGES: markers + filled circles (radius + desc normalised)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (existingBlockagesRef.current) {
      map.removeLayer(existingBlockagesRef.current);
      existingBlockagesRef.current = null;
    }

    const feats = safeFeatures(blockageGeoJson);
    if (feats.length === 0) return;

    const group = L.layerGroup([], { pane: "blockages" });

    for (let i = 0; i < feats.length; i += 1) {
      const f = feats[i];
      const geom = f && f.geometry ? f.geometry : null;
      const props = f && f.properties ? f.properties : {};

      if (!geom || geom.type !== "Point" || !Array.isArray(geom.coordinates)) continue;

      const lng = Number(geom.coordinates[0]);
      const lat = Number(geom.coordinates[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const radius = getBlockageRadius(f);
      const name = String(props.name || props.id || "").trim();
      const desc = normaliseOptionalText(props.description);

      if (radius !== null) {
        const circle = L.circle([lat, lng], {
          pane: "blockages",
          radius,
          color: "#2563eb",
          weight: 2,
          opacity: 0.95,
          fillColor: "#2563eb",
          fillOpacity: 0.15,
        });
        group.addLayer(circle);
      }

      const marker = L.marker([lat, lng], {
        pane: "markers",
        icon: ICON_BLOCKAGE,
        keyboard: false,
        zIndexOffset: 950,
      });

      const tip = `
        <div style="font-size:12px; line-height:1.25; padding:2px 2px;">
          <div style="font-weight:800; color:#0f172a; margin-bottom:4px;">Blockage</div>
          <div style="display:grid; grid-template-columns:auto 1fr; gap:4px 10px;">
            <div style="color:#64748b;">name</div>
            <div style="color:#0f172a; font-weight:700;">${escapeHtml(name || "—")}</div>
            <div style="color:#64748b;">radius</div>
            <div style="color:#0f172a; font-weight:700;">${escapeHtml(
              radius !== null ? `${radius} m` : "—"
            )}</div>
            ${
              desc
                ? `<div style="color:#64748b;">desc</div><div style="color:#0f172a; font-weight:700;">${escapeHtml(desc)}</div>`
                : ""
            }
          </div>
        </div>
      `;

      marker.bindTooltip(tip, {
        sticky: true,
        opacity: 0.95,
        direction: "top",
        className: "sg-tooltip",
        offset: [0, -14],
      });

      group.addLayer(marker);
    }

    group.addTo(map);
    existingBlockagesRef.current = group;
  }, [blockageGeoJson]);

  // DRAFT BLOCKAGE: orange marker + dotted radius
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (draftBlockageMarkerRef.current) {
      map.removeLayer(draftBlockageMarkerRef.current);
      draftBlockageMarkerRef.current = null;
    }
    if (draftBlockageCircleRef.current) {
      map.removeLayer(draftBlockageCircleRef.current);
      draftBlockageCircleRef.current = null;
    }

    if (!draftBlockage || !draftBlockage.point) return;

    const lat = getLat(draftBlockage.point);
    const lng = getLng(draftBlockage.point);
    const radius = Number(draftBlockage.radius);

    if (lat === null || lng === null) return;

    const marker = L.marker([lat, lng], {
      pane: "markers",
      icon: ICON_BLOCKAGE_DRAFT,
      keyboard: false,
      zIndexOffset: 980,
    });

    marker.bindTooltip(pointTooltipHtml("Draft Blockage", { lat, long: lng }), {
      permanent: false,
      sticky: true,
      opacity: 0.98,
      direction: "top",
      offset: [0, -18],
      className: "sg-tooltip",
    });

    marker.addTo(map);
    draftBlockageMarkerRef.current = marker;

    if (Number.isFinite(radius) && radius > 0) {
      const circle = L.circle([lat, lng], {
        pane: "blockages",
        radius,
        color: "#2563eb",
        weight: 2,
        opacity: 0.95,
        fillColor: "#2563eb",
        fillOpacity: 0.08,
        dashArray: "2 8",
        lineCap: "round",
      });

      circle.addTo(map);
      draftBlockageCircleRef.current = circle;
    }
  }, [draftBlockage]);

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

  // Road-types overlay (keep visible across tab changes)
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
        const meta = ROAD_TYPE_META_BY_VALUE[t] || ROAD_TYPE_META_BY_VALUE[normaliseTypeName(t)];
        const colour = meta && meta.colour ? meta.colour : "#64748b";

        return { color: colour, weight: 3, opacity: 0.95 };
      },
      onEachFeature: function onEachFeature(feature, l) {
        const props = feature && feature.properties ? feature.properties : {};
        const html = routeTooltipHtml(props);

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

  return <div ref={mapDivRef} className="h-full w-full" />;
}

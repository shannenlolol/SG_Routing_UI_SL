// src/components/MapView.jsx
import React, { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatRoadTypeLabel, ROAD_TYPE_META_BY_VALUE } from "../utils/roadTypes";

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
  if (!gj || !Array.isArray(gj.features)) return [];
  return gj.features.filter(Boolean);
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

  const selectionModeRef = useRef(selectionMode);
  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  const base = useMemo(() => {
    const k = mapStyle === "simple" ? "simple" : "default";
    return TILE[k];
  }, [mapStyle]);

  // --- NEW: guards for Leaflet timing issues in dev ---
  const mapReadyRef = useRef(false);
  const fitTimerRef = useRef(null);

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;

    const container = mapDivRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: [1.3521, 103.8198],
      zoom: 12,
      zoomControl: true,
    });

    map.whenReady(() => {
      mapReadyRef.current = true;
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

    map.on("click", (e) => {
      const mode = selectionModeRef.current;
      if (!mode) return;
      if (typeof onPickPoint !== "function") return;

      onPickPoint({
        lat: e.latlng.lat,
        long: e.latlng.lng,
      });
    });

    return () => {
      window.clearTimeout(fitTimerRef.current);
      mapReadyRef.current = false;

      try {
        map.off();
        map.remove();
      } catch (e) {
        // ignore (dev/HMR edge cases)
      }

      mapRef.current = null;
      tileLayerRef.current = null;
      routeLayerRef.current = null;
      roadLayerRef.current = null;
      blockageLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPickPoint]); // ✅ do NOT depend on base.* (avoid remount on style toggle)

  // Update basemap URL only (do NOT recreate map, do NOT touch overlays)
  useEffect(() => {
    if (!tileLayerRef.current) return;

    tileLayerRef.current.setUrl(base.url);
    tileLayerRef.current.options.attribution = base.attribution;

    const map = mapRef.current;
    if (map) {
      const a = map.attributionControl;
      if (a) a.setPrefix(false);
    }
  }, [base.url, base.attribution]);

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
        return { color: "#0f172a", weight: 5, opacity: 0.9 };
      },
    });

    layer.addTo(map);
    routeLayerRef.current = layer;
  }, [routeGeoJson]);

  // Road-types overlay (always remove + replace)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (roadLayerRef.current) {
      map.removeLayer(roadLayerRef.current);
      roadLayerRef.current = null;
    }

    const feats = safeFeatures(axisTypeGeoJson);
    if (feats.length === 0) return;

    function escapeHtml(value) {
      const s = String(value == null ? "" : value);
      return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function getTooltipHtml(feature) {
      const props = feature && feature.properties ? feature.properties : {};

      const roadName =
        props.road_name || props.roadName || props.name || props.road || "";

      const axisTypeValue =
        props.__axisType || props.road_type || props.roadType || "";
      const axisTypeLabel = formatRoadTypeLabel(axisTypeValue);

      const rn = escapeHtml(roadName || "Unknown");
      const rt = escapeHtml(axisTypeLabel || "Unknown");

      return `
      <div>
        <div><span style="color:#64748b;font-size:12px;">road name</span> <b>${rn}</b></div>
        <div><span style="color:#64748b;font-size:12px;">road type</span> <b>${rt}</b></div>
      </div>
    `;
    }

    const layer = L.geoJSON(axisTypeGeoJson, {
      pane: "roads",
      style: function style(feature) {
        const props = feature && feature.properties ? feature.properties : {};
        const t = String(props.__axisType || "");
        const meta = ROAD_TYPE_META_BY_VALUE[t];
        const colour = meta && meta.colour ? meta.colour : "#64748b";

        return {
          color: colour,
          weight: 3,
          opacity: 0.95,
        };
      },
      onEachFeature: function onEachFeature(feature, leafletLayer) {
        const html = getTooltipHtml(feature);
        leafletLayer.bindTooltip(html, {
          sticky: true,
          direction: "auto",
          opacity: 0.95,
          className: "road-tooltip",
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
    });

    layer.addTo(map);
    blockageLayerRef.current = layer;
  }, [blockageGeoJson]);

  // Safe fitBounds (prevents "_leaflet_pos" crash)
  useEffect(() => {
    const map = mapRef.current;
    const container = mapDivRef.current;

    if (!map || !container) return;
    if (!mapReadyRef.current) return;
    if (!startPoint || !endPoint) return;

    window.clearTimeout(fitTimerRef.current);

    fitTimerRef.current = window.setTimeout(() => {
      const latestMap = mapRef.current;
      const latestContainer = mapDivRef.current;

      if (!latestMap || !latestContainer) return;
      if (!document.body.contains(latestContainer)) return;

      try {
        latestMap.invalidateSize();

        const bounds = L.latLngBounds(
          [startPoint.lat, startPoint.long],
          [endPoint.lat, endPoint.long]
        );

        if (bounds && bounds.isValid && bounds.isValid()) {
          latestMap.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch (e) {
        // swallow to avoid crashing app in dev
      }
    }, 0);

    return () => {
      window.clearTimeout(fitTimerRef.current);
    };
  }, [startPoint, endPoint]);

  return <div ref={mapDivRef} className="h-full w-full" />;
}

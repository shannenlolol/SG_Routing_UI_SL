// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import Badge from "./components/Badge";
import Segmented from "./components/Segmented";
import MapView from "./components/MapView";
import FloatingInput from "./components/FloatingInput";
import RoadTypesPanel from "./components/RoadTypesPanel";
import ToastStack from "./components/ToastStack";
import LoadingOverlay from "./components/LoadingOverlay";
import { apiDelete, apiGet, apiPost } from "./api/client";
import {
  normaliseTypeName,
  sortRoadTypesByImportance,
} from "./utils/roadTypes";

const TAB_ROUTE = "route";
const TAB_ROAD_TYPES = "roadTypes";
const TAB_BLOCKAGES = "blockages";

function toNumber(value) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return null;
}

function normaliseOptionalText(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (s.toLowerCase() === "null") return "";
  if (s.toLowerCase() === "undefined") return "";
  return s;
}

function getBlockageNameFromFeature(feature, idx) {
  const props = feature && feature.properties ? feature.properties : {};
  const raw = props.name || props.id || "";
  const s = String(raw || "").trim();
  if (s) return s;
  return String(idx);
}

function getBlockageRadiusFromFeature(feature) {
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

export default function App() {
  // -------------------- Server readiness --------------------
  const [serverStatus, setServerStatus] = useState("unknown"); // unknown | wait | ready | error
  const [serverError, setServerError] = useState("");
  const pollTimer = useRef(null);

  async function checkReadyOnce() {
    try {
      const result = await apiGet("/ready");
      const text = String(result).trim().toLowerCase();
      if (text === "ready") {
        setServerStatus("ready");
        setServerError("");
        return "ready";
      }
      if (text === "wait") {
        setServerStatus("wait");
        setServerError("");
        return "wait";
      }
      setServerStatus("unknown");
      setServerError(`Unexpected response: ${String(result)}`);
      return "unknown";
    } catch (err) {
      setServerStatus("error");
      setServerError(err.message || "Failed to reach server");
      return "error";
    }
  }

  async function pollUntilReady() {
    window.clearInterval(pollTimer.current);
    const first = await checkReadyOnce();
    if (first === "ready") return;

    pollTimer.current = window.setInterval(async () => {
      const status = await checkReadyOnce();
      if (status === "ready") {
        window.clearInterval(pollTimer.current);
      }
    }, 3000);
  }

  useEffect(() => {
    pollUntilReady();
    return () => {
      window.clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------- UI state --------------------
  const [tab, setTab] = useState(TAB_ROUTE);

  // Map selection mode: "start" | "end" | "blockage" | null
  const [selectionMode, setSelectionMode] = useState(null);

  // Base map style only
  const [mapStyle, setMapStyle] = useState("simple");

  // Points
  const [start, setStart] = useState({ lat: "", long: "", description: "Start" });
  const [end, setEnd] = useState({ lat: "", long: "", description: "End" });

  const startPoint = useMemo(() => {
    const lat = toNumber(start.lat);
    const long = toNumber(start.long);
    if (lat === null || long === null) return null;
    return { lat, long };
  }, [start.lat, start.long]);

  const endPoint = useMemo(() => {
    const lat = toNumber(end.lat);
    const long = toNumber(end.long);
    if (lat === null || long === null) return null;
    return { lat, long };
  }, [end.lat, end.long]);

  const [routeGeoJson, setRouteGeoJson] = useState(null);

  // -------------------- Road types --------------------
  const [validAxisTypes, setValidAxisTypes] = useState([]);
  const [displayAxisTypes, setDisplayAxisTypes] = useState([]);
  const [axisTypeGeoJson, setAxisTypeGeoJson] = useState(null);

  const axisGeoJsonCacheRef = useRef(new Map()); // axisType -> geojson
  const displayAxisTypesRef = useRef([]);
  useEffect(() => {
    displayAxisTypesRef.current = displayAxisTypes;
  }, [displayAxisTypes]);

  const pendingSetRef = useRef(new Set());
  const [pendingAxisTypes, setPendingAxisTypes] = useState([]);

  function syncPendingState() {
    setPendingAxisTypes(Array.from(pendingSetRef.current));
  }
  function addPending(type) {
    pendingSetRef.current.add(type);
    syncPendingState();
  }
  function removePending(type) {
    pendingSetRef.current.delete(type);
    syncPendingState();
  }
  const roadLayerLoading = pendingAxisTypes.length > 0;

  async function ensureAxisTypeLoaded(axisType) {
    const typeName = normaliseTypeName(axisType);
    if (!typeName) return null;

    const cache = axisGeoJsonCacheRef.current;
    if (cache.has(typeName)) return cache.get(typeName);

    const gj = await apiGet(`/axisType/${encodeURIComponent(typeName)}`);

    if (gj && typeof gj === "object" && Array.isArray(gj.features)) {
      for (let i = 0; i < gj.features.length; i += 1) {
        const f = gj.features[i];
        if (!f || typeof f !== "object") continue;
        if (!f.properties || typeof f.properties !== "object") {
          f.properties = {};
        }
        f.properties.__axisType = typeName;
      }
    }

    cache.set(typeName, gj);
    return gj;
  }

  function rebuildAxisLayer(selectedTypes) {
    const cache = axisGeoJsonCacheRef.current;
    const selected = Array.from(new Set((selectedTypes || []).map(normaliseTypeName)))
      .filter(Boolean);

    if (selected.length === 0) {
      setAxisTypeGeoJson(null);
      return;
    }

    const features = [];
    for (let i = 0; i < selected.length; i += 1) {
      const t = selected[i];
      const gj = cache.get(t);
      if (gj && Array.isArray(gj.features)) {
        features.push(...gj.features);
      }
    }

    setAxisTypeGeoJson({ type: "FeatureCollection", features });
  }

  useEffect(() => {
    rebuildAxisLayer(displayAxisTypes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayAxisTypes]);

  async function refreshRoadTypes() {
    addPending("refresh");
    try {
      const valid = await apiGet("/validAxisTypes");
      const raw = Array.isArray(valid) ? valid.map(normaliseTypeName) : [];
      const ordered = sortRoadTypesByImportance(raw);
      setValidAxisTypes(ordered);

      const current = displayAxisTypesRef.current;
      const cleaned = current.filter((t) => ordered.includes(t));

      if (cleaned.length > 0) {
        setDisplayAxisTypes(cleaned);
        return;
      }

      await hideAllRoadTypes();
    } catch (err) {
      showToast("bad", err.message || "Failed to load road types");
    } finally {
      removePending("refresh");
    }
  }

  async function selectAllRoadTypes(validListOverride) {
    const list = Array.isArray(validListOverride)
      ? validListOverride.slice()
      : sortRoadTypesByImportance(validAxisTypes);

    const all = Array.from(new Set(list.map(normaliseTypeName))).filter(Boolean);

    if (all.length === 0) {
      setDisplayAxisTypes([]);
      setAxisTypeGeoJson(null);
      return;
    }

    setDisplayAxisTypes(all);

    for (let i = 0; i < all.length; i += 1) {
      addPending(all[i]);
    }

    try {
      await Promise.all(
        all.map(async (t) => {
          try {
            await ensureAxisTypeLoaded(t);
          } finally {
            removePending(t);
          }
        })
      );

      rebuildAxisLayer(displayAxisTypesRef.current);
    } catch (err) {
      showToast("bad", err.message || "Failed to load road type layer(s)");
    } finally {
      pendingSetRef.current.clear();
      setPendingAxisTypes([]);
    }
  }

  async function toggleRoadType(typeName, nextChecked) {
    const type = normaliseTypeName(typeName);
    if (!type) return;

    const current = displayAxisTypesRef.current;
    const next = nextChecked
      ? Array.from(new Set([...current, type]))
      : current.filter((t) => t !== type);

    setDisplayAxisTypes(next);

    if (!nextChecked) {
      rebuildAxisLayer(next);
      return;
    }

    addPending(type);
    try {
      await ensureAxisTypeLoaded(type);
      rebuildAxisLayer(displayAxisTypesRef.current);
    } catch (err) {
      setDisplayAxisTypes((prev) => prev.filter((t) => t !== type));
      rebuildAxisLayer(displayAxisTypesRef.current);
      showToast("bad", err.message || "Failed to load road type layer");
    } finally {
      removePending(type);
    }
  }

  function hideAllRoadTypes() {
    setDisplayAxisTypes([]);
    setAxisTypeGeoJson(null);
  }

  // -------------------- Blockages --------------------
  const [blockageGeoJson, setBlockageGeoJson] = useState(null);

  // keep known meta so we can fill missing radius/desc if backend doesn’t return them
  const blockageMetaRef = useRef(new Map()); // nameLower -> { radius, description }

  const [newBlockage, setNewBlockage] = useState({
    lat: "",
    long: "",
    radius: 200,
    name: "",
    description: "",
  });

  const draftBlockage = useMemo(() => {
    const lat = toNumber(newBlockage.lat);
    const long = toNumber(newBlockage.long);
    const radius = toNumber(newBlockage.radius);

    if (lat === null || long === null) return null;

    return {
      point: { lat, long },
      radius: radius === null ? 0 : radius,
      name: String(newBlockage.name || "").trim(),
      description: normaliseOptionalText(newBlockage.description),
    };
  }, [
    newBlockage.lat,
    newBlockage.long,
    newBlockage.radius,
    newBlockage.name,
    newBlockage.description,
  ]);

  // focus target for map
  const [focusTarget, setFocusTarget] = useState(null);

  // -------------------- Toasts + busy --------------------
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]); // [{ id, tone, text }]

  function showToast(tone, text) {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());

    setToasts((prev) => [...prev, { id, tone, text }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }

  function upsertBlockageMeta(name, radius, description) {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return;
    const r = Number(radius);
    const d = normaliseOptionalText(description);

    const prev = blockageMetaRef.current.get(key) || {};
    const next = {
      radius: Number.isFinite(r) && r > 0 ? r : prev.radius,
      description: d !== "" ? d : prev.description,
    };
    blockageMetaRef.current.set(key, next);
  }

  function enrichBlockageGeoJson(gj) {
    if (!gj || typeof gj !== "object") return gj;
    if (gj.type !== "FeatureCollection" || !Array.isArray(gj.features)) return gj;

    const next = { ...gj, features: gj.features.map((f) => f) };

    for (let i = 0; i < next.features.length; i += 1) {
      const f = next.features[i];
      if (!f || typeof f !== "object") continue;

      if (!f.properties || typeof f.properties !== "object") {
        f.properties = {};
      }

      const name = getBlockageNameFromFeature(f, i);
      const nameKey = String(name).trim().toLowerCase();

      // cache whatever the backend DID return
      const rFromServer = getBlockageRadiusFromFeature(f);
      const dFromServer = normaliseOptionalText(f.properties.description);

      if (rFromServer !== null) {
        upsertBlockageMeta(name, rFromServer, dFromServer);
      } else if (nameKey && blockageMetaRef.current.has(nameKey)) {
        const cached = blockageMetaRef.current.get(nameKey);
        if (cached && Number.isFinite(cached.radius)) {
          f.properties.radius = cached.radius;
        }
      }

      if (dFromServer !== "") {
        f.properties.description = dFromServer;
      } else if (nameKey && blockageMetaRef.current.has(nameKey)) {
        const cached = blockageMetaRef.current.get(nameKey);
        if (cached && cached.description) {
          f.properties.description = cached.description;
        } else {
          f.properties.description = "";
        }
      } else {
        f.properties.description = "";
      }
    }

    return next;
  }

  async function refreshBlockages() {
    setBusy(true);
    try {
      const gj = await apiGet("/blockage");
      const enriched = enrichBlockageGeoJson(gj);
      setBlockageGeoJson(enriched);
    } catch (err) {
      showToast("bad", err.message || "Failed to load blockages");
    } finally {
      setBusy(false);
    }
  }

  function blockageNameExists(name) {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return false;

    if (blockageMetaRef.current.has(key)) return true;

    const feats = Array.isArray(blockageGeoJson && blockageGeoJson.features)
      ? blockageGeoJson.features
      : [];

    for (let i = 0; i < feats.length; i += 1) {
      const f = feats[i];
      const existing = getBlockageNameFromFeature(f, i);
      if (String(existing || "").trim().toLowerCase() === key) return true;
    }

    return false;
  }

  async function addBlockage() {
    const lat = toNumber(newBlockage.lat);
    const long = toNumber(newBlockage.long);
    const radius = toNumber(newBlockage.radius);
    const name = String(newBlockage.name || "").trim();
    const desc = normaliseOptionalText(newBlockage.description);

    if (lat === null || long === null || radius === null) {
      showToast("warn", "Blockage coordinates and radius must be valid numbers.");
      return;
    }
    if (!name) {
      showToast("warn", "Blockage name is required.");
      return;
    }
    if (blockageNameExists(name)) {
      showToast("warn", "A blockage with that name already exists. Please use a unique name.");
      return;
    }

    setBusy(true);
    try {
      const body = {
        point: { long, lat },
        radius,
        name,
        description: desc, // never null
      };

      await apiPost("/blockage", body);

      // cache meta so radius/desc show even if backend omits them
      upsertBlockageMeta(name, radius, desc);

      showToast("good", "Blockage added.");

      // clear ALL inputs after add
      setNewBlockage({
        lat: "",
        long: "",
        radius: 200,
        name: "",
        description: "",
      });

      await refreshBlockages();
    } catch (err) {
      showToast("bad", err.message || "Failed to add blockage");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBlockage(name) {
    const nm = String(name || "").trim();
    if (!nm) return;

    setBusy(true);
    try {
      await apiDelete(`/blockage/${encodeURIComponent(nm)}`);

      // also drop cached meta (optional but keeps things tidy)
      blockageMetaRef.current.delete(nm.toLowerCase());

      showToast("good", "Blockage deleted.");
      await refreshBlockages();
    } catch (err) {
      showToast("bad", err.message || "Failed to delete blockage");
    } finally {
      setBusy(false);
    }
  }

  // -------------------- Route --------------------
  async function requestRoute() {
    if (!startPoint || !endPoint) {
      showToast("warn", "Start and End coordinates must be set.");
      return;
    }

    setRouteGeoJson(null);
    setBusy(true);

    try {
      const body = {
        startPt: {
          long: startPoint.long,
          lat: startPoint.lat,
          description: start.description || "Start",
        },
        endPt: {
          long: endPoint.long,
          lat: endPoint.lat,
          description: end.description || "End",
        },
        blockages: blockageGeoJson || null,
      };

      const gj = await apiPost("/route", body);
      setRouteGeoJson(gj);
      showToast("good", "Route loaded.");
    } catch (err) {
      showToast("bad", err.message || "Failed to request route");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!startPoint || !endPoint) return;
    if (!routeGeoJson) return;
    requestRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockageGeoJson]);

  function onPickPoint(point) {
    if (selectionMode === "start") {
      setStart((prev) => ({ ...prev, lat: String(point.lat), long: String(point.long) }));
      setSelectionMode(null);
      showToast("good", "Start point set.");
      return;
    }

    if (selectionMode === "end") {
      setEnd((prev) => ({ ...prev, lat: String(point.lat), long: String(point.long) }));
      setSelectionMode(null);
      showToast("good", "End point set.");
      return;
    }

    if (selectionMode === "blockage") {
      setNewBlockage((prev) => ({ ...prev, lat: String(point.lat), long: String(point.long) }));
      setSelectionMode(null);
      showToast("good", "Blockage point set.");
    }
  }

  function focusOnBlockageFeature(feature) {
    if (!feature || !feature.geometry || feature.geometry.type !== "Point") return;
    if (!Array.isArray(feature.geometry.coordinates)) return;

    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    setFocusTarget({
      lat,
      long: lng,
      zoom: 15,
      nonce: Date.now(),
    });
  }

  // -------------------- Badge --------------------
  const statusBadge = useMemo(() => {
    if (serverStatus === "ready") return <Badge tone="good">Ready</Badge>;
    if (serverStatus === "wait") return <Badge tone="warn">Warming up</Badge>;
    if (serverStatus === "error") return <Badge tone="bad">Error</Badge>;
    return <Badge tone="neutral">Unknown</Badge>;
  }, [serverStatus]);

  return (
    <div className="h-full w-full bg-slate-50">
      <div className="grid h-14 grid-cols-3 items-center border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-1">
          {statusBadge}

          <button
            type="button"
            onClick={pollUntilReady}
            className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-transparent text-slate-700 hover:bg-slate-100"
            aria-label="Refresh server status"
            title="Refresh server status"
          >
            <img
              src="/icons/refresh.png"
              alt="Refresh"
              className="h-5 w-5 select-none"
              draggable={false}
            />
          </button>

          {serverError ? <div className="text-xs text-red-600">{serverError}</div> : null}
        </div>

        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900">SG Routing App</div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Segmented
            value={mapStyle}
            onChange={setMapStyle}
            options={[
              { label: "Default", value: "default" },
              { label: "Simple", value: "simple" },
            ]}
          />
        </div>
      </div>

      <div className="grid h-[calc(100%-56px)] grid-cols-[340px_1fr]">
        <Sidebar>
          <Tabs
            tabs={[
              { label: "Route", value: TAB_ROUTE },
              { label: "Road Types", value: TAB_ROAD_TYPES },
              { label: "Blockages", value: TAB_BLOCKAGES },
            ]}
            value={tab}
            onChange={async (v) => {
              setTab(v);
              setSelectionMode(null);

              // Do NOT clear axis/blockages on tab change:
              // keep overlays visible on the map.

              if (v === TAB_ROAD_TYPES && validAxisTypes.length === 0) {
                await refreshRoadTypes();
              }

              if (v === TAB_BLOCKAGES && !blockageGeoJson) {
                await refreshBlockages();
              }
            }}
          />

          {tab === TAB_ROUTE ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <div className="mb-2 mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Start point
                  </div>

                  <FloatingInput
                    label="Longitude"
                    value={start.long}
                    onChange={(e) => setStart((p) => ({ ...p, long: e.target.value }))}
                    inputMode="decimal"
                  />

                  <div className="mt-2">
                    <FloatingInput
                      label="Latitude"
                      value={start.lat}
                      onChange={(e) => setStart((p) => ({ ...p, lat: e.target.value }))}
                      inputMode="decimal"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectionMode((prev) => (prev === "start" ? null : "start"))}
                      className={
                        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition " +
                        (selectionMode === "start"
                          ? "bg-slate-900 text-white shadow-sm translate-y-[1px]"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:translate-y-[1px]")
                      }
                    >
                      {selectionMode === "start" ? "Picking..." : "Pick"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setStart((p) => ({ ...p, lat: "", long: "" }))}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-[1px]"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="my-4 border-t border-slate-200" />
                </div>

                <div>
                  <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    End point
                  </div>

                  <FloatingInput
                    label="Longitude"
                    value={end.long}
                    onChange={(e) => setEnd((p) => ({ ...p, long: e.target.value }))}
                    inputMode="decimal"
                  />

                  <div className="mt-2">
                    <FloatingInput
                      label="Latitude"
                      value={end.lat}
                      onChange={(e) => setEnd((p) => ({ ...p, lat: e.target.value }))}
                      inputMode="decimal"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectionMode((prev) => (prev === "end" ? null : "end"))}
                      className={
                        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition " +
                        (selectionMode === "end"
                          ? "bg-slate-900 text-white shadow-sm translate-y-[1px]"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:translate-y-[1px]")
                      }
                    >
                      {selectionMode === "end" ? "Picking..." : "Pick"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEnd((p) => ({ ...p, lat: "", long: "" }))}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-[1px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRouteGeoJson(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Clear Route
                </button>
                <button
                  type="button"
                  onClick={requestRoute}
                  disabled={busy || serverStatus !== "ready"}
                  className="rounded-xl bg-blue-400 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                >
                  Search Route
                </button>
              </div>
            </div>
          ) : null}

          {tab === TAB_ROAD_TYPES ? (
            <RoadTypesPanel
              options={validAxisTypes}
              checked={displayAxisTypes}
              loading={roadLayerLoading}
              onRefresh={refreshRoadTypes}
              onToggle={toggleRoadType}
              onHideAll={hideAllRoadTypes}
              onSelectAll={() => selectAllRoadTypes()}
            />
          ) : null}

          {tab === TAB_BLOCKAGES ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Blockages</div>
                <button
                  type="button"
                  onClick={refreshBlockages}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-100 disabled:opacity-60"
                  disabled={busy}
                >
                  Refresh
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700">Add blockage</div>

                <div className="mt-2 space-y-2">
                  <input
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="lat"
                    value={newBlockage.lat}
                    onChange={(e) => setNewBlockage((p) => ({ ...p, lat: e.target.value }))}
                  />

                  <input
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="long"
                    value={newBlockage.long}
                    onChange={(e) => setNewBlockage((p) => ({ ...p, long: e.target.value }))}
                  />

                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">Radius</div>
                      <div className="text-xs text-slate-600">
                        {Number(newBlockage.radius || 0)} m
                      </div>
                    </div>

                    <input
                      type="range"
                      min={50}
                      max={2000}
                      step={10}
                      value={Number(newBlockage.radius || 200)}
                      onChange={(e) => setNewBlockage((p) => ({ ...p, radius: e.target.value }))}
                      className="mt-2 w-full"
                    />
                  </div>

                  <input
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="name"
                    value={newBlockage.name}
                    onChange={(e) => setNewBlockage((p) => ({ ...p, name: e.target.value }))}
                  />

                  <textarea
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="description (optional)"
                    rows={2}
                    value={newBlockage.description}
                    onChange={(e) => setNewBlockage((p) => ({ ...p, description: e.target.value }))}
                  />

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectionMode((prev) => (prev === "blockage" ? null : "blockage"))}
                      className={
                        "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition " +
                        (selectionMode === "blockage"
                          ? "bg-slate-900 text-white shadow-sm translate-y-[1px]"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:translate-y-[1px]")
                      }
                    >
                      {selectionMode === "blockage" ? "Picking..." : "Pick"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setNewBlockage({
                          lat: "",
                          long: "",
                          radius: 200,
                          name: "",
                          description: "",
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-[1px]"
                    >
                      Clear
                    </button>

                    <div className="flex-1" />

                    <button
                      type="button"
                      onClick={addBlockage}
                      disabled={busy || serverStatus !== "ready"}
                      className="rounded-lg bg-blue-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700">Existing blockages</div>
                <div className="mt-2 max-h-60 overflow-auto">
                  <BlockageList
                    geojson={blockageGeoJson}
                    onDelete={deleteBlockage}
                    onFocus={focusOnBlockageFeature}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </Sidebar>

        <div className="h-full w-full">
          <MapView
            mapStyle={mapStyle}
            selectionMode={selectionMode}
            onPickPoint={onPickPoint}
            startPoint={startPoint}
            endPoint={endPoint}
            routeGeoJson={routeGeoJson}
            axisTypeGeoJson={axisTypeGeoJson}     // keep visible even when tab changes
            blockageGeoJson={blockageGeoJson}     // keep visible even when tab changes
            draftBlockage={draftBlockage}
            focusTarget={focusTarget}
          />
        </div>
      </div>

      <ToastStack toasts={toasts} />

      {roadLayerLoading ? <LoadingOverlay title="Loading road type layer(s)…" /> : null}
    </div>
  );
}

function BlockageList({ geojson, onDelete, onFocus }) {
  const features = Array.isArray(geojson && geojson.features) ? geojson.features : [];

  if (features.length === 0) {
    return <div className="text-xs text-slate-500">No blockages loaded.</div>;
  }

  return (
    <div className="space-y-2">
      {features.map((f, idx) => {
        const props = f && f.properties ? f.properties : {};
        const name = props.name || props.id || String(idx);
        const desc = normaliseOptionalText(props.description);
        const radius =
          props.radius ??
          props.r ??
          (f && f.radius) ??
          "";

        return (
          <button
            type="button"
            key={String(name)}
            onClick={() => {
              if (typeof onFocus === "function") onFocus(f);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{String(name)}</div>
                {desc ? <div className="text-xs text-slate-600">{desc}</div> : null}
                {radius ? (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Radius: {String(radius)} m
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (typeof onDelete === "function") onDelete(String(name));
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-100"
              >
                Delete
              </button>
            </div>
          </button>
        );
      })}
    </div>
  );
}

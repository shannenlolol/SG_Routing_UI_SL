// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import Field from "./components/Field";
import Badge from "./components/Badge";
import ModePicker from "./components/ModePicker";
import Segmented from "./components/Segmented";
import MapView from "./components/MapView";
import FloatingInput from "./components/FloatingInput";
import RoadTypesPanel from "./components/RoadTypesPanel";
import ToastStack from "./components/ToastStack";
import LoadingOverlay from "./components/LoadingOverlay";
import { apiDelete, apiGet, apiPost } from "./api/client";
import { normaliseRoadTypesForMode } from "./utils/geo";
import { normaliseTypeName, sortRoadTypesByImportance } from "./utils/roadTypes";

const TAB_ROUTE = "route";
const TAB_ROAD_TYPES = "roadTypes";
const TAB_BLOCKAGES = "blockages";

// Keep these within the “11 algo types” only.
const ROADTYPE_DEFAULTS = {
  driving: [
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "residential",
  ],
  cycling: ["secondary", "tertiary", "residential"],
  walking: ["residential", "tertiary"],
};

function toNumber(value) {
  const n = Number(value);
  if (Number.isFinite(n)) {
    return n;
  }
  return null;
}

function tagFeaturesWithAxisType(geojson, axisTypeValue) {
  const t = normaliseTypeName(axisTypeValue);
  if (!geojson || typeof geojson !== "object") {
    return geojson;
  }
  if (!Array.isArray(geojson.features)) {
    return geojson;
  }

  return {
    ...geojson,
    features: geojson.features
      .filter(Boolean)
      .map((f) => {
        const props = f && f.properties && typeof f.properties === "object" ? f.properties : {};
        return {
          ...f,
          properties: {
            ...props,
            __axisType: t,
          },
        };
      }),
  };
}

export default function App() {
  // -------------------- Server readiness --------------------
  const [serverStatus, setServerStatus] = useState("unknown"); // unknown | wait | ready | error
  const [serverError, setServerError] = useState("");
  const pollTimer = useRef(null);

  // -------------------- UI state --------------------
  const [tab, setTab] = useState(TAB_ROUTE);

  // Map selection mode: "start" | "end" | "blockage" | null
  const [selectionMode, setSelectionMode] = useState(null);

  // Map tiles (base map only)
  const [mapStyle, setMapStyle] = useState("default");

  // Mode (algorithm mode)
  const [mode, setMode] = useState("driving");

  // -------------------- Route points --------------------
  const [start, setStart] = useState({
    lat: "",
    long: "",
    description: "Start",
  });

  const [end, setEnd] = useState({
    lat: "",
    long: "",
    description: "End",
  });

  const startPoint = useMemo(() => {
    const lat = toNumber(start.lat);
    const long = toNumber(start.long);
    if (lat === null || long === null) {
      return null;
    }
    return { lat, long };
  }, [start.lat, start.long]);

  const endPoint = useMemo(() => {
    const lat = toNumber(end.lat);
    const long = toNumber(end.long);
    if (lat === null || long === null) {
      return null;
    }
    return { lat, long };
  }, [end.lat, end.long]);

  const [routeGeoJson, setRouteGeoJson] = useState(null);

  // -------------------- Road types (only VALID options) --------------------
  const [validAxisTypes, setValidAxisTypes] = useState([]);
  const [displayAxisTypes, setDisplayAxisTypes] = useState([]);
  const displayAxisTypesRef = useRef([]);
  useEffect(() => {
    displayAxisTypesRef.current = displayAxisTypes;
  }, [displayAxisTypes]);

  const [axisTypeGeoJson, setAxisTypeGeoJson] = useState(null);

  // cache: axisType -> geojson (already tagged with __axisType)
  const axisGeoJsonCacheRef = useRef(new Map());

  // Track pending loads for full-screen overlay
  const pendingSetRef = useRef(new Set());
  const [pendingAxisTypes, setPendingAxisTypes] = useState([]);

  function syncPendingState() {
    setPendingAxisTypes(Array.from(pendingSetRef.current));
  }

  function addPending(key) {
    pendingSetRef.current.add(key);
    syncPendingState();
  }

  function removePending(key) {
    pendingSetRef.current.delete(key);
    syncPendingState();
  }

  const roadLayerLoading = pendingAxisTypes.length > 0;

  // Avoid duplicate in-flight requests
  const inflightRef = useRef(new Map()); // axisType -> Promise

  function setSelection(nextSelection) {
    const next = Array.from(new Set((nextSelection || []).map(normaliseTypeName))).filter(Boolean);
    displayAxisTypesRef.current = next;
    setDisplayAxisTypes(next);
  }

  function rebuildAxisLayer(selection) {
    const selected = Array.from(new Set((selection || []).map(normaliseTypeName))).filter(Boolean);

    if (selected.length === 0) {
      setAxisTypeGeoJson(null);
      return;
    }

    const cache = axisGeoJsonCacheRef.current;
    const features = [];

    for (let i = 0; i < selected.length; i += 1) {
      const t = selected[i];
      const gj = cache.get(t);
      if (gj && Array.isArray(gj.features)) {
        features.push(...gj.features);
      }
    }

    setAxisTypeGeoJson({
      type: "FeatureCollection",
      features,
    });
  }

  // Keep map layer consistent with selection even when switching tabs
  useEffect(() => {
    rebuildAxisLayer(displayAxisTypes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayAxisTypes]);

  async function ensureAxisTypeLoaded(axisTypeValue) {
    const t = normaliseTypeName(axisTypeValue);
    if (!t) {
      return null;
    }

    const cache = axisGeoJsonCacheRef.current;
    if (cache.has(t)) {
      return cache.get(t);
    }

    const inflight = inflightRef.current;
    if (inflight.has(t)) {
      return inflight.get(t);
    }

    const p = (async () => {
      const gj = await apiGet(`/axisType/${encodeURIComponent(t)}`);
      const tagged = tagFeaturesWithAxisType(gj, t);
      cache.set(t, tagged);
      return tagged;
    })();

    inflight.set(t, p);

    try {
      const result = await p;
      return result;
    } finally {
      inflight.delete(t);
    }
  }

  function getModeDisplayDefaults(nextMode, validList) {
    const wanted = Array.isArray(ROADTYPE_DEFAULTS[nextMode])
      ? ROADTYPE_DEFAULTS[nextMode].map(normaliseTypeName)
      : [];

    const valid = Array.isArray(validList) ? validList.map(normaliseTypeName) : [];
    const filtered = wanted.filter((x) => valid.includes(x));

    if (filtered.length > 0) {
      return filtered;
    }

    // fallback: first few valid types (already ordered)
    return valid.slice(0, 6);
  }

  async function applySelection(nextSelection) {
    const selected = Array.from(new Set((nextSelection || []).map(normaliseTypeName))).filter(Boolean);
    setSelection(selected);

    // Which ones need fetching?
    const cache = axisGeoJsonCacheRef.current;
    const missing = [];

    for (let i = 0; i < selected.length; i += 1) {
      const t = selected[i];
      if (!cache.has(t)) {
        missing.push(t);
      }
    }

    if (missing.length === 0) {
      rebuildAxisLayer(displayAxisTypesRef.current);
      return;
    }

    for (let i = 0; i < missing.length; i += 1) {
      addPending(missing[i]);
    }

    try {
      await Promise.all(
        missing.map(async (t) => {
          try {
            await ensureAxisTypeLoaded(t);
          } finally {
            removePending(t);
          }
        })
      );
    } catch (err) {
      showToast("bad", err && err.message ? err.message : "Failed to load road type layer(s)");
    } finally {
      // Rebuild using *current* selection (handles user toggling mid-load)
      rebuildAxisLayer(displayAxisTypesRef.current);
    }
  }

  async function selectAllRoadTypes() {
    const list = Array.isArray(validAxisTypes) ? validAxisTypes : [];
    await applySelection(list);
  }

  async function toggleRoadType(typeName, nextChecked) {
    const t = normaliseTypeName(typeName);
    if (!t) {
      return;
    }

    const current = displayAxisTypesRef.current;
    let next = [];

    if (nextChecked) {
      next = Array.from(new Set([...current, t]));
    } else {
      next = current.filter((x) => x !== t);
    }

    // Optimistic checkbox update immediately
    setSelection(next);

    // Uncheck: immediate map update, and ignore any in-flight loads (rebuild uses current selection)
    if (!nextChecked) {
      rebuildAxisLayer(next);
      return;
    }

    // Check: show overlay while fetching if needed, then rebuild from current selection
    const cache = axisGeoJsonCacheRef.current;
    if (cache.has(t)) {
      rebuildAxisLayer(displayAxisTypesRef.current);
      return;
    }

    addPending(t);

    try {
      await ensureAxisTypeLoaded(t);
    } catch (err) {
      // Roll back only this type
      setSelection(displayAxisTypesRef.current.filter((x) => x !== t));
      showToast("bad", err && err.message ? err.message : "Failed to load road type layer");
    } finally {
      removePending(t);
      rebuildAxisLayer(displayAxisTypesRef.current);
    }
  }

  async function hideAllRoadTypes() {
    setSelection([]);
    setAxisTypeGeoJson(null);
  }

  async function refreshRoadTypes() {
    addPending("refresh");

    try {
      const valid = await apiGet("/validAxisTypes");
      const raw = Array.isArray(valid) ? valid.map(normaliseTypeName) : [];
      const ordered = sortRoadTypesByImportance(raw);
      setValidAxisTypes(ordered);

      // Preserve current selection if possible (drop invalid ones only)
      const current = displayAxisTypesRef.current;
      const cleaned = current.filter((t) => ordered.includes(t));

      if (cleaned.length > 0) {
        await applySelection(cleaned);
        return;
      }

      // First time / nothing selected: use mode defaults
      const defaults = getModeDisplayDefaults(mode, ordered);
      await applySelection(defaults);
    } catch (err) {
      showToast("bad", err && err.message ? err.message : "Failed to load road types");
    } finally {
      removePending("refresh");
    }
  }

  async function applyModeDefaults(nextMode) {
    const types = normaliseRoadTypesForMode(nextMode);

    setBusy(true);
    try {
      const updated = await apiPost("/changeValidRoadTypes", types);
      const raw = Array.isArray(updated) ? updated.map(normaliseTypeName) : types.map(normaliseTypeName);
      const ordered = sortRoadTypesByImportance(raw);

      setValidAxisTypes(ordered);

      // Keep only valid selections; if none, fall back to mode defaults
      const current = displayAxisTypesRef.current;
      const cleaned = current.filter((t) => ordered.includes(t));

      if (cleaned.length > 0) {
        await applySelection(cleaned);
      } else {
        const defaults = getModeDisplayDefaults(nextMode, ordered);
        await applySelection(defaults);
      }
    } catch (err) {
      showToast(
        "warn",
        `Travel mode ${String(nextMode).toUpperCase()} selected. Server update may be unsupported for now.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function onModeChange(nextMode) {
    setMode(nextMode);
    await applyModeDefaults(nextMode);
  }

  // -------------------- Blockages --------------------
  const [blockageGeoJson, setBlockageGeoJson] = useState(null);
  const [newBlockage, setNewBlockage] = useState({
    lat: "",
    long: "",
    radius: 200,
    name: "",
    description: "",
  });

  // -------------------- Busy + toasts --------------------
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]); // [{ id, tone, text }]

  function showToast(tone, text) {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());

    setToasts((prev) => {
      const next = Array.isArray(prev) ? prev.slice() : [];
      next.push({ id, tone, text });
      return next;
    });

    window.setTimeout(() => {
      setToasts((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.filter((t) => t.id !== id);
      });
    }, 3000);
  }

  // -------------------- Server polling (fixes pollUntilReady error) --------------------
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
      setServerError(err && err.message ? err.message : "Failed to reach server");
      return "error";
    }
  }

  async function pollUntilReady() {
    window.clearInterval(pollTimer.current);

    const first = await checkReadyOnce();
    if (first === "ready") {
      return;
    }

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

  // -------------------- API actions --------------------
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
      };

      const gj = await apiPost("/route", body);
      setRouteGeoJson(gj);
      showToast("good", "Route loaded.");
    } catch (err) {
      showToast("bad", err && err.message ? err.message : "Failed to request route");
    } finally {
      setBusy(false);
    }
  }

  async function refreshBlockages() {
    setBusy(true);
    try {
      const gj = await apiGet("/blockage");
      setBlockageGeoJson(gj);
    } catch (err) {
      showToast("bad", err && err.message ? err.message : "Failed to load blockages");
    } finally {
      setBusy(false);
    }
  }

  async function addBlockage() {
    const lat = toNumber(newBlockage.lat);
    const long = toNumber(newBlockage.long);
    const radius = toNumber(newBlockage.radius);

    if (lat === null || long === null || radius === null) {
      showToast("warn", "Blockage coordinates and radius must be valid numbers.");
      return;
    }

    if (!String(newBlockage.name || "").trim()) {
      showToast("warn", "Blockage name is required.");
      return;
    }

    setBusy(true);
    try {
      const body = {
        point: { long, lat },
        radius,
        name: String(newBlockage.name).trim(),
        description: newBlockage.description || "",
      };

      await apiPost("/blockage", body);
      showToast("good", "Blockage added.");
      await refreshBlockages();
    } catch (err) {
      showToast("bad", err && err.message ? err.message : "Failed to add blockage");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBlockage(name) {
    if (!name) {
      return;
    }

    setBusy(true);
    try {
      await apiDelete(`/blockage/${encodeURIComponent(name)}`);
      showToast("good", "Blockage deleted.");
      await refreshBlockages();
    } catch (err) {
      showToast("bad", err && err.message ? err.message : "Failed to delete blockage");
    } finally {
      setBusy(false);
    }
  }

  function onPickPoint(point) {
    if (selectionMode === "start") {
      setStart((prev) => {
        return { ...prev, lat: String(point.lat), long: String(point.long) };
      });
      setSelectionMode(null);
      showToast("good", "Start point set.");
      return;
    }

    if (selectionMode === "end") {
      setEnd((prev) => {
        return { ...prev, lat: String(point.lat), long: String(point.long) };
      });
      setSelectionMode(null);
      showToast("good", "End point set.");
      return;
    }

    if (selectionMode === "blockage") {
      setNewBlockage((prev) => {
        return { ...prev, lat: String(point.lat), long: String(point.long) };
      });
      setSelectionMode(null);
      showToast("good", "Blockage point set.");
    }
  }

  const statusBadge = useMemo(() => {
    if (serverStatus === "ready") {
      return <Badge tone="good">Ready</Badge>;
    }
    if (serverStatus === "wait") {
      return <Badge tone="warn">Warming up</Badge>;
    }
    if (serverStatus === "error") {
      return <Badge tone="bad">Error</Badge>;
    }
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
          {/* IMPORTANT: this ONLY changes mapStyle state; MapView updates tile URL without refreshing overlays */}
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
              <Field>
                <ModePicker value={mode} onChange={onModeChange} />
              </Field>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <div className="mb-2 mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Start point
                  </div>

                  <FloatingInput
                    label="Longitude"
                    value={start.long}
                    onChange={(e) => {
                      setStart((p) => {
                        return { ...p, long: e.target.value };
                      });
                    }}
                    inputMode="decimal"
                  />

                  <div className="mt-2">
                    <FloatingInput
                      label="Latitude"
                      value={start.lat}
                      onChange={(e) => {
                        setStart((p) => {
                          return { ...p, lat: e.target.value };
                        });
                      }}
                      inputMode="decimal"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode((prev) => {
                          if (prev === "start") {
                            return null;
                          }
                          return "start";
                        });
                      }}
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
                      onClick={() => {
                        setStart((p) => {
                          return { ...p, lat: "", long: "" };
                        });
                      }}
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
                    onChange={(e) => {
                      setEnd((p) => {
                        return { ...p, long: e.target.value };
                      });
                    }}
                    inputMode="decimal"
                  />

                  <div className="mt-2">
                    <FloatingInput
                      label="Latitude"
                      value={end.lat}
                      onChange={(e) => {
                        setEnd((p) => {
                          return { ...p, lat: e.target.value };
                        });
                      }}
                      inputMode="decimal"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode((prev) => {
                          if (prev === "end") {
                            return null;
                          }
                          return "end";
                        });
                      }}
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
                      onClick={() => {
                        setEnd((p) => {
                          return { ...p, lat: "", long: "" };
                        });
                      }}
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
                  onClick={requestRoute}
                  disabled={busy || serverStatus !== "ready"}
                  className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Search Route
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRouteGeoJson(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Clear Route
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
              onSelectAll={selectAllRoadTypes}
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

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="lat"
                    value={newBlockage.lat}
                    onChange={(e) => {
                      setNewBlockage((p) => {
                        return { ...p, lat: e.target.value };
                      });
                    }}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="long"
                    value={newBlockage.long}
                    onChange={(e) => {
                      setNewBlockage((p) => {
                        return { ...p, long: e.target.value };
                      });
                    }}
                  />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="radius (m)"
                    value={newBlockage.radius}
                    onChange={(e) => {
                      setNewBlockage((p) => {
                        return { ...p, radius: e.target.value };
                      });
                    }}
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="name"
                    value={newBlockage.name}
                    onChange={(e) => {
                      setNewBlockage((p) => {
                        return { ...p, name: e.target.value };
                      });
                    }}
                  />
                </div>

                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder="description (optional)"
                  rows={2}
                  value={newBlockage.description}
                  onChange={(e) => {
                    setNewBlockage((p) => {
                      return { ...p, description: e.target.value };
                    });
                  }}
                />

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode("blockage");
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-100"
                  >
                    Pick point
                  </button>

                  <button
                    type="button"
                    onClick={addBlockage}
                    disabled={busy || serverStatus !== "ready"}
                    className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700">Existing</div>
                <div className="mt-2 max-h-60 overflow-auto">
                  <BlockageList geojson={blockageGeoJson} onDelete={deleteBlockage} />
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
            axisTypeGeoJson={axisTypeGeoJson}
            blockageGeoJson={blockageGeoJson}
          />
        </div>
      </div>

      <ToastStack toasts={toasts} />

      {/* Full-screen overlay for road-types loading (checkbox/select-all/refresh) */}
      {roadLayerLoading ? (
        <LoadingOverlay
          title="Loading road type layer(s)…"
          subtitle={pendingAxisTypes.length > 0 ? pendingAxisTypes.join(", ") : "Please wait"}
        />
      ) : null}
    </div>
  );
}

function BlockageList({ geojson, onDelete }) {
  const features = Array.isArray(geojson && geojson.features) ? geojson.features : [];

  if (features.length === 0) {
    return <div className="text-xs text-slate-500">No blockages loaded.</div>;
  }

  return (
    <div className="space-y-2">
      {features.map((f, idx) => {
        const props = f && f.properties ? f.properties : {};
        const name = props.name || props.id || String(idx);
        const desc = props.description || "";
        const radius = props.radius || props.r || "";

        return (
          <div key={name} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{name}</div>
                {desc ? <div className="text-xs text-slate-600">{desc}</div> : null}
                {radius ? (
                  <div className="mt-1 text-[11px] text-slate-500">Radius: {radius} m</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  onDelete(name);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-100"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

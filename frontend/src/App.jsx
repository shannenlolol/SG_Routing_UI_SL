// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import Field from "./components/Field";
import Badge from "./components/Badge";
import Segmented from "./components/Segmented";
import MapView from "./components/MapView";
import FloatingInput from "./components/FloatingInput";
import RoadTypesPanel from "./components/RoadTypesPanel";
import ToastStack from "./components/ToastStack";
import LoadingOverlay from "./components/LoadingOverlay";
import { apiDelete, apiGet, apiPost } from "./api/client";
import { normaliseRoadTypesForMode } from "./utils/geo";
import {
  ROAD_TYPE_META_BY_VALUE,
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

  // Base map style only (must not refresh anything else)
  const [mapStyle, setMapStyle] = useState("default");

  // Transport mode removed per request: keep default only
  const mode = "driving";

  // Points
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

  // Pending set controls the full-screen overlay (road-types only)
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

    // Tag every feature so MapView can style + tooltip properly.
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
    const selected = Array.from(
      new Set((selectedTypes || []).map(normaliseTypeName))
    ).filter(Boolean);

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

    setAxisTypeGeoJson({
      type: "FeatureCollection",
      features,
    });
  }

  // Keep map overlay consistent with the *actual* selection even when tab changes
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

      // Preserve selection; drop invalid only
      const current = displayAxisTypesRef.current;
      const cleaned = current.filter((t) => ordered.includes(t));

      if (cleaned.length > 0) {
        setDisplayAxisTypes(cleaned);
        return;
      }

      // First-time: select all
      await selectAllRoadTypes(ordered);
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

    const all = Array.from(new Set(list.map(normaliseTypeName))).filter(
      Boolean
    );

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

      // Use latest selection (handles user clicking while loading)
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

    // Optimistic checkbox update immediately
    const current = displayAxisTypesRef.current;
    const next = nextChecked
      ? Array.from(new Set([...current, type]))
      : current.filter((t) => t !== type);

    setDisplayAxisTypes(next);

    // Uncheck: immediate map update
    if (!nextChecked) {
      rebuildAxisLayer(next);
      return;
    }

    // Check: show overlay while fetching
    addPending(type);
    try {
      await ensureAxisTypeLoaded(type);
      rebuildAxisLayer(displayAxisTypesRef.current);
    } catch (err) {
      // revert if fetch fails
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
  const [newBlockage, setNewBlockage] = useState({
    lat: "",
    long: "",
    radius: 200,
    name: "",
    description: "",
  });

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

  async function refreshBlockages() {
    setBusy(true);
    try {
      const gj = await apiGet("/blockage");
      setBlockageGeoJson(gj);
    } catch (err) {
      showToast("bad", err.message || "Failed to load blockages");
    } finally {
      setBusy(false);
    }
  }

  async function addBlockage() {
    const lat = toNumber(newBlockage.lat);
    const long = toNumber(newBlockage.long);
    const radius = toNumber(newBlockage.radius);

    if (lat === null || long === null || radius === null) {
      showToast(
        "warn",
        "Blockage coordinates and radius must be valid numbers."
      );
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
      showToast("bad", err.message || "Failed to add blockage");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBlockage(name) {
    if (!name) return;
    setBusy(true);
    try {
      await apiDelete(`/blockage/${encodeURIComponent(name)}`);
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

  function onPickPoint(point) {
    if (selectionMode === "start") {
      setStart((prev) => ({
        ...prev,
        lat: String(point.lat),
        long: String(point.long),
      }));
      setSelectionMode(null);
      showToast("good", "Start point set.");
      return;
    }

    if (selectionMode === "end") {
      setEnd((prev) => ({
        ...prev,
        lat: String(point.lat),
        long: String(point.long),
      }));
      setSelectionMode(null);
      showToast("good", "End point set.");
      return;
    }

    if (selectionMode === "blockage") {
      setNewBlockage((prev) => ({
        ...prev,
        lat: String(point.lat),
        long: String(point.long),
      }));
      setSelectionMode(null);
      showToast("good", "Blockage point set.");
    }
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
        {/* Left */}
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

          {serverError ? (
            <div className="text-xs text-red-600">{serverError}</div>
          ) : null}
        </div>

        {/* Centre */}
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900">
            SG Routing App
          </div>
        </div>

        {/* Right */}
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

              if (v !== TAB_ROAD_TYPES) {
                setAxisTypeGeoJson(null);
              }

              if (v === TAB_ROAD_TYPES && validAxisTypes.length === 0) {
                await refreshRoadTypes();
              }

              if (v === TAB_BLOCKAGES && !blockageGeoJson) {
                await refreshBlockages();
              }
            }}
          />

          {/* -------------------- ROUTE TAB (no mode picker now) -------------------- */}
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
                    onChange={(e) =>
                      setStart((p) => ({ ...p, long: e.target.value }))
                    }
                    inputMode="decimal"
                  />

                  <div className="mt-2">
                    <FloatingInput
                      label="Latitude"
                      value={start.lat}
                      onChange={(e) =>
                        setStart((p) => ({ ...p, lat: e.target.value }))
                      }
                      inputMode="decimal"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectionMode((prev) =>
                          prev === "start" ? null : "start"
                        )
                      }
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
                      onClick={() =>
                        setStart((p) => ({ ...p, lat: "", long: "" }))
                      }
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
                    onChange={(e) =>
                      setEnd((p) => ({ ...p, long: e.target.value }))
                    }
                    inputMode="decimal"
                  />

                  <div className="mt-2">
                    <FloatingInput
                      label="Latitude"
                      value={end.lat}
                      onChange={(e) =>
                        setEnd((p) => ({ ...p, lat: e.target.value }))
                      }
                      inputMode="decimal"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectionMode((prev) =>
                          prev === "end" ? null : "end"
                        )
                      }
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
                      onClick={() =>
                        setEnd((p) => ({ ...p, lat: "", long: "" }))
                      }
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
                  onClick={() => setRouteGeoJson(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Clear Route
                </button>
              </div>
            </div>
          ) : null}

          {/* -------------------- ROAD TYPES TAB -------------------- */}
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

          {/* -------------------- BLOCKAGES TAB -------------------- */}
          {tab === TAB_BLOCKAGES ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  Blockages
                </div>
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
                <div className="text-xs font-semibold text-slate-700">
                  Add blockage
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="lat"
                    value={newBlockage.lat}
                    onChange={(e) =>
                      setNewBlockage((p) => ({ ...p, lat: e.target.value }))
                    }
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="long"
                    value={newBlockage.long}
                    onChange={(e) =>
                      setNewBlockage((p) => ({ ...p, long: e.target.value }))
                    }
                  />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="radius (m)"
                    value={newBlockage.radius}
                    onChange={(e) =>
                      setNewBlockage((p) => ({ ...p, radius: e.target.value }))
                    }
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="name"
                    value={newBlockage.name}
                    onChange={(e) =>
                      setNewBlockage((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>

                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder="description (optional)"
                  rows={2}
                  value={newBlockage.description}
                  onChange={(e) =>
                    setNewBlockage((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                />

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectionMode("blockage")}
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
                <div className="text-xs font-semibold text-slate-700">
                  Existing
                </div>
                <div className="mt-2 max-h-60 overflow-auto">
                  <BlockageList
                    geojson={blockageGeoJson}
                    onDelete={deleteBlockage}
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
            axisTypeGeoJson={tab === TAB_ROAD_TYPES ? axisTypeGeoJson : null}
            blockageGeoJson={blockageGeoJson}
          />
        </div>
      </div>

      <ToastStack toasts={toasts} />

      {/* Full-screen road layer overlay */}
      {roadLayerLoading ? (
        <LoadingOverlay
          title="Loading road type layer(s)…"
          subtitle={
            pendingAxisTypes.length > 0
              ? pendingAxisTypes.join(", ")
              : "Please wait"
          }
        />
      ) : null}
    </div>
  );
}

function BlockageList({ geojson, onDelete }) {
  const features = Array.isArray(geojson && geojson.features)
    ? geojson.features
    : [];

  if (features.length === 0) {
    return <div className="text-xs text-slate-500">No blockages loaded.</div>;
  }

  return (
    <div className="space-y-2">
      {features.map((f, idx) => {
        const props = f.properties || {};
        const name = props.name || props.id || String(idx);
        const desc = props.description || "";
        const radius = props.radius || props.r || "";

        return (
          <div
            key={name}
            className="rounded-lg border border-slate-200 bg-white p-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {name}
                </div>
                {desc ? (
                  <div className="text-xs text-slate-600">{desc}</div>
                ) : null}
                {radius ? (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Radius: {radius} m
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onDelete(name)}
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

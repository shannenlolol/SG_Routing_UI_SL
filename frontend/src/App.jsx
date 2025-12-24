// src/App.jsx
import React, { useState, useMemo, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import Badge from "./components/Badge";
import Segmented from "./components/Segmented";
import MapView from "./components/MapView";
import RoadTypesTab from "./components/RoadTypesTab";
import RouteTab from "./components/RouteTab";
import BlockagesTab from "./components/BlockagesTab";
import ToastStack from "./components/ToastStack";
import LoadingOverlay from "./components/LoadingOverlay";
import { useServerStatus } from "./hooks/useServerStatus";
import { useRoadTypes } from "./hooks/useRoadTypes";
import { useBlockages } from "./hooks/useBlockages";
import { useRouting } from "./hooks/useRouting";
import { useToast } from "./hooks/useToast";
import { TRANSPORT_MODES, getRoadTypesForMode } from "./utils/transportModes";
import { apiPost } from "./api/client";

const TAB_ROUTE = "route";
const TAB_ROAD_TYPES = "roadTypes";
const TAB_BLOCKAGES = "blockages";

export default function App() {
  const { toasts, showToast } = useToast();
  const { serverStatus, serverError, pollUntilReady } = useServerStatus();

  const [tab, setTab] = useState(TAB_ROUTE);
  const [selectionMode, setSelectionMode] = useState(null);
  const [mapStyle, setMapStyle] = useState("simple");
  const [focusTarget, setFocusTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  
  // SEPARATE transport modes - DO NOT SHARE
  const [routeTransportMode, setRouteTransportMode] = useState(TRANSPORT_MODES.CAR);
  const [roadTypesFilterMode, setRoadTypesFilterMode] = useState(null);

  const {
    allRoadTypes,
    roadTypeColors,
    validAxisTypes,
    displayAxisTypes,
    axisTypeGeoJson,
    roadLayerLoading,
    fetchAllRoadTypes,
    refreshRoadTypes,
    selectAllRoadTypes,
    selectRoadTypes,
    toggleRoadType,
    hideAllRoadTypes,
  } = useRoadTypes(showToast, routeTransportMode);

  // Only update routing road types when ROUTE transport mode changes
  useEffect(() => {
    async function updateRoadTypesForMode() {
      if (serverStatus !== "ready") return;
      
      const roadTypes = getRoadTypesForMode(routeTransportMode);
      console.log("[app] route transport mode changed to", routeTransportMode, "setting road types", roadTypes);
      
      try {
        await apiPost("/changeValidRoadTypes", roadTypes);
      } catch (err) {
        console.warn("[app] failed to update road types for mode", err);
      }
    }
    
    updateRoadTypesForMode();
  }, [routeTransportMode, serverStatus]);

  const {
    blockageGeoJson,
    blockageGeoJsonRef,
    newBlockage,
    setNewBlockage,
    draftBlockage,
    refreshBlockages,
    addBlockage: addBlockageHook,
    deleteBlockage: deleteBlockageHook,
  } = useBlockages(showToast);

  const {
    start,
    setStart,
    end,
    setEnd,
    startPoint,
    endPoint,
    routeGeoJson,
    handleSearchRoute,
    scheduleAutoReroute,
    clearRoute,
  } = useRouting(serverStatus, blockageGeoJsonRef, routeTransportMode, showToast);

  async function handleAddBlockage() {
    setBusy(true);
    try {
      await addBlockageHook(serverStatus, (synced) => {
        scheduleAutoReroute("blockage:add", synced);
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteBlockage(name) {
    setBusy(true);
    try {
      await deleteBlockageHook(name, (synced) => {
        scheduleAutoReroute("blockage:delete", synced);
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshBlockages() {
    setBusy(true);
    try {
      await refreshBlockages();
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

  function focusOnBlockageFeature(feature) {
    if (!feature || !feature.geometry || feature.geometry.type !== "Point") {
      return;
    }
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

  function handleReversePoints() {
    const tempStart = { ...start };
    setStart({ ...end });
    setEnd({ ...tempStart });
    showToast("good", "Start and end points reversed.");
  }

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

          {serverError ? (
            <div className="text-xs text-red-600">{serverError}</div>
          ) : null}
        </div>

        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900">
            SG Routing App
          </div>
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

              if (v === TAB_ROAD_TYPES && validAxisTypes.length === 0) {
                await refreshRoadTypes();
              }

              if (v === TAB_BLOCKAGES && !blockageGeoJsonRef.current) {
                await handleRefreshBlockages();
              }
            }}
          />

          {tab === TAB_ROUTE && (
            <RouteTab
              start={start}
              setStart={setStart}
              end={end}
              setEnd={setEnd}
              selectionMode={selectionMode}
              setSelectionMode={setSelectionMode}
              onClearRoute={clearRoute}
              onSearchRoute={handleSearchRoute}
              onReversePoints={handleReversePoints}
              transportMode={routeTransportMode}
              onTransportModeChange={setRouteTransportMode}
              busy={busy}
              serverStatus={serverStatus}
            />
          )}

          {tab === TAB_ROAD_TYPES && (
            <RoadTypesTab
              options={validAxisTypes}
              checked={displayAxisTypes}
              loading={roadLayerLoading}
              colors={roadTypeColors}
              transportMode={roadTypesFilterMode}
              onTransportModeChange={setRoadTypesFilterMode}
              onRefresh={refreshRoadTypes}
              onToggle={toggleRoadType}
              onHideAll={hideAllRoadTypes}
              onSelectAll={selectAllRoadTypes}
              onSelectRoadTypes={selectRoadTypes}
            />
          )}

          {tab === TAB_BLOCKAGES && (
            <BlockagesTab
              newBlockage={newBlockage}
              setNewBlockage={setNewBlockage}
              selectionMode={selectionMode}
              setSelectionMode={setSelectionMode}
              onAdd={handleAddBlockage}
              onRefresh={handleRefreshBlockages}
              onDelete={handleDeleteBlockage}
              onFocus={focusOnBlockageFeature}
              blockageGeoJson={blockageGeoJson}
              busy={busy}
              serverStatus={serverStatus}
            />
          )}
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
            draftBlockage={draftBlockage}
            focusTarget={focusTarget}
          />
        </div>
      </div>

      <ToastStack toasts={toasts} />

      {roadLayerLoading && <LoadingOverlay title="Loading road type layer(s)…" />}
    </div>
  );
}
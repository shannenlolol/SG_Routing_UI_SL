// src/components/BlockagesTab.jsx
import React from "react";
import { normaliseOptionalText } from "../utils/blockages";

export default function BlockagesTab({
  newBlockage,
  setNewBlockage,
  selectionMode,
  setSelectionMode,
  onAdd,
  onRefresh,
  onDelete,
  onFocus,
  blockageGeoJson,
  busy,
  serverStatus,
}) {
  return (
    // Make the whole tab scroll within the sidebar height
    <div className="mt-3 flex h-[calc(100vh-56px-56px)] flex-col">
      {/* Header stays visible */}
      <div className="flex items-center justify-between pb-3">
        <div className="text-sm font-semibold text-slate-900">Blockages</div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-100 disabled:opacity-60"
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {/* Scrollable content area */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-3 mb-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-700">Add blockage</div>

            <div className="mt-2 space-y-2">
              <input
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Latitude"
                value={newBlockage.lat}
                onChange={(e) => setNewBlockage((p) => ({ ...p, lat: e.target.value }))}
              />

              <input
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Longitude"
                value={newBlockage.long}
                onChange={(e) => setNewBlockage((p) => ({ ...p, long: e.target.value }))}
              />

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-700">Radius</div>
                  <div className="text-xs text-slate-600">{Number(newBlockage.radius || 0)} m</div>
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
                placeholder="Name"
                value={newBlockage.name}
                onChange={(e) => setNewBlockage((p) => ({ ...p, name: e.target.value }))}
              />

              <textarea
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Description (optional)"
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
                  onClick={onAdd}
                  disabled={busy || serverStatus !== "ready"}
                  className="rounded-lg bg-blue-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Existing list can grow; whole tab scrolls */}
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-700">Existing blockages</div>
            <div className="mt-2">
              <BlockageList geojson={blockageGeoJson} onDelete={onDelete} onFocus={onFocus} />
            </div>
          </div>
        </div>
      </div>
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

        let radius = null;
        const radiusCandidates = [
          props.radius,
          props.r,
          props.R,
          props["radius (m)"],
          props.radius_m,
          props.radiusM,
          props["distance (meters)"],
          props["distance(meters)"],
          props["distance_meters"],
          props.distance_meters,
          props.distance,
          props.distance_m,
          props.distanceM,
          f && f.radius,
          f && f.r,
        ];

        for (const candidate of radiusCandidates) {
          const num = Number(candidate);
          if (Number.isFinite(num) && num > 0) {
            radius = num;
            break;
          }
        }

        return (
          <div
            key={String(name)}
            className="w-full rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof onFocus === "function") onFocus(f);
                }}
                className="flex-1 text-left"
              >
                <div className="text-sm font-semibold text-slate-900">{String(name)}</div>
                {desc ? <div className="text-xs text-slate-600">{desc}</div> : null}
                {radius !== null ? (
                  <div className="mt-1 text-[11px] text-slate-500">Radius: {radius} m</div>
                ) : (
                  <div className="mt-1 text-[11px] text-slate-400">Radius: unknown</div>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof onDelete === "function") onDelete(String(name));
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

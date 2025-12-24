// src/components/RouteTab.jsx
import React from "react";
import FloatingInput from "./FloatingInput";
import TransportModeSelector from "./TransportModeSelector";

export default function RouteTab({
  start,
  setStart,
  end,
  setEnd,
  selectionMode,
  setSelectionMode,
  onClearRoute,
  onSearchRoute,
  onReversePoints,
  transportMode,
  onTransportModeChange,
  busy,
  serverStatus,
}) {
  return (
    <div className="mt-2 space-y-2">
      {/* Transport Mode Selector */}
      <div className="flex items-center justify-center">
        <TransportModeSelector value={transportMode} onChange={onTransportModeChange} />
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-2">
        <div>
          <div className="mb-1 mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Start point
          </div>

          <FloatingInput
            label="Longitude"
            value={start.long}
            onChange={(e) => setStart((p) => ({ ...p, long: e.target.value }))}
            inputMode="decimal"
          />

          <div className="mt-1">
            <FloatingInput
              label="Latitude"
              value={start.lat}
              onChange={(e) => setStart((p) => ({ ...p, lat: e.target.value }))}
              inputMode="decimal"
            />
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectionMode((prev) => (prev === "start" ? null : "start"))}
              className={
                "inline-flex items-center justify-center rounded-md px-2 py-1.5 text-[11px] font-semibold transition " +
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
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-[1px]"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Divider with centered swap button */}
        <div className="relative my-2 flex items-center">
          <div className="flex-1 border-t border-slate-200"></div>
          <button
            type="button"
            onClick={onReversePoints}
            className="mx-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 active:scale-95"
            title="Reverse start and end points"
          >
            <img
              src="/icons/swap.png"
              alt="Swap"
              className="h-3 w-3 select-none"
              draggable={false}
            />
          </button>
          <div className="flex-1 border-t border-slate-200"></div>
        </div>

        <div>
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            End point
          </div>

          <FloatingInput
            label="Longitude"
            value={end.long}
            onChange={(e) => setEnd((p) => ({ ...p, long: e.target.value }))}
            inputMode="decimal"
          />

          <div className="mt-1">
            <FloatingInput
              label="Latitude"
              value={end.lat}
              onChange={(e) => setEnd((p) => ({ ...p, lat: e.target.value }))}
              inputMode="decimal"
            />
          </div>

          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => setSelectionMode((prev) => (prev === "end" ? null : "end"))}
              className={
                "inline-flex items-center justify-center rounded-md px-2 py-1.5 text-[11px] font-semibold transition " +
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
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-[1px]"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={onClearRoute}
          className="rounded-md mt-1 border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Clear Route
        </button>

        <button
          type="button"
          onClick={() => {
            console.log("[ui] Search Route clicked");
            onSearchRoute({ reason: "ui" });
          }}
          disabled={busy || serverStatus !== "ready"}
          className="rounded-md mt-1 bg-blue-400 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
        >
          Search Route
        </button>
      </div>
    </div>
  );
}
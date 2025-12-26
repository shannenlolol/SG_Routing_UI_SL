// src/components/RouteTab.jsx
import React from "react";
import FloatingInput from "./FloatingInput";
import TransportModeSelector from "./TransportModeSelector";

function isFiniteNumberString(value) {
  const s = String(value ?? "").trim();
  if (!s) return false;
  const n = Number(s);
  if (!Number.isFinite(n)) return false;
  return true;
}

function toNumberOrNull(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function validateLatLng(latStr, lngStr, labelPrefix) {
  const errors = { lat: "", long: "" };

  const lat = toNumberOrNull(latStr);
  const lng = toNumberOrNull(lngStr);

  if (String(lngStr ?? "").trim() === "") {
    errors.long = `${labelPrefix} longitude is required.`;
  } else if (!isFiniteNumberString(lngStr)) {
    errors.long = `${labelPrefix} longitude must be a valid number.`;
  } else if (lng !== null && (lng < -180 || lng > 180)) {
    errors.long = `${labelPrefix} longitude must be between -180 and 180.`;
  }

  if (String(latStr ?? "").trim() === "") {
    errors.lat = `${labelPrefix} latitude is required.`;
  } else if (!isFiniteNumberString(latStr)) {
    errors.lat = `${labelPrefix} latitude must be a valid number.`;
  } else if (lat !== null && (lat < -90 || lat > 90)) {
    errors.lat = `${labelPrefix} latitude must be between -90 and 90.`;
  }

  return errors;
}

function ErrorText({ text }) {
  if (!text) return null;
  return (
    <div className="mt-1 text-[11px] font-medium text-red-600">{text}</div>
  );
}

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
  showToast,
}) {
  const [touched, setTouched] = React.useState({
    startLong: false,
    startLat: false,
    endLong: false,
    endLat: false,
  });

  const startErr = React.useMemo(() => {
    return validateLatLng(start.lat, start.long, "Start");
  }, [start.lat, start.long]);

  const endErr = React.useMemo(() => {
    return validateLatLng(end.lat, end.long, "End");
  }, [end.lat, end.long]);

  const hasAnyErrors = React.useMemo(() => {
    return Boolean(startErr.lat || startErr.long || endErr.lat || endErr.long);
  }, [startErr, endErr]);

  const canSearch = serverStatus === "ready" && !busy && !hasAnyErrors;

  function markAllTouched() {
    setTouched({
      startLong: true,
      startLat: true,
      endLong: true,
      endLat: true,
    });
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1 mt-2 space-y-2 ">
      {/* Transport Mode Selector */}
      <div className="flex items-center justify-center">
        <TransportModeSelector
          value={transportMode}
          onChange={onTransportModeChange}
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-2">
        <div>
          <div className="mb-1 mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Start point
          </div>

          <FloatingInput
            label="Longitude"
            value={start.long}
            onChange={(e) => {
              setStart((p) => ({ ...p, long: e.target.value }));
              if (!touched.startLong)
                setTouched((p) => ({ ...p, startLong: true }));
            }}
            inputMode="decimal"
          />
          <ErrorText text={touched.startLong ? startErr.long : ""} />

          <div className="mt-1">
            <FloatingInput
              label="Latitude"
              value={start.lat}
              onChange={(e) => {
                setStart((p) => ({ ...p, lat: e.target.value }));
                if (!touched.startLat)
                  setTouched((p) => ({ ...p, startLat: true }));
              }}
              inputMode="decimal"
            />
            <ErrorText text={touched.startLat ? startErr.lat : ""} />
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectionMode((prev) => (prev === "start" ? null : "start"))
              }
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
              onClick={() => {
                setStart((p) => ({ ...p, lat: "", long: "" }));
                setTouched((p) => ({
                  ...p,
                  startLat: false,
                  startLong: false,
                }));
              }}
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
            onClick={() => {
              onReversePoints();
              // keep validation visible after swap if they already interacted
              if (
                touched.startLat ||
                touched.startLong ||
                touched.endLat ||
                touched.endLong
              ) {
                markAllTouched();
              }
            }}
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
            onChange={(e) => {
              setEnd((p) => ({ ...p, long: e.target.value }));
              if (!touched.endLong)
                setTouched((p) => ({ ...p, endLong: true }));
            }}
            inputMode="decimal"
          />
          <ErrorText text={touched.endLong ? endErr.long : ""} />

          <div className="mt-1">
            <FloatingInput
              label="Latitude"
              value={end.lat}
              onChange={(e) => {
                setEnd((p) => ({ ...p, lat: e.target.value }));
                if (!touched.endLat)
                  setTouched((p) => ({ ...p, endLat: true }));
              }}
              inputMode="decimal"
            />
            <ErrorText text={touched.endLat ? endErr.lat : ""} />
          </div>

          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              onClick={() =>
                setSelectionMode((prev) => (prev === "end" ? null : "end"))
              }
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
              onClick={() => {
                setEnd((p) => ({ ...p, lat: "", long: "" }));
                setTouched((p) => ({ ...p, endLat: false, endLong: false }));
              }}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-[1px]"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Optional: summary error (only after attempting search) */}
      {/* {hasAnyErrors && (touched.startLat || touched.startLong || touched.endLat || touched.endLong) ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] font-medium text-red-700">
          Please fix the highlighted coordinate fields before searching.
        </div>
      ) : null} */}

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            onClearRoute();
          }}
          className="rounded-md mt-1 border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Clear Route
        </button>

        <button
          type="button"
          onClick={() => {
            markAllTouched();
            if (serverStatus !== "ready") {
              // needs showToast passed into RouteTab
              showToast("bad", "Failed to search route");
              return;
            }

            // If invalid, do not call API; inline errors will show.
            if (!canSearch) return;
            onSearchRoute({ reason: "ui" });
          }}
          disabled={busy}
          className="rounded-md mt-1 bg-blue-400 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
        >
          Search Route
        </button>
      </div>
    </div>
  );
}

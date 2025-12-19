// src/components/RoadTypesPanel.jsx
import React, { useMemo } from "react";
import { formatRoadTypeLabel, getRoadTypeColour, sortRoadTypesByImportance } from "../utils/roadTypes";

export default function RoadTypesPanel({
  options,
  checked,
  loading,
  onRefresh,
  onToggle,
  onHideAll,
  onSelectAll,
}) {
  const list = useMemo(() => {
    const arr = Array.isArray(options) ? options.slice() : [];
    return sortRoadTypesByImportance(arr);
  }, [options]);

  const checkedList = Array.isArray(checked) ? checked : [];

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Select road type(s) to display</div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-100 disabled:opacity-60"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-xs text-slate-600">
          Ordered by importance. Colour marker matches the map layer.
        </div>

        <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200">
          {list.length === 0 ? (
            <div className="p-3 text-xs text-slate-500">No valid road types loaded.</div>
          ) : (
            <div className="space-y-2 p-3">
              {list.map((value) => {
                const isChecked = checkedList.includes(value);
                const label = formatRoadTypeLabel(value);
                const colour = getRoadTypeColour(value);

                return (
                  <label key={value} className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={isChecked}
                      disabled={loading}
                      onChange={(e) => {
                        const nextChecked = Boolean(e.target.checked);
                        onToggle(value, nextChecked);
                      }}
                    />

                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colour }}
                      aria-hidden="true"
                      title={label}
                    />

                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onHideAll}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-100 disabled:opacity-60"
            disabled={loading}
          >
            Hide all
          </button>

          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={loading}
          >
            Select all
          </button>
        </div>
      </div>
    </div>
  );
}

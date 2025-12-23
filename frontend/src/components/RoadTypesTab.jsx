// src/components/RoadTypesTab.jsx
import React from "react";
import { getRoadTypeLabel } from "../utils/roadTypeDescriptions";
import TransportModeIndicator from "./TransportModeIndicator";

export default function RoadTypesTab({
  options,
  checked,
  loading,
  colors,
  transportMode,
  onTransportModeChange,
  onRefresh,
  onToggle,
  onHideAll,
  onSelectAll,
}) {
  const isAllChecked = options.length > 0 && options.every((opt) => checked.includes(opt));
  const isSomeChecked = checked.length > 0 && !isAllChecked;

  return (
    <div className="mt-3 space-y-3">
      {/* Transport Mode Selector */}

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Road Types</div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-100 disabled:opacity-60"
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      <div className="flex items-center justify-center">
        <TransportModeIndicator selectedMode={transportMode} onModeSelect={onTransportModeChange} />
      </div>



      {isSomeChecked && !isAllChecked && (
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {checked.length} of {options.length} road types visible
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="max-h-[calc(45vh)] overflow-y-auto p-2">
          {options.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              No road types available. Click Refresh.
            </div>
          ) : (
            <div className="space-y-1">
              {options.map((type) => {
                const isChecked = checked.includes(type);
                const color = colors[type] || "#64748b";
                const label = getRoadTypeLabel(type);

                return (
                  <label
                    key={type}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => onToggle(type, e.target.checked)}
                      disabled={loading}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    
                    <div
                      className="h-4 w-4 rounded flex-shrink-0 border border-slate-300"
                      style={{ backgroundColor: color }}
                      title={`Color: ${color}`}
                    />
                    
                    <span className="flex-1 text-sm font-medium text-slate-900">
                      {label}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={loading || options.length === 0}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {isAllChecked ? "Refresh All" : "Select All"}
        </button>

        <button
          type="button"
          onClick={onHideAll}
          disabled={loading || checked.length === 0}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Hide All
        </button>
      </div>
    </div>
  );
}
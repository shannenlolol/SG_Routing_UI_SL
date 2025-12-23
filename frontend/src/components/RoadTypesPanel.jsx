// src/components/RoadTypesPanel.jsx
import React, { useState } from "react";
import { ROAD_TYPE_DESCRIPTIONS, getRoadTypeLabel } from "../utils/roadTypeDescriptions";

export default function RoadTypesPanel({
  options,
  checked,
  loading,
  colors,
  onRefresh,
  onToggle,
  onHideAll,
  onSelectAll,
}) {
  const [expandedType, setExpandedType] = useState(null);

  const isAllChecked = options.length > 0 && options.every((opt) => checked.includes(opt));
  const isSomeChecked = checked.length > 0 && !isAllChecked;

  return (
    <div className="mt-3 space-y-3">
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

      <div className="flex gap-2">
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

      {isSomeChecked && !isAllChecked && (
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {checked.length} of {options.length} road types visible
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="max-h-[calc(60vh)] overflow-y-auto p-2">
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
                const description = ROAD_TYPE_DESCRIPTIONS[type] || "No description available.";
                const isExpanded = expandedType === type;

                return (
                  <div
                    key={type}
                    className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                  >
                    <div className="flex items-center gap-2 p-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onToggle(type, e.target.checked)}
                        disabled={loading}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      
                      <div
                        className="h-4 w-4 rounded flex-shrink-0"
                        style={{ backgroundColor: color }}
                        title={`Color: ${color}`}
                      />
                      
                      <button
                        type="button"
                        onClick={() => setExpandedType(isExpanded ? null : type)}
                        className="flex-1 text-left text-sm font-medium text-slate-900"
                      >
                        {label}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setExpandedType(isExpanded ? null : type)}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                        title={isExpanded ? "Hide description" : "Show description"}
                      >
                        {isExpanded ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {description}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
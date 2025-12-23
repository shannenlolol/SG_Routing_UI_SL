// src/components/TransportModeIndicator.jsx
import React from "react";
import { TRANSPORT_MODES, TRANSPORT_MODE_INFO, TRANSPORT_ROAD_TYPES } from "../utils/transportModes";
import { getRoadTypeLabel } from "../utils/roadTypeDescriptions";

export default function TransportModeIndicator({ 
  selectedMode, 
  onModeSelect 
}) {
  const modes = [TRANSPORT_MODES.CAR, TRANSPORT_MODES.CYCLE, TRANSPORT_MODES.WALK];

  const handleModeClick = (mode) => {
    // If clicking the same mode, deselect it
    if (selectedMode === mode) {
      onModeSelect(null);
    } else {
      onModeSelect(mode);
    }
  };

  return (
    <div className="space-y-2">
      
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {modes.map((mode) => {
          const info = TRANSPORT_MODE_INFO[mode];
          const isSelected = selectedMode === mode;

          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeClick(mode)}
              className={
                "flex items-center justify-center rounded-md px-3 py-2 transition " +
                (isSelected
                  ? "bg-blue-100 text-blue-700 shadow-sm"
                  : "bg-transparent text-slate-600 hover:bg-slate-100")
              }
              title={`${info.label} - ${isSelected ? 'Click to deselect' : 'Click to select road types'}`}
            >
              <img
                src={info.icon}
                alt={info.label}
                className={`h-5 w-5 select-none ${isSelected ? 'opacity-100' : 'opacity-60'}`}
                draggable={false}
              />
            </button>
          );
        })}
      </div>

    </div>
  );
}
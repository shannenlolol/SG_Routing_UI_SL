// src/components/TransportModeSelector.jsx
import React from "react";
import { TRANSPORT_MODES, TRANSPORT_MODE_INFO } from "../utils/transportModes";

export default function TransportModeSelector({ value, onChange }) {
  const modes = [TRANSPORT_MODES.CAR, TRANSPORT_MODES.CYCLE, TRANSPORT_MODES.WALK];

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {modes.map((mode) => {
        const info = TRANSPORT_MODE_INFO[mode];
        const isActive = value === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={
              "flex items-center justify-center rounded-md px-3 py-2 transition " +
              (isActive
                ? "bg-blue-100 text-blue-700"
                : "text-slate-600 hover:bg-slate-100")
            }
            title={info.label}
          >
            <img
              src={info.icon}
              alt={info.label}
              className="h-5 w-5 select-none"
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}
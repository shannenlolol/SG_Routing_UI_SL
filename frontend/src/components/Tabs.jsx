import React from "react";

export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="border-b border-slate-200">
      <div className="grid grid-cols-3 items-center">
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={
                "relative -mb-px border-b-2 px-1 pb-2 text-sm font-medium transition " +
                (active
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-600 hover:text-slate-900")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

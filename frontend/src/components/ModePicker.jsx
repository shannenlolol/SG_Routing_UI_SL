import React from "react";

const OPTIONS = [
  {
    value: "driving",
    label: "Driving",
    icon: "/icons/car.png",
  },
  {
    value: "cycling",
    label: "Cycling",
    icon: "/icons/cycle.png",
  },
  {
    value: "walking",
    label: "Walking",
    icon: "/icons/walk.png",
  },
];

function ModeIcon({ src, alt }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-5 w-5 select-none"
      draggable={false}
      loading="lazy"
    />
  );
}

export default function ModePicker({ value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
      {OPTIONS.map((opt) => {
        const active = opt.value === value;

        return (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            aria-label={opt.label}
            onClick={() => onChange(opt.value)}
            className={
              "flex items-center justify-center rounded-lg px-3 py-2 transition " +
              (active ? "bg-gray-200" : "bg-white hover:bg-slate-100")
            }
          >
            <ModeIcon src={opt.icon} alt={opt.label} />
          </button>
        );
      })}
    </div>
  );
}

import React, { useId } from "react";

function FloatingInput({
  label,
  required = false,
  value,
  onChange,
  placeholder,
  inputMode,
}) {
  const id = useId();

  const isFilled = String(value ?? "").trim().length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder || " "}
        inputMode={inputMode}
        className="peer w-full rounded-lg border border-slate-200 bg-white px-3 pb-2 pt-5 text-sm outline-none transition
                   focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
      />

      <label
        htmlFor={id}
        className={
          "pointer-events-none absolute left-3 origin-left transition-all " +
          (isFilled
            ? "top-1 text-xs font-semibold text-slate-600"
            : "top-3 text-xs font-semibold text-slate-500 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:text-slate-400 peer-focus:top-1 peer-focus:text-xs peer-focus:font-semibold peer-focus:text-slate-600")
        }
      >
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
    </div>
  );
}

export default FloatingInput;

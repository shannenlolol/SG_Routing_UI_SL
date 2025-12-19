import React from "react";

export default function Sidebar({ title, subtitle, children, footer }) {
  return (
    <div className="h-full w-full border-r border-slate-200 bg-white">
      {/* <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
      </div> */}

      <div className="h-[calc(100%-56px)] px-4 py-3">
        {children}
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </div>
  );
}

// Sidebar.jsx
import React from "react";

export default function Sidebar({ children, footer }) {
  return (
    <div className="h-full w-full bg-white">
      <div className="h-[calc(100%-56px)] px-4 py-3">
        {children}
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </div>
  );
}

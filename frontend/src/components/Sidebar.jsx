// Sidebar.jsx
import React from "react";

export default function Sidebar({ children }) {
  return (
    <div className="h-full w-full bg-white">
      <div className="h-full px-4 py-2">
        {children}
      </div>
    </div>
  );
}

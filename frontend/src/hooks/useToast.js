// src/hooks/useToast.js
import { useState } from "react";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  function showToast(tone, text) {
    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now() + Math.random());

    setToasts((prev) => [...prev, { id, tone, text }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }

  return { toasts, showToast };
}
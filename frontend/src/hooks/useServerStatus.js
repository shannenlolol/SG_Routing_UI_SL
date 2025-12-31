// src/hooks/useServerStatus.js
import { useState, useRef, useEffect, useCallback } from "react";
import { apiGet } from "../api/client";

export function useServerStatus(showToast) {
  const [serverStatus, setServerStatus] = useState("unknown");
  const [serverError, setServerError] = useState("");

  const pollTimer = useRef(null);
  const lastStatusRef = useRef("unknown");

  const maybeToast = useCallback(
    (tone, msg) => {
      if (typeof showToast === "function") {
        showToast(tone, msg);
      }
    },
    [showToast]
  );

  async function checkReadyOnce(opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const source = options.source ? String(options.source) : "auto";

    try {
      const result = await apiGet("/ready");
      const text = String(result).trim().toLowerCase();

      let next = "unknown";
      if (text === "ready") next = "ready";
      else if (text === "wait") next = "wait";

      setServerStatus(next);

      if (next === "ready") {
        setServerError("");
      } else if (next === "wait") {
        setServerError("");
      } else {
        setServerError(`Unexpected response: ${String(result)}`);
      }

      // Toast only if status changed OR user manually refreshed
      const prev = lastStatusRef.current;
      const changed = prev !== next;
      lastStatusRef.current = next;

      if (changed) {
        if (next === "ready") maybeToast("good", "Server is ready.");
        if (next === "wait") maybeToast("warn", "Server is warming up.");
        if (next === "unknown") maybeToast("warn", "Server status unknown.");
      } else if (source === "manual") {
        if (next === "ready") maybeToast("good", "Server is ready.");
        if (next === "wait") maybeToast("warn", "Server is warming up.");
        if (next === "unknown") maybeToast("warn", "Server status unknown.");
      }

      return next;
    } catch (err) {
      setServerStatus("error");
      setServerError(err.message || "Failed to reach server");

      const prev = lastStatusRef.current;
      const changed = prev !== "error";
      lastStatusRef.current = "error";
        maybeToast("bad", "Failed to reach server.");

      if (changed) {
        maybeToast("bad", "Failed to reach server.");
      } else if (source === "manual") {
        maybeToast("bad", "Still unable to reach server.");
      }

      return "error";
    }
  }

  async function pollUntilReady(opts) {
    window.clearInterval(pollTimer.current);

    const first = await checkReadyOnce(opts);
    if (first === "ready") return;

    pollTimer.current = window.setInterval(async () => {
      const status = await checkReadyOnce({ source: "auto" });
      if (status === "ready") {
        window.clearInterval(pollTimer.current);
      }
    }, 10000);
  }

  useEffect(() => {
    pollUntilReady({ source: "auto" });
    return () => window.clearInterval(pollTimer.current);
  }, []);

  return {
    serverStatus,
    serverError,
    pollUntilReady: () => pollUntilReady({ source: "manual" }),
  };
}

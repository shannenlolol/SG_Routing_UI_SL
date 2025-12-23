// src/hooks/useServerStatus.js
import { useState, useRef, useEffect } from "react";
import { apiGet } from "../api/client";

export function useServerStatus() {
  const [serverStatus, setServerStatus] = useState("unknown");
  const [serverError, setServerError] = useState("");
  const pollTimer = useRef(null);

  async function checkReadyOnce() {
    try {
      const result = await apiGet("/ready");
      const text = String(result).trim().toLowerCase();

      if (text === "ready") {
        setServerStatus("ready");
        setServerError("");
        return "ready";
      }

      if (text === "wait") {
        setServerStatus("wait");
        setServerError("");
        return "wait";
      }

      setServerStatus("unknown");
      setServerError(`Unexpected response: ${String(result)}`);
      return "unknown";
    } catch (err) {
      setServerStatus("error");
      setServerError(err.message || "Failed to reach server");
      return "error";
    }
  }

  async function pollUntilReady() {
    window.clearInterval(pollTimer.current);
    const first = await checkReadyOnce();
    if (first === "ready") return;

    pollTimer.current = window.setInterval(async () => {
      const status = await checkReadyOnce();
      if (status === "ready") {
        window.clearInterval(pollTimer.current);
      }
    }, 3000);
  }

  useEffect(() => {
    pollUntilReady();
    return () => {
      window.clearInterval(pollTimer.current);
    };
  }, []);

  return {
    serverStatus,
    serverError,
    pollUntilReady,
  };
}
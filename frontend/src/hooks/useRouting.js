// src/hooks/useRouting.js
import { useState, useRef, useEffect, useMemo } from "react";
import { apiPost } from "../api/client";
import { sanitiseBlockagesForRoute } from "../utils/blockages";
import { getRoadTypesForMode } from "../utils/transportModes";

function toNumber(value) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return null;
}

export function useRouting(
  serverStatus,
  blockageGeoJsonRef,
  transportMode,
  showToast
) {
  const [start, setStart] = useState({
    lat: "",
    long: "",
    description: "Start",
  });
  const [end, setEnd] = useState({ lat: "", long: "", description: "End" });
  const [routeGeoJson, setRouteGeoJson] = useState(null);

  const lastRouteRequestRef = useRef(null);
  const hasRequestedRouteRef = useRef(false);
  const routeInFlightRef = useRef(false);
  const rerouteTimerRef = useRef(null);
  const routeReqIdRef = useRef(0);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const lastRetryOptionsRef = useRef(null);

  const startPoint = useMemo(() => {
    const lat = toNumber(start.lat);
    const long = toNumber(start.long);
    if (lat === null || long === null) return null;
    return { lat, long };
  }, [start.lat, start.long]);

  const endPoint = useMemo(() => {
    const lat = toNumber(end.lat);
    const long = toNumber(end.long);
    if (lat === null || long === null) return null;
    return { lat, long };
  }, [end.lat, end.long]);

  useEffect(() => {
    return () => {
      window.clearTimeout(rerouteTimerRef.current);
      window.clearTimeout(retryTimerRef.current);
    };
  }, []);

  async function handleSearchRoute(options) {
    const opts = options && typeof options === "object" ? options : {};
    const reason = opts.reason ? String(opts.reason) : "ui";
    const blockagesOverride =
      opts.blockagesOverride && typeof opts.blockagesOverride === "object"
        ? opts.blockagesOverride
        : null;

    if (serverStatus !== "ready") {
      const msg =
        serverStatus === "wait"
          ? "Server is warming up."
          : serverStatus === "error"
          ? "Server is unreachable (check connection)."
          : "Server status unknown. Please refresh.";
      showToast("bad", msg);
      return;
    }

    if (!startPoint || !endPoint) {
      console.log("[route] blocked: missing start/end", {
        startPoint,
        endPoint,
      });
      showToast("warn", "Start and End coordinates must be set.");
      return;
    }

    const startPt = {
      long: startPoint.long,
      lat: startPoint.lat,
      description: start.description || "Start",
    };
    const endPt = {
      long: endPoint.long,
      lat: endPoint.lat,
      description: end.description || "End",
    };

    lastRouteRequestRef.current = { startPt, endPt };
    hasRequestedRouteRef.current = true;

    if (routeInFlightRef.current) {
      console.log("[route] skip: in flight");
      return;
    }

    routeInFlightRef.current = true;
    const reqId = (routeReqIdRef.current += 1);

    const blockagesToUse = blockagesOverride
      ? blockagesOverride
      : blockageGeoJsonRef.current;

    // IMPORTANT: Set valid road types based on transport mode BEFORE routing
    try {
      const roadTypes = getRoadTypesForMode(transportMode);
      console.log(
        "[route] setting valid road types for",
        transportMode,
        roadTypes
      );

      await apiPost("/changeValidRoadTypes", roadTypes);
    } catch (err) {
      console.log("[route] failed to set road types", { err });
      showToast("warn", "Failed to set road types for " + transportMode);
      routeInFlightRef.current = false;
      return;
    }

    const body = {
      startPt,
      endPt,
      blockages: sanitiseBlockagesForRoute(blockagesToUse),
    };

    const count =
      body.blockages && Array.isArray(body.blockages.features)
        ? body.blockages.features.length
        : 0;

    console.log("[route] sending", {
      reqId,
      reason,
      start: startPt,
      end: endPt,
      blockagesCount: count,
      transportMode,
    });

    try {
      const resp = await apiPost("/route", body);

      if (typeof resp === "string") {
        const text = resp.trim().toLowerCase();

        if (text === "wait") {
          console.log("[route] backend says WAIT", { reqId, reason });

          if (retryCountRef.current < 5) {
            lastRetryOptionsRef.current = { reason, blockagesOverride };
            scheduleRouteRetry({ reason, blockagesOverride }, "backend_wait");
          } else {
            console.log("[route] retry limit reached", { reqId });
            showToast(
              "warn",
              "Route engine still warming up. Try again shortly."
            );
          }

          return;
        }

        console.log("[route] bad response shape (string)", {
          reqId,
          gotType: "string",
          resp,
        });
        showToast("bad", "Route API returned invalid data.");
        return;
      }

      if (
        !resp ||
        typeof resp !== "object" ||
        resp.type !== "FeatureCollection" ||
        !Array.isArray(resp.features)
      ) {
        console.log("[route] bad response shape", {
          reqId,
          gotType: typeof resp,
          resp,
        });
        showToast("bad", "Route API returned invalid data.");
        return;
      }

      // NEW: ensure there is at least one LineString (route) returned
      const hasLineString = resp.features.some((f) => {
        return (
          f &&
          f.type === "Feature" &&
          f.geometry &&
          f.geometry.type === "LineString" &&
          Array.isArray(f.geometry.coordinates) &&
          f.geometry.coordinates.length > 1
        );
      });

      if (!hasLineString) {
        console.log("[route] no LineString returned (no available route)", {
          reqId,
          transportMode,
          featuresCount: resp.features.length,
        });

        const formatTransportMode =
          transportMode.charAt(0).toUpperCase() + transportMode.slice(1);

        showToast("bad", `No available route for ${formatTransportMode} route`);

        // Optional: clear old route so it doesn't look like it "worked"
        setRouteGeoJson(null);

        return;
      }

      retryCountRef.current = 0;
      lastRetryOptionsRef.current = null;

      const formatTransportMode =
        transportMode.charAt(0).toUpperCase() + transportMode.slice(1);

      setRouteGeoJson(resp);
      showToast("good", `${formatTransportMode} route loaded successfully.`);
    } catch (err) {
      console.log("[route] failed", { reqId, err });
      showToast("bad", err.message || "Unable to get route. Please try again.");
    } finally {
      routeInFlightRef.current = false;
    }
  }

  function scheduleAutoReroute(reason, blockagesOverride) {
    if (!hasRequestedRouteRef.current || !lastRouteRequestRef.current) {
      console.log("[reroute] skip: no last route request");
      return;
    }
    if (serverStatus !== "ready") {
      const msg =
        serverStatus === "wait"
          ? "Server is warming up."
          : serverStatus === "error"
          ? "Server is unreachable (check connection)."
          : "Server status unknown. Please refresh.";
      showToast("bad", msg);
      return;
    }

    window.clearTimeout(rerouteTimerRef.current);
    rerouteTimerRef.current = window.setTimeout(() => {
      console.log("[reroute] triggering via same handler", {
        hasLastRequest: Boolean(lastRouteRequestRef.current),
        blockagesCount:
          blockagesOverride && Array.isArray(blockagesOverride.features)
            ? blockagesOverride.features.length
            : (() => {
                const gj = blockageGeoJsonRef.current;
                return gj && Array.isArray(gj.features)
                  ? gj.features.length
                  : 0;
              })(),
      });

      handleSearchRoute({
        reason: reason || "auto",
        blockagesOverride: blockagesOverride || null,
      });
    }, 250);
  }

  function scheduleRouteRetry(options, label) {
    const attempt = retryCountRef.current;
    const delays = [300, 700, 1200, 2000, 3000];
    const delay = delays[Math.min(attempt, delays.length - 1)];

    window.clearTimeout(retryTimerRef.current);

    console.log("[route] retry scheduled", {
      attempt: attempt + 1,
      inMs: delay,
      label: label || "",
    });

    retryTimerRef.current = window.setTimeout(() => {
      retryCountRef.current += 1;
      handleSearchRoute({
        ...options,
        reason: `${options.reason || "auto"}:retry${retryCountRef.current}`,
        _isRetry: true,
      });
    }, delay);
  }

  function clearRoute() {
    setRouteGeoJson(null);
    hasRequestedRouteRef.current = false;
    lastRouteRequestRef.current = null;
    console.log("[route] cleared by user");
  }

  return {
    start,
    setStart,
    end,
    setEnd,
    startPoint,
    endPoint,
    routeGeoJson,
    handleSearchRoute,
    scheduleAutoReroute,
    clearRoute,
  };
}

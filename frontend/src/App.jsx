// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import Badge from "./components/Badge";
import Segmented from "./components/Segmented";
import MapView from "./components/MapView";
import FloatingInput from "./components/FloatingInput";
import RoadTypesPanel from "./components/RoadTypesPanel";
import ToastStack from "./components/ToastStack";
import LoadingOverlay from "./components/LoadingOverlay";
import { apiDelete, apiGet, apiPost } from "./api/client";
import {
  normaliseTypeName,
  sortRoadTypesByImportance,
} from "./utils/roadTypes";

const TAB_ROUTE = "route";
const TAB_ROAD_TYPES = "roadTypes";
const TAB_BLOCKAGES = "blockages";

function toNumber(value) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return null;
}

function normaliseOptionalText(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (s.toLowerCase() === "null") return "";
  if (s.toLowerCase() === "undefined") return "";
  return s;
}

function normaliseBlockageName(name) {
  return String(name || "").trim().toLowerCase();
}

function getBlockageNameFromFeature(feature, idx) {
  const props = feature && feature.properties ? feature.properties : {};
  const raw = props.name || props.id || "";
  const s = String(raw || "").trim();
  if (s) return s;
  return String(idx);
}

function getBlockageKeyFromFeature(feature, idx) {
  const name = getBlockageNameFromFeature(feature, idx);
  return normaliseBlockageName(name);
}

/**
 * Backend returns radius under keys like:
 * - "distance (meters)" (seen in your Postman screenshot)
 * - sometimes "distance", "distance_m", etc
 * We normalise all of these into f.properties.radius.
 */
function readRadiusMetersFromProps(props) {
  if (!props || typeof props !== "object") return null;

  const candidates = [
    props.radius,
    props.r,
    props.R,
    props["radius (m)"],
    props.radius_m,
    props.radiusM,

    // backend key in your screenshot:
    props["distance (meters)"],
    props["distance(meters)"],
    props["distance_meters"],
    props.distance_meters,
    props.distance,
    props.distance_m,
    props.distanceM,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const n = Number(candidates[i]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function getBlockageRadiusFromFeature(feature) {
  const props = feature && feature.properties ? feature.properties : {};
  const fromProps = readRadiusMetersFromProps(props);
  if (fromProps !== null) return fromProps;

  const extraCandidates = [feature && feature.radius, feature && feature.r];
  for (let i = 0; i < extraCandidates.length; i += 1) {
    const n = Number(extraCandidates[i]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

function getBlockageNamesSet(gj) {
  const feats = Array.isArray(gj && gj.features) ? gj.features : [];
  const out = new Set();

  for (let i = 0; i < feats.length; i += 1) {
    const f = feats[i];
    const props = (f && f.properties) || {};
    const n = normaliseBlockageName(props.name || props.id || "");
    if (n) out.add(n);
  }

  return out;
}

function removeBlockageFromGeoJsonByKey(gj, keyToRemove) {
  if (!gj || gj.type !== "FeatureCollection" || !Array.isArray(gj.features)) {
    return gj;
  }

  return {
    ...gj,
    features: gj.features.filter((f, idx) => {
      return getBlockageKeyFromFeature(f, idx) !== keyToRemove;
    }),
  };
}

/**
 * Ensure route payload always contains:
 * - properties.radius as a number (meters)
 * - properties.description as non-null string
 * Also: if backend uses distance(meters), we convert to radius here too.
 */
function sanitiseBlockagesForRoute(gj) {
  if (!gj || gj.type !== "FeatureCollection" || !Array.isArray(gj.features)) {
    return null;
  }

  return {
    type: "FeatureCollection",
    features: gj.features.filter(Boolean).map((f) => {
      const props = (f && f.properties) || {};

      const radiusNum = readRadiusMetersFromProps(props);
      const radius =
        Number.isFinite(radiusNum) && radiusNum > 0 ? radiusNum : 0;

      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          ...props,
          radius: radius,
          description: normaliseOptionalText(props.description),
        },
      };
    }),
  };
}

export default function App() {
  // -------------------- Server readiness --------------------
  const [serverStatus, setServerStatus] = useState("unknown"); // unknown | wait | ready | error
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------- UI state --------------------
  const [tab, setTab] = useState(TAB_ROUTE);

  // Map selection mode: "start" | "end" | "blockage" | null
  const [selectionMode, setSelectionMode] = useState(null);

  // Base map style only
  const [mapStyle, setMapStyle] = useState("simple");

  // Points
  const [start, setStart] = useState({
    lat: "",
    long: "",
    description: "Start",
  });
  const [end, setEnd] = useState({ lat: "", long: "", description: "End" });

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

  const [routeGeoJson, setRouteGeoJson] = useState(null);

  // -------------------- Route memory (for auto reroute) --------------------
  // If you want auto-reroute, we need to remember what the user searched last.
  // We store the last request payload (start/end descriptions + coords) and just re-run it.
  const lastRouteRequestRef = useRef(null); // { startPt, endPt }
  const hasRequestedRouteRef = useRef(false);

  // -------------------- Road types --------------------
  const [validAxisTypes, setValidAxisTypes] = useState([]);
  const [displayAxisTypes, setDisplayAxisTypes] = useState([]);
  const [axisTypeGeoJson, setAxisTypeGeoJson] = useState(null);

  const axisGeoJsonCacheRef = useRef(new Map()); // axisType -> geojson
  const displayAxisTypesRef = useRef([]);
  useEffect(() => {
    displayAxisTypesRef.current = displayAxisTypes;
  }, [displayAxisTypes]);

  const pendingSetRef = useRef(new Set());
  const [pendingAxisTypes, setPendingAxisTypes] = useState([]);

  function syncPendingState() {
    setPendingAxisTypes(Array.from(pendingSetRef.current));
  }

  function addPending(type) {
    pendingSetRef.current.add(type);
    syncPendingState();
  }

  function removePending(type) {
    pendingSetRef.current.delete(type);
    syncPendingState();
  }

  const roadLayerLoading = pendingAxisTypes.length > 0;

  async function ensureAxisTypeLoaded(axisType) {
    const typeName = normaliseTypeName(axisType);
    if (!typeName) return null;

    const cache = axisGeoJsonCacheRef.current;
    if (cache.has(typeName)) return cache.get(typeName);

    const gj = await apiGet(`/axisType/${encodeURIComponent(typeName)}`);

    if (gj && typeof gj === "object" && Array.isArray(gj.features)) {
      for (let i = 0; i < gj.features.length; i += 1) {
        const f = gj.features[i];
        if (!f || typeof f !== "object") continue;
        if (!f.properties || typeof f.properties !== "object") {
          f.properties = {};
        }
        f.properties.__axisType = typeName;
      }
    }

    cache.set(typeName, gj);
    return gj;
  }

  function rebuildAxisLayer(selectedTypes) {
    const cache = axisGeoJsonCacheRef.current;
    const selected = Array.from(
      new Set((selectedTypes || []).map(normaliseTypeName))
    ).filter(Boolean);

    if (selected.length === 0) {
      setAxisTypeGeoJson(null);
      return;
    }

    const features = [];
    for (let i = 0; i < selected.length; i += 1) {
      const t = selected[i];
      const gj = cache.get(t);
      if (gj && Array.isArray(gj.features)) {
        features.push(...gj.features);
      }
    }

    setAxisTypeGeoJson({ type: "FeatureCollection", features });
  }

  useEffect(() => {
    rebuildAxisLayer(displayAxisTypes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayAxisTypes]);

  async function refreshRoadTypes() {
    addPending("refresh");
    try {
      const valid = await apiGet("/validAxisTypes");
      const raw = Array.isArray(valid) ? valid.map(normaliseTypeName) : [];
      const ordered = sortRoadTypesByImportance(raw);
      setValidAxisTypes(ordered);

      const current = displayAxisTypesRef.current;
      const cleaned = current.filter((t) => ordered.includes(t));

      if (cleaned.length > 0) {
        setDisplayAxisTypes(cleaned);
        return;
      }

      hideAllRoadTypes();
    } catch (err) {
      showToast("bad", err.message || "Failed to load road types");
    } finally {
      removePending("refresh");
    }
  }

  async function selectAllRoadTypes(validListOverride) {
    const list = Array.isArray(validListOverride)
      ? validListOverride.slice()
      : sortRoadTypesByImportance(validAxisTypes);

    const all = Array.from(new Set(list.map(normaliseTypeName))).filter(
      Boolean
    );

    if (all.length === 0) {
      setDisplayAxisTypes([]);
      setAxisTypeGeoJson(null);
      return;
    }

    setDisplayAxisTypes(all);

    for (let i = 0; i < all.length; i += 1) {
      addPending(all[i]);
    }

    try {
      await Promise.all(
        all.map(async (t) => {
          try {
            await ensureAxisTypeLoaded(t);
          } finally {
            removePending(t);
          }
        })
      );

      rebuildAxisLayer(displayAxisTypesRef.current);
    } catch (err) {
      showToast("bad", err.message || "Failed to load road type layer(s)");
    } finally {
      pendingSetRef.current.clear();
      setPendingAxisTypes([]);
    }
  }

  async function toggleRoadType(typeName, nextChecked) {
    const type = normaliseTypeName(typeName);
    if (!type) return;

    const current = displayAxisTypesRef.current;
    const next = nextChecked
      ? Array.from(new Set([...current, type]))
      : current.filter((t) => t !== type);

    setDisplayAxisTypes(next);

    if (!nextChecked) {
      rebuildAxisLayer(next);
      return;
    }

    addPending(type);
    try {
      await ensureAxisTypeLoaded(type);
      rebuildAxisLayer(displayAxisTypesRef.current);
    } catch (err) {
      setDisplayAxisTypes((prev) => prev.filter((t) => t !== type));
      rebuildAxisLayer(displayAxisTypesRef.current);
      showToast("bad", err.message || "Failed to load road type layer");
    } finally {
      removePending(type);
    }
  }

  function hideAllRoadTypes() {
    setDisplayAxisTypes([]);
    setAxisTypeGeoJson(null);
  }

  // -------------------- Blockages --------------------
  const [blockageGeoJson, setBlockageGeoJson] = useState(null);

  // Always keep a ref to latest blockages (prevents stale closures)
  const blockageGeoJsonRef = useRef(null);
  useEffect(() => {
    blockageGeoJsonRef.current = blockageGeoJson;
  }, [blockageGeoJson]);

  // keep known meta so we can fill missing radius/desc if backend doesn’t return them
  const blockageMetaRef = useRef(new Map()); // nameLower -> { radius, description }
  const pendingDeleteRef = useRef(new Set()); // nameLower while waiting for server to catch up

  const [newBlockage, setNewBlockage] = useState({
    lat: "",
    long: "",
    radius: 200,
    name: "",
    description: "",
  });

  const draftBlockage = useMemo(() => {
    const lat = toNumber(newBlockage.lat);
    const long = toNumber(newBlockage.long);
    const radius = toNumber(newBlockage.radius);

    if (lat === null || long === null) return null;

    return {
      point: { lat, long },
      radius: radius === null ? 0 : radius,
      name: String(newBlockage.name || "").trim(),
      description: normaliseOptionalText(newBlockage.description),
    };
  }, [
    newBlockage.lat,
    newBlockage.long,
    newBlockage.radius,
    newBlockage.name,
    newBlockage.description,
  ]);

  // focus target for map
  const [focusTarget, setFocusTarget] = useState(null);

  // -------------------- Toasts + busy --------------------
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]); // [{ id, tone, text }]

  function showToast(tone, text) {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());

    setToasts((prev) => {
      return [...prev, { id, tone, text }];
    });

    window.setTimeout(() => {
      setToasts((prev) => {
        return prev.filter((t) => t.id !== id);
      });
    }, 3000);
  }

  function upsertBlockageMeta(name, radius, description) {
    const key = normaliseBlockageName(name);
    if (!key) return;

    const r = Number(radius);
    const d = normaliseOptionalText(description);

    const prev = blockageMetaRef.current.get(key) || {};
    const next = {
      radius: Number.isFinite(r) && r > 0 ? r : prev.radius,
      description: d !== "" ? d : prev.description,
    };

    blockageMetaRef.current.set(key, next);
  }

  function enrichBlockageGeoJson(gj) {
    if (!gj || typeof gj !== "object") return gj;
    if (gj.type !== "FeatureCollection" || !Array.isArray(gj.features))
      return gj;

    const next = { ...gj, features: gj.features.map((f) => f) };

    for (let i = 0; i < next.features.length; i += 1) {
      const f = next.features[i];
      if (!f || typeof f !== "object") continue;

      if (!f.properties || typeof f.properties !== "object") {
        f.properties = {};
      }

      const name = getBlockageNameFromFeature(f, i);
      const nameKey = normaliseBlockageName(name);

      const rFromServer = getBlockageRadiusFromFeature(f);
      const dFromServer = normaliseOptionalText(f.properties.description);

      // cache whatever server DID return (if any)
      if (rFromServer !== null) {
        upsertBlockageMeta(name, rFromServer, dFromServer);
      }

      // fill missing radius from cache
      if ((rFromServer === null || rFromServer <= 0) && nameKey) {
        const cached = blockageMetaRef.current.get(nameKey);
        if (cached && Number.isFinite(cached.radius) && cached.radius > 0) {
          f.properties.radius = cached.radius;
        }
      }

      // description must never be null
      if (dFromServer !== "") {
        f.properties.description = dFromServer;
      } else if (nameKey) {
        const cached = blockageMetaRef.current.get(nameKey);
        if (cached && cached.description) {
          f.properties.description = cached.description;
        } else {
          f.properties.description = "";
        }
      } else {
        f.properties.description = "";
      }
    }

    return next;
  }

  async function refreshBlockages() {
    setBusy(true);
    try {
      const serverRaw = await apiGet("/blockage");
      const server = enrichBlockageGeoJson(serverRaw);

      // if server no longer has a pending-deleted key, stop filtering it
      const serverKeys = new Set(
        (Array.isArray(server && server.features) ? server.features : []).map(
          (f, idx) => {
            return getBlockageKeyFromFeature(f, idx);
          }
        )
      );

      for (const k of Array.from(pendingDeleteRef.current)) {
        if (!serverKeys.has(k)) pendingDeleteRef.current.delete(k);
      }

      setBlockageGeoJson((prev) => {
        const local = enrichBlockageGeoJson(prev);

        const localMap = new Map();
        const serverMap = new Map();

        if (local && Array.isArray(local.features)) {
          for (let i = 0; i < local.features.length; i += 1) {
            const f = local.features[i];
            const key = getBlockageKeyFromFeature(f, i);
            if (key) localMap.set(key, f);
          }
        }

        if (server && Array.isArray(server.features)) {
          for (let i = 0; i < server.features.length; i += 1) {
            const f = server.features[i];
            const key = getBlockageKeyFromFeature(f, i);
            if (key) serverMap.set(key, f);
          }
        }

        const merged = [];
        const keys = new Set([...localMap.keys(), ...serverMap.keys()]);

        for (const key of keys) {
          if (!key) continue;
          if (pendingDeleteRef.current.has(key)) continue;

          const localF = localMap.get(key) || null;
          const serverF = serverMap.get(key) || null;

          const chosen = serverF
            ? structuredClone(serverF)
            : structuredClone(localF);

          if (!chosen) continue;
          if (!chosen.properties || typeof chosen.properties !== "object") {
            chosen.properties = {};
          }

          // Fill missing radius using local/cache
          const rChosen = getBlockageRadiusFromFeature(chosen);
          const rLocal = localF ? getBlockageRadiusFromFeature(localF) : null;

          if (
            (rChosen === null || rChosen <= 0) &&
            rLocal !== null &&
            rLocal > 0
          ) {
            chosen.properties.radius = rLocal;
          } else if (
            (rChosen === null || rChosen <= 0) &&
            blockageMetaRef.current.has(key)
          ) {
            const cached = blockageMetaRef.current.get(key);
            if (cached && Number.isFinite(cached.radius) && cached.radius > 0) {
              chosen.properties.radius = cached.radius;
            }
          }

          // Description must never be null
          const dChosen = normaliseOptionalText(chosen.properties.description);
          const dLocal = localF
            ? normaliseOptionalText(
                localF.properties && localF.properties.description
              )
            : "";

          if (!dChosen && dLocal) {
            chosen.properties.description = dLocal;
          } else if (!dChosen) {
            const cached = blockageMetaRef.current.get(key);
            chosen.properties.description =
              cached && cached.description ? cached.description : "";
          }

          merged.push(chosen);
        }

        return { type: "FeatureCollection", features: merged };
      });

      // IMPORTANT: return enriched server snapshot so reroute can use it immediately
      return server;
    } catch (err) {
      showToast("bad", err.message || "Failed to load blockages");
      return null;
    } finally {
      setBusy(false);
    }
  }

  // -------------------- Route: single handler used by button + auto reroute --------------------
  const routeInFlightRef = useRef(false);
  const rerouteTimerRef = useRef(null);
  const routeReqIdRef = useRef(0);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const lastRetryOptionsRef = useRef(null);

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
      console.log("[route] blocked: server not ready", { serverStatus });
      showToast("warn", "Server not ready yet.");
      return;
    }

    // Use the latest typed points
    if (!startPoint || !endPoint) {
      console.log("[route] blocked: missing start/end", {
        startPoint,
        endPoint,
      });
      showToast("warn", "Start and End coordinates must be set.");
      return;
    }

    // Remember last route request for auto-reroute
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
    setBusy(true);

    const reqId = (routeReqIdRef.current += 1);

    const blockagesToUse = blockagesOverride
      ? blockagesOverride
      : blockageGeoJsonRef.current;

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
    });

    try {
      const resp = await apiPost("/route", body);

      // NEW: backend may return "Wait" when it’s not ready
      if (typeof resp === "string") {
        const text = resp.trim().toLowerCase();

        if (text === "wait") {
          console.log("[route] backend says WAIT", { reqId, reason });

          // keep the existing route (do not clear)
          // retry a few times
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

        // any other string is still invalid
        console.log("[route] bad response shape (string)", {
          reqId,
          gotType: "string",
          resp,
        });
        showToast("bad", "Route API returned invalid data.");
        return;
      }

      // Normal GeoJSON success path
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

      // NEW: on success, reset retry counters
      retryCountRef.current = 0;
      lastRetryOptionsRef.current = null;

      console.log("[route] success", {
        reqId,
        gotType: resp.type,
        gotFeatures: resp.features.length,
      });

      setRouteGeoJson(resp);
      showToast("good", "Route updated.");
    } catch (err) {
      console.log("[route] failed", { reqId, err });
      showToast("bad", err.message || "Upstream request failed");
    } finally {
      routeInFlightRef.current = false;
      setBusy(false);
    }
  }

  function scheduleAutoReroute(reason, blockagesOverride) {
    // literally call the SAME handler as Search Route button
    if (!hasRequestedRouteRef.current || !lastRouteRequestRef.current) {
      console.log("[reroute] skip: no last route request");
      return;
    }
    if (serverStatus !== "ready") {
      console.log("[reroute] skip: server not ready", { serverStatus });
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
    const delays = [300, 700, 1200, 2000, 3000]; // tweak if you want
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

  // -------------------- Add / Delete blockages (then call Search Route handler) --------------------
  async function addBlockage() {
    const lat = toNumber(newBlockage.lat);
    const long = toNumber(newBlockage.long);
    const radius = toNumber(newBlockage.radius);

    const nameRaw = String(newBlockage.name || "").trim();
    const nameKey = normaliseBlockageName(nameRaw);

    if (lat === null || long === null || radius === null) {
      showToast(
        "warn",
        "Blockage coordinates and radius must be valid numbers."
      );
      return;
    }

    if (!nameRaw) {
      showToast("warn", "Blockage name is required.");
      return;
    }

    const existing = getBlockageNamesSet(blockageGeoJsonRef.current);
    if (existing.has(nameKey)) {
      showToast("bad", "A blockage with the same name already exists.");
      return;
    }

    const desc = String(newBlockage.description || "").trim();
    upsertBlockageMeta(nameRaw, radius, desc);

    console.log("[blockage:add] posting", {
      name: nameRaw,
      lat,
      long,
      radius,
    });

    // optimistic update so it appears immediately
    setBlockageGeoJson((prev) => {
      const base =
        prev && prev.type === "FeatureCollection"
          ? prev
          : { type: "FeatureCollection", features: [] };

      const nextFeatures = Array.isArray(base.features)
        ? base.features.slice()
        : [];

      nextFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [long, lat] },
        properties: {
          name: nameRaw,
          radius: radius,
          description: desc,
        },
      });

      return { type: "FeatureCollection", features: nextFeatures };
    });

    setBusy(true);
    try {
      await apiPost("/blockage", {
        point: { long, lat },
        radius,
        name: nameRaw,
        description: desc,
      });

      showToast("good", "Blockage added.");

      setNewBlockage({
        lat: "",
        long: "",
        radius: 200,
        name: "",
        description: "",
      });

      // sync from server then auto reroute using SAME handler
      const synced = await refreshBlockages();
      scheduleAutoReroute("blockage:add", synced);
    } catch (err) {
      console.log("[blockage:add] failed", { err });
      showToast("bad", err.message || "Failed to add blockage");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBlockage(name) {
    const nm = String(name || "").trim();
    if (!nm) return;

    const key = normaliseBlockageName(nm);
    pendingDeleteRef.current.add(key);

    console.log("[blockage:delete] deleting", { name: nm });

    // optimistic remove immediately
    setBlockageGeoJson((prev) => {
      return removeBlockageFromGeoJsonByKey(prev, key);
    });

    blockageMetaRef.current.delete(key);

    setBusy(true);
    try {
      await apiDelete(`/blockage/${encodeURIComponent(nm)}`);
      showToast("good", "Blockage deleted.");

      const synced = await refreshBlockages();
      scheduleAutoReroute("blockage:delete", synced);
    } catch (err) {
      console.log("[blockage:delete] failed", { err });
      pendingDeleteRef.current.delete(key);
      showToast("bad", err.message || "Failed to delete blockage");

      const synced = await refreshBlockages();
      scheduleAutoReroute("blockage:delete:recover", synced);
    } finally {
      setBusy(false);
    }
  }

  // -------------------- Map picking --------------------
  function onPickPoint(point) {
    if (selectionMode === "start") {
      setStart((prev) => {
        return { ...prev, lat: String(point.lat), long: String(point.long) };
      });
      setSelectionMode(null);
      showToast("good", "Start point set.");
      return;
    }

    if (selectionMode === "end") {
      setEnd((prev) => {
        return { ...prev, lat: String(point.lat), long: String(point.long) };
      });
      setSelectionMode(null);
      showToast("good", "End point set.");
      return;
    }

    if (selectionMode === "blockage") {
      setNewBlockage((prev) => {
        return { ...prev, lat: String(point.lat), long: String(point.long) };
      });
      setSelectionMode(null);
      showToast("good", "Blockage point set.");
    }
  }

  function focusOnBlockageFeature(feature) {
    if (!feature || !feature.geometry || feature.geometry.type !== "Point") {
      return;
    }
    if (!Array.isArray(feature.geometry.coordinates)) return;

    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    setFocusTarget({
      lat,
      long: lng,
      zoom: 15,
      nonce: Date.now(),
    });
  }

  // -------------------- Badge --------------------
  const statusBadge = useMemo(() => {
    if (serverStatus === "ready") return <Badge tone="good">Ready</Badge>;
    if (serverStatus === "wait") return <Badge tone="warn">Warming up</Badge>;
    if (serverStatus === "error") return <Badge tone="bad">Error</Badge>;
    return <Badge tone="neutral">Unknown</Badge>;
  }, [serverStatus]);

  return (
    <div className="h-full w-full bg-slate-50">
      <div className="grid h-14 grid-cols-3 items-center border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-1">
          {statusBadge}

          <button
            type="button"
            onClick={pollUntilReady}
            className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-transparent text-slate-700 hover:bg-slate-100"
            aria-label="Refresh server status"
            title="Refresh server status"
          >
            <img
              src="/icons/refresh.png"
              alt="Refresh"
              className="h-5 w-5 select-none"
              draggable={false}
            />
          </button>

          {serverError ? (
            <div className="text-xs text-red-600">{serverError}</div>
          ) : null}
        </div>

        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900">
            SG Routing App
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Segmented
            value={mapStyle}
            onChange={setMapStyle}
            options={[
              { label: "Default", value: "default" },
              { label: "Simple", value: "simple" },
            ]}
          />
        </div>
      </div>

      <div className="grid h-[calc(100%-56px)] grid-cols-[340px_1fr]">
        <Sidebar>
          <Tabs
            tabs={[
              { label: "Route", value: TAB_ROUTE },
              { label: "Road Types", value: TAB_ROAD_TYPES },
              { label: "Blockages", value: TAB_BLOCKAGES },
            ]}
            value={tab}
            onChange={async (v) => {
              setTab(v);
              setSelectionMode(null);

              if (v === TAB_ROAD_TYPES && validAxisTypes.length === 0) {
                await refreshRoadTypes();
              }

              if (v === TAB_BLOCKAGES && !blockageGeoJsonRef.current) {
                await refreshBlockages();
              }
            }}
          />

          {tab === TAB_ROUTE ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <div className="mb-2 mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Start point
                  </div>

                  <FloatingInput
                    label="Longitude"
                    value={start.long}
                    onChange={(e) => {
                      setStart((p) => {
                        return { ...p, long: e.target.value };
                      });
                    }}
                    inputMode="decimal"
                  />

                  <div className="mt-2">
                    <FloatingInput
                      label="Latitude"
                      value={start.lat}
                      onChange={(e) => {
                        setStart((p) => {
                          return { ...p, lat: e.target.value };
                        });
                      }}
                      inputMode="decimal"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode((prev) => {
                          return prev === "start" ? null : "start";
                        });
                      }}
                      className={
                        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition " +
                        (selectionMode === "start"
                          ? "bg-slate-900 text-white shadow-sm translate-y-[1px]"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:translate-y-[1px]")
                      }
                    >
                      {selectionMode === "start" ? "Picking..." : "Pick"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStart((p) => {
                          return { ...p, lat: "", long: "" };
                        });
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-[1px]"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="my-4 border-t border-slate-200" />
                </div>

                <div>
                  <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    End point
                  </div>

                  <FloatingInput
                    label="Longitude"
                    value={end.long}
                    onChange={(e) => {
                      setEnd((p) => {
                        return { ...p, long: e.target.value };
                      });
                    }}
                    inputMode="decimal"
                  />

                  <div className="mt-2">
                    <FloatingInput
                      label="Latitude"
                      value={end.lat}
                      onChange={(e) => {
                        setEnd((p) => {
                          return { ...p, lat: e.target.value };
                        });
                      }}
                      inputMode="decimal"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode((prev) => {
                          return prev === "end" ? null : "end";
                        });
                      }}
                      className={
                        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition " +
                        (selectionMode === "end"
                          ? "bg-slate-900 text-white shadow-sm translate-y-[1px]"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:translate-y-[1px]")
                      }
                    >
                      {selectionMode === "end" ? "Picking..." : "Pick"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEnd((p) => {
                          return { ...p, lat: "", long: "" };
                        });
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-[1px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRouteGeoJson(null);
                    hasRequestedRouteRef.current = false;
                    lastRouteRequestRef.current = null;
                    console.log("[route] cleared by user");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Clear Route
                </button>

                <button
                  type="button"
                  onClick={() => {
                    console.log("[ui] Search Route clicked");
                    handleSearchRoute({ reason: "ui" });
                  }}
                  disabled={busy || serverStatus !== "ready"}
                  className="rounded-xl bg-blue-400 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                >
                  Search Route
                </button>
              </div>
            </div>
          ) : null}

          {tab === TAB_ROAD_TYPES ? (
            <RoadTypesPanel
              options={validAxisTypes}
              checked={displayAxisTypes}
              loading={roadLayerLoading}
              onRefresh={refreshRoadTypes}
              onToggle={toggleRoadType}
              onHideAll={hideAllRoadTypes}
              onSelectAll={() => {
                selectAllRoadTypes();
              }}
            />
          ) : null}

          {tab === TAB_BLOCKAGES ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  Blockages
                </div>
                <button
                  type="button"
                  onClick={refreshBlockages}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-100 disabled:opacity-60"
                  disabled={busy}
                >
                  Refresh
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700">
                  Add blockage
                </div>

                <div className="mt-2 space-y-2">
                  <input
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Latitude"
                    value={newBlockage.lat}
                    onChange={(e) => {
                      setNewBlockage((p) => {
                        return { ...p, lat: e.target.value };
                      });
                    }}
                  />

                  <input
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Longitude"
                    value={newBlockage.long}
                    onChange={(e) => {
                      setNewBlockage((p) => {
                        return { ...p, long: e.target.value };
                      });
                    }}
                  />

                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">
                        Radius
                      </div>
                      <div className="text-xs text-slate-600">
                        {Number(newBlockage.radius || 0)} m
                      </div>
                    </div>

                    <input
                      type="range"
                      min={50}
                      max={2000}
                      step={10}
                      value={Number(newBlockage.radius || 200)}
                      onChange={(e) => {
                        setNewBlockage((p) => {
                          return { ...p, radius: e.target.value };
                        });
                      }}
                      className="mt-2 w-full"
                    />
                  </div>

                  <input
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Name"
                    value={newBlockage.name}
                    onChange={(e) => {
                      setNewBlockage((p) => {
                        return { ...p, name: e.target.value };
                      });
                    }}
                  />

                  <textarea
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Description (optional)"
                    rows={2}
                    value={newBlockage.description}
                    onChange={(e) => {
                      setNewBlockage((p) => {
                        return { ...p, description: e.target.value };
                      });
                    }}
                  />

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMode((prev) => {
                          return prev === "blockage" ? null : "blockage";
                        });
                      }}
                      className={
                        "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition " +
                        (selectionMode === "blockage"
                          ? "bg-slate-900 text-white shadow-sm translate-y-[1px]"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:translate-y-[1px]")
                      }
                    >
                      {selectionMode === "blockage" ? "Picking..." : "Pick"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewBlockage({
                          lat: "",
                          long: "",
                          radius: 200,
                          name: "",
                          description: "",
                        });
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-[1px]"
                    >
                      Clear
                    </button>

                    <div className="flex-1" />

                    <button
                      type="button"
                      onClick={addBlockage}
                      disabled={busy || serverStatus !== "ready"}
                      className="rounded-lg bg-blue-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700">
                  Existing blockages
                </div>
                <div className="mt-2 max-h-60 overflow-auto">
                  <BlockageList
                    geojson={blockageGeoJson}
                    onDelete={deleteBlockage}
                    onFocus={focusOnBlockageFeature}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </Sidebar>

        <div className="h-full w-full">
          <MapView
            mapStyle={mapStyle}
            selectionMode={selectionMode}
            onPickPoint={onPickPoint}
            startPoint={startPoint}
            endPoint={endPoint}
            routeGeoJson={routeGeoJson}
            axisTypeGeoJson={axisTypeGeoJson}
            blockageGeoJson={blockageGeoJson}
            draftBlockage={draftBlockage}
            focusTarget={focusTarget}
          />
        </div>
      </div>

      <ToastStack toasts={toasts} />

      {roadLayerLoading ? (
        <LoadingOverlay title="Loading road type layer(s)…" />
      ) : null}
    </div>
  );
}

// FIX: No nested <button>. Use a div row + separate buttons.
function BlockageList({ geojson, onDelete, onFocus }) {
  const features = Array.isArray(geojson && geojson.features)
    ? geojson.features
    : [];

  if (features.length === 0) {
    return <div className="text-xs text-slate-500">No blockages loaded.</div>;
  }

  return (
    <div className="space-y-2">
      {features.map((f, idx) => {
        const props = f && f.properties ? f.properties : {};
        const name = props.name || props.id || String(idx);
        const desc = normaliseOptionalText(props.description);

        const radius =
          props.radius ??
          props.r ??
          props.R ??
          props["radius (m)"] ??
          (f && f.radius) ??
          "";

        return (
          <div
            key={String(name)}
            className="w-full rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof onFocus === "function") onFocus(f);
                }}
                className="flex-1 text-left"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {String(name)}
                </div>
                {desc ? (
                  <div className="text-xs text-slate-600">{desc}</div>
                ) : null}
                {radius ? (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Radius: {String(radius)} m
                  </div>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof onDelete === "function") onDelete(String(name));
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-100"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

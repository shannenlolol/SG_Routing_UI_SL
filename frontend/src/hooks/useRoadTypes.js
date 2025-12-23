// src/hooks/useRoadTypes.js
import { useState, useRef, useEffect } from "react";
import { apiGet, apiPost } from "../api/client";
import { normaliseTypeName } from "../utils/roadTypes";
import { getRoadTypesForMode } from "../utils/transportModes";
import { generateRoadTypeColors,sortRoadTypesByImportance } from "../utils/roadTypeDescriptions";

export function useRoadTypes(showToast, transportMode) {
  const [allRoadTypes, setAllRoadTypes] = useState([]); // All available types from API
  const [roadTypeColors, setRoadTypeColors] = useState({}); // Color mapping
  const [validAxisTypes, setValidAxisTypes] = useState([]);
  const [displayAxisTypes, setDisplayAxisTypes] = useState([]);
  const [axisTypeGeoJson, setAxisTypeGeoJson] = useState(null);

  const axisGeoJsonCacheRef = useRef(new Map());
  const displayAxisTypesRef = useRef([]);
  const pendingSetRef = useRef(new Set());
  const [pendingAxisTypes, setPendingAxisTypes] = useState([]);

  useEffect(() => {
    displayAxisTypesRef.current = displayAxisTypes;
  }, [displayAxisTypes]);

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

  async function fetchAllRoadTypes() {
    try {
      const types = await apiGet("/allAxisTypes");
      if (Array.isArray(types)) {
        const normalized = types.map(normaliseTypeName);
        setAllRoadTypes(normalized);
        
        // Generate colors for all types
        const colors = generateRoadTypeColors(normalized);
        setRoadTypeColors(colors);
        console.log("[roadTypes] fetched all road types", normalized);
        
        return normalized;
      }
      return [];
    } catch (err) {
      console.error("[roadTypes] failed to fetch all road types", err);
      showToast("bad", "Failed to fetch available road types");
      return [];
    }
  }

  async function ensureAxisTypeLoaded(axisType) {
    const typeName = normaliseTypeName(axisType);
    if (!typeName) return null;

    const cache = axisGeoJsonCacheRef.current;
    if (cache.has(typeName)) return cache.get(typeName);

    const gj = await apiGet(`/axisType/${encodeURIComponent(typeName)}`);
    console.log("[roadTypes] loaded axis type", typeName, gj);
    if (gj === "Wait") {
      throw new Error("Road type \"" + typeName + "\" layer is still being prepared. Try again shortly.");
    }
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
  }, [displayAxisTypes]);

  async function refreshRoadTypes() {
    addPending("refresh");
    try {
      // First, fetch all available road types if not already loaded
      let availableTypes = allRoadTypes;
      if (availableTypes.length === 0) {
        availableTypes = await fetchAllRoadTypes();
      }

      try {
        await apiPost("/changeValidRoadTypes", availableTypes);
      } catch (err) {
        console.warn("[roadTypes] failed to set valid road types", err);
      }

      const raw = Array.isArray(availableTypes) ? availableTypes.map(normaliseTypeName) : [];
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

  async function selectAllRoadTypes() {
    const list = sortRoadTypesByImportance(validAxisTypes);

    const all = Array.from(new Set(list.map(normaliseTypeName))).filter(Boolean);

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

  return {
    allRoadTypes,
    roadTypeColors,
    validAxisTypes,
    displayAxisTypes,
    axisTypeGeoJson,
    pendingAxisTypes,
    roadLayerLoading: pendingAxisTypes.length > 0,
    fetchAllRoadTypes,
    refreshRoadTypes,
    selectAllRoadTypes,
    toggleRoadType,
    hideAllRoadTypes,
  };
}
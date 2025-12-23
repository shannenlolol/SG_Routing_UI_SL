// src/hooks/useRoadTypes.js
import { useState, useRef, useEffect } from "react";
import { apiGet, apiPost } from "../api/client";
import { normaliseTypeName, sortRoadTypesByImportance } from "../utils/roadTypes";
import { getRoadTypesForMode } from "../utils/transportModes";

export function useRoadTypes(showToast, transportMode) {
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
  }, [displayAxisTypes]);

  async function refreshRoadTypes() {
    addPending("refresh");
    try {
      // First, set the valid road types based on transport mode
      const allowedTypes = getRoadTypesForMode(transportMode);
      console.log("[roadTypes] setting valid road types for", transportMode, allowedTypes);
      
      try {
        await apiPost("/changeValidRoadTypes", allowedTypes);
      } catch (err) {
        console.warn("[roadTypes] failed to set valid road types", err);
      }

      // Then fetch what the server considers valid
      const valid = await apiGet("/validAxisTypes");
      const raw = Array.isArray(valid) ? valid.map(normaliseTypeName) : [];
      const ordered = sortRoadTypesByImportance(raw);
      
      // Filter based on transport mode
      const filtered = ordered.filter((type) => 
        allowedTypes.some((allowed) => 
          normaliseTypeName(allowed) === type
        )
      );
      
      setValidAxisTypes(filtered);

      const current = displayAxisTypesRef.current;
      const cleaned = current.filter((t) => filtered.includes(t));

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

    // Filter based on transport mode
    const allowedTypes = getRoadTypesForMode(transportMode);
    const filtered = list.filter((type) => 
      allowedTypes.some((allowed) => 
        normaliseTypeName(allowed) === normaliseTypeName(type)
      )
    );

    const all = Array.from(new Set(filtered.map(normaliseTypeName))).filter(Boolean);

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
    validAxisTypes,
    displayAxisTypes,
    axisTypeGeoJson,
    pendingAxisTypes,
    roadLayerLoading: pendingAxisTypes.length > 0,
    refreshRoadTypes,
    selectAllRoadTypes,
    toggleRoadType,
    hideAllRoadTypes,
  };
}
// src/hooks/useBlockages.js
import { useState, useRef, useEffect, useMemo } from "react";
import { apiGet, apiPost, apiDelete } from "../api/client";
import {
  normaliseOptionalText,
  normaliseBlockageName,
  getBlockageNameFromFeature,
  getBlockageKeyFromFeature,
  getBlockageRadiusFromFeature,
  getBlockageNamesSet,
  removeBlockageFromGeoJsonByKey,
} from "../utils/blockages";

function toNumber(value) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return null;
}

export function useBlockages(showToast) {
  const [blockageGeoJson, setBlockageGeoJson] = useState(null);
  const blockageGeoJsonRef = useRef(null);
  const blockageMetaRef = useRef(new Map());
  const pendingDeleteRef = useRef(new Set());

  const [newBlockage, setNewBlockage] = useState({
    lat: "",
    long: "",
    radius: 200,
    name: "",
    description: "",
  });

  useEffect(() => {
    blockageGeoJsonRef.current = blockageGeoJson;
  }, [blockageGeoJson]);

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
    if (gj.type !== "FeatureCollection" || !Array.isArray(gj.features)) return gj;

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

      if (rFromServer !== null) {
        upsertBlockageMeta(name, rFromServer, dFromServer);
      }

      if ((rFromServer === null || rFromServer <= 0) && nameKey) {
        const cached = blockageMetaRef.current.get(nameKey);
        if (cached && Number.isFinite(cached.radius) && cached.radius > 0) {
          f.properties.radius = cached.radius;
        }
      }

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
    try {
      const serverRaw = await apiGet("/blockage");
      const server = enrichBlockageGeoJson(serverRaw);

      const serverKeys = new Set(
        (Array.isArray(server && server.features) ? server.features : []).map(
          (f, idx) => getBlockageKeyFromFeature(f, idx)
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

          const rChosen = getBlockageRadiusFromFeature(chosen);
          const rLocal = localF ? getBlockageRadiusFromFeature(localF) : null;

          if ((rChosen === null || rChosen <= 0) && rLocal !== null && rLocal > 0) {
            chosen.properties.radius = rLocal;
          } else if ((rChosen === null || rChosen <= 0) && blockageMetaRef.current.has(key)) {
            const cached = blockageMetaRef.current.get(key);
            if (cached && Number.isFinite(cached.radius) && cached.radius > 0) {
              chosen.properties.radius = cached.radius;
            }
          }

          const dChosen = normaliseOptionalText(chosen.properties.description);
          const dLocal = localF
            ? normaliseOptionalText(localF.properties && localF.properties.description)
            : "";

          if (!dChosen && dLocal) {
            chosen.properties.description = dLocal;
          } else if (!dChosen) {
            const cached = blockageMetaRef.current.get(key);
            chosen.properties.description = cached && cached.description ? cached.description : "";
          }

          merged.push(chosen);
        }

        return { type: "FeatureCollection", features: merged };
      });

      return server;
    } catch (err) {
      showToast("bad", err.message || "Failed to load blockages");
      return null;
    }
  }

  async function addBlockage(serverStatus, onSuccess) {
    const lat = toNumber(newBlockage.lat);
    const long = toNumber(newBlockage.long);
    const radius = toNumber(newBlockage.radius);

    const nameRaw = String(newBlockage.name || "").trim();
    const nameKey = normaliseBlockageName(nameRaw);

    if (lat === null || long === null || radius === null) {
      showToast("warn", "Blockage coordinates and radius must be valid numbers.");
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

    console.log("[blockage:add] posting", { name: nameRaw, lat, long, radius });

    setBlockageGeoJson((prev) => {
      const base = prev && prev.type === "FeatureCollection"
        ? prev
        : { type: "FeatureCollection", features: [] };

      const nextFeatures = Array.isArray(base.features) ? base.features.slice() : [];

      nextFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [long, lat] },
        properties: { name: nameRaw, radius: radius, description: desc },
      });

      return { type: "FeatureCollection", features: nextFeatures };
    });

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

      const synced = await refreshBlockages();
      if (onSuccess) onSuccess(synced);
    } catch (err) {
      console.log("[blockage:add] failed", { err });
      showToast("bad", err.message || "Failed to add blockage");
    }
  }

  async function deleteBlockage(name, onSuccess) {
    const nm = String(name || "").trim();
    if (!nm) return;

    const key = normaliseBlockageName(nm);
    pendingDeleteRef.current.add(key);

    console.log("[blockage:delete] deleting", { name: nm });

    setBlockageGeoJson((prev) => removeBlockageFromGeoJsonByKey(prev, key));
    blockageMetaRef.current.delete(key);

    try {
      await apiDelete(`/blockage/${encodeURIComponent(nm)}`);
      showToast("good", "Blockage deleted.");

      const synced = await refreshBlockages();
      if (onSuccess) onSuccess(synced);
    } catch (err) {
      console.log("[blockage:delete] failed", { err });
      pendingDeleteRef.current.delete(key);
      showToast("bad", err.message || "Failed to delete blockage");

      const synced = await refreshBlockages();
      if (onSuccess) onSuccess(synced);
    }
  }

  return {
    blockageGeoJson,
    blockageGeoJsonRef,
    newBlockage,
    setNewBlockage,
    draftBlockage,
    refreshBlockages,
    addBlockage,
    deleteBlockage,
  };
}   
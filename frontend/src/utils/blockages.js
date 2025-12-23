// src/utils/blockages.js

export function normaliseOptionalText(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (s.toLowerCase() === "null") return "";
  if (s.toLowerCase() === "undefined") return "";
  return s;
}

export function normaliseBlockageName(name) {
  return String(name || "").trim().toLowerCase();
}

export function getBlockageNameFromFeature(feature, idx) {
  const props = feature && feature.properties ? feature.properties : {};
  const raw = props.name || props.id || "";
  const s = String(raw || "").trim();
  if (s) return s;
  return String(idx);
}

export function getBlockageKeyFromFeature(feature, idx) {
  const name = getBlockageNameFromFeature(feature, idx);
  return normaliseBlockageName(name);
}

export function readRadiusMetersFromProps(props) {
  if (!props || typeof props !== "object") return null;

  const candidates = [
    props.radius,
    props.r,
    props.R,
    props["radius (m)"],
    props.radius_m,
    props.radiusM,
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

export function getBlockageRadiusFromFeature(feature) {
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

export function getBlockageNamesSet(gj) {
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

export function removeBlockageFromGeoJsonByKey(gj, keyToRemove) {
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

export function sanitiseBlockagesForRoute(gj) {
  if (!gj || gj.type !== "FeatureCollection" || !Array.isArray(gj.features)) {
    return null;
  }

  return {
    type: "FeatureCollection",
    features: gj.features.filter(Boolean).map((f) => {
      const props = (f && f.properties) || {};

      const radiusNum = readRadiusMetersFromProps(props);
      const radius = Number.isFinite(radiusNum) && radiusNum > 0 ? radiusNum : 0;

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
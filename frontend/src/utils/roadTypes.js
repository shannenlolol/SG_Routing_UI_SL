// src/utils/roadTypes.js

const META = [
  { value: "motorway", label: "Motorway", colour: "#dc2626", rank: 1 },
  { value: "motorway_link", label: "Motorway Link", colour: "#f97316", rank: 2 },
  { value: "trunk", label: "Trunk", colour: "#16a34a", rank: 3 },
  { value: "trunk_link", label: "Trunk Link", colour: "#22c55e", rank: 4 },
  { value: "primary", label: "Primary", colour: "#ea580c", rank: 5 },
  { value: "primary_link", label: "Primary Link", colour: "#fb923c", rank: 6 },
  { value: "secondary", label: "Secondary", colour: "#7c3aed", rank: 7 },
  { value: "secondary_link", label: "Secondary Link", colour: "#a78bfa", rank: 8 },
  { value: "tertiary", label: "Tertiary", colour: "#ca8a04", rank: 9 },
  { value: "tertiary_link", label: "Tertiary Link", colour: "#facc15", rank: 10 },
  { value: "residential", label: "Residential", colour: "#0ea5e9", rank: 11 },
];

export const ROAD_TYPE_META_BY_VALUE = META.reduce((acc, item) => {
  acc[item.value] = item;
  return acc;
}, {});

export function formatRoadTypeLabel(value) {
  const v = String(value || "").trim();
  const meta = ROAD_TYPE_META_BY_VALUE[v];
  if (meta && meta.label) return meta.label;

  // Fallback: "primary_link" -> "Primary Link"
  const cleaned = v.replaceAll("-", " ").replaceAll("_", " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function getRoadTypeColour(value) {
  const v = String(value || "").trim();
  const meta = ROAD_TYPE_META_BY_VALUE[v];
  if (meta && meta.colour) return meta.colour;
  return "#64748b";
}

export function sortRoadTypesByImportance(values) {
  const arr = Array.isArray(values) ? values.slice() : [];

  arr.sort((a, b) => {
    const av = String(a || "").trim();
    const bv = String(b || "").trim();

    const am = ROAD_TYPE_META_BY_VALUE[av];
    const bm = ROAD_TYPE_META_BY_VALUE[bv];

    const ar = am ? am.rank : 9999;
    const br = bm ? bm.rank : 9999;

    if (ar !== br) return ar - br;
    return av.localeCompare(bv);
  });

  return arr;
}

export function normaliseTypeName(t) {
  return String(t || "").trim().toLowerCase();
}

export function toDisplayLabel(type) {
  const raw = String(type || "").trim();
  if (!raw) return "";

  const spaced = raw
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = spaced.split(" ");
  const cased = words.map((w) => {
    if (!w) return "";
    return w[0].toUpperCase() + w.slice(1).toLowerCase();
  });

  return cased.join(" ");
}

// Lower rank = higher importance
const RANK = {
  motorway: 1,
  motorway_link: 2,
  trunk: 3,
  trunk_link: 4,
  primary: 5,
  primary_link: 6,
  secondary: 7,
  secondary_link: 8,
  tertiary: 9,
  tertiary_link: 10,
  residential: 11,
};

export function sortByImportance(types) {
  const list = Array.isArray(types) ? types.map(normaliseTypeName).filter(Boolean) : [];
  const uniq = Array.from(new Set(list));

  uniq.sort((a, b) => {
    const ra = Object.prototype.hasOwnProperty.call(RANK, a) ? RANK[a] : 999;
    const rb = Object.prototype.hasOwnProperty.call(RANK, b) ? RANK[b] : 999;

    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });

  return uniq;
}

const COLOURS = {
  motorway: "#0ea5e9",
  motorway_link: "#38bdf8",
  trunk: "#22c55e",
  trunk_link: "#4ade80",
  primary: "#f97316",
  primary_link: "#fb923c",
  secondary: "#a855f7",
  secondary_link: "#c084fc",
  tertiary: "#eab308",
  tertiary_link: "#facc15",
  residential: "#64748b",
};


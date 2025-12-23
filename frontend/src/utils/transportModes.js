// src/utils/transportModes.js

export const TRANSPORT_MODES = {
  CAR: "car",
  CYCLE: "cycle",
  WALK: "walk",
};

// Define which road types are allowed for each transport mode
// Based on actual Singapore OSM data from /allAxisTypes
export const TRANSPORT_ROAD_TYPES = {
  [TRANSPORT_MODES.CAR]: [
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "residential",
  ],
  [TRANSPORT_MODES.CYCLE]: [
    "cycleway",
    "path",
    "track",
    "residential",
  ],
  [TRANSPORT_MODES.WALK]: [
    "footway",
    "path",
    "pedestrian",
    "steps",
    "track",
    "crossing",
    "residential",
  ],
};

export const TRANSPORT_MODE_INFO = {
  [TRANSPORT_MODES.CAR]: {
    label: "Car",
    icon: "/icons/car.png",
  },
  [TRANSPORT_MODES.CYCLE]: {
    label: "Cycle",
    icon: "/icons/cycle.png",
  },
  [TRANSPORT_MODES.WALK]: {
    label: "Walk",
    icon: "/icons/walk.png",
  },
};

// Road type metadata for display - all types available in Singapore OSM
export const ROAD_TYPE_META = [
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
  // { value: "living_street", label: "Living Street", colour: "#38bdf8", rank: 12 },
  // { value: "unclassified", label: "Unclassified", colour: "#94a3b8", rank: 13 },
  // { value: "service", label: "Service", colour: "#cbd5e1", rank: 14 },
  { value: "cycleway", label: "Cycleway", colour: "#10b981", rank: 15 },
  { value: "path", label: "Path", colour: "#84cc16", rank: 16 },
  { value: "track", label: "Track", colour: "#a3e635", rank: 17 },
  { value: "footway", label: "Footway", colour: "#06b6d4", rank: 18 },
  { value: "pedestrian", label: "Pedestrian", colour: "#0891b2", rank: 19 },
  { value: "steps", label: "Steps", colour: "#0e7490", rank: 20 },
  { value: "crossing", label: "Crossing", colour: "#14b8a6", rank: 21 },
  { value: "bridleway", label: "Bridleway", colour: "#d946ef", rank: 22 },
  { value: "corridor", label: "Corridor", colour: "#c084fc", rank: 23 },
  // { value: "construction", label: "Construction", colour: "#fb923c", rank: 24 },
  // { value: "proposed", label: "Proposed", colour: "#fdba74", rank: 25 },
  { value: "raceway", label: "Raceway", colour: "#ef4444", rank: 26 },
  { value: "road", label: "Road", colour: "#64748b", rank: 27 },
];

export function getRoadTypesForMode(mode) {
  return TRANSPORT_ROAD_TYPES[mode] || TRANSPORT_ROAD_TYPES[TRANSPORT_MODES.CAR];
}
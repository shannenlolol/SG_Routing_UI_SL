// src/utils/transportModes.js

export const TRANSPORT_MODES = {
  CAR: "car",
  CYCLE: "cycle",
  WALK: "walk",
};

// Define which road types are allowed for each transport mode
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
    "residential",
    "tertiary",
    "tertiary_link",
    "secondary",
    "secondary_link",
    "primary",
    "primary_link",
    "path",
    "track",
  ],
  [TRANSPORT_MODES.WALK]: [
    "footway",
    "path",
    "pedestrian",
    "steps",
    "residential",
    "cycleway",
    "track",
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

// Road type metadata for display
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
  { value: "cycleway", label: "Cycleway", colour: "#10b981", rank: 12 },
  { value: "path", label: "Path", colour: "#84cc16", rank: 13 },
  { value: "track", label: "Track", colour: "#a3e635", rank: 14 },
  { value: "footway", label: "Footway", colour: "#06b6d4", rank: 15 },
  { value: "pedestrian", label: "Pedestrian", colour: "#0891b2", rank: 16 },
  { value: "steps", label: "Steps", colour: "#0e7490", rank: 17 },
];

export function getRoadTypesForMode(mode) {
  return TRANSPORT_ROAD_TYPES[mode] || TRANSPORT_ROAD_TYPES[TRANSPORT_MODES.CAR];
}
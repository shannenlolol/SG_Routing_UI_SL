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
    "footway",
    "path",
    "pedestrian",
    "steps",
    "track",
    "crossing",
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

export function getRoadTypesForMode(mode) {
  return TRANSPORT_ROAD_TYPES[mode] || TRANSPORT_ROAD_TYPES[TRANSPORT_MODES.CAR];
}
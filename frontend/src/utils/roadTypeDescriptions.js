// src/utils/roadTypeDescriptions.js

// Road type importance order (higher number = more important)
const ROAD_TYPE_IMPORTANCE = {
  // Major highways and expressways
  motorway: 100,
  motorway_link: 95,
  trunk: 90,
  trunk_link: 85,

  // Major roads
  primary: 80,
  primary_link: 75,
  secondary: 70,
  secondary_link: 65,
  tertiary: 60,
  tertiary_link: 55,

  // Residential and local
  residential: 50,
  living_street: 45,

  // Cycling infrastructure
  cycleway: 25,

  // Pedestrian infrastructure
  footway: 20,
  pedestrian: 18,
  path: 15,
  crossing: 14,
  steps: 13,
  track: 12,

  // Construction/planning/minor
  road: 11,
  bridleway: 10,
  construction: 9,
  proposed: 2,
  raceway: 7,
  unclassified: 1,
  corridor: 5,
  elevator: 4,
  service: 3,
};

export function sortRoadTypesByImportance(roadTypes) {
  return [...roadTypes].sort((a, b) => {
    const importanceA = ROAD_TYPE_IMPORTANCE[a] || 0;
    const importanceB = ROAD_TYPE_IMPORTANCE[b] || 0;
    return importanceB - importanceA; // Descending order
  });
}

// Generate distinct colors for road types - matching map line colors
export function generateRoadTypeColors(roadTypes) {
  const colorMap = {
    // Major highways - Red tones
    motorway: "#dc2626",
    motorway_link: "#f87171",

    // Trunk roads - Green tones
    trunk: "#16a34a",
    trunk_link: "#4ade80",

    // Primary roads - Orange tones
    primary: "#ea580c",
    primary_link: "#fb923c",

    // Secondary roads - Purple tones
    secondary: "#7c3aed",
    secondary_link: "#a78bfa",

    // Tertiary roads - Yellow tones
    tertiary: "#ca8a04",
    tertiary_link: "#fbbf24",

    // Residential - Blue tones
    residential: "#0ea5e9",
    living_street: "#38bdf8",
    road: "#64748b",

    // Cycling - Green tones
    cycleway: "#10b981",

    // Pedestrian - Cyan tones
    footway: "#10b981",
    pedestrian: "#14b8a6",
    path: "#2dd4bf",
    crossing: "#5eead4",
    steps: "#99f6e4",

    // Special - Various
    track: "#99f6e4",
    bridleway: "#64748b",

    // // Construction/planning - Orange/Gray
    // construction: "#64748b",
    // proposed: "#64748b",
    // raceway: "#64748b",
    // unclassified: "#64748b",
    // service: "#64748b",
    // corridor: "#64748b",
    // elevator: "#64748b",
  };

  // Fill in any missing types with a default color
  const result = {};
  roadTypes.forEach((type) => {
    result[type] = colorMap[type] || "#64748b";
  });

  return result;
}

export function getRoadTypeLabel(roadType) {
  // Convert snake_case to Title Case
  return roadType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

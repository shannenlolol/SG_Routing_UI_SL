// src/utils/roadTypeDescriptions.js

// Descriptions for each road type based on OpenStreetMap standards
export const ROAD_TYPE_DESCRIPTIONS = {
  motorway: "High-speed expressways and highways with grade-separated junctions. Usually 2+ lanes per direction with barriers.",
  motorway_link: "Slip roads and ramps connecting motorways to other roads.",
  trunk: "Major non-motorway roads that form the main transport network. Important inter-city routes.",
  trunk_link: "Slip roads and links connecting trunk roads.",
  primary: "Major roads connecting large towns and cities. Usually with 2 lanes and relatively high speed limits.",
  primary_link: "Slip roads connecting primary roads to other roads.",
  secondary: "Roads connecting medium-sized towns and serving as main through routes in urban areas.",
  secondary_link: "Slip roads connecting secondary roads.",
  tertiary: "Roads connecting smaller towns and villages, often single carriageway.",
  tertiary_link: "Slip roads connecting tertiary roads.",
  residential: "Roads in residential areas primarily for access to housing.",
  living_street: "Residential streets where pedestrians have priority and vehicles move slowly (shared space).",
  unclassified: "Minor public roads that are not residential but don't fit higher classifications.",
  service: "Access roads to buildings, parking lots, or other facilities. Not for through traffic.",
  road: "Unknown road type or generic road classification.",
  cycleway: "Dedicated paths or lanes specifically for bicycles.",
  path: "Generic non-specific path for walking, cycling or other non-motorized use.",
  footway: "Designated paths primarily for pedestrians (sidewalks, footpaths).",
  pedestrian: "Roads or areas primarily or exclusively for pedestrian use.",
  steps: "Stairs for pedestrians to change elevation.",
  crossing: "Marked pedestrian crossings on roads.",
  track: "Roads for agricultural or forestry use, usually unpaved.",
  bridleway: "Paths designated for horse riding (also often open to pedestrians and cyclists).",
  corridor: "Indoor passages in buildings (e.g., shopping malls, airports).",
  elevator: "Elevator/lift for vertical transportation.",
  construction: "Roads under construction, not yet open to traffic.",
  proposed: "Planned roads not yet built.",
  raceway: "Race tracks for motorsports or cycling.",
};

// Generate distinct colors for road types using a color palette
export function generateRoadTypeColors(roadTypes) {
  // Predefined color palette with good contrast
  const colorPalette = [
    "#dc2626", // red-600
    "#ea580c", // orange-600
    "#ca8a04", // yellow-600
    "#16a34a", // green-600
    "#0891b2", // cyan-600
    "#0284c7", // sky-600
    "#2563eb", // blue-600
    "#7c3aed", // violet-600
    "#c026d3", // fuchsia-600
    "#db2777", // pink-600
    "#f97316", // orange-500
    "#84cc16", // lime-500
    "#10b981", // emerald-500
    "#06b6d4", // cyan-500
    "#3b82f6", // blue-500
    "#8b5cf6", // violet-500
    "#d946ef", // fuchsia-500
    "#f43f5e", // rose-500
    "#f59e0b", // amber-500
    "#22c55e", // green-500
    "#14b8a6", // teal-500
    "#6366f1", // indigo-500
    "#a855f7", // purple-500
    "#ec4899", // pink-500
    "#ef4444", // red-500
    "#eab308", // yellow-500
    "#64748b", // slate-500
    "#78716c", // stone-500
  ];

  const colorMap = {};
  roadTypes.forEach((type, index) => {
    colorMap[type] = colorPalette[index % colorPalette.length];
  });

  return colorMap;
}

export function getRoadTypeLabel(roadType) {
  // Convert snake_case to Title Case
  return roadType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
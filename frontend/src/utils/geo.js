import * as turf from "@turf/turf";
import L from "leaflet";

export function computeBoundsFromGeoJson(geojson) {
  if (!geojson) return null;

  try {
    const bbox = turf.bbox(geojson);
    const southWest = L.latLng(bbox[1], bbox[0]);
    const northEast = L.latLng(bbox[3], bbox[2]);
    return L.latLngBounds(southWest, northEast);
  } catch (err) {
    return null;
  }
}

export function normaliseRoadTypesForMode(mode) {
  // Conservative defaults based on typical OSM tagging.
  // You can tweak these without changing the UI.
  if (mode === "cycling") {
    return ["cycleway", "residential", "living_street", "service", "path"];
  }

  if (mode === "walking") {
    return ["footway", "path", "pedestrian", "residential", "living_street", "service"];
  }

  // driving
  return [
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
    "service",
  ];
}

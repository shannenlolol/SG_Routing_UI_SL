# Software Design Description

## Introduction

The **SG Routing App** lets a user **plan a route and visualise it on an interactive map**, while also exploring **road-type overlays** and managing **routing blockages**.

The current scope focuses on a **Vite + React frontend** talking to hosted routing services (returning route and overlay data as **GeoJSON**):

* Checking backend readiness and showing a clear status (**Ready / Warming up / Error**).
* Defining start/end points via:

  * typed latitude/longitude, or
  * map-picking (click on map to set a point).
* Requesting the **shortest route** from the backend and rendering it as a GeoJSON route line on the map.
* Improving usability with:

  * replacing the previous route on each new search,
  * reversing start/end points for quick opposite-direction planning,
  * automatic map focus on the searched route or selected blockage (inset-aware when the sidebar is expanded),
  * hover tooltips for route segments (road name + type) and markers (latitude + longitude),
  * a transport mode selector (car/cycle/walk) that updates valid road types for routing,
  * a road-type overlay tab to toggle road layers,
  * blockage management (view/add/delete/focus),
  * a **simple vs default basemap** toggle, and
  * a collapsible sidebar (Google Maps-style rail).

On the frontend, the main logic lives in:

* `App.jsx` – **overall state + orchestration**, including:

  * server readiness polling,
  * tab selection, sidebar collapse state, busy/loading states,
  * start/end inputs and selection mode,
  * route search/reverse and reroute triggers on blockage changes,
  * road-type selection and valid-road-types updates.
* `MapView.jsx` – **Leaflet map component** that:

  * renders the basemap (default or simple),
  * draws the route GeoJSON,
  * draws road-type overlay GeoJSON layers,
  * draws blockages and blockage radii,
  * renders start/end markers (and nearest-on-route markers),
  * provides hover tooltips for route/markers,
  * automatically fits/centres the map for route and blockage focus, **taking sidebar inset into account**.
* `RouteTab.jsx`, `RoadTypesTab.jsx`, `BlockagesTab.jsx` – sidebar tab UIs for route input/actions, overlay selection, and blockage management.

---

## Summary of User Story to Sequence Diagram Mapping

| No. | User Story                         | Sequence Diagram Focus                                                           |
| --- | ---------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Check Server Readiness             | How the status badge and refresh call `/ready`                                   |
| 2   | Define Start and End Points        | How typed inputs and map-picking set start/end state                             |
| 3   | Search for Route                   | How `App` calls `POST /route` and renders the returned GeoJSON                   |
| 4   | View Route on Map                  | How GeoJSON becomes a Leaflet route layer                                        |
| 5   | View Route Details                 | How hover tooltips are derived from `feature.properties` and marker coords       |
| 6   | Replace Previous Route             | How route state and layers are cleared before rendering a new route              |
| 7   | Reverse Route                      | How swapping start/end updates state and enables re-search                       |
| 8   | Automatic Map Focus                | How `fitBounds` / `setView` are applied, including sidebar inset-aware behaviour |
| 9   | Select Transport Mode              | How switching mode updates valid road types (via `/changeValidRoadTypes`)        |
| 10  | View Road Types Overlay            | How toggled road-type GeoJSON is fetched and rendered                            |
| 11  | Manage Blockages                   | How blockages are fetched/added/deleted and trigger reroute + focus              |
| 12  | Toggle Simple Map Style            | How basemap tile URL changes without clearing overlays                           |
| 13  | Collapse / Expand Sidebar          | How sidebar state changes layout and affects map centring                        |

---

## Sequence Diagrams

The following diagrams show how the **user**, the **React application (`App` + `MapView`)**, and the **Routing APIs** collaborate to implement each feature.

For brevity, `App` represents the main React component (`App.jsx`), `MapView` represents the Leaflet map component (`MapView.jsx`), and `RoutingAPI` represents the backend endpoints used (e.g., `/ready`, `/route`, `/blockage`, `/axisType/...`).

---

### 1. Check Server Readiness

```mermaid
sequenceDiagram
    participant User
    participant App
    participant RoutingAPI as Routing API

    User->>App: Open app OR click refresh status
    App->>RoutingAPI: GET /ready
    RoutingAPI-->>App: 200 OK ("ready" | "wait" | error)

    alt Ready
        App->>App: setServerStatus("ready")
        App->>User: Show "Ready" badge
    else Warming up
        App->>App: setServerStatus("wait")
        App->>User: Show "Warming up" badge
    else Error
        App->>App: setServerStatus("error")
        App->>User: Show error badge/message
    end
```

**Explanation:**
The app polls or the user refreshes `/ready`. The status badge informs the user of the server status.

---

### 2. Define Start and End Points

```mermaid
sequenceDiagram
    participant User
    participant App
    participant MapView

    alt Typed coordinates
        User->>App: Type lat/long into Start or End inputs
        App->>App: setStart(...) / setEnd(...)
        App->>MapView: startPoint/endPoint props updated
        MapView->>User: Render start/end marker tooltip targets
    else Map picking
        User->>App: Click "Pick start" or "Pick end"
        App->>App: setSelectionMode("start" | "end")
        User->>MapView: Click map
        MapView->>App: onPickPoint({lat,long})
        App->>App: Update start/end state + clear selection mode
        App->>User: Show toast "Start point set" / "End point set"
    end
```

**Explanation:**
Start/end can be set by input fields or map click selection. Markers update on the map and tooltips are available on hover.

---

### 3. Search for Route

```mermaid
sequenceDiagram
    participant User
    participant App
    participant MapView
    participant RoutingAPI as Routing API

    User->>App: Click "Search route"
    App->>App: Validate start/end are numeric
    alt Invalid input
        App->>User: Show inline validation error
        App->>MapView: No route update
    else Valid input
        App->>App: Clear previous route state (if any)
        App->>RoutingAPI: POST /route { startPt, endPt }
        RoutingAPI-->>App: 200 OK + route GeoJSON OR error

        alt API error
            App->>User: Show error toast/message
            App->>MapView: No route drawn
        else Success
            App->>App: setRouteGeoJson(geoJson)
            App->>MapView: routeGeoJson prop updated
            MapView->>User: Render route polyline
        end
    end
```

**Explanation:**
`App` validates input, calls `POST /route`, and updates `MapView` with the returned GeoJSON.

---

### 4. View Route on Map

```mermaid
sequenceDiagram
    participant App
    participant MapView

    App->>MapView: routeGeoJson updated
    MapView->>MapView: Remove existing route layer (if any)
    MapView->>MapView: Add new GeoJSON route layer
    MapView->>User: Route polyline displayed on basemap
```

**Explanation:**
`MapView` replaces the Leaflet route layer whenever the route GeoJSON changes.

---

### 5. View Route Details

```mermaid
sequenceDiagram
    participant User
    participant MapView

    User->>MapView: Hover route segment (LineString)
    MapView->>MapView: Read feature.properties fields
    MapView->>User: Tooltip shows Road Name + Road Type

    User->>MapView: Hover markers (start/end/nearest points)
    MapView->>MapView: Use marker lat/lng
    MapView->>User: Tooltip shows Latitude + Longitude

    User->>MapView: Hover blockage marker
    MapView->>MapView: Read blockage properties (name/radius/desc)
    MapView->>User: Tooltip shows blockage details
```

**Explanation:**
Tooltips come from GeoJSON properties (for route segments and blockages) and from marker coordinates (for points).

---

### 6. Replace Previous Route

```mermaid
sequenceDiagram
    participant User
    participant App
    participant MapView
    participant RoutingAPI as Routing API

    User->>App: Click "Search route" again
    App->>App: setRouteGeoJson(null) / clear old state
    App->>MapView: Remove old route layer
    App->>RoutingAPI: POST /route { startPt, endPt }
    RoutingAPI-->>App: 200 OK + new GeoJSON
    App->>App: setRouteGeoJson(newGeoJson)
    App->>MapView: Render only the latest route
```

**Explanation:**
Only one route is shown at any time. Starting a new search clears the previous route before drawing the new one.

---

### 7. Reverse Route

```mermaid
sequenceDiagram
    participant User
    participant App

    User->>App: Click "Reverse"
    App->>App: Swap start and end state
    App->>User: Toast "Start and end points reversed"
    User->>App: Click "Search route"
    App->>App: Route search proceeds using swapped points
```

**Explanation:**
Reverse swaps start/end values. The user can immediately search again to get the opposite direction.

---

### 8. Automatic Map Focus

```mermaid
sequenceDiagram
    participant App
    participant MapView

    alt Focus after route search
        App->>MapView: routeGeoJson updated
        MapView->>MapView: Compute route bounds from GeoJSON
        MapView->>MapView: Fit bounds with padding
        MapView->>MapView: Apply inset-aware centring if sidebar expanded
        MapView->>User: Full route visible without manual pan/zoom
    else Focus after selecting blockage
        App->>MapView: focusTarget updated (lat/lng/zoom)
        MapView->>MapView: setView(lat,lng,zoom)
        MapView->>MapView: Apply inset-aware pan if sidebar expanded
        MapView->>User: Blockage is centred in visible map area
    end
```

**Explanation:**
The map auto-focuses for both route results and blockage selection. When the sidebar is expanded, the focus is adjusted so the target does not sit under the sidebar.

---

### 9. Select Transport Mode

```mermaid
sequenceDiagram
    participant User
    participant App
    participant RoutingAPI as Routing API

    User->>App: Select mode (Car/Cycle/Walk)
    App->>App: setRouteTransportMode(mode)
    App->>App: Derive allowed road types for mode
    App->>RoutingAPI: POST /changeValidRoadTypes [types...]
    RoutingAPI-->>App: 200 OK + updated list OR error

    alt Error updating
        App->>User: Show warning toast
    else Success
        App->>User: Mode applied (next route uses updated constraints)
    end
```

**Explanation:**
Changing transport mode updates which road types the backend uses for routing.

---

### 10. View Road Types Overlay

```mermaid
sequenceDiagram
    participant User
    participant App
    participant MapView
    participant RoutingAPI as Routing API

    User->>App: Open Road Types tab
    App->>RoutingAPI: GET /allAxisTypes
    RoutingAPI-->>App: List of axis types

    User->>App: Toggle one or more road types
    App->>RoutingAPI: GET /axisType/{type} (per selected type)
    RoutingAPI-->>App: GeoJSON for that type
    App->>MapView: axisTypeGeoJson updated
    MapView->>User: Road overlay lines appear on map
```

**Explanation:**
Road-type overlays are rendered as Leaflet GeoJSON layers and can be toggled without affecting the route.

---

### 11. Manage Blockages

```mermaid
sequenceDiagram
    participant User
    participant App
    participant MapView
    participant RoutingAPI as Routing API

    User->>App: Click "Refresh" blockages
    App->>RoutingAPI: GET /blockage
    RoutingAPI-->>App: Blockage GeoJSON
    App->>MapView: blockageGeoJson updated
    MapView->>User: Blockage markers + radius circles rendered

    User->>App: Add blockage (form + optional pick on map)
    App->>RoutingAPI: POST /blockage { point, radius, name, description }
    RoutingAPI-->>App: 200 OK
    App->>RoutingAPI: GET /blockage
    RoutingAPI-->>App: Updated blockage GeoJSON
    App->>MapView: Render updated blockages
    App->>App: Schedule auto reroute

    User->>App: Delete blockage
    App->>RoutingAPI: DELETE /blockage/{name}
    RoutingAPI-->>App: 200 OK
    App->>App: Refresh blockages + schedule auto reroute

    User->>App: Click blockage in list
    App->>MapView: focusTarget updated
    MapView->>User: Map centres on blockage (inset-aware)
```

**Explanation:**
Blockages can be refreshed, added, deleted, and focused. Adding/deleting triggers rerouting behaviour in the app and refreshes the overlays.

---

### 12. Toggle Simple Map Style

```mermaid
sequenceDiagram
    participant User
    participant App
    participant MapView

    User->>App: Toggle basemap (Default/Simple)
    App->>App: setMapStyle("default" | "simple")
    App->>MapView: mapStyle prop updated
    MapView->>MapView: tileLayer.setUrl(newUrl)
    MapView->>User: Basemap updates without clearing overlays
```

**Explanation:**
Basemap style toggles by swapping tile URLs. Route, blockages, and overlays remain intact.

---

### 13. Collapse / Expand Sidebar

```mermaid
sequenceDiagram
    participant User
    participant App
    participant MapView

    User->>App: Click collapse button
    App->>App: setSidebarCollapsed(true)
    App->>User: Sidebar becomes compact rail

    User->>App: Click open button
    App->>App: setSidebarCollapsed(false)
    App->>User: Sidebar expands to full panel

    Note over App,MapView: Map focusing logic reads sidebar state
    App->>MapView: leftInsetPx changes
    MapView->>MapView: Apply inset-aware pan adjustment
    MapView->>User: Route/blockage focus remains centred in visible map area
```

**Explanation:**
The sidebar can collapse and expand. When it changes width, map focus logic uses the inset to keep important content centred in the visible region.

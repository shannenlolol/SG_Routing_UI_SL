# User Stories


## Summary Table

| No. | User Story                         | As a... | I want to...                                                                | So that...                                                   |
| --- | ---------------------------------- | ------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Check Server Readiness             | user    | see whether the backend is warming up or ready, and refresh the status      | I know when routing and other features can be used           |
| 2   | Define Start and End Points        | user    | set start and end points by typing coordinates or picking on the map        | a route can be computed between two locations                |
| 3   | Search for Route                   | user    | request the shortest route between my start and end points                  | the best route can be displayed on the map                   |
| 4   | View Route on Map                  | user    | view the returned route on an interactive map                               | the path can be visualised clearly                           |
| 5   | View Route Details                 | user    | hover over route segments and points to see details                         | road and coordinate information can be understood easily     |
| 6   | Replace Previous Route             | user    | have the current route cleared and replaced when I search again             | only the latest route is shown and the map stays uncluttered |
| 7   | Reverse Route                      | user    | reverse (swap) the start and end points                                     | I can quickly plan the opposite direction                    |
| 8   | Automatic Map Focus                | user    | have the map automatically focus on the searched route or selected blockage | the relevant area is visible without manual panning/zooming  |
| 9   | Select Transport Mode              | user    | choose a transport mode (car/cycle/walk)                                    | the route uses suitable road types for my travel method      |
| 10  | View Road Types Overlay            | user    | toggle road-type layers on the map                                          | I can explore different road network types visually          |
| 11  | Manage Blockages                   | user    | view, add, delete, and focus on blockages                                   | routing can avoid blocked regions and testing is easier      |
| 12  | Toggle Simple Map Style            | user    | toggle between a normal and a simpler basemap                               | a more readable map view can be chosen when needed           |
| 13  | Collapse / Expand Sidebar          | user    | collapse the sidebar into a compact rail and reopen it                      | more map space is available when needed                      |

---

## 1. Check Server Readiness

**User Story**
*As a user, I want to see whether the backend is warming up or ready, and refresh the status so that I know when routing and other features can be used.*

**Acceptance Criteria**

* The system shall display the current server status (e.g., **Warming up** / **Ready** / **Error**).
* The system shall provide a refresh control that triggers a new readiness check.
* When the server is not ready, server-dependent actions (e.g., routing search, adding blockages) shall display an error.

---

## 2. Define Start and End Points

**User Story**
*As a user, I want to set start and end points by typing coordinates or picking on the map so that a route can be computed between two locations.*

**Acceptance Criteria**

* The system shall provide inputs for **Start** and **End** coordinates (latitude and longitude).
* The system shall allow points to be set by **map click** when a “Pick start” or “Pick end” mode is active.
* When a point is picked, the system shall populate the corresponding input fields and show a confirmation message.
* The system shall accept optional descriptions for points (if supported in the UI).

---

## 3. Search for Route

**User Story**
*As a user, I want to request the shortest route between my start and end points so that the best route can be displayed on the map.*

**Acceptance Criteria**

* When the user triggers “Search Route”, the system shall validate that start and end coordinates are present and numeric.
* If validation fails, an inline error message shall be shown and the request shall not be sent.
* If validation passes, the system shall call the backend routing endpoint and load the returned GeoJSON route.
* If the server is not ready, route search shall be disabled or an appropriate message shall be shown.

---

## 4. View Route on Map

**User Story**
*As a user, I want to view the returned route on an interactive map so that the path can be visualised clearly.*

**Acceptance Criteria**

* The system shall render the returned route as a visible polyline overlay on the Leaflet map.
* The user shall be able to pan and zoom using standard map interactions and zoom controls.
* If no route is loaded, the map shall show only the basemap (and any enabled overlays such as road types/blockages).

---

## 5. View Route Details

**User Story**
*As a user, I want to hover over route segments and points to see details so that road and coordinate information can be understood easily.*

**Acceptance Criteria**

* When the user hovers over a **route segment** (line), the system shall display a tooltip showing at minimum:

  * **Road Name**
  * **Road Type**
* When the user hovers over a **point marker** (start/end/nearest start/nearest end), the system shall display a tooltip showing at minimum:

  * **Latitude**
  * **Longitude**
* When the user hovers over a **blockage marker**, the system shall display a tooltip showing blockage details (e.g., name and radius if available).
* Tooltips shall be non-blocking and disappear when the cursor moves away.

---

## 6. Replace Previous Route

**User Story**
*As a user, I want the previous route to be cleared and replaced when I search again so that only the latest route is shown and the map stays uncluttered.*

**Acceptance Criteria**

* When a new route search is triggered, the system shall clear the currently displayed route before rendering the new one.
* After the new route loads successfully, only the latest route shall be displayed.
* Any route-specific transient layers (e.g., old route segments/markers tied to the previous route) shall not remain on the map.

---

## 7. Reverse Route

**User Story**
*As a user, I want to reverse (swap) the start and end points so that I can quickly plan the opposite direction.*

**Acceptance Criteria**

* The system shall provide a reverse action (e.g., a “Reverse” button).
* Triggering reverse shall swap start and end coordinate values in the UI.
* After reversal, the user shall be able to run route search again using the swapped points.

---

## 8. Automatic Map Focus

**User Story**
*As a user, I want the map to automatically focus on the searched route or selected blockage so that the relevant area is visible without manual panning or zooming.*

**Acceptance Criteria**

* After a successful route search, the map shall automatically fit to the route’s bounds with padding so the full route is visible.
* When a blockage is selected from the list, the map shall centre/focus on that blockage location.
* When the sidebar is expanded, focusing/fit behaviour shall account for the visible map area.

---

## 9. Select Transport Mode

**User Story**
*As a user, I want to choose a transport mode (car/cycle/walk) so that the route uses suitable road types for my travel method.*

**Acceptance Criteria**

* The system shall provide a transport mode selector.
* Changing transport mode shall update the set of road types used for routing.
* Subsequent route searches shall use the updated transport mode road-type rules.

---

## 10. View Road Types Overlay

**User Story**
*As a user, I want to toggle road-type layers on the map so that I can explore different road network types visually.*

**Acceptance Criteria**

* The system shall list available road types for selection.
* The system shall allow multiple road types to be toggled on/off.
* Selecting a road type shall load and display its GeoJSON layer on the map.
* Toggling road types shall not remove the currently displayed route.

---

## 11. Manage Blockages

**User Story**
*As a user, I want to view, add, delete, and focus on blockages so that routing can avoid blocked regions and testing is easier.*

**Acceptance Criteria**

* The system shall allow refreshing the list of existing blockages.
* The system shall allow adding a blockage with:

  * latitude, longitude
  * radius (metres)
  * name
  * optional description
* The system shall allow setting blockage coordinates via map picking when “Pick blockage” mode is active.
* The system shall allow deleting a blockage.
* Selecting a blockage from the list shall focus the map on the blockage location.

---

## 12. Toggle Simple Map Style

**User Story**
*As a user, I want to toggle between a normal and a simpler basemap so that a more readable map view can be chosen when needed.*

**Acceptance Criteria**

* The system shall provide a map style toggle (e.g., **Default** / **Simple**).
* When set to Default, the map shall use the standard OpenStreetMap tile layer.
* When set to Simple, the map shall switch to a simplified basemap (e.g., a light Carto style).
* Toggling the basemap shall not clear the route, road-type overlays, or blockage layers.

---

## 13. Collapse / Expand Sidebar

**User Story**
*As a user, I want to collapse the sidebar into a compact rail and reopen it so that more map space is available when needed.*

**Acceptance Criteria**

* The system shall provide a control to collapse/expand the sidebar.
* When collapsed, the sidebar shall reduce into a compact rail that still allows access to the main tabs.
* When expanded, the full tab content shall be visible.
* Map focusing behaviour (route fit, blockage focus) shall reflect the sidebar state so content appears centred in the visible map area.


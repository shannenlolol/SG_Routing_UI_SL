# Software Interface Agreement

This document specifies the REST API endpoints used by the **SG Routing App** frontend. All endpoints are provided by the hosted routing backend services.

The frontend interacts with these endpoints via helper functions (e.g., `apiGet()`, `apiPost()` in `src/api/client`).

Base URLs (endpoints are hosted across these base URLs as provided):

```text
https://routing-web-service-ityenzhnyq-an.a.run.app
```

Mapped helper calls (typical usage):

* `checkServerReady()` → `GET /ready` 
* `fetchAllAxisTypes()` → `GET /allAxisTypes` 
* `fetchValidAxisTypes()` → `GET /validAxisTypes` 
* `fetchAxisTypeGeoJson(type)` → `GET /axisType/{type}` 
* `changeValidRoadTypes(types[])` → `POST /changeValidRoadTypes` 
* `fetchRoute(startPt, endPt)` → `POST /route` 
* `fetchBlockages()` → `GET /blockage` 
* `addBlockage(payload)` → `POST /blockage` 
* `deleteBlockage(name)` → `DELETE /blockage/{name}` 

---

## 1. API Endpoints Overview

| No. | Endpoint                | Method | Used By                         | Description                                        |
| --- | ----------------------- | ------ | ------------------------------- | -------------------------------------------------- |
| 1   | `/ready`                | GET    | `checkServerReady()`            | Check if the server is ready for requests          |
| 2   | `/allAxisTypes`         | GET    | `fetchAllAxisTypes()`           | Retrieve all available road types                  |
| 3   | `/validAxisTypes`       | GET    | `fetchValidAxisTypes()`         | Retrieve road types used by the routing algorithm  |
| 4   | `/axisType/{type}`      | GET    | `fetchAxisTypeGeoJson(type)`    | Retrieve GeoJSON for a selected road type          |
| 5   | `/changeValidRoadTypes` | POST   | `changeValidRoadTypes(types[])` | Update road types used by the routing algorithm    |
| 6   | `/route`                | POST   | `fetchRoute(startPt, endPt)`    | Get shortest route from start to end               |
| 7   | `/blockage`             | GET    | `fetchBlockages()`              | Retrieve all blockages as GeoJSON                  |
| 8   | `/blockage`             | POST   | `addBlockage(payload)`          | Add a new blockage (radius in metres)              |
| 9   | `/blockage/{name}`      | DELETE | `deleteBlockage(name)`          | Delete an existing blockage by name                |

---

## 2. Detailed API Specifications

### 2.1 Server Readiness

**Endpoint**

```text
GET /ready
```

**Description**
Checks whether the backend is ready to serve requests. The server may require a cold start and returns `"wait"` or `"ready"`. 

**Sample Request**

```http
GET https://routing-web-service-ityenzhnyq-an.a.run.app/ready
```

**200 Response (examples)**

```json
"ready"
```

```json
"wait"
```

---

### 2.2 Get All Road Types (Axis Types)

**Endpoint**

```text
GET /allAxisTypes
```

**Description**
Returns a JSON list of all available road/axis types. 

**Sample Request**

```http
GET https://routing-web-service-ityenzhnyq-an.a.run.app/allAxisTypes
```

**200 Response**

```json
[
    "bridleway",
    "construction",
    "corridor",
    "crossing",
    "cycleway",
    "elevator",
    "footway",
    "living_street",
    "motorway",
    "motorway_link",
    "path",
    "pedestrian",
    "primary",
    "primary_link",
    "proposed",
    "raceway",
    "residential",
    "road",
    "secondary",
    "secondary_link",
    "service",
    "steps",
    "tertiary",
    "tertiary_link",
    "track",
    "trunk",
    "trunk_link",
    "unclassified"
]
```

---

### 2.3 Get Valid Road Types Used by Routing Algorithm

**Endpoint**

```text
GET /validAxisTypes
```

**Description**
Returns the list of road types currently used by the routing algorithm. 

**Sample Request**

```http
GET https://routing-web-service-ityenzhnyq-an.a.run.app/validAxisTypes
```

**200 Response (example from API description)**

```json
[
  "tertiary_link",
  "tertiary",
  "secondary_link",
  "primary_link",
  "primary",
  "motorway_link",
  "secondary",
  "motorway"
]
```

---

### 2.4 Get GeoJSON for a Selected Road Type

**Endpoint**

```text
GET /axisType/{type}
```

**Description**
Returns GeoJSON data for the requested road type (replace `{type}` with a valid axis type such as `motorway`, `primary`, `secondary`). 

**Path Parameters**

| Parameter | Type   | Required | Description                               |
| --------: | ------ | -------- | ----------------------------------------- |
|    `type` | string | Yes      | Road type / axis type (e.g., `motorway`)  |

**Sample Request**

```http
GET https://routing-web-service-ityenzhnyq-an.a.run.app/axisType/motorway
```

**200 Response**
Truncated GeoJSON (FeatureCollection) for rendering as a Leaflet GeoJSON layer. 

```json
{
    "axis_type": "motorway",
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [
                        103.897400,
                        1.297156
                    ],
                    [
                        103.898384,
                        1.297519
                    ]
                ]
            },
            "properties": {
                "road name": "East Coast Parkway",
                "road type": "motorway",
                "distance": 116
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [
                        103.877312,
                        1.282685
                    ],
                    [
                        103.876968,
                        1.282420
                    ],
                    [
                        103.876884,
                        1.282366
                    ],
                    [
                        103.876587,
                        1.282127
                    ],
                    [
                        103.876221,
                        1.281851
                    ],
                    [
                        103.873253,
                        1.279668
                    ],
                    [
                        103.872475,
                        1.279111
                    ]
                ]
            },
            "properties": {
                "road name": "Marina Coastal Expressway",
                "road type": "motorway",
                "distance": 666
            }
        },
...
    ]
}
```
---

### 2.5 Change Valid Road Types Used by Routing Algorithm

**Endpoint**

```text
POST /changeValidRoadTypes
```

**Description**
Updates the road types used by the routing algorithm. The request body is a JSON array of selected road types, and the endpoint returns the updated list. 

**Request Body (example)**

```json
[
  "primary",
  "secondary",
  "tertiary",
  "trunk",
  "primary_link",
  "secondary_link",
  "tertiary_link",
  "truck_link"
]
```

**Sample Request**

```http
POST https://routing-web-service-ityenzhnyq-an.a.run.app/changeValidRoadTypes
Content-Type: application/json
```

**200 Response**
JSON list of road types used by the routing algorithm. 

---

### 2.6 Get Shortest Route from Start Point to End Point

**Endpoint**

```text
POST /route
```

**Description**
Returns the shortest route from a start point to an end point. The request body contains `startPt` and `endPt` (longitude, latitude, and optional description). 

**Request Body**

```json
{
  "startPt": {
    "long": 103.93443316267717,
    "lat": 1.323996524195518,
    "description": "Bedok 85"
  },
  "endPt": {
    "long": 103.75741069280338,
    "lat": 1.3783396904609801,
    "description": "Choa Chu Kang Road"
  }
}
```

**Sample Request**

```http
POST https://routing-web-service-ityenzhnyq-an.a.run.app/route
Content-Type: application/json
```

**200 Response**
GeoJSON suitable for rendering as the route layer in the map. 

---

### 2.7 Get All Blockages

**Endpoint**

```text
GET /blockage
```

**Description**
Returns all blockages from the server as GeoJSON. 

**Sample Request**

```http
GET https://routing-web-service-ityenzhnyq-an.a.run.app/blockage
```

**200 Response**
GeoJSON (FeatureCollection) containing blockage point features (and associated properties such as name and radius/distance fields). 

```json
{
    "items": "blockages",
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    103.934433,
                    1.323997
                ]
            },
            "properties": {
                "name": "testing blockage 1",
                "description": "description 1",
                "distance (meters)": 200
            }
        }
    ]
}
```

---

### 2.8 Add a New Blockage

**Endpoint**

```text
POST /blockage
```

**Description**
Adds a new blockage. The request body includes a `point` (longitude, latitude), `radius` in metres, `name`, and an optional `description`. 

**Request Body**

```json
{
  "point": {
    "long": 103.93443316267717,
    "lat": 1.323996524195518
  },
  "radius": 200,
  "name": "testing blockage 1",
  "description": "description 1"
}
```

**Sample Request**

```http
POST https://routing-web-service-ityenzhnyq-an.a.run.app/blockage
Content-Type: application/json
```

**Success Criteria**

* A successful request shall return HTTP 200 (or other success status as implemented by the backend). 

---

### 2.9 Delete an Existing Blockage

**Endpoint**

```text
DELETE /blockage/{name}
```

**Description**
Deletes an existing blockage by its name (replace `{name}` with the blockage name). 

**Path Parameters**

| Parameter | Type   | Required | Description                     |
| --------: | ------ | -------- | ------------------------------- |
|    `name` | string | Yes      | Name of the blockage to delete  |

**Sample Request**

```http
DELETE https://routing-web-service-ityenzhnyq-an.a.run.app/blockage/testing%20blockage%201
```

**Success Criteria**

* A successful request shall return HTTP 200 and the GeoJSON containing exisiting blockages.

```json
{
    "items": "blockages",
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    103.934433,
                    1.323997
                ]
            },
            "properties": {
                "name": "testing blockage 1",
                "description": "description 1",
                "distance (meters)": 200
            }
        }
    ]
}
```
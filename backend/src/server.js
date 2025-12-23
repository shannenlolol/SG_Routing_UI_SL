import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const port = Number(process.env.PORT || 3001);

const corsOrigin = process.env.CORS_ORIGIN || "*";

app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin,
    credentials: false,
  })
);

app.use(express.json({ limit: "2mb" }));

const ROUTING_BASE_URL = (process.env.ROUTING_BASE_URL || "").trim();

const PATH_READY = process.env.PATH_READY || "/ready";
const PATH_VALID_AXIS_TYPES = process.env.PATH_VALID_AXIS_TYPES || "/validAxisTypes";
const PATH_AXIS_TYPE = process.env.PATH_AXIS_TYPE || "/axisType";
const PATH_ROUTE = process.env.PATH_ROUTE || "/route";
const PATH_BLOCKAGE = process.env.PATH_BLOCKAGE || "/blockage";
const PATH_ALL_AXIS_TYPES = process.env.PATH_ALL_AXIS_TYPES || "/allAxisTypes";
const PATH_CHANGE_VALID_ROAD_TYPES =
  process.env.PATH_CHANGE_VALID_ROAD_TYPES || "/changeValidRoadTypes";

function mustHaveBaseUrl(baseUrl, label) {
  if (!baseUrl) {
    const err = new Error(`${label} is not set. Configure it in backend/.env`);
    err.statusCode = 500;
    throw err;
  }
}

async function forwardJson(req, res, { url, method }) {
  const headers = {
    "Accept": "application/json, text/plain, */*",
  };

  let body;
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(req.body ?? {});
  }

  const upstream = await fetch(url, {
    method,
    headers,
    body,
  });

  const contentType = upstream.headers.get("content-type") || "";
  const status = upstream.status;

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return res.status(status).json({
      error: "Upstream request failed",
      status,
      url,
      details: text,
    });
  }

  if (contentType.includes("application/json") || contentType.includes("geo+json")) {
    const data = await upstream.json();
    return res.status(status).json(data);
  }

  // Some endpoints may return plain text like "wait" / "ready"
  const text = await upstream.text();
  res.status(status).type("text/plain").send(text);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Readiness
app.get("/api/ready", async (req, res) => {
  try {
    mustHaveBaseUrl(ROUTING_BASE_URL, "ROUTING_BASE_URL");
    const url = `${ROUTING_BASE_URL}${PATH_READY}`;
    await forwardJson(req, res, { url, method: "GET" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Unknown error" });
  }
});

// Axis types
app.get("/api/allAxisTypes", async (req, res) => {
  try {
    mustHaveBaseUrl(ROUTING_BASE_URL, "ROUTING_BASE_URL");
    const url = `${ROUTING_BASE_URL}${PATH_ALL_AXIS_TYPES}`;
    await forwardJson(req, res, { url, method: "GET" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Unknown error" });
  }
});

app.get("/api/validAxisTypes", async (req, res) => {
  try {
    mustHaveBaseUrl(ROUTING_BASE_URL, "ROUTING_BASE_URL");
    const url = `${ROUTING_BASE_URL}${PATH_VALID_AXIS_TYPES}`;
    await forwardJson(req, res, { url, method: "GET" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Unknown error" });
  }
});

app.get("/api/axisType/:type", async (req, res) => {
  try {
    mustHaveBaseUrl(ROUTING_BASE_URL, "ROUTING_BASE_URL");
    const type = encodeURIComponent(req.params.type);
    const url = `${ROUTING_BASE_URL}${PATH_AXIS_TYPE}/${type}`;
    await forwardJson(req, res, { url, method: "GET" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Unknown error" });
  }
});

app.post("/api/changeValidRoadTypes", async (req, res) => {
  try {
    mustHaveBaseUrl(ROUTING_BASE_URL, "ROUTING_BASE_URL");
    const url = `${ROUTING_BASE_URL}${PATH_CHANGE_VALID_ROAD_TYPES}`;
    await forwardJson(req, res, { url, method: "POST" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Unknown error" });
  }
});

// Route
app.post("/api/route", async (req, res) => {
  try {
    mustHaveBaseUrl(ROUTING_BASE_URL, "ROUTING_BASE_URL");
    const url = `${ROUTING_BASE_URL}${PATH_ROUTE}`;
    await forwardJson(req, res, { url, method: "POST" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Unknown error" });
  }
});

// Blockage
app.get("/api/blockage", async (req, res) => {
  try {
    mustHaveBaseUrl(ROUTING_BASE_URL, "ROUTING_BASE_URL");
    const url = `${ROUTING_BASE_URL}${PATH_BLOCKAGE}`;
    await forwardJson(req, res, { url, method: "GET" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Unknown error" });
  }
});

app.post("/api/blockage", async (req, res) => {
  try {
    mustHaveBaseUrl(ROUTING_BASE_URL, "ROUTING_BASE_URL");
    const url = `${ROUTING_BASE_URL}${PATH_BLOCKAGE}`;
    await forwardJson(req, res, { url, method: "POST" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Unknown error" });
  }
});

app.delete("/api/blockage/:name", async (req, res) => {
  try {
    mustHaveBaseUrl(ROUTING_BASE_URL, "ROUTING_BASE_URL");
    const name = encodeURIComponent(req.params.name);
    const url = `${ROUTING_BASE_URL}${PATH_BLOCKAGE}/${name}`;

    const upstream = await fetch(url, { method: "DELETE" });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return res.status(upstream.status).json({
        error: "Upstream request failed",
        status: upstream.status,
        url,
        details: text,
      });
    }
    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await upstream.json();
      return res.json(data);
    }
    const text = await upstream.text().catch(() => "deleted");
    return res.type("text/plain").send(text);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Unknown error" });
  }
});

app.listen(port, () => {
  console.log(`sg-routing-proxy listening on http://localhost:${port}`);
});

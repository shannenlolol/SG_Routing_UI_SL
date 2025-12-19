const API_BASE = "http://localhost:3001/api";

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json") || contentType.includes("geo+json")) {
    return await response.json();
  }
  return await response.text();
}

export async function apiGet(path) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json, text/plain, */*" },
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const message = typeof data === "string" ? data : (data && data.error) || "Request failed";
    throw new Error(message);
  }

  return data;
}

export async function apiPost(path, body) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const message = typeof data === "string" ? data : (data && data.error) || "Request failed";
    throw new Error(message);
  }

  return data;
}

export async function apiDelete(path) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { "Accept": "application/json, text/plain, */*" },
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const message = typeof data === "string" ? data : (data && data.error) || "Request failed";
    throw new Error(message);
  }

  return data;
}

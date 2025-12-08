// src/api.js
export async function api(path, opts = {}) {
  const base = process.env.REACT_APP_API_BASE || "http://localhost:5010/api";
  const token = localStorage.getItem("token");
  const headers = Object.assign({}, opts.headers || {}, {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const res = await fetch(base + path, { ...opts, headers });
  if (res.status === 401) {
    // redirect to login
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "API error");
  return json;
}

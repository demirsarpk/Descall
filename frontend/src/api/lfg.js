import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";

const BASE = `${API_BASE_URL}/lfg`;

function getHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parse(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "LFG request failed");
  return body;
}

export async function getLfgMeta() {
  const res = await fetch(`${BASE}/meta`, { headers: getHeaders() });
  return parse(res);
}

export async function listLfgLobbies(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const res = await fetch(`${BASE}/lobbies?${qs}`, { headers: getHeaders() });
  return parse(res);
}

export async function getLfgLobby(id) {
  const res = await fetch(`${BASE}/lobbies/${encodeURIComponent(id)}`, {
    headers: getHeaders(),
  });
  return parse(res);
}

export async function createLfgLobby(payload) {
  const res = await fetch(`${BASE}/lobbies`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return parse(res);
}

export async function joinLfgLobby(id, payload) {
  const res = await fetch(`${BASE}/lobbies/${encodeURIComponent(id)}/join`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return parse(res);
}

export async function leaveLfgLobby(id) {
  const res = await fetch(`${BASE}/lobbies/${encodeURIComponent(id)}/leave`, {
    method: "POST",
    headers: getHeaders(),
  });
  return parse(res);
}

export async function updateLfgLobby(id, payload) {
  const res = await fetch(`${BASE}/lobbies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return parse(res);
}

export async function reportLfg(payload) {
  const res = await fetch(`${BASE}/reports`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return parse(res);
}

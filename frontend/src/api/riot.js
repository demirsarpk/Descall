import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";

const BASE = `${API_BASE_URL}/riot`;

function getHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parse(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Riot request failed");
  return body;
}

export async function getRiotStatus() {
  const res = await fetch(`${BASE}/status`, { headers: getHeaders() });
  return parse(res);
}

export async function getUserValorant(userId) {
  const res = await fetch(`${BASE}/users/${encodeURIComponent(userId)}`, {
    headers: getHeaders(),
  });
  return parse(res);
}

export async function linkRiotId({ riotId, region = "eu" }) {
  const res = await fetch(`${BASE}/link`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ riotId, region }),
  });
  return parse(res);
}

export async function refreshRiotRank() {
  const res = await fetch(`${BASE}/refresh`, {
    method: "POST",
    headers: getHeaders(),
  });
  return parse(res);
}

export async function unlinkRiot() {
  const res = await fetch(`${BASE}/link`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return parse(res);
}

export async function startRiotOAuth() {
  const res = await fetch(`${BASE}/oauth/start`, { headers: getHeaders() });
  return parse(res);
}

import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";

async function serversRequest(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code || null;
    err.body = data;
    throw err;
  }
  return data;
}

/** List servers the current user belongs to. */
export function getMyServers() {
  return serversRequest("/api/servers/my");
}

/** Create a server (max 10 owned). */
export function createServer({ name, iconUrl, description } = {}) {
  return serversRequest("/api/servers", {
    method: "POST",
    body: { name, iconUrl, description },
  });
}

export function getServer(serverId) {
  return serversRequest(`/api/servers/${serverId}`);
}

/** Owner delete — confirmName must match server name. */
export function deleteServer(serverId, confirmName) {
  return serversRequest(`/api/servers/${serverId}`, {
    method: "DELETE",
    body: { confirmName },
  });
}

/**
 * Leave server. If owner, deletes the server (confirmName required).
 */
export function leaveServer(serverId, confirmName) {
  return serversRequest(`/api/servers/${serverId}/leave`, {
    method: "POST",
    body: confirmName ? { confirmName } : {},
  });
}

export function getServerMembers(serverId) {
  return serversRequest(`/api/servers/${serverId}/members`);
}

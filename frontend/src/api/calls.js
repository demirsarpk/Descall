import { httpRequest } from "./http";
import { getToken } from "../lib/storage";

export async function fetchCallHistory({ limit = 50 } = {}) {
  const token = getToken();
  if (!token) return { calls: [] };
  return httpRequest(`/api/calls?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

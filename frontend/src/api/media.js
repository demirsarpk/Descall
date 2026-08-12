import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";

export async function uploadFile(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Upload failed");
  return body;
}

export async function uploadAvatar(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(`${API_BASE_URL}/api/media/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Avatar upload failed");
  return body;
}

export function getMediaUrl(relativePath) {
  if (!relativePath) return null;
  if (relativePath.startsWith("http")) return relativePath;
  return `${API_BASE_URL}${relativePath}`;
}

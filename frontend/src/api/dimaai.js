import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";
import { authedRequest } from "./authedHttp";

export function getDimaMeta() {
  return authedRequest("/api/dimaai/meta");
}

export function listDimaConversations() {
  return authedRequest("/api/dimaai/conversations");
}

export function createDimaConversation(title) {
  return authedRequest("/api/dimaai/conversations", {
    method: "POST",
    body: { title: title || "New chat" },
  });
}

export function getDimaConversation(id) {
  return authedRequest(`/api/dimaai/conversations/${encodeURIComponent(id)}`);
}

export function deleteDimaConversation(id) {
  return authedRequest(`/api/dimaai/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * Stream a Dima reply. Calls onToken for each chunk.
 * Returns the final assistant message or throws a user-safe error.
 */
export async function streamDimaMessage({
  conversationId,
  content,
  regenerate = false,
  signal,
  onToken,
  onMeta,
}) {
  const token = getToken();
  const res = await fetch(
    `${API_BASE_URL}/api/dimaai/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content, regenerate }),
      signal,
    },
  );

  const ctype = res.headers.get("content-type") || "";
  if (!res.ok && !ctype.includes("text/event-stream")) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Dima is temporarily unavailable. Please try again shortly.");
  }

  if (!res.body) {
    throw new Error("Dima is temporarily unavailable. Please try again shortly.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let assembled = "";
  let doneMessage = null;
  let streamError = null;

  const consumeBlock = (block) => {
    const lines = block.split("\n");
    let event = "message";
    let dataLine = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLine += line.slice(5).trim();
    }
    if (!dataLine) return;
    let payload = {};
    try {
      payload = JSON.parse(dataLine);
    } catch {
      return;
    }
    if (event === "token" && payload.t) {
      assembled += payload.t;
      onToken?.(payload.t, assembled);
    } else if (event === "meta") {
      onMeta?.(payload);
    } else if (event === "done") {
      doneMessage = payload.message || { role: "assistant", content: assembled };
    } else if (event === "error") {
      streamError = payload.error || "Dima is temporarily unavailable. Please try again shortly.";
    } else if (event === "stopped") {
      doneMessage = assembled
        ? { role: "assistant", content: assembled, stopped: true }
        : { stopped: true };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const part of parts) consumeBlock(part);
  }
  if (buf.trim()) consumeBlock(buf);

  if (streamError) throw new Error(streamError);
  const final = doneMessage || { role: "assistant", content: assembled };
  if (!final.stopped && !String(final.content || assembled || "").trim()) {
    throw new Error("Dima is temporarily unavailable. Please try again shortly.");
  }
  return final;
}

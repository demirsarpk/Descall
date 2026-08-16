"use strict";

const { logInternal, sanitizeProviderText } = require("./sanitize");

/** Internal model id — never returned to clients. */
const INTERNAL_MODEL = process.env.DIMA_INTERNAL_MODEL || "gemini-2.0-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_INSTRUCTION = [
  "You are Dima 1.0, the AI assistant inside Descall (product name: DimaAI).",
  "Be helpful, concise, and clear. Use Markdown when it improves readability.",
  "Never mention underlying model providers, APIs, model IDs, or hosting vendors.",
  "If asked what model you are, say you are Dima 1.0, Descall's AI assistant.",
  "Do not claim you were trained from scratch by Descall.",
].join(" ");

function toGeminiContents(messages) {
  return (messages || [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content) }],
    }));
}

function extractText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => p?.text || "").join("");
}

function classifyHttpStatus(status) {
  if (status === 429) return "quota";
  if (status === 401 || status === 403) return "auth";
  if (status === 400 || status === 404) return "request";
  if (status >= 500 || status === 408) return "unavailable";
  return "error";
}

async function readSseStream(res, { onToken, signal }) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  while (true) {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch { /* ignore */ }
      const err = new Error("aborted");
      err.code = "aborted";
      throw err;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split("\n\n");
    buf = blocks.pop() || "";
    for (const block of blocks) {
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const piece = extractText(json);
        if (piece) {
          full += piece;
          onToken?.(piece);
        }
      } catch {
        /* ignore partial json */
      }
    }
  }
  return full;
}

async function complete({ apiKey, messages, signal, onToken }) {
  const url = `${BASE}/${INTERNAL_MODEL}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError" || signal?.aborted) {
      const aborted = new Error("aborted");
      aborted.code = "aborted";
      throw aborted;
    }
    const wrapped = new Error("provider_unavailable");
    wrapped.code = "unavailable";
    wrapped.causeStatus = 503;
    logInternal("gemini-network", err);
    throw wrapped;
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    const kind = classifyHttpStatus(res.status);
    const err = new Error(kind);
    err.code = kind;
    err.causeStatus = res.status;
    logInternal("gemini-http", { message: sanitizeProviderText(raw).slice(0, 180) }, { status: res.status });
    throw err;
  }

  const text = await readSseStream(res, { onToken, signal });
  return { text: text || "" };
}

async function pingKey(apiKey, signal) {
  const url = `${BASE}/${INTERNAL_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }],
      generationConfig: { maxOutputTokens: 8, temperature: 0 },
    }),
    signal,
  });
  if (!res.ok) {
    const kind = classifyHttpStatus(res.status);
    const err = new Error(kind);
    err.code = kind;
    err.causeStatus = res.status;
    throw err;
  }
  const json = await res.json();
  const text = extractText(json);
  return { ok: true, preview: Boolean(text) };
}

module.exports = {
  id: "primary",
  complete,
  pingKey,
  classifyHttpStatus,
};

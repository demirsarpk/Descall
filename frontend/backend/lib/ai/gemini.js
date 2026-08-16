"use strict";

const { logInternal, sanitizeProviderText } = require("./sanitize");

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Retired June 2026 — kept only so env overrides that still point here can 404-fallback. */
const SHUTDOWN_DEFAULT = "gemini-2.0-flash";

function modelCandidates() {
  const env = String(process.env.DIMA_INTERNAL_MODEL || "").trim();
  const fallbacks = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"];
  const out = [];
  if (env && env !== SHUTDOWN_DEFAULT) out.push(env);
  for (const id of fallbacks) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

let stickyModel = null;

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
  return parts
    .filter((p) => p && p.thought !== true)
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");
}

function thinkingConfigFor(model) {
  const id = String(model || "").toLowerCase();
  if (id.includes("gemini-3")) return { thinkingLevel: "minimal" };
  if (id.includes("gemini-2.5")) return { thinkingBudget: 0 };
  return null;
}

function generationConfigFor(model, maxOutputTokens = 16384) {
  const cfg = { temperature: 0.7, maxOutputTokens };
  const thinkingConfig = thinkingConfigFor(model);
  if (thinkingConfig) cfg.thinkingConfig = thinkingConfig;
  return cfg;
}

function classifyHttpStatus(status) {
  if (status === 429) return "quota";
  if (status === 401 || status === 403) return "auth";
  if (status === 400 || status === 404) return "request";
  if (status >= 500 || status === 408) return "unavailable";
  return "error";
}

function httpError(status, raw) {
  const kind = classifyHttpStatus(status);
  const err = new Error(kind);
  err.code = kind;
  err.causeStatus = status;
  logInternal("gemini-http", { message: sanitizeProviderText(raw).slice(0, 180) }, { status });
  return err;
}

async function withModelFallback(run) {
  const preferred = stickyModel && modelCandidates().includes(stickyModel) ? stickyModel : null;
  const models = preferred
    ? [preferred, ...modelCandidates().filter((id) => id !== preferred)]
    : modelCandidates();
  let lastErr = null;
  for (const model of models) {
    try {
      const result = await run(model);
      stickyModel = model;
      return result;
    } catch (err) {
      lastErr = err;
      if (err?.causeStatus === 404) {
        if (stickyModel === model) stickyModel = null;
        continue;
      }
      throw err;
    }
  }
  throw lastErr || Object.assign(new Error("unavailable"), { code: "unavailable", causeStatus: 503 });
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

function requestBody(messages, generationConfig) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: toGeminiContents(messages),
    generationConfig,
  };
}

async function postGemini({ model, stream, apiKey, messages, signal, generationConfig }) {
  const path = stream
    ? `${BASE}/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
    : `${BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let res;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(messages, generationConfig)),
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
    throw httpError(res.status, raw);
  }
  return res;
}

async function complete({ apiKey, messages, signal, onToken }) {
  return withModelFallback(async (model) => {
    const withThinking = generationConfigFor(model);
    const withoutThinking = { temperature: 0.7, maxOutputTokens: 16384 };

    const streamOnce = async (cfg) => {
      const res = await postGemini({
        model,
        stream: true,
        apiKey,
        messages,
        signal,
        generationConfig: cfg,
      });
      return readSseStream(res, { onToken, signal });
    };

    const unaryOnce = async (cfg) => {
      const res = await postGemini({
        model,
        stream: false,
        apiKey,
        messages,
        signal,
        generationConfig: cfg,
      });
      const json = await res.json().catch(() => ({}));
      return extractText(json);
    };

    let text = "";
    try {
      text = await streamOnce(withThinking);
    } catch (err) {
      if (err?.causeStatus === 400 && withThinking.thinkingConfig) {
        text = await streamOnce(withoutThinking);
      } else {
        throw err;
      }
    }

    if (!String(text).trim()) {
      try {
        text = await unaryOnce(withThinking);
      } catch (err) {
        if (err?.causeStatus === 400 && withThinking.thinkingConfig) {
          text = await unaryOnce(withoutThinking);
        } else if (err?.code === "aborted") {
          throw err;
        }
      }
      if (String(text).trim()) onToken?.(text);
    }

    if (!String(text).trim()) {
      const empty = new Error("empty_reply");
      empty.code = "unavailable";
      empty.causeStatus = 503;
      throw empty;
    }
    return { text };
  });
}

async function pingKey(apiKey, signal) {
  return withModelFallback(async (model) => {
    const withThinking = { ...generationConfigFor(model, 32), temperature: 0 };
    const withoutThinking = { maxOutputTokens: 32, temperature: 0 };
    const tryPing = async (generationConfig) => {
      const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }],
          generationConfig,
        }),
        signal,
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw httpError(res.status, raw);
      }
      return res.json();
    };

    let json;
    try {
      json = await tryPing(withThinking);
    } catch (err) {
      if (err?.causeStatus === 400 && withThinking.thinkingConfig) {
        json = await tryPing(withoutThinking);
      } else {
        throw err;
      }
    }
    const text = extractText(json);
    return { ok: true, preview: Boolean(text) };
  });
}

module.exports = {
  id: "primary",
  complete,
  pingKey,
  classifyHttpStatus,
  modelCandidates,
  extractText,
  thinkingConfigFor,
};

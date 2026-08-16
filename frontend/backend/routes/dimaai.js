"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");
const conversations = require("../lib/ai/conversations");
const { completeWithFailover } = require("../lib/ai/provider-manager");
const { PUBLIC_ASSISTANT_NAME, PUBLIC_PRODUCT_NAME } = require("../lib/ai/provider");
const {
  assertMessage,
  allowUser,
  allowIp,
} = require("../lib/ai/rateLimit");
const {
  USER_UNAVAILABLE,
  USER_GENERIC,
  USER_RATE,
  USER_TOO_LONG,
  publicErrorForStatus,
  logInternal,
} = require("../lib/ai/sanitize");

const router = express.Router();
router.use(requireAuth);

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function publicFail(res, err) {
  if (err?.code === "too_long") return res.status(400).json({ error: USER_TOO_LONG });
  if (err?.code === "empty") return res.status(400).json({ error: "Please enter a message." });
  if (err?.code === "quota") return res.status(429).json({ error: USER_RATE });
  if (err?.code === "no_keys" || err?.code === "unavailable" || err?.code === "auth") {
    return res.status(503).json({ error: USER_UNAVAILABLE });
  }
  logInternal("api", err);
  return res.status(500).json({ error: USER_GENERIC });
}

router.get("/meta", (_req, res) => {
  res.json({
    product: PUBLIC_PRODUCT_NAME,
    assistant: PUBLIC_ASSISTANT_NAME,
    tagline: "Your AI assistant inside Descall.",
  });
});

router.get("/conversations", async (req, res) => {
  try {
    const items = await conversations.listConversations(req.user.id);
    res.json({ conversations: items });
  } catch (err) {
    logInternal("list", err);
    res.status(500).json({ error: USER_GENERIC });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const created = await conversations.createConversation(req.user.id, req.body?.title || "New chat");
    res.json({ conversation: created });
  } catch (err) {
    logInternal("create", err);
    res.status(500).json({ error: USER_GENERIC });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const pack = await conversations.listMessages(req.user.id, req.params.id);
    if (!pack) return res.status(404).json({ error: "Conversation not found." });
    res.json(pack);
  } catch (err) {
    logInternal("get", err);
    res.status(500).json({ error: USER_GENERIC });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const owned = await conversations.getOwnedConversation(req.user.id, req.params.id);
    if (!owned) return res.status(404).json({ error: "Conversation not found." });
    await conversations.deleteConversation(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    logInternal("delete", err);
    res.status(500).json({ error: USER_GENERIC });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  if (!allowIp(req) || !allowUser(req.user.id)) {
    return res.status(429).json({ error: USER_RATE });
  }

  const regenerate = Boolean(req.body?.regenerate);
  let content;
  try {
    content = regenerate ? String(req.body?.content || " ") : assertMessage(req.body?.content);
  } catch (err) {
    return publicFail(res, err);
  }

  try {
    let conversation = await conversations.getOwnedConversation(req.user.id, req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });

    const ctx = await conversations.contextForComplete(req.user.id, conversation.id);
    let history = ctx.messages;

    if (regenerate) {
      const lastAssistant = [...(ctx.stored || [])].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) {
        await conversations.deleteMessage(req.user.id, lastAssistant.id);
        history = history.filter((_, idx) => !(idx === history.length - 1 && history[idx].role === "assistant"));
        if (history[history.length - 1]?.role !== "user") {
          return res.status(400).json({ error: USER_GENERIC });
        }
      }
    } else {
      const userMsg = await conversations.insertMessage({
        userId: req.user.id,
        conversationId: conversation.id,
        role: "user",
        content,
      });
      history = [...history, { role: "user", content: userMsg.content }];
      if (ctx.stored.length === 0) {
        await conversations.touchConversation(req.user.id, conversation.id, content);
      } else {
        await conversations.touchConversation(req.user.id, conversation.id);
      }
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    const abort = new AbortController();
    req.on("close", () => abort.abort());

    sseWrite(res, "meta", { assistant: PUBLIC_ASSISTANT_NAME, conversationId: conversation.id });

    let full = "";
    try {
      const result = await completeWithFailover({
        messages: history,
        signal: abort.signal,
        onToken: (chunk) => {
          full += chunk;
          sseWrite(res, "token", { t: chunk });
        },
      });
      full = result.text || full;
    } catch (err) {
      if (err?.code === "aborted") {
        if (full.trim()) {
          await conversations.insertMessage({
            userId: req.user.id,
            conversationId: conversation.id,
            role: "assistant",
            content: full,
          });
        }
        sseWrite(res, "stopped", { ok: true });
        return res.end();
      }
      const status = err?.causeStatus || 503;
      sseWrite(res, "error", { error: publicErrorForStatus(status) });
      return res.end();
    }

    full = String(full || "").trim();
    if (!full) {
      sseWrite(res, "error", { error: USER_UNAVAILABLE });
      return res.end();
    }

    const assistant = await conversations.insertMessage({
      userId: req.user.id,
      conversationId: conversation.id,
      role: "assistant",
      content: full,
    });
    await conversations.touchConversation(req.user.id, conversation.id);
    sseWrite(res, "done", { message: assistant });
    res.end();
  } catch (err) {
    if (res.headersSent) {
      sseWrite(res, "error", { error: USER_GENERIC });
      return res.end();
    }
    return publicFail(res, err);
  }
});

module.exports = router;

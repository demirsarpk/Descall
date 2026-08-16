"use strict";

const supabase = require("../../db/supabase");
const { MAX_CONTEXT_MESSAGES } = require("./rateLimit");

function titleFromPrompt(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 48 ? `${cleaned.slice(0, 45)}…` : cleaned;
}

async function listConversations(userId) {
  const { data, error } = await supabase
    .from("dimaai_conversations")
    .select("id,title,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return data || [];
}

async function getOwnedConversation(userId, conversationId) {
  const { data, error } = await supabase
    .from("dimaai_conversations")
    .select("id,user_id,title,created_at,updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function createConversation(userId, title) {
  const { data, error } = await supabase
    .from("dimaai_conversations")
    .insert({ user_id: userId, title: titleFromPrompt(title) })
    .select("id,title,created_at,updated_at")
    .single();
  if (error) throw error;
  return data;
}

async function touchConversation(userId, conversationId, title) {
  const patch = { updated_at: new Date().toISOString() };
  if (title) patch.title = titleFromPrompt(title);
  const { error } = await supabase
    .from("dimaai_conversations")
    .update(patch)
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

async function deleteConversation(userId, conversationId) {
  const { error } = await supabase
    .from("dimaai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

async function listMessages(userId, conversationId) {
  const owned = await getOwnedConversation(userId, conversationId);
  if (!owned) return null;
  const { data, error } = await supabase
    .from("dimaai_messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  const messages = (data || []).filter(
    (m) => m.role !== "assistant" || String(m.content || "").trim(),
  );
  return { conversation: owned, messages };
}

async function insertMessage({ userId, conversationId, role, content }) {
  const { data, error } = await supabase
    .from("dimaai_messages")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      role,
      content,
    })
    .select("id,role,content,created_at")
    .single();
  if (error) throw error;
  return data;
}

async function deleteMessage(userId, messageId) {
  const { error } = await supabase
    .from("dimaai_messages")
    .delete()
    .eq("id", messageId)
    .eq("user_id", userId);
  if (error) throw error;
}

async function contextForComplete(userId, conversationId) {
  const pack = await listMessages(userId, conversationId);
  if (!pack) return null;
  const msgs = pack.messages.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  return { conversation: pack.conversation, messages: msgs, stored: pack.messages };
}

module.exports = {
  titleFromPrompt,
  listConversations,
  getOwnedConversation,
  createConversation,
  touchConversation,
  deleteConversation,
  listMessages,
  insertMessage,
  deleteMessage,
  contextForComplete,
};

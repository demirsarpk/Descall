"use strict";

/**
 * Community rules acceptance gate — blocks chat/voice until rules_accepted_at is set.
 */
async function needsRulesAcceptance(supabase, serverId, userId, { isOwner = false } = {}) {
  if (!serverId || !userId || isOwner) return false;

  const [{ data: server, error: sErr }, { data: membership, error: mErr }] = await Promise.all([
    supabase
      .from("servers")
      .select("community_enabled, rules_text")
      .eq("id", serverId)
      .maybeSingle(),
    supabase
      .from("server_members")
      .select("rules_accepted_at")
      .eq("server_id", serverId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (sErr) throw sErr;
  if (mErr) throw mErr;

  return (
    Boolean(server?.community_enabled) &&
    Boolean(String(server?.rules_text || "").trim()) &&
    !membership?.rules_accepted_at
  );
}

module.exports = {
  needsRulesAcceptance,
};

'use strict';

const supabase = require('../db/supabase');

const VALID_PRIVACY = new Set(['friends', 'only-me', 'hidden']);

/**
 * Retrieve the friend IDs for a given user from Supabase.
 * Returns a Set of friend user IDs.
 */
async function getFriendIds(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('user_id,friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error || !data) return new Set();
  return new Set(
    data.map(row => (row.user_id === userId ? row.friend_id : row.user_id))
  );
}

/**
 * Broadcast presence update to all online friends who are allowed to see it.
 */
function broadcastPresenceToFriends(io, userId, username, presencePayload, friendIds, privacy) {
  if (privacy === 'hidden' || privacy === 'only-me') return;

  const sockets = io.sockets.sockets;
  for (const [, sock] of sockets) {
    if (!sock.user) continue;
    const friendId = sock.user.id;
    if (!friendIds.has(friendId)) continue;
    sock.emit('activity:friend:update', {
      userId,
      username,
      ...presencePayload,
    });
  }
}

function broadcastPresenceClear(io, userId, friendIds) {
  const sockets = io.sockets.sockets;
  for (const [, sock] of sockets) {
    if (!sock.user) continue;
    if (!friendIds.has(sock.user.id)) continue;
    sock.emit('activity:friend:clear', { userId });
  }
}

function registerActivityHandlers(io, socket) {
  const me = socket.user;
  const myId = me.id;

  // ─── activity:update ────────────────────────────────────────────────────────
  socket.on('activity:update', async ({ appName, appType, displayName, startedAt } = {}) => {
    if (!appName || typeof appName !== 'string') return;

    const payload = {
      app_name:     String(appName).slice(0, 100),
      app_type:     String(appType || 'app').slice(0, 32),
      display_name: String(displayName || appName).slice(0, 120),
      started_at:   startedAt || new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };

    // Upsert to DB (only on change — caller is responsible for diffing)
    await supabase
      .from('user_presence')
      .upsert({ user_id: myId, ...payload, is_manual: false }, { onConflict: 'user_id' });

    const { data: settings } = await supabase
      .from('user_activity_settings')
      .select('privacy')
      .eq('user_id', myId)
      .single();

    const privacy = settings?.privacy ?? 'friends';
    if (privacy === 'hidden' || privacy === 'only-me') return;

    const friendIds = await getFriendIds(myId);
    broadcastPresenceToFriends(io, myId, me.username, {
      appName:     payload.app_name,
      appType:     payload.app_type,
      displayName: payload.display_name,
      startedAt:   payload.started_at,
      isManual:    false,
    }, friendIds, privacy);
  });

  // ─── activity:clear ─────────────────────────────────────────────────────────
  socket.on('activity:clear', async () => {
    await supabase
      .from('user_presence')
      .delete()
      .eq('user_id', myId);

    const friendIds = await getFriendIds(myId);
    broadcastPresenceClear(io, myId, friendIds);
  });

  // ─── activity:manual ────────────────────────────────────────────────────────
  socket.on('activity:manual', async ({ displayName, expiresIn } = {}) => {
    if (!displayName || typeof displayName !== 'string') return;

    const EXPIRY_MAP = { '1h': 3600, '4h': 14400 };
    const expirySec = EXPIRY_MAP[expiresIn] ?? null;
    const expiresAt = expirySec
      ? new Date(Date.now() + expirySec * 1000).toISOString()
      : null;

    const payload = {
      user_id:          myId,
      app_name:         'manual',
      app_type:         'manual',
      display_name:     String(displayName).slice(0, 120),
      started_at:       new Date().toISOString(),
      updated_at:       new Date().toISOString(),
      is_manual:        true,
      manual_expires_at: expiresAt,
    };

    await supabase
      .from('user_presence')
      .upsert(payload, { onConflict: 'user_id' });

    const { data: settings } = await supabase
      .from('user_activity_settings')
      .select('privacy')
      .eq('user_id', myId)
      .single();

    const privacy = settings?.privacy ?? 'friends';
    if (privacy === 'hidden' || privacy === 'only-me') return;

    const friendIds = await getFriendIds(myId);
    broadcastPresenceToFriends(io, myId, me.username, {
      appName:     'manual',
      appType:     'manual',
      displayName: payload.display_name,
      startedAt:   payload.started_at,
      isManual:    true,
    }, friendIds, privacy);
  });

  // ─── activity:privacy ───────────────────────────────────────────────────────
  socket.on('activity:privacy', async ({ privacy } = {}) => {
    if (!VALID_PRIVACY.has(privacy)) return;

    await supabase
      .from('user_activity_settings')
      .upsert(
        { user_id: myId, privacy, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    // If switched to hidden → clear presence for all friends immediately
    if (privacy === 'hidden') {
      const friendIds = await getFriendIds(myId);
      broadcastPresenceClear(io, myId, friendIds);
    }
  });
}

module.exports = { registerActivityHandlers };

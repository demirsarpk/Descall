'use strict';

const supabase = require('../db/supabase');
const { friends: friendsMap } = require('../runtime/sharedState');

const VALID_PRIVACY = new Set(['friends', 'only-me', 'hidden']);

/**
 * Retrieve the friend IDs for a given user from Supabase.
 * Returns a Set of friend user IDs.
 */
async function getFriendIds(userId) {
  // Primary: Supabase (persistent, cross-restart)
  const { data, error } = await supabase
    .from('friendships')
    .select('user_id,friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (!error && data && data.length > 0) {
    return new Set(
      data.map(row => (row.user_id === userId ? row.friend_id : row.user_id))
    );
  }

  if (error && error.code !== '42P01') {
    console.error('[activity] getFriendIds supabase error:', error.message);
  }

  // Fallback: in-memory friends map (populated by handlers.js on socket connect)
  const memoryFriends = friendsMap.get(userId);
  if (memoryFriends && memoryFriends.size > 0) {
    console.log(`[activity] getFriendIds: using memory fallback for ${userId} (${memoryFriends.size} friends)`);
    return new Set(memoryFriends);
  }

  return new Set();
}

/**
 * Broadcast presence update to all online friends who are allowed to see it.
 */
function broadcastPresenceToFriends(io, userId, username, presencePayload, friendIds, privacy) {
  if (privacy === 'hidden' || privacy === 'only-me') return;

  const sockets = io.sockets.sockets;
  let sent = 0;
  for (const [, sock] of sockets) {
    if (!sock.user) continue;
    const friendId = sock.user.id;
    if (!friendIds.has(friendId)) continue;
    sock.emit('activity:friend:update', { userId, username, ...presencePayload });
    sent++;
  }
  console.log(`[activity:broadcast] ${username} -> sent to ${sent}/${friendIds.size} friend socket(s)`);
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
    console.log(`[activity:update] ${me.username} -> "${appName}" (${appType})`);

    const payload = {
      app_name:     String(appName).slice(0, 100),
      app_type:     String(appType || 'app').slice(0, 32),
      display_name: String(displayName || appName).slice(0, 120),
      started_at:   startedAt || new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };

    // Non-blocking DB persist — broadcast must not wait on this
    supabase.from('user_presence')
      .upsert({ user_id: myId, ...payload, is_manual: false }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.error('[activity:update] upsert error:', error.message); });

    // Fetch privacy setting — default 'friends' if table missing (42P01) or no row (PGRST116)
    const { data: settings, error: settingsErr } = await supabase
      .from('user_activity_settings')
      .select('privacy')
      .eq('user_id', myId)
      .single();

    if (settingsErr && !['PGRST116', '42P01'].includes(settingsErr.code)) {
      console.error('[activity:update] settings error:', settingsErr.message);
    }

    const privacy = settings?.privacy ?? 'friends';
    if (privacy === 'hidden' || privacy === 'only-me') return;

    const friendIds = await getFriendIds(myId);
    console.log(`[activity:update] ${me.username} friendIds=${friendIds.size} privacy=${privacy}`);
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

    console.log(`[activity:manual] ${me.username} -> "${displayName}" (expires: ${expiresIn ?? 'never'})`);

    const EXPIRY_MAP = { '1h': 3600, '4h': 14400 };
    const expirySec  = EXPIRY_MAP[expiresIn] ?? null;
    const expiresAt  = expirySec ? new Date(Date.now() + expirySec * 1000).toISOString() : null;
    const startedAt  = new Date().toISOString();
    const displayStr = String(displayName).slice(0, 120);

    // Non-blocking DB persist — broadcast doesn't wait on this
    supabase.from('user_presence').upsert({
      user_id: myId, app_name: 'manual', app_type: 'manual',
      display_name: displayStr, started_at: startedAt,
      updated_at: startedAt, is_manual: true, manual_expires_at: expiresAt,
    }, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.error('[activity:manual] upsert error:', error.message);
    });

    // Privacy check — default to 'friends' if table not yet created
    const { data: settings, error: settingsErr } = await supabase
      .from('user_activity_settings')
      .select('privacy')
      .eq('user_id', myId)
      .single();

    const IGNORABLE = new Set(['PGRST116', '42P01']);  // row-not-found, table-not-found
    if (settingsErr && !IGNORABLE.has(settingsErr.code)) {
      console.error('[activity:manual] settings error:', settingsErr.message);
    }

    const privacy = settings?.privacy ?? 'friends';
    if (privacy === 'hidden' || privacy === 'only-me') {
      console.log(`[activity:manual] ${me.username} privacy=${privacy}, skipping broadcast`);
      return;
    }

    const friendIds = await getFriendIds(myId);
    console.log(`[activity:manual] broadcasting to ${friendIds.size} friend socket(s)`);

    broadcastPresenceToFriends(io, myId, me.username, {
      appName: 'manual', appType: 'manual',
      displayName: displayStr, startedAt, isManual: true,
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

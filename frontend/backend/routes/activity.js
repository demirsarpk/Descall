'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const supabase = require('../db/supabase');

const router = express.Router();

const VALID_PRIVACY = ['friends', 'only-me', 'hidden'];
const MAX_HISTORY_ROWS = 200;

// ─── GET own activity history ─────────────────────────────────────────────────
router.get('/history', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('user_activity_log')
    .select('id,app_name,app_type,display_name,started_at,ended_at,duration_sec,is_manual')
    .eq('user_id', req.user.id)
    .order('started_at', { ascending: false })
    .limit(MAX_HISTORY_ROWS);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ history: data || [] });
});

// ─── GET friend's activity history (privacy-gated) ───────────────────────────
router.get('/friend/:userId/history', requireAuth, async (req, res) => {
  const { userId } = req.params;

  const { data: settings } = await supabase
    .from('user_activity_settings')
    .select('privacy')
    .eq('user_id', userId)
    .single();

  const privacy = settings?.privacy ?? 'friends';
  if (privacy !== 'friends') {
    return res.json({ history: [], restricted: true });
  }

  const { data: friendship } = await supabase
    .from('friendships')
    .select('id')
    .or(`and(user_id.eq.${req.user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${req.user.id})`)
    .eq('status', 'accepted')
    .maybeSingle();

  if (!friendship) return res.json({ history: [], restricted: true });

  const { data, error } = await supabase
    .from('user_activity_log')
    .select('id,app_name,app_type,display_name,started_at,ended_at,duration_sec,is_manual')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ history: data || [] });
});

// ─── GET friend's current presence (privacy-gated) ───────────────────────────
router.get('/friend/:userId/presence', requireAuth, async (req, res) => {
  const { userId } = req.params;

  const { data: settings } = await supabase
    .from('user_activity_settings')
    .select('privacy')
    .eq('user_id', userId)
    .single();

  const privacy = settings?.privacy ?? 'friends';
  if (privacy === 'hidden') return res.json({ presence: null });
  if (privacy === 'only-me') return res.json({ presence: { privacy: 'only-me' } });

  const { data, error } = await supabase
    .from('user_presence')
    .select('app_name,app_type,display_name,started_at,is_manual,updated_at')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  return res.json({ presence: data || null });
});

// ─── GET own settings ────────────────────────────────────────────────────────
router.get('/settings', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('user_activity_settings')
    .select('*')
    .eq('user_id', req.user.id)
    .single();

  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });

  const defaults = {
    privacy: 'friends',
    show_game_activity: true,
    show_app_activity: true,
    show_browser: false,
    show_descall_time: true,
  };

  return res.json({ settings: data ? { ...defaults, ...data } : defaults });
});

// ─── POST update settings ────────────────────────────────────────────────────
router.post('/settings', requireAuth, async (req, res) => {
  const { privacy, show_game_activity, show_app_activity, show_browser, show_descall_time } = req.body;

  if (privacy && !VALID_PRIVACY.includes(privacy)) {
    return res.status(400).json({ error: 'Invalid privacy value' });
  }

  const patch = { user_id: req.user.id, updated_at: new Date().toISOString() };
  if (privacy !== undefined) patch.privacy = privacy;
  if (show_game_activity !== undefined) patch.show_game_activity = !!show_game_activity;
  if (show_app_activity !== undefined) patch.show_app_activity = !!show_app_activity;
  if (show_browser !== undefined) patch.show_browser = !!show_browser;
  if (show_descall_time !== undefined) patch.show_descall_time = !!show_descall_time;

  const { error } = await supabase
    .from('user_activity_settings')
    .upsert(patch, { onConflict: 'user_id' });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// ─── POST log a completed session (called by client on activity end) ─────────
router.post('/session', requireAuth, async (req, res) => {
  const { app_name, app_type, display_name, started_at, ended_at, duration_sec, is_manual } = req.body;

  if (!app_name || !started_at) {
    return res.status(400).json({ error: 'app_name and started_at are required' });
  }

  const { error: insertError } = await supabase
    .from('user_activity_log')
    .insert({
      user_id: req.user.id,
      app_name: String(app_name).slice(0, 100),
      app_type: String(app_type || 'app').slice(0, 32),
      display_name: String(display_name || app_name).slice(0, 120),
      started_at,
      ended_at: ended_at || new Date().toISOString(),
      duration_sec: Number(duration_sec) || 0,
      is_manual: !!is_manual,
    });

  if (insertError) return res.status(500).json({ error: insertError.message });

  // Prune oldest rows beyond MAX_HISTORY_ROWS
  const { data: rows } = await supabase
    .from('user_activity_log')
    .select('id')
    .eq('user_id', req.user.id)
    .order('started_at', { ascending: false })
    .range(MAX_HISTORY_ROWS, MAX_HISTORY_ROWS + 50);

  if (rows?.length) {
    const ids = rows.map(r => r.id);
    await supabase.from('user_activity_log').delete().in('id', ids);
  }

  return res.json({ success: true });
});

module.exports = router;

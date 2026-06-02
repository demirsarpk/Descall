import { useState, useEffect, useRef, useCallback } from 'react';
import { PROCESS_DB, TYPE_PRIORITY, PROCESS_BLOCKLIST } from '../lib/processDatabase';
import { getToken } from '../lib/storage';
import { API_BASE_URL } from '../config/api';

const SCAN_INTERVAL_MS = 10_000;
const DESCALL_APP_NAME = 'Descall';
const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

/** Resolve the highest-priority detected app from running process names. */
function resolveActivity(processList) {
  const candidates = [];

  for (const proc of processList) {
    const lc = proc.toLowerCase();
    if (PROCESS_BLOCKLIST.has(lc)) continue;
    const entry = PROCESS_DB[lc];
    if (entry) candidates.push({ ...entry, exe: lc });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const ai = TYPE_PRIORITY.indexOf(a.type);
    const bi = TYPE_PRIORITY.indexOf(b.type);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const top = candidates[0];
  return {
    appName:     top.name,
    appType:     top.type,
    displayName: buildDisplayName(top),
    category:    top.category,
    icon:        top.icon,
  };
}

function buildDisplayName({ type, name }) {
  if (type === 'game')         return `Playing ${name}`;
  if (type === 'music')        return `Listening to ${name}`;
  if (type === 'browser')      return `Browsing with ${name}`;
  if (type === 'dev')          return `Coding in ${name}`;
  if (type === 'creative')     return `Creating in ${name}`;
  if (type === 'communication') return `Using ${name}`;
  if (type === 'media')        return `Watching with ${name}`;
  if (type === 'launcher')     return `In ${name}`;
  return `Using ${name}`;
}

export function useActivity({ socket, me, friends = [] }) {
  const [currentActivity, setCurrentActivity] = useState(null);   // own detected/manual
  const [friendPresence, setFriendPresence]   = useState({});      // { [userId]: presenceObj }
  const [history, setHistory]                 = useState([]);
  const [settings, setSettings]               = useState({
    privacy: 'friends',
    show_game_activity: true,
    show_app_activity: true,
    show_browser: false,
    show_descall_time: true,
  });
  const [manualOverride, setManualOverride]   = useState(null);

  const lastEmittedRef    = useRef(null);   // last app name emitted — prevent redundant emits
  const sessionStartRef   = useRef(null);   // start time of current activity session
  const focusStartRef     = useRef(null);   // start time of current focus window
  const focusAccumRef     = useRef(0);      // accumulated focused seconds this session
  const manualTimerRef    = useRef(null);
  const scanIntervalRef   = useRef(null);

  // ─── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([
      fetch(`${API_BASE_URL}/api/activity/history`,  { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE_URL}/api/activity/settings`, { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([histRes, setRes]) => {
      if (histRes.ok) {
        const { history: h } = await histRes.json();
        setHistory(h || []);
      }
      if (setRes.ok) {
        const { settings: s } = await setRes.json();
        if (s) setSettings(prev => ({ ...prev, ...s }));
      }
    }).catch(() => {});
  }, []);

  // ─── Focused-time tracking ──────────────────────────────────────────────────
  useEffect(() => {
    const onFocus = () => { focusStartRef.current = Date.now(); };
    const onBlur  = () => {
      if (focusStartRef.current) {
        focusAccumRef.current += (Date.now() - focusStartRef.current) / 1000;
        focusStartRef.current = null;
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur',  onBlur);
    if (document.hasFocus()) focusStartRef.current = Date.now();
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur',  onBlur);
    };
  }, []);

  // ─── Process scanning (Electron only) ──────────────────────────────────────
  const scanAndEmit = useCallback(async () => {
    if (!isElectron || !socket?.connected) return;
    if (manualOverride) return;  // manual override takes precedence

    let processList = [];
    try {
      processList = await window.electronAPI.scanProcesses();
    } catch { return; }

    const detected = resolveActivity(processList);

    // Filter per user settings
    if (detected) {
      if (detected.appType === 'browser' && !settings.show_browser) return;
      if (detected.appType === 'game'    && !settings.show_game_activity) return;
      if (!['game', 'music'].includes(detected.appType) && !settings.show_app_activity) return;
    }

    const newName = detected?.appName ?? null;
    if (newName === lastEmittedRef.current) return;  // no change, skip emit

    // Log previous session before switching
    if (lastEmittedRef.current && sessionStartRef.current) {
      logSession(lastEmittedRef.current, sessionStartRef.current);
    }

    lastEmittedRef.current = newName;
    sessionStartRef.current = detected ? new Date().toISOString() : null;

    if (detected) {
      setCurrentActivity(detected);
      socket.emit('activity:update', {
        appName:     detected.appName,
        appType:     detected.appType,
        displayName: detected.displayName,
        startedAt:   sessionStartRef.current,
      });
    } else {
      setCurrentActivity(null);
      socket.emit('activity:clear');
    }
  }, [socket, manualOverride, settings]);

  useEffect(() => {
    if (!isElectron) return;
    scanAndEmit();
    scanIntervalRef.current = setInterval(scanAndEmit, SCAN_INTERVAL_MS);

    const onFocus = () => scanAndEmit();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(scanIntervalRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [scanAndEmit]);

  // ─── Log a completed session to backend ────────────────────────────────────
  const logSession = useCallback(async (appName, startedAt) => {
    const token = getToken();
    if (!token || !appName || !startedAt) return;

    const endedAt    = new Date().toISOString();
    const startMs    = new Date(startedAt).getTime();
    const durationSec = Math.round((Date.now() - startMs) / 1000);
    if (durationSec < 30) return;  // ignore sub-30s blips

    const entry = Object.values(PROCESS_DB).find(e => e.name === appName);

    await fetch(`${API_BASE_URL}/api/activity/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        app_name:     appName,
        app_type:     entry?.type ?? 'app',
        display_name: buildDisplayName(entry ?? { type: 'app', name: appName }),
        started_at:   startedAt,
        ended_at:     endedAt,
        duration_sec: durationSec,
        is_manual:    false,
      }),
    }).catch(() => {});

    // Refresh history
    const res = await fetch(`${API_BASE_URL}/api/activity/history`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (res?.ok) {
      const { history: h } = await res.json();
      setHistory(h || []);
    }
  }, []);

  // ─── Log Descall focused time on unload ────────────────────────────────────
  useEffect(() => {
    const sessionStart = new Date().toISOString();

    const flush = () => {
      if (focusStartRef.current) {
        focusAccumRef.current += (Date.now() - focusStartRef.current) / 1000;
        focusStartRef.current = null;
      }
      const secs = Math.round(focusAccumRef.current);
      if (secs < 60 || !settings.show_descall_time) return;

      const token = getToken();
      if (!token) return;

      // Use sendBeacon for reliability on page unload
      const payload = JSON.stringify({
        app_name: DESCALL_APP_NAME, app_type: 'app',
        display_name: `Using ${DESCALL_APP_NAME}`,
        started_at: sessionStart,
        ended_at: new Date().toISOString(),
        duration_sec: secs, is_manual: false,
      });
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(
        `${API_BASE_URL}/api/activity/session`,
        blob
      );
    };

    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [settings.show_descall_time]);

  // ─── Socket event listeners (friend presence) ──────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onFriendUpdate = (data) => {
      if (!data?.userId) return;
      setFriendPresence(prev => ({ ...prev, [data.userId]: data }));
    };

    const onFriendClear = ({ userId } = {}) => {
      if (!userId) return;
      setFriendPresence(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    socket.on('activity:friend:update', onFriendUpdate);
    socket.on('activity:friend:clear',  onFriendClear);

    return () => {
      socket.off('activity:friend:update', onFriendUpdate);
      socket.off('activity:friend:clear',  onFriendClear);
    };
  }, [socket]);

  // ─── Manual override ────────────────────────────────────────────────────────
  const setManual = useCallback((displayName, expiresIn) => {
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);

    const override = { displayName, expiresIn, startedAt: new Date().toISOString() };
    setManualOverride(override);
    setCurrentActivity({ appName: 'manual', appType: 'manual', displayName, icon: '✏️' });

    if (socket?.connected) {
      socket.emit('activity:manual', { displayName, expiresIn: expiresIn || null });
    }

    if (expiresIn) {
      const ms = expiresIn === '1h' ? 3_600_000 : 14_400_000;
      manualTimerRef.current = setTimeout(clearManual, ms);
    }
  }, [socket]);

  const clearManual = useCallback(() => {
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    setManualOverride(null);
    lastEmittedRef.current = null;  // force re-scan on next tick
    scanAndEmit();
  }, [scanAndEmit]);

  // ─── Privacy update ─────────────────────────────────────────────────────────
  const updatePrivacy = useCallback(async (privacy) => {
    setSettings(prev => ({ ...prev, privacy }));
    if (socket?.connected) socket.emit('activity:privacy', { privacy });

    const token = getToken();
    if (!token) return;
    await fetch(`${API_BASE_URL}/api/activity/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ privacy }),
    }).catch(() => {});
  }, [socket]);

  const updateSettings = useCallback(async (patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
    const token = getToken();
    if (!token) return;
    await fetch(`${API_BASE_URL}/api/activity/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  return {
    currentActivity,
    friendPresence,
    history,
    settings,
    manualOverride,
    isElectron,
    setManual,
    clearManual,
    updatePrivacy,
    updateSettings,
  };
}

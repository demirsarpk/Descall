const COOLDOWN_MS = 800;
const CALL_TAG = 'descall-incoming-call';

class NotificationService {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
    this.hasPermission = false;
    this.initialized = false;
    this.lastNotificationTime = 0;
    this.pendingNotifications = [];
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    if (this.isElectron) {
      this.hasPermission = true;
      this._registerClickHandler();
    } else if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.hasPermission = true;
      }
      // Don't auto-request on init — let requestPermission() be called explicitly
      // so the browser doesn't block the prompt (requires user gesture in some browsers)
    }

    this._drainPending();
  }

  // Call this from a button click / user gesture to request web permission
  async requestPermission() {
    if (this.isElectron) return 'granted';
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') {
      this.hasPermission = true;
      return 'granted';
    }
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission().catch(() => 'denied');
    this.hasPermission = result === 'granted';
    return result;
  }

  getPermissionState() {
    if (this.isElectron) return 'granted';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  _registerClickHandler() {
    if (!this.isElectron || !window.electronAPI?.onNotificationClicked) return;
    window.electronAPI.onNotificationClicked((payload) => {
      window.dispatchEvent(new CustomEvent('descall:notification-click', { detail: payload }));
    });
  }

  async _isWindowActive() {
    if (this.isElectron && window.electronAPI?.isWindowFocused) {
      return window.electronAPI.isWindowFocused();
    }
    return document.hasFocus();
  }

  async show({ title, body, tag = 'descall', requireInteraction = false, silent = false, data = {} }) {
    if (!this.initialized) {
      this.pendingNotifications.push({ title, body, tag, requireInteraction, silent, data });
      await this.init();
      return;
    }
    if (!this.hasPermission) return;

    // Rate limit — skip non-call notifications during cooldown
    const now = Date.now();
    if (!requireInteraction && now - this.lastNotificationTime < COOLDOWN_MS) return;
    this.lastNotificationTime = now;

    // Skip if window is focused (user can already see the message)
    const windowActive = await this._isWindowActive();
    if (windowActive && !requireInteraction) return;

    if (this.isElectron) {
      window.electronAPI.showNotification(title, { body, tag, data });
    } else {
      this._showWebNotification({ title, body, tag, requireInteraction, silent, data });
    }
  }

  _showWebNotification({ title, body, tag, requireInteraction, silent, data }) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, {
        body,
        tag,
        requireInteraction,
        silent,
        icon: '/icon.png',
        badge: '/icon.png',
        data,
      });
      n.onclick = () => {
        window.focus();
        n.close();
        window.dispatchEvent(new CustomEvent('descall:notification-click', { detail: data }));
      };
      if (!requireInteraction) setTimeout(() => n.close(), 5000);
    } catch (err) {
      console.error('[Notification] Failed to show:', err);
    }
  }

  _drainPending() {
    const queued = this.pendingNotifications.splice(0);
    queued.forEach((opts, i) => setTimeout(() => this.show(opts), i * COOLDOWN_MS));
  }

  // ─── Typed notification helpers ───────────────────────────────────────────

  async dm({ from, text, conversationId }) {
    await this.show({
      title: from,
      body: text?.substring(0, 120) || 'Yeni mesaj',
      tag: `dm-${conversationId}`,
      data: { type: 'dm', conversationId, from },
    });
  }

  // Legacy alias used in existing App.jsx calls
  async newMessage({ from, text, preview, conversationId }) {
    await this.dm({ from, text: preview || text, conversationId });
  }

  async groupMessage({ groupName, from, text, groupId }) {
    await this.show({
      title: groupName,
      body: `${from}: ${(text || 'Yeni mesaj').substring(0, 100)}`,
      tag: `group-${groupId}`,
      data: { type: 'group', groupId, from, groupName },
    });
  }

  async mention({ groupName, from, text, groupId, dmConversationId }) {
    await this.show({
      title: `💬 ${from} senden bahsetti`,
      body: groupName ? `${groupName}: ${(text || '').substring(0, 100)}` : (text || '').substring(0, 120),
      tag: `mention-${groupId || dmConversationId}`,
      requireInteraction: true,
      data: { type: 'mention', groupId, dmConversationId, from },
    });
  }

  // Legacy alias
  async groupMention({ groupName, from, text, groupId }) {
    await this.mention({ groupName, from, text, groupId });
  }

  async incomingCall({ from, type = 'voice' }) {
    await this.show({
      title: `📞 ${from} arıyor`,
      body: type === 'video' ? 'Görüntülü arama' : 'Sesli arama',
      tag: CALL_TAG,
      requireInteraction: true,
      data: { type: 'call', from, callType: type },
    });
  }

  async groupCall({ groupName, from }) {
    await this.show({
      title: `📞 ${groupName} — Grup Araması`,
      body: `${from} grup araması başlattı`,
      tag: `group-call-${groupName}`,
      requireInteraction: true,
      data: { type: 'group-call', groupName, from },
    });
  }

  async missedCall({ from, type = 'voice' }) {
    await this.show({
      title: 'Cevapsız Arama',
      body: `${from} ${type === 'video' ? 'görüntülü' : 'sesli'} aradı`,
      tag: `missed-call-${from}`,
      data: { type: 'missed-call', from, callType: type },
    });
  }

  async friendRequest({ from, fromId }) {
    await this.show({
      title: 'Arkadaşlık İsteği',
      body: `${from} seni arkadaş olarak eklemek istiyor`,
      tag: `friend-req-${fromId}`,
      data: { type: 'friend-request', fromId, from },
    });
  }

  async friendOnline({ username }) {
    await this.show({
      title: 'Descall',
      body: `${username} çevrimiçi oldu`,
      tag: `online-${username}`,
      silent: true,
      data: { type: 'friend-online', username },
    });
  }

  async newAnnouncement({ title, preview, announcementId }) {
    await this.show({
      title: `📢 ${title}`,
      body: preview,
      tag: `ann-${announcementId}`,
      data: { type: 'announcement', announcementId },
    });
  }
}

const notificationService = new NotificationService();

if (typeof window !== 'undefined') {
  const boot = () => {
    notificationService.init();
    document.removeEventListener('click', boot);
    document.removeEventListener('keydown', boot);
  };
  document.addEventListener('click', boot, { once: true });
  document.addEventListener('keydown', boot, { once: true });
}

export default notificationService;

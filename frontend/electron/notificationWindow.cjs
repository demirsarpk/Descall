'use strict';

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

const NOTIF_WIDTH = 360;
const NOTIF_HEIGHT = 100;
const NOTIF_MARGIN = 12;
const DEFAULT_DURATION = 5000;

const activeNotifications = [];

function getNextPosition() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const x = width - NOTIF_WIDTH - NOTIF_MARGIN;
  const stackOffset = activeNotifications.length * (NOTIF_HEIGHT + NOTIF_MARGIN);
  const y = height - NOTIF_HEIGHT - NOTIF_MARGIN - stackOffset;
  return { x, y };
}

function repositionAll() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  activeNotifications.forEach((win, i) => {
    if (win.isDestroyed()) return;
    const x = width - NOTIF_WIDTH - NOTIF_MARGIN;
    const y = height - NOTIF_HEIGHT - NOTIF_MARGIN - i * (NOTIF_HEIGHT + NOTIF_MARGIN);
    win.setPosition(x, y, true);
  });
}

/**
 * Show a custom always-on-top notification window.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {'default'|'call'|'mention'} opts.type
 * @param {string|null} opts.avatarUrl
 * @param {number} opts.duration  ms before auto-dismiss (0 = never)
 * @param {function} opts.onClick called when user clicks
 */
function showNotificationWindow({ title, body, type = 'default', avatarUrl = null, duration = DEFAULT_DURATION, onClick } = {}) {
  const { x, y } = getNextPosition();

  const win = new BrowserWindow({
    width: NOTIF_WIDTH,
    height: NOTIF_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'notifPreload.cjs'),
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');

  const ACCENT_BY_TYPE = {
    call: '#23a55a',
    mention: '#f0b232',
    default: '#5865f2',
  };
  const accent = ACCENT_BY_TYPE[type] || ACCENT_BY_TYPE.default;

  const safeTitle = (title || 'Descall').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeBody = (body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
    : `<div style="width:36px;height:36px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;font-weight:700;color:#fff;">${safeTitle.charAt(0).toUpperCase()}</div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      background:transparent;
      overflow:hidden;
      user-select:none;
      -webkit-app-region:no-drag;
    }
    .card{
      width:${NOTIF_WIDTH}px;
      height:${NOTIF_HEIGHT}px;
      background:#1e1f22;
      border:1px solid rgba(255,255,255,0.09);
      border-left:3px solid ${accent};
      border-radius:10px;
      display:flex;
      align-items:center;
      gap:12px;
      padding:0 14px;
      cursor:pointer;
      box-shadow:0 8px 32px rgba(0,0,0,0.55),0 2px 8px rgba(0,0,0,0.4);
      opacity:0;
      transform:translateX(20px);
      transition:opacity 0.22s ease,transform 0.22s cubic-bezier(0.16,1,0.3,1);
    }
    .card.visible{opacity:1;transform:translateX(0);}
    .card:hover{background:#2b2d31;}
    .avatar{flex-shrink:0;}
    .text{flex:1;min-width:0;}
    .title{font-size:13px;font-weight:600;color:#f2f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .body{font-size:12px;color:#b5bac1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
    .close{
      flex-shrink:0;width:20px;height:20px;border:none;background:transparent;
      color:#6d6f78;font-size:16px;cursor:pointer;display:flex;align-items:center;
      justify-content:center;border-radius:4px;transition:background 0.1s,color 0.1s;
      line-height:1;
    }
    .close:hover{background:rgba(255,255,255,0.07);color:#f2f3f5;}
    .progress{
      position:absolute;bottom:0;left:0;height:2px;background:${accent};
      border-radius:0 0 0 10px;opacity:0.6;
    }
  </style></head><body>
    <div class="card" id="card" onclick="window.__notifClick()">
      <div class="avatar">${avatarHtml}</div>
      <div class="text">
        <div class="title">${safeTitle}</div>
        <div class="body">${safeBody}</div>
      </div>
      <button class="close" onclick="event.stopPropagation();window.__notifClose()">×</button>
      ${duration > 0 ? `<div class="progress" id="prog"></div>` : ''}
    </div>
    <script>
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        document.getElementById('card').classList.add('visible');
        ${duration > 0 ? `
        const prog=document.getElementById('prog');
        if(prog){
          prog.style.width='100%';
          prog.style.transition='width ${duration}ms linear';
          requestAnimationFrame(()=>requestAnimationFrame(()=>{prog.style.width='0%';}));
        }` : ''}
      }));
      window.__notifClick=()=>{ const el=document.getElementById('card'); el.style.opacity='0'; el.style.transform='translateX(20px)'; setTimeout(()=>window.notifAPI?.click(),200); };
      window.__notifClose=()=>{ const el=document.getElementById('card'); el.style.opacity='0'; el.style.transform='translateX(20px)'; setTimeout(()=>window.notifAPI?.close(),200); };
    <\/script>
  </body></html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  let dismissTimer = null;

  let dismissed = false;
  const dismiss = (clicked) => {
    if (dismissed) return;
    dismissed = true;
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
    const idx = activeNotifications.indexOf(win);
    if (idx !== -1) activeNotifications.splice(idx, 1);
    try { if (!win.isDestroyed()) win.close(); } catch (_) {}
    repositionAll();
    if (clicked && onClick) onClick();
  };

  // Route IPC from this specific webContents only
  const onIpc = (channel, handler) => {
    const listener = (event) => {
      if (event.sender.id === win.webContents.id) handler();
    };
    ipcMain.on(channel, listener);
    win.once('closed', () => ipcMain.off(channel, listener));
  };

  onIpc('notif:click', () => dismiss(true));
  onIpc('notif:close', () => dismiss(false));

  win.once('ready-to-show', () => {
    win.showInactive();
    activeNotifications.push(win);
    repositionAll();

    if (duration > 0) {
      dismissTimer = setTimeout(() => dismiss(false), duration);
    }
  });

  return win;
}

module.exports = { showNotificationWindow };

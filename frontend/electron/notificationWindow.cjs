'use strict';

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const NOTIF_WIDTH        = 360;
const NOTIF_HEIGHT       = 100;
const NOTIF_HEIGHT_CALL  = 130;   // taller to fit Accept / Decline buttons
const NOTIF_MARGIN       = 12;
const DEFAULT_DURATION   = 5000;

const activeNotifications = [];

function getWindowHeight(type) {
  return type === 'call' ? NOTIF_HEIGHT_CALL : NOTIF_HEIGHT;
}

function getNextPosition(type) {
  const display   = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const winHeight = getWindowHeight(type);
  const x         = width - NOTIF_WIDTH - NOTIF_MARGIN;
  const stackOffset = activeNotifications.length * (NOTIF_HEIGHT + NOTIF_MARGIN);
  const y         = height - winHeight - NOTIF_MARGIN - stackOffset;
  return { x, y };
}

function repositionAll() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  activeNotifications.forEach((entry, i) => {
    const { win, type } = entry;
    if (win.isDestroyed()) return;
    const winHeight = getWindowHeight(type);
    const x = width - NOTIF_WIDTH - NOTIF_MARGIN;
    const y = height - winHeight - NOTIF_MARGIN - i * (NOTIF_HEIGHT + NOTIF_MARGIN);
    win.setPosition(x, y, true);
  });
}

/**
 * Show a custom always-on-top notification window.
 * @param {object}   opts
 * @param {string}   opts.title
 * @param {string}   opts.body
 * @param {'default'|'call'|'mention'} opts.type
 * @param {string|null} opts.avatarUrl
 * @param {number}   opts.duration    ms before auto-dismiss (0 = never)
 * @param {function} opts.onClick     called when user clicks the card body
 * @param {function} opts.onAccept    called when Accept button is clicked (call type)
 * @param {function} opts.onDecline   called when Decline button is clicked (call type)
 */
function showNotificationWindow({
  title, body, type = 'default', avatarUrl = null,
  duration = DEFAULT_DURATION, onClick, onAccept, onDecline,
} = {}) {
  const isCall    = type === 'call';
  const winHeight = getWindowHeight(type);
  const { x, y }  = getNextPosition(type);

  const win = new BrowserWindow({
    width:  NOTIF_WIDTH,
    height: winHeight,
    x, y,
    frame:      false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    movable:     false,
    focusable:   isCall,   // call notifications need focus for button clicks
    show:        false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, 'notifPreload.cjs'),
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');

  const ACCENT = { call: '#23a55a', mention: '#f0b232', default: '#5865f2' };
  const accent  = ACCENT[type] || ACCENT.default;

  const safe = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const safeTitle = safe(title || 'Descall');
  const safeBody  = safe(body  || '');

  const avatarHtml = avatarUrl
    ? `<img src="${safe(avatarUrl)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
    : `<div style="width:36px;height:36px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;font-weight:700;color:#fff;">${safeTitle.charAt(0).toUpperCase()}</div>`;

  const callButtons = isCall ? `
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button onclick="event.stopPropagation();window.__notifAccept()"
        style="flex:1;padding:5px 0;border:none;border-radius:6px;background:#23a55a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">
        Accept
      </button>
      <button onclick="event.stopPropagation();window.__notifDecline()"
        style="flex:1;padding:5px 0;border:none;border-radius:6px;background:#ed4245;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">
        Decline
      </button>
    </div>` : '';

  const progressBar = (!isCall && duration > 0)
    ? `<div id="prog" style="position:absolute;bottom:0;left:0;height:2px;background:${accent};border-radius:0 0 0 10px;opacity:0.6;width:100%;"></div>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:transparent;overflow:hidden;user-select:none;-webkit-app-region:no-drag;}
    .card{
      width:${NOTIF_WIDTH}px;min-height:${winHeight}px;
      background:#1e1f22;border:1px solid rgba(255,255,255,0.09);border-left:3px solid ${accent};
      border-radius:10px;padding:12px 14px;
      box-shadow:0 8px 32px rgba(0,0,0,0.55),0 2px 8px rgba(0,0,0,0.4);
      cursor:pointer;opacity:0;transform:translateX(20px);
      transition:opacity 0.22s ease,transform 0.22s cubic-bezier(0.16,1,0.3,1);
      position:relative;
    }
    .card.visible{opacity:1;transform:translateX(0);}
    .card:hover{background:#2b2d31;}
    .row{display:flex;align-items:center;gap:12px;}
    .text{flex:1;min-width:0;}
    .title{font-size:13px;font-weight:600;color:#f2f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .body-text{font-size:12px;color:#b5bac1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
    .close-btn{flex-shrink:0;width:20px;height:20px;border:none;background:transparent;color:#6d6f78;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:background 0.1s,color 0.1s;line-height:1;}
    .close-btn:hover{background:rgba(255,255,255,0.07);color:#f2f3f5;}
  </style></head><body>
    <div class="card" id="card" onclick="window.__notifClick()">
      <div class="row">
        <div>${avatarHtml}</div>
        <div class="text">
          <div class="title">${safeTitle}</div>
          <div class="body-text">${safeBody}</div>
        </div>
        <button class="close-btn" onclick="event.stopPropagation();window.__notifClose()">&#x2715;</button>
      </div>
      ${callButtons}
      ${progressBar}
    </div>
    <script>
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const card=document.getElementById('card');
        card.classList.add('visible');
        ${(!isCall && duration > 0) ? `
          const prog=document.getElementById('prog');
          if(prog){prog.style.transition='width ${duration}ms linear';requestAnimationFrame(()=>requestAnimationFrame(()=>{prog.style.width='0%';}))}
        ` : ''}
      }));
      const dismiss=(fn)=>{ const c=document.getElementById('card'); c.style.opacity='0'; c.style.transform='translateX(20px)'; setTimeout(fn,200); };
      window.__notifClick   =()=>dismiss(()=>window.notifAPI?.click());
      window.__notifClose   =()=>dismiss(()=>window.notifAPI?.close());
      window.__notifAccept  =()=>dismiss(()=>window.notifAPI?.accept());
      window.__notifDecline =()=>dismiss(()=>window.notifAPI?.decline());
    <\/script>
  </body></html>`;

  // Write to a temp file to avoid encodeURIComponent URIError on special chars
  const tmpFile = path.join(os.tmpdir(), `descall-notif-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf8');
  win.loadFile(tmpFile);

  let dismissTimer = null;
  let dismissed    = false;

  const dismiss = (action) => {
    if (dismissed) return;
    dismissed = true;
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
    const idx = activeNotifications.findIndex(e => e.win === win);
    if (idx !== -1) activeNotifications.splice(idx, 1);
    try { if (!win.isDestroyed()) win.close(); } catch (_) {}
    // Clean up temp file after a short delay
    setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) {} }, 2000);
    repositionAll();
    if (action === 'click'    && onClick)   onClick();
    if (action === 'accept'   && onAccept)  onAccept();
    if (action === 'decline'  && onDecline) onDecline();
  };

  // Scope IPC listeners to this window's webContents only
  const onIpc = (channel, action) => {
    const listener = (event) => { if (event.sender.id === win.webContents.id) dismiss(action); };
    ipcMain.on(channel, listener);
    win.once('closed', () => ipcMain.off(channel, listener));
  };

  onIpc('notif:click',   'click');
  onIpc('notif:close',   'close');
  onIpc('notif:accept',  'accept');
  onIpc('notif:decline', 'decline');

  win.once('ready-to-show', () => {
    win.showInactive();
    activeNotifications.push({ win, type });
    repositionAll();
    if (!isCall && duration > 0) {
      dismissTimer = setTimeout(() => dismiss('timeout'), duration);
    }
  });

  return win;
}

module.exports = { showNotificationWindow };

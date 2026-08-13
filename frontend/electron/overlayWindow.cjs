'use strict';

/**
 * Always-on-top mini voice overlay (Discord-style "always-on voice" surface).
 * Shows current voice status (channel/call name) plus mute / deafen / leave
 * controls that round-trip through IPC back to the renderer.
 */

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const OVERLAY_WIDTH  = 260;
const OVERLAY_HEIGHT = 96;
const OVERLAY_MARGIN = 16;

let overlayWin  = null;
let overlayFile = null;
let currentState = { title: '', muted: false, deafened: false, connected: false };

function getDefaultPosition() {
  try {
    const display = screen.getPrimaryDisplay();
    const { width } = display.workAreaSize;
    return { x: Math.max(0, width - OVERLAY_WIDTH - OVERLAY_MARGIN), y: OVERLAY_MARGIN };
  } catch (_) {
    return { x: 100, y: 100 };
  }
}

const safe = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildHtml() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width:100%; height:100%; overflow:hidden; background:transparent;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    user-select:none; -webkit-user-select:none;
  }
  .bar {
    width:${OVERLAY_WIDTH}px; height:${OVERLAY_HEIGHT}px;
    background:#1e1f22; border:1px solid rgba(255,255,255,0.08);
    border-radius:12px; box-shadow:0 10px 32px rgba(0,0,0,0.55);
    display:flex; flex-direction:column; padding:10px 12px;
    -webkit-app-region:drag; cursor:move;
  }
  .row-top { display:flex; align-items:center; gap:8px; -webkit-app-region:drag; }
  .dot {
    width:8px; height:8px; border-radius:50%; flex-shrink:0;
    background:#747f8d; box-shadow:0 0 0 rgba(35,165,90,0);
    transition:background 0.15s, box-shadow 0.15s;
  }
  .dot.connected { background:#23a55a; box-shadow:0 0 6px rgba(35,165,90,0.7); }
  .title {
    font-size:12.5px; font-weight:600; color:#f2f3f5;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;
  }
  .actions {
    display:flex; align-items:center; gap:6px; margin-top:8px;
    -webkit-app-region:no-drag;
  }
  .btn {
    flex:1; height:30px; border:none; border-radius:8px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    background:#2b2d31; color:#dbdee1; font-size:13px;
    transition:background 0.12s, color 0.12s;
  }
  .btn:hover { background:#35373c; }
  .btn.active { background:#ed4245; color:#fff; }
  .btn.leave { background:#3c1618; color:#ed4245; }
  .btn.leave:hover { background:#ed4245; color:#fff; }
  </style></head><body>
    <div class="bar" id="bar">
      <div class="row-top">
        <span class="dot" id="dot"></span>
        <span class="title" id="title">Descall</span>
      </div>
      <div class="actions">
        <button class="btn" id="muteBtn" title="Toggle mute">&#127908;</button>
        <button class="btn" id="deafenBtn" title="Toggle deafen">&#127911;</button>
        <button class="btn leave" id="leaveBtn" title="Leave">&#128222;</button>
      </div>
    </div>
    <script>
      const dotEl    = document.getElementById('dot');
      const titleEl  = document.getElementById('title');
      const muteBtn  = document.getElementById('muteBtn');
      const deafenBtn = document.getElementById('deafenBtn');
      const leaveBtn = document.getElementById('leaveBtn');

      window.__overlayUpdate = (payload = {}) => {
        const { title, muted, deafened, connected } = payload;
        if (typeof title === 'string') titleEl.textContent = title || 'Descall';
        if (typeof connected === 'boolean') dotEl.classList.toggle('connected', connected);
        if (typeof muted === 'boolean') {
          muteBtn.classList.toggle('active', muted);
          muteBtn.innerHTML = muted ? '&#128263;' : '&#127908;';
        }
        if (typeof deafened === 'boolean') {
          deafenBtn.classList.toggle('active', deafened);
          deafenBtn.innerHTML = deafened ? '&#128263;' : '&#127911;';
        }
      };

      muteBtn.onclick   = () => window.overlayAPI?.action('mute');
      deafenBtn.onclick = () => window.overlayAPI?.action('deafen');
      leaveBtn.onclick  = () => window.overlayAPI?.action('leave');
    <\/script>
  </body></html>`;
}

function ensureOverlayWindow() {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin;

  const { x, y } = getDefaultPosition();
  overlayWin = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'overlayPreload.cjs'),
    },
  });

  try {
    overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch (_) { /* ignore */ }
  overlayWin.setAlwaysOnTop(true, 'screen-saver');

  overlayFile = path.join(os.tmpdir(), `descall-overlay-${Date.now()}.html`);
  fs.writeFileSync(overlayFile, buildHtml(), 'utf8');
  overlayWin.loadFile(overlayFile).catch(() => {});

  overlayWin.once('closed', () => {
    overlayWin = null;
    if (overlayFile) {
      try { fs.unlinkSync(overlayFile); } catch (_) { /* ignore */ }
      overlayFile = null;
    }
  });

  return overlayWin;
}

function pushState() {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  try {
    const js = `window.__overlayUpdate && window.__overlayUpdate(${JSON.stringify(currentState)});`;
    overlayWin.webContents.executeJavaScript(js, true).catch(() => {});
  } catch (_) { /* ignore */ }
}

function showOverlayWindow(payload = {}) {
  currentState = { ...currentState, ...payload, connected: true };
  const win = ensureOverlayWindow();

  const reveal = () => {
    if (win.isDestroyed()) return;
    if (!win.isVisible()) win.showInactive();
    pushState();
  };

  if (win.webContents.isLoadingMainFrame()) {
    win.webContents.once('did-finish-load', reveal);
  } else {
    reveal();
  }
}

function updateOverlayWindow(payload = {}) {
  currentState = { ...currentState, ...payload };
  if (!overlayWin || overlayWin.isDestroyed() || !overlayWin.isVisible()) return;
  pushState();
}

function hideOverlayWindow() {
  currentState = { ...currentState, connected: false };
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.hide();
  }
}

function destroyOverlayWindow() {
  if (overlayWin && !overlayWin.isDestroyed()) {
    try { overlayWin.close(); } catch (_) { /* ignore */ }
  }
  overlayWin = null;
}

function isOverlayWindowVisible() {
  return Boolean(overlayWin && !overlayWin.isDestroyed() && overlayWin.isVisible());
}

/**
 * Wires the descall:overlay:* IPC channels. `getMainWindow` is a lazy
 * accessor so this can be registered before the main window is created.
 */
function registerOverlayIPC(getMainWindow) {
  ipcMain.on('descall:overlay:show', (_event, payload) => showOverlayWindow(payload));
  ipcMain.on('descall:overlay:hide', () => hideOverlayWindow());
  ipcMain.on('descall:overlay:update', (_event, payload) => updateOverlayWindow(payload));
  ipcMain.on('descall:overlay:action', (_event, action) => {
    const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : null;
    mainWindow?.webContents?.send('descall:overlay:action', action);
  });
}

module.exports = {
  showOverlayWindow,
  hideOverlayWindow,
  updateOverlayWindow,
  destroyOverlayWindow,
  isOverlayWindowVisible,
  registerOverlayIPC,
};

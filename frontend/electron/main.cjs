const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, protocol, Menu, MenuItem, desktopCapturer, globalShortcut, Tray, Notification, powerMonitor } = require('electron');
const { showNotificationWindow } = require('./notificationWindow.cjs');
const { registerProcessScannerIPC } = require('./processScanner.cjs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');

// Logging
log.transports.file.level = 'info';
log.info('App starting...');

// Auto-updater — NSIS Setup installs always track the newest GitHub release.
// Portable .exe cannot self-update; users must install Setup once.
//
// Feed uses generic "latest/download" URLs (not GitHub Releases API) so
// Render/desktop clients are not blocked by API rate limits.
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;
// Full Setup download is more reliable than delta/blockmap across jumps
autoUpdater.disableDifferentialDownload = true;
// App is not code-signed — signature checks would block every update
if (process.platform === 'win32') {
  try {
    autoUpdater.verifyUpdateCodeSignature = false;
  } catch (_) { /* older electron-updater */ }
}

const UPDATE_FEED_URL =
  'https://github.com/demirrsarppkurtlarr/Descall/releases/latest/download/';

try {
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: UPDATE_FEED_URL,
    channel: 'latest',
  });
  log.info('[updater] feed =', UPDATE_FEED_URL);
} catch (err) {
  log.warn('[updater] setFeedURL(generic) failed, falling back to github provider:', err?.message);
  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'demirrsarppkurtlarr',
      repo: 'Descall',
    });
  } catch (err2) {
    log.warn('[updater] setFeedURL(github) also failed:', err2?.message);
  }
}

let updateReady = false;
let updateVersion = null;
let updateCheckTimer = null;
let updateRetryTimer = null;
let installTimer = null;
let updateCheckInFlight = false;
let powerHooksBound = false;
const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
const UPDATE_STARTUP_DELAY_MS = 3 * 1000;        // soon after open
const UPDATE_INSTALL_DELAY_MS = 12 * 1000;       // after download → silent install

function applyDownloadedUpdate(reason = 'auto') {
  if (!updateReady || !app.isPackaged) return;
  log.info(`[updater] quitAndInstall (${reason}) → v${updateVersion || '?'}`);
  isQuitting = true;
  try {
    // isSilent=true → NSIS /S replaces old install; isForceRunAfter=true relaunches
    autoUpdater.quitAndInstall(true, true);
  } catch (err) {
    log.error('[updater] quitAndInstall failed:', err?.message || err);
    isQuitting = false;
  }
}

function scheduleSilentInstall() {
  if (installTimer) clearTimeout(installTimer);
  if (!updateReady) return;
  installTimer = setTimeout(() => {
    installTimer = null;
    applyDownloadedUpdate('scheduled');
  }, UPDATE_INSTALL_DELAY_MS);
}

function checkForAppUpdates(reason = 'manual') {
  if (!app.isPackaged) {
    log.info(`[updater] skip check (${reason}) — not packaged`);
    return Promise.resolve(null);
  }
  if (updateReady) {
    log.info(`[updater] skip check (${reason}) — update already downloaded, installing`);
    scheduleSilentInstall();
    return Promise.resolve(null);
  }
  if (updateCheckInFlight) {
    log.info(`[updater] skip check (${reason}) — already in flight`);
    return Promise.resolve(null);
  }
  updateCheckInFlight = true;
  log.info(`[updater] checking for updates (${reason})… current=${app.getVersion()} feed=${UPDATE_FEED_URL}`);
  return autoUpdater.checkForUpdates()
    .then((result) => {
      if (updateRetryTimer) {
        clearTimeout(updateRetryTimer);
        updateRetryTimer = null;
      }
      const next = result?.updateInfo?.version;
      if (next) log.info(`[updater] check result: latest=${next}`);
      return result;
    })
    .catch((err) => {
      log.error(`[updater] check failed (${reason}):`, err?.message || err);
      if (!updateRetryTimer) {
        updateRetryTimer = setTimeout(() => {
          updateRetryTimer = null;
          checkForAppUpdates('retry');
        }, 2 * 60 * 1000);
      }
      return null;
    })
    .finally(() => {
      updateCheckInFlight = false;
    });
}

function scheduleBackgroundUpdateChecks() {
  if (!app.isPackaged) return;
  if (updateCheckTimer) clearInterval(updateCheckTimer);

  // Every app open
  setTimeout(() => checkForAppUpdates('startup'), UPDATE_STARTUP_DELAY_MS);
  // Every 10 minutes while running
  updateCheckTimer = setInterval(() => checkForAppUpdates('interval-10m'), UPDATE_CHECK_INTERVAL_MS);

  if (!powerHooksBound) {
    powerHooksBound = true;
    try {
      powerMonitor.on('resume', () => {
        setTimeout(() => checkForAppUpdates('resume'), 5 * 1000);
      });
      powerMonitor.on('unlock-screen', () => {
        setTimeout(() => checkForAppUpdates('unlock'), 5 * 1000);
      });
    } catch (err) {
      log.warn('[updater] powerMonitor hooks unavailable:', err?.message);
    }
  }
}

// Paths
const isDev = process.env.NODE_ENV === 'development';
const isPackaged = app.isPackaged;

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

// Create splash window
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadURL(`data:text/html,
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            width: 500px;
            height: 300px;
            background: linear-gradient(135deg, #6678ff 0%, #8b5cf6 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            overflow: hidden;
            border-radius: 20px;
          }
          .logo {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 20px;
            text-shadow: 0 4px 20px rgba(0,0,0,0.3);
          }
          .loading {
            font-size: 16px;
            opacity: 0.9;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-top: 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .version {
            position: absolute;
            bottom: 20px;
            font-size: 12px;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div class="logo">Descall</div>
        <div class="loading">Yükleniyor...</div>
        <div class="spinner"></div>
        <div class="version">v${app.getVersion()}</div>
      </body>
    </html>
  `);

  splashWindow.center();
}

// Create main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    // Frameless — React TitleBar provides window controls (avoids double title bars)
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  mainWindow.setMenu(null);
  Menu.setApplicationMenu(null);

  // Close → minimize to tray instead of quitting
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      // Update already downloaded → install as soon as we go to tray
      if (updateReady) {
        e.preventDefault();
        mainWindow.hide();
        applyDownloadedUpdate('tray-close');
        return;
      }
      e.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'Descall',
          content: 'Descall arka planda çalışmaya devam ediyor.',
        });
      }
    }
  });

  // IPC handlers for window controls
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  // Handle maximize state change
  mainWindow.on('maximize', () => {
    mainWindow?.webContents?.send('window:maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents?.send('window:maximized', false);
  });

  // Notification handlers
  ipcMain.handle('notification:request-permission', async () => true);

  const dispatchNotification = ({ title, body, tag, data, requireInteraction = false, silent = false, avatarUrl = null }) => {
    const type = data?.type === 'call' || data?.type === 'group-call' ? 'call'
      : data?.type === 'mention' ? 'mention'
      : 'default';

    showNotificationWindow({
      title: title || 'Descall',
      body: body || '',
      type,
      avatarUrl: avatarUrl || null,
      duration: requireInteraction ? 0 : 5000,
      onClick: () => {
        if (mainWindow) {
          mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        mainWindow?.webContents?.send('notification:click', { title, body, tag, data });
      },
    });
  };

  ipcMain.on('notification:show', (_, { title, options = {} }) => {
    dispatchNotification({ title, ...options });
  });

  ipcMain.handle('show-notification', (_, payload) => {
    dispatchNotification(payload || {});
  });

  // Allow screen capture permissions
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'display-capture', 'screen', 'audioCapture', 'videoCapture'];
    callback(allowed.includes(permission));
  });

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    const allowed = ['media', 'display-capture', 'screen', 'audioCapture', 'videoCapture'];
    return allowed.includes(permission);
  });

  // Right-click context menu for DevTools
  mainWindow.webContents.on('context-menu', () => {
    const menu = new Menu();
    menu.append(new MenuItem({
      label: 'Toggle Developer Tools',
      click: () => mainWindow?.webContents.toggleDevTools(),
    }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: 'Reload',
      click: () => mainWindow?.webContents.reload(),
    }));
    menu.popup();
  });

  // Set CSP headers to allow Supabase and API connections
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "connect-src 'self' https://des-call.onrender.com https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://des-call.onrender.com http://localhost:5173 https://api.github.com; " +
          "img-src 'self' https://*.supabase.co https://*.supabase.in https://*.githubusercontent.com data: blob:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "media-src 'self' blob:;"
        ]
      }
    });
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // extraResources puts files in resources/dist/
    const indexPath = path.join(process.resourcesPath, 'dist', 'index.html');
    console.log('Loading from:', indexPath);
    
    if (require('fs').existsSync(indexPath)) {
      mainWindow.loadFile(indexPath).catch(err => {
        console.error('Failed to load:', err);
        dialog.showErrorBox('Loading Error', `Failed to load app: ${err.message}`);
      });
    } else {
      // Fallback paths
      const altPaths = [
        path.join(app.getAppPath(), 'dist', 'index.html'),
        path.join(__dirname, 'dist', 'index.html'),
        path.join(__dirname, '..', 'dist', 'index.html')
      ];
      
      let found = false;
      for (const altPath of altPaths) {
        console.log('Trying:', altPath);
        if (require('fs').existsSync(altPath)) {
          console.log('Found at:', altPath);
          mainWindow.loadFile(altPath);
          found = true;
          break;
        }
      }
      
      if (!found) {
        dialog.showErrorBox('Loading Error', `index.html not found at: ${indexPath}\nTried:\n${altPaths.join('\n')}`);
      }
    }
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();

    // Re-arm checks when UI is up (also already started in whenReady)
    scheduleBackgroundUpdateChecks();
  });

  // Window events
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.includes('localhost') && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Descall');

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: 'Descall\'i Aç',
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: 'separator' },
    {
      label: 'Windows ile Başlat',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        tray.setContextMenu(buildMenu());
      },
    },
    { type: 'separator' },
    {
      label: updateReady ? `Güncelle ve Çık (v${updateVersion || ''})` : 'Çıkış',
      click: () => {
        isQuitting = true;
        if (updateReady) {
          try {
            autoUpdater.quitAndInstall(true, true);
            return;
          } catch (err) {
            log.error('[updater] tray quitAndInstall failed:', err?.message);
          }
        }
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(buildMenu());
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// App events
app.whenReady().then(() => {
  // Enable startup on first run (packaged only)
  if (isPackaged && !app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  // Start update loop as soon as the process is ready (every open + 10m)
  scheduleBackgroundUpdateChecks();

  createSplashWindow();
  setTimeout(() => {
    createMainWindow();
    createTray();
  }, 1500);

  registerProcessScannerIPC();

  globalShortcut.register('F12', () => mainWindow?.webContents.toggleDevTools());
  globalShortcut.register('CommandOrControl+Shift+I', () => mainWindow?.webContents.toggleDevTools());

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit — stay in tray
});

app.on('before-quit', () => {
  isQuitting = true;
  // autoInstallOnAppQuit=true applies a downloaded update during this quit
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  log.info('[updater] Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('[updater] Update available, downloading silently:', info.version);
  mainWindow?.webContents?.send('update:downloading', { version: info.version });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('[updater] Already up-to-date:', info.version);
});

autoUpdater.on('error', (err) => {
  log.error('[updater] Error:', err?.message ?? err);
  mainWindow?.webContents?.send('update:error', { message: err?.message || String(err) });
});

autoUpdater.on('download-progress', ({ percent, bytesPerSecond, transferred, total }) => {
  log.info(`[updater] Downloading: ${percent.toFixed(1)}% (${bytesPerSecond} B/s)`);
  mainWindow?.webContents?.send('update:progress', { percent, bytesPerSecond, transferred, total });
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('[updater] Update downloaded — scheduling silent install:', info.version);
  updateReady = true;
  updateVersion = info.version;

  mainWindow?.webContents?.send('update:ready', { version: info.version });
  mainWindow?.webContents?.send('update:installing', { version: info.version });

  if (tray) {
    tray.displayBalloon({
      iconType: 'info',
      title: 'Descall Güncelleniyor',
      content: `v${info.version} indirildi. Birkaç saniye içinde sessizce kurulacak…`,
    });
  }

  showNotificationWindow({
    title: 'Descall Güncelleniyor',
    body: `v${info.version} arka planda kuruluyor. Uygulama kısa süre yeniden başlayacak.`,
    type: 'default',
    duration: 8000,
    onClick: () => {
      mainWindow?.show();
      mainWindow?.focus();
    },
  });

  // Always apply in background — replaces old Setup install and relaunches
  scheduleSilentInstall();
});

// ─── Notification IPC ────────────────────────────────────────────────────────
// tag → BrowserWindow — prevents duplicate notifications for the same event
const activeNotifByTag = new Map();

ipcMain.on('notification:show', (event, { title, options = {} } = {}) => {
  const { body, tag = 'descall', data = {} } = options;

  // Deduplicate: close any existing window with the same tag
  if (activeNotifByTag.has(tag)) {
    const existing = activeNotifByTag.get(tag);
    try { if (!existing.isDestroyed()) existing.close(); } catch (_) {}
    activeNotifByTag.delete(tag);
  }

  const isCall    = data.type === 'call' || data.type === 'group-call';
  const notifType = isCall ? 'call' : (tag.startsWith('mention') ? 'mention' : 'default');
  const duration  = isCall ? 0 : 5000;

  const win = showNotificationWindow({
    title,
    body,
    type:     notifType,
    duration,
    onClick:  () => {
      mainWindow?.show();
      mainWindow?.focus();
      mainWindow?.webContents.send('notification:click', data);
    },
    onAccept: isCall ? () => {
      mainWindow?.show();
      mainWindow?.focus();
      mainWindow?.webContents.send('notification:call-accept', data);
    } : undefined,
    onDecline: isCall ? () => {
      mainWindow?.webContents.send('notification:call-decline', data);
    } : undefined,
  });

  if (win) {
    activeNotifByTag.set(tag, win);
    win.once('closed', () => {
      if (activeNotifByTag.get(tag) === win) activeNotifByTag.delete(tag);
    });
  }
});

// IPC handlers
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  if (!isPackaged) return { success: true, skipped: true };
  try {
    const result = await checkForAppUpdates('ipc');
    return { success: true, updateInfo: result?.updateInfo || null, updateReady, updateVersion };
  } catch (err) {
    log.error('[updater] Manual check failed:', err?.message);
    return { success: false, error: err?.message };
  }
});

ipcMain.handle('restart-app', () => {
  if (updateReady) {
    isQuitting = true;
    autoUpdater.quitAndInstall(true, true); // silent, force run after
  } else {
    app.relaunch();
    app.quit();
  }
});

ipcMain.handle('get-update-status', () => {
  return { updateReady, updateVersion };
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('is-window-focused', () => mainWindow ? mainWindow.isFocused() : false);

ipcMain.handle('focus-window', () => {
  if (!mainWindow) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

// Desktop capturer — screen share sources
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 240 },
      fetchWindowIcons: true,
    });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnailDataURL: s.thumbnail.toDataURL(),
    }));
  } catch (err) {
    log.error('get-screen-sources error:', err);
    return [];
  }
});

// Security: Handle downloads
ipcMain.on('download-file', async (event, { url, filename }) => {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(url);
    const buffer = await response.buffer();
    
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, filename);
    
    fs.writeFileSync(filePath, buffer);
    
    shell.showItemInFolder(filePath);
    return { success: true, path: filePath };
  } catch (error) {
    log.error('Download error:', error);
    return { success: false, error: error.message };
  }
});

// Register custom protocol for sounds
app.on('ready', () => {
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6); // Remove 'app://'
    const filePath = path.join(__dirname, '..', url);
    callback({ path: filePath });
  });
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

log.info('Electron main process initialized');

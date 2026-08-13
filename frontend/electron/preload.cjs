const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app-version'),
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onMaximizedChange: (callback) => ipcRenderer.on('window:maximized', (_, isMaximized) => callback(isMaximized)),
  
  // Platform
  platform: process.platform,
  
  // Is electron
  isElectron: true,
  
  // Download
  downloadFile: (url, filename) => ipcRenderer.send('download-file', { url, filename }),
  
  // Listen for events from main
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', callback);
  },

  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', callback);
  },

  // Silent auto-update progress events
  onUpdateDownloading: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:downloading', handler);
    return () => ipcRenderer.off('update:downloading', handler);
  },
  onUpdateInstalling: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:installing', handler);
    return () => ipcRenderer.off('update:installing', handler);
  },
  onUpdateProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.off('update:progress', handler);
  },
  onUpdateReady: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:ready', handler);
    return () => ipcRenderer.off('update:ready', handler);
  },
  onUpdateError: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update:error', handler);
    return () => ipcRenderer.off('update:error', handler);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Notifications
  requestNotificationPermission: () => ipcRenderer.invoke('notification:request-permission'),
  showNotification: (title, options) => ipcRenderer.send('notification:show', { title, options }),
  onNotificationClick: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('notification:click', handler);
    return () => ipcRenderer.off('notification:click', handler);
  },
  onNotificationClicked: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('notification:click', handler);
    return () => ipcRenderer.off('notification:click', handler);
  },
  onCallAccept: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('notification:call-accept', handler);
    return () => ipcRenderer.off('notification:call-accept', handler);
  },
  onCallDecline: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('notification:call-decline', handler);
    return () => ipcRenderer.off('notification:call-decline', handler);
  },

  // Desktop screen sharing
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),

  // Window focus helpers (used by notificationService)
  isWindowFocused: () => ipcRenderer.invoke('is-window-focused'),
  focusWindow: () => ipcRenderer.invoke('focus-window'),

  // Activity / process scanning
  scanProcesses: () => ipcRenderer.invoke('scan-processes'),

  // Always-on voice mini overlay (Discord-style always-on-top HUD)
  overlayShow: (payload) => ipcRenderer.send('descall:overlay:show', payload || {}),
  overlayHide: () => ipcRenderer.send('descall:overlay:hide'),
  overlayUpdate: (payload) => ipcRenderer.send('descall:overlay:update', payload || {}),
  onOverlayAction: (callback) => {
    const handler = (_, action) => callback(action);
    ipcRenderer.on('descall:overlay:action', handler);
    return () => ipcRenderer.off('descall:overlay:action', handler);
  },
});

// Log preload loaded
console.log('[Preload] Electron API exposed');

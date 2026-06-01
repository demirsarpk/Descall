const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Version
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // Platform
  platform: process.platform,
  isElectron: true,
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', callback);
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', callback);
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Native notifications
  showNotification: (title, options) => ipcRenderer.invoke('show-notification', { title, ...options }),
  isWindowFocused: () => ipcRenderer.invoke('is-window-focused'),
  focusWindow: () => ipcRenderer.invoke('focus-window'),
  onNotificationClicked: (callback) => {
    ipcRenderer.on('notification:clicked', (_event, data) => callback(data));
  },
});

// Confirm preload loaded
console.log('[Preload] Electron API exposed');

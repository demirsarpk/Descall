const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app-version'),
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
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
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Notifications
  requestNotificationPermission: () => ipcRenderer.invoke('notification:request-permission'),
  showNotification: (title, options) => ipcRenderer.send('notification:show', { title, options }),
  onNotificationClick: (callback) => ipcRenderer.on('notification:click', (_, data) => callback(data)),
  onNotificationClicked: (callback) => ipcRenderer.on('notification:click', (_, data) => callback(data)),

  // Desktop screen sharing
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
});

// Log preload loaded
console.log('[Preload] Electron API exposed');

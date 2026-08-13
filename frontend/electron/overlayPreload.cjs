'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  action: (type) => ipcRenderer.send('descall:overlay:action', type),
});

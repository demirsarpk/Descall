'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notifAPI', {
  click: () => ipcRenderer.send('notif:click'),
  close: () => ipcRenderer.send('notif:close'),
});

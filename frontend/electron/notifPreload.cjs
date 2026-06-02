'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notifAPI', {
  click:   () => ipcRenderer.send('notif:click'),
  close:   () => ipcRenderer.send('notif:close'),
  accept:  () => ipcRenderer.send('notif:accept'),
  decline: () => ipcRenderer.send('notif:decline'),
});

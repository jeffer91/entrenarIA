const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.freeze({save: payload => ipcRenderer.invoke('file:export',payload), generate: payload => ipcRenderer.invoke('ollama:generate',payload), pdf: payload => ipcRenderer.invoke('report:pdf',payload)}));

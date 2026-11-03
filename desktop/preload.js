const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hagisiroWidget', {
  getBounds: () => ipcRenderer.invoke('wb-get'),
  setBounds: (b, mode) => ipcRenderer.send('wb-set', b, mode),
  done: () => ipcRenderer.send('wb-done'),
  getAutoStart: () => ipcRenderer.invoke('as-get'),
  setAutoStart: (v) => ipcRenderer.invoke('as-set', !!v),
  setMinWidth: (w) => ipcRenderer.send('min-w', w),
  quit: () => ipcRenderer.send('quit'),
});

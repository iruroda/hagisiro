const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hagisiroWidget', {
  getBounds: () => ipcRenderer.invoke('wb-get'),
  setBounds: (b, mode) => ipcRenderer.send('wb-set', b, mode),
  done: () => ipcRenderer.send('wb-done'),
});

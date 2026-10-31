const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ibraMind', {
  auth: {
    takePending: () => ipcRenderer.invoke('auth:take-pending'),
    acknowledge: (url) => ipcRenderer.invoke('auth:ack', url),
    onCallback: (handler) => {
      if (typeof handler !== 'function') return () => undefined;
      const listener = (_event, url) => handler(url);
      ipcRenderer.on('auth:callback', listener);
      return () => ipcRenderer.removeListener('auth:callback', listener);
    },
  },
  media: { requestMicrophone: () => ipcRenderer.invoke('app:request-microphone') },
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    save: (provider) => ipcRenderer.invoke('providers:save', provider),
    remove: (id) => ipcRenderer.invoke('providers:remove', id),
    models: (id) => ipcRenderer.invoke('providers:models', id),
    test: (id) => ipcRenderer.invoke('providers:test', id),
    complete: (request) => ipcRenderer.invoke('providers:complete', request),
    transcribe: (request) => ipcRenderer.invoke('providers:transcribe', request),
  },
});

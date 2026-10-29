const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  platform: process.platform,
  listAudioSources: () => ipcRenderer.invoke('core07:list-sources'),
  startAudio: (options) => ipcRenderer.invoke('core07:start-audio', options),
  stopAudio: () => ipcRenderer.invoke('core07:stop-audio'),
  getAudioState: () => ipcRenderer.invoke('core07:audio-state'),
  onAudioChunk: (callback) => {
    const listener = (_event, data) => {
      if (typeof callback === 'function') callback(data);
    };
    ipcRenderer.on('core07:audio-chunk', listener);
    return () => ipcRenderer.removeListener('core07:audio-chunk', listener);
  }
});

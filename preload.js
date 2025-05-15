const { contextBridge, ipcRenderer } = require('electron');
// Expose protected IPC methods to the renderer process
contextBridge.exposeInMainWorld('api', {
  onLogModelPath: (fn) => ipcRenderer.on('log-model-path', (_, modelPath) => fn(modelPath)),
  // … any other exposed APIs …
});
contextBridge.exposeInMainWorld('mainLogger', {
  onMainError: (callback) => ipcRenderer.on('main-process-error', (_, data) => callback(data))
});
contextBridge.exposeInMainWorld('electron', {
  log: (message) => ipcRenderer.send('log', message),
  onPythonLog: (callback) => ipcRenderer.on('python-log', callback),
  onPythonDebug: (callback) => ipcRenderer.on('python-debug', callback), // use consistent name
});
contextBridge.exposeInMainWorld('electronAPI', {
  // Shortcut management
  checkVoskModel: () => ipcRenderer.invoke('check-vosk-model'),
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  addShortcut: (data) => ipcRenderer.invoke('add-shortcut', data),
  updateShortcut: (data) => ipcRenderer.invoke('update-shortcut', data),
  deleteShortcut: (id) => ipcRenderer.invoke('delete-shortcut', id),
  getShortcutFile: (id) => ipcRenderer.invoke('get-shortcut-file', id),
  launchShortcut: (id) => ipcRenderer.invoke('launch-shortcut', id),
  saveDownloadedFile: (fileData, fileName) => ipcRenderer.invoke('save-downloaded-file', fileData, fileName),
  selectFile: () => ipcRenderer.invoke('select-file'),
  
  // File system operations
  readFile: (path, options) => ipcRenderer.invoke('read-file', path, options),
  writeFile: (path, data) => ipcRenderer.invoke('write-file', path, data),
  fileExists: (path) => ipcRenderer.invoke('file-exists', path),
  
  // Vosk model operations
  getVoskModelPath: () => ipcRenderer.invoke('get-vosk-model-path'),
  checkVoskModel: () => ipcRenderer.invoke('check-vosk-model'),
  downloadVoskModel: () => ipcRenderer.invoke('download-vosk-model'),
  
  // Speech recognition control
  startListening: () => ipcRenderer.invoke('start-listening'),
  stopListening: () => ipcRenderer.invoke('stop-listening'),
  sendTranscriptResult: (data) => ipcRenderer.invoke('vosk-transcript-result', data),
  
  // Event listeners
  onAudioData: (callback) => ipcRenderer.on('audio-data', (_, data) => callback(data)),
  onVoskStatus: (callback) => ipcRenderer.on('vosk-status', (_, data) => callback(data)),
  onVoskModelReady: (callback) => ipcRenderer.on('vosk-model-ready', (_, data) => callback(data)),
  onVoskPartial: (callback) => ipcRenderer.on('vosk-partial', (_, data) => callback(data)),
  onVoskTranscript: (callback) => ipcRenderer.on('vosk-transcript', (_, data) => callback(data)),
  onVoskCommandActivated: (callback) => ipcRenderer.on('vosk-command-activated', (_, data) => callback(data)),
  onShortcutLaunching: (callback) => ipcRenderer.on('shortcut-launching', (_, data) => callback(data)),
  onShowConfigModal: (callback) => ipcRenderer.on('show-config-modal', (_, data) => callback(data)),
  onVoiceStatus: (callback) => ipcRenderer.on('voice-status', callback),
  // Cleanup function for event listeners
  cleanup: () => {
    ipcRenderer.removeAllListeners('audio-data');
    ipcRenderer.removeAllListeners('vosk-status');
    ipcRenderer.removeAllListeners('vosk-model-ready');
    ipcRenderer.removeAllListeners('vosk-partial');
    ipcRenderer.removeAllListeners('vosk-transcript');
    ipcRenderer.removeAllListeners('vosk-command-activated');
    ipcRenderer.removeAllListeners('shortcut-launching');
    ipcRenderer.removeAllListeners('show-config-modal');
  }
});
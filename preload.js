const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');

// Expose protected methods that allow the renderer process to use
// Electron and Node.js capabilities without exposing the entire API
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app info
  getAppInfo: () => {
    return {
      platform: process.platform,
      homeDir: os.homedir(),
      appDir: path.join(os.homedir(), 'TheShortcutter')
    };
  },

  // File operations
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveDownloadedFile: (fileData, fileName) => 
    ipcRenderer.invoke('save-downloaded-file', fileData, fileName),
  launchShortcut: (filePath) => 
    ipcRenderer.invoke('launch-shortcut', filePath),

  // Custom API endpoint
  apiBaseUrl: 'https://pat.ipo-servers.net:8080'
});

// Inject a simple notification to confirm the preload script is working
window.addEventListener('DOMContentLoaded', () => {
  console.log('TheShortcutter Electron app initialized');
});
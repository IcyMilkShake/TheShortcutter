const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;

// Configuration
const APP_NAME = 'TheShortcutter';
const API_URL = 'https://pat.ipo-servers.net:8080'; // Your remote API URL

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // For security reasons
      contextIsolation: true, // Protect against prototype pollution
      preload: path.join(__dirname, 'preload.js') // Use a preload script
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false // Don't show until ready-to-show
  });

  // Load the index.html of the app
  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window being closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Handle IPC communications between renderer and main process

// Launch downloaded shortcut files
ipcMain.handle('launch-shortcut', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Handle different platforms
    if (process.platform === 'win32') {
      // On Windows, we can directly execute .lnk files
      shell.openPath(filePath);
    } else if (process.platform === 'darwin') {
      // On MacOS we need to handle differently (would need additional logic)
      shell.openPath(filePath);
    } else {
      // Linux - might need specific handling
      shell.openPath(filePath);
    }

    return { success: true };
  } catch (error) {
    console.error('Error launching shortcut:', error);
    return { success: false, error: error.message };
  }
});

// Handle file downloads
ipcMain.handle('save-downloaded-file', async (event, fileData, fileName) => {
  try {
    // Define download directory
    const downloadPath = path.join(os.homedir(), 'TheShortcutter', 'shortcuts');
    
    // Ensure directory exists
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
    
    // Save the file
    const filePath = path.join(downloadPath, fileName);
    
    // Convert base64 to buffer if it's in that format
    let data;
    if (fileData.startsWith('data:')) {
      const base64Data = fileData.split(',')[1];
      data = Buffer.from(base64Data, 'base64');
    } else {
      data = Buffer.from(fileData);
    }
    
    fs.writeFileSync(filePath, data);
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
});

// Select a file from the file system
ipcMain.handle('select-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Shortcuts', extensions: ['lnk'] }]
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    const filePath = result.filePaths[0];
    const fileData = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    return {
      success: true,
      fileName,
      filePath,
      fileData: fileData.toString('base64')
    };
  } catch (error) {
    console.error('Error selecting file:', error);
    return { success: false, error: error.message };
  }
});
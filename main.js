const { app, BrowserWindow, ipcMain, shell, dialog, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { pipeline } = require('stream');
const { promisify } = require('util');
// Register custom protocol before app ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
]);

// Global error handlers
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

const streamPipeline = promisify(pipeline);
const NODE_ENV = process.env.NODE_ENV || 'production';

// Constants
const DEVELOPMENT = NODE_ENV === 'development';
const APP_DATA_DIR = path.dirname(__dirname); // Assuming this is the root folder of your project
const SHORTCUTS_DIR = path.join(APP_DATA_DIR, 'shortcuts');
const PROJECT = path.join(APP_DATA_DIR, 'TheShortcutterFrontEnd');
const VOSK_MODEL_DIR = DEVELOPMENT
  ? path.join(PROJECT, 'vosk-model') // Development path
  : path.join(process.resourcesPath, 'vosk-model'); // Production path (resources directory)
const PYTHON_SCRIPTS_DIR = DEVELOPMENT
  ? path.join(PROJECT, 'python_scripts') // Development path
  : path.join(process.resourcesPath, 'python_scripts'); // Production path (resources directory)
// Ensure data directories
for (const dir of [APP_DATA_DIR, SHORTCUTS_DIR, VOSK_MODEL_DIR, PYTHON_SCRIPTS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function forwardErrorToRenderer(tag, err) {
  console.error(tag, err);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('main-process-error', {
      tag,
      message: err.message,
      stack: err.stack
    });
  }
}

process.on('uncaughtException', (err) => forwardErrorToRenderer('Uncaught Exception', err));
process.on('unhandledRejection', (reason) => {
  forwardErrorToRenderer('Unhandled Rejection', reason instanceof Error ? reason : new Error(reason));
});
// Deploy Python script
function deployPythonScript() {
  const scriptSrc = path.join(__dirname, 'voice_recognition.py');
  const scriptDest = path.join(PYTHON_SCRIPTS_DIR, 'voice_recognition.py');
  
  // Copy the script if it doesn't exist or needs to be updated
  try {
    // Ensure script is there and up to date
    fs.copyFileSync(scriptSrc, scriptDest);
    fs.chmodSync(scriptDest, 0o755); // Make executable
    console.log('Python script deployed successfully');
    return scriptDest;
  } catch (error) {
    console.error('Failed to deploy Python script:', error);
    throw error;
  }
}

// Load shortcuts DB
let shortcutsDb = [];
const DB_FILE = path.join(APP_DATA_DIR, 'shortcuts.json');
try {
  if (fs.existsSync(DB_FILE)) {
    shortcutsDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) || [];
    console.log(`Loaded ${shortcutsDb.length} shortcuts`);
  }
} catch (e) {
  console.error('DB load error:', e);
}
function saveDatabase() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(shortcutsDb, null, 2)); }
  catch (e) { console.error('DB save error:', e); }
}
function generateId() { return Math.random().toString(36).substr(2, 9); }


/*
const REGION     = "f1db6c";
const PROJECT_ID = "efc6b7e137fd-4f1a-8a76-0625d66ce6e9";
const API_KEY    = "sk-YjlmZDUzMTAtY2Y2Zi00ZGJhLWI5ZTUtNzgyMTkzMjg5Yzll"; 
const AGENT_ID   = "68197669-9139-47a8-a790-6f77f46ec242";

const userMessage = "open hay";

const endpoint = `https://api-${REGION}.stack.tryrelevance.com/latest/agents/trigger`;
const authHeader = `${PROJECT_ID}:${API_KEY}`;

fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": authHeader
  },
  body: JSON.stringify({
    message: {
      role: "user",
      content: `${"Spoken text:", userMessage} | All Shortcuts: ${JSON.stringify(shortcutsDb)}`
    },
    agent_id: AGENT_ID 
  })
})
.then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();  
})
.then(json => {
  console.log("✅ Agent Response:", json);
})
.catch(err => {
  console.error("❌ Error triggering agent:", err);
});
*/


// Speech recognition variables
let pythonProcess;
let isListening = false;
let voskModelPath = path.join(VOSK_MODEL_DIR, 'vosk-model-small-en-us-0.15');

let mainWindow;

async function createWindow() {
  console.log('Creating window...');
  try {
    protocol.handle('app', ({ url }) => {
      const resource = url.replace('app://', '');
      return { path: path.join(__dirname, resource) };
    });

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      icon: path.join(__dirname, 'assets', 'icon.png'),
      webPreferences: {
        devTools: false,
        nodeIntegration: true,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    mainWindow.removeMenu();
    mainWindow.webContents.on('did-fail-load', (e, errorCode, errorDesc, validatedURL) => {
      console.error(`Load failed (${errorCode}): ${validatedURL} -> ${errorDesc}`);
    });

    console.log('Loading index.html');
    await mainWindow.loadFile(path.join(__dirname, 'index.html'));
    console.log('File loaded, showing window');
    mainWindow.show();
    
    if (DEVELOPMENT) mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => { 
      mainWindow = null;
      stopSpeechRecognition();
    });
    
    // Set up Python-based speech recognition
    deployPythonScript();
    const modelCheck = checkVoskModel();
      if (mainWindow) {
        mainWindow.webContents.send('check-vosk-model', modelCheck);
      }
    if (modelCheck.exists) {
      // Start speech recognition when window is created
      startSpeechRecognition();
    } else {
      // Notify that model is missing
      if (mainWindow) {
        mainWindow.webContents.send('vosk-status', {
          status: 'error',
          message: 'Speech recognition model not found'
        });
      }
    }
    
    // Listen for window focus/blur events
    mainWindow.on('focus', () => {
      if (!isListening) {
        startSpeechRecognition();
      }
    });
    
    mainWindow.on('blur', () => {
      if (isListening) {
        stopSpeechRecognition();
      }
    });
  } catch (err) {
    console.error('createWindow error:', err);
  }
}

// Vosk model helpers
function getVoskModelPath() { 
  return voskModelPath;
}

function checkVoskModel() {
  const p = getVoskModelPath();
  return { exists: fs.existsSync(p), path: p };
}
function getPythonExecutablePath() {
  if (DEVELOPMENT) {
    // Custom Python path for development
    const devPythonPath = 'C:\\CodingProjects\\TheShortcutterFrontEnd\\dev_python\\Python\\Python313\\python.exe'; // Replace with your development Python path
    if (fs.existsSync(devPythonPath)) {
      return devPythonPath;
    }
    throw new Error(`Development Python not found at: ${devPythonPath}`);
  }else{
      return path.join(process.resourcesPath, 'python_executor', 'Scripts', 'python.exe');
  }
}

// Python-based Speech Recognition
function startSpeechRecognition() {
  try {
    if (isListening || pythonProcess) {
      // Already running
      return;
    }
    
    console.log("Starting Python-based speech recognition");
    
    // Check if model exists
    const modelCheck = checkVoskModel();
    if (!modelCheck.exists) {
      console.error("Vosk model not found at", modelCheck.path);
      if (mainWindow) {
        mainWindow.webContents.send('vosk-status', {
          status: 'error',
          message: 'Speech recognition model not found'
        });
      }
      return;
    } else {
      mainWindow.webContents.send('log-model-path', getVoskModelPath());
    }
    console.log(`Model Path: found`);

    // Notify that we're starting
    if (mainWindow) {
      mainWindow.webContents.send('vosk-status', {
        status: 'starting',
        message: 'Starting speech recognition...'
      });
    }
    
    // Path to Python script
    const pythonScriptPath = path.join(PYTHON_SCRIPTS_DIR, 'voice_recognition.py');
    
    //const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3'
    //const pythonExecutable = path.join(process.resourcesPath, 'python_executor', 'python.exe')
    console.log(process.PATH)
    pythonExecutable = getPythonExecutablePath()
    console.log(`Using Python at: ${pythonExecutable}`);
    mainWindow.webContents.send('python-log', "Using Python at: " + pythonExecutable);
    console.log(`Script path: ${pythonScriptPath}`);
    mainWindow.webContents.send('python-log', "Using Script at: " + pythonScriptPath);
    console.log(`Model path: ${modelCheck.path}`);
    mainWindow.webContents.send('python-log', "Using Model at: " + modelCheck.path);
    
    if (!fs.existsSync(pythonScriptPath)) {
      const errorMsg = `Python script not found at: ${pythonScriptPath}`;
      console.error(errorMsg);
      if (mainWindow) {
        mainWindow.webContents.send('python-log', errorMsg);
        mainWindow.webContents.send('vosk-status', {
          status: 'error',
          message: 'Python script not found'
        });
      }
      return;
    }
    if (fs.existsSync(pythonExecutable)) {
      console.log(`Using embedded Python: ${pythonExecutable}`);
      console.log("until this shit turns right path dont send to ur uncle fr")
      mainWindow.webContents.send('python-log', `Using embedded Python: ${pythonExecutable}`);
      mainWindow.webContents.send('python-log', "until this shit turns right path dont send to ur uncle fr");
    } else {
      console.log('Python executable not found, using fallback');
    }
    // Start the Python process with explicit options
    let envVariables = { ...process.env };

// Optionally, you can set custom environment variables like this:
    if (!DEVELOPMENT) {
        envVariables.PYTHONPATH = path.join(process.resourcesPath, 'python_executor', 'Python313', 'site-packages');
    }
    pythonProcess = spawn(pythonExecutable, [pythonScriptPath, '--model-path', modelCheck.path], {
      env: envVariables, // Ensure environment variables are passed correctly
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let dataBuffer = '';
    console.log("Environment variables:", envVariables);
    
    if (mainWindow) {
      mainWindow.webContents.send('python-log', `✅ Python process started using: ${pythonExecutable}`);
    }
    // First data handler for stdout
    pythonProcess.stdout.on('data', (data) => {
      dataBuffer += data.toString();
      try {
        const messages = data.toString().trim().split('\n');
        for (const message of messages) {
          if (!message.trim()) continue;
          
          try {
            const parsedMessage = JSON.parse(message);
            console.log('Python message:', parsedMessage);
            
            // Handle different message types
            if (parsedMessage.status === 'ready') {
              isListening = true;
              // Model is ready, notify renderer
              if (mainWindow) {
                mainWindow.webContents.send('vosk-model-ready', parsedMessage);
                mainWindow.webContents.send('vosk-status', {
                  status: 'listening',
                  message: 'Listening...'
                });
              }
            } else if (parsedMessage.status === 'debug') {
              // Handle debug messages from Python
              console.log('[🐍 Python Debug]', parsedMessage); // ✅ Logs to Electron DevTools
              if (mainWindow) {
                mainWindow.webContents.send('python-debug', parsedMessage); // Send to renderer
              }
            } else if (parsedMessage.status) {
              // Status update
              if (mainWindow) {
                mainWindow.webContents.send('vosk-status', parsedMessage);
              }
            } else if (parsedMessage.type === 'partial') {
              // Partial transcript
              if (mainWindow) {
                mainWindow.webContents.send('vosk-partial', {
                  text: parsedMessage.text
                });
              }
            } else if (parsedMessage.type === 'transcript') {
              // Complete transcript
              if (mainWindow) {
                mainWindow.webContents.send('vosk-transcript', {
                  text: parsedMessage.text
                });
              }
              
              // Process as command
              processVoiceCommand(parsedMessage.text);
            }
          } catch (parseError) {
            // Not JSON, log as raw output
            if (mainWindow) {
              mainWindow.webContents.send('python-log', `Python Output: ${message}`);
            }
          }
        }
      } catch (error) {
        console.error('Error handling Python output:', error);
        if (mainWindow) {
          mainWindow.webContents.send('python-log', `Error handling output: ${error.message}`);
        }
      }
    });
    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString().trim();
      console.log('Python stdout:', text);
      mainWindow.webContents.send('python-debug', text);
    });
    pythonProcess.on('exit', (code, signal) => {
      console.log(`Python process exited with code ${code}, signal ${signal}`);
      mainWindow.webContents.send('python-log', `Python exited with code ${code}, signal ${signal}`);
    });
    // Handle stderr
    pythonProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString().trim();
      console.error('Python stderr:', errorMsg);
      if (mainWindow) {
        mainWindow.webContents.send('python-log', `Python Error: ${errorMsg}`);
      }
    });

    // Handle process errors
    pythonProcess.on('error', (err) => {
      console.error('Error spawning Python process:', err);
      if (mainWindow) {
        mainWindow.webContents.send('python-log', `Error spawning Python process: ${err.message}`);
        mainWindow.webContents.send('vosk-status', {
          status: 'error',
          message: `Failed to start: ${err.message}`
        });
      }
    });
    
    pythonProcess.stdout.on('end', () => {
      try {
        const debugData = JSON.parse(dataBuffer);
        console.log('[Python Debug]', debugData);  // This logs to the main process console
    
        if (debugData.status === 'debug') {
          // Send the debug message to renderer process
          mainWindow.webContents.send('python-debug', debugData);
        }
      } catch (err) {
        console.error('Failed to parse Python debug JSON:', err);
      }
    });
    
    // Handle process exit
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      pythonProcess = null;
      isListening = false;
      
      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('vosk-status', {
          status: 'not-listening',
          message: 'Not Listening'
        });
      }
      
      // Restart if unexpected exit and window still exists
      if (code !== 0 && mainWindow) {
        console.log('Restarting speech recognition after error...');
        setTimeout(() => {
          startSpeechRecognition();
        }, 5000);
      }
    });
    
    // Send message to renderer when Python process starts
    console.log('Python process started.');
    
  } catch (error) {
    console.error('Error starting speech recognition:', error);
    if (mainWindow) {
      mainWindow.webContents.send('vosk-status', {
        status: 'error',
        message: `Error starting speech recognition: ${error.message}`
      });
    }
  }
}
function stopSpeechRecognition() {
  if (pythonProcess) {
    try {
      // Try to gracefully terminate the process
      if (process.platform === 'win32') {
        // Windows needs SIGTERM to be emulated with taskkill
        spawn('taskkill', ['/pid', pythonProcess.pid, '/f', '/t']);
      } else {
        // For Unix-like systems, send SIGTERM
        pythonProcess.kill('SIGTERM');
      }
      
      pythonProcess = null;
    } catch (err) {
      console.error('Error stopping Python process:', err);
    }
  }
  
  isListening = false;
  
  // Notify renderer
  if (mainWindow) {
    mainWindow.webContents.send('vosk-status', {
      status: 'not-listening',
      message: 'Not Listening'
    });
  }
}

function processVoiceCommand(text) {
  const lowerText = text.toLowerCase();
  console.log('All Shortcuts:\n', JSON.stringify(shortcutsDb, null, 2));
  // Check if any shortcut command matches
  const matchingShortcut = shortcutsDb.find(shortcut => 
    lowerText.includes(shortcut.voiceCommand.toLowerCase())
  );
  
  if (matchingShortcut) {
    if (mainWindow) {
      // Tell the renderer to highlight the shortcut
      mainWindow.webContents.send('vosk-command-activated', { 
        id: matchingShortcut.id,
        command: matchingShortcut.voiceCommand
      });
    }
    
    // Launch the shortcut
    launchShortcut(matchingShortcut.id);
  }
  
  // Check for system commands
  if (lowerText.includes('add new shortcut') || lowerText.includes('add shortcut')) {
    if (mainWindow) {
      mainWindow.webContents.send('show-config-modal');
    }
  }
}

async function launchShortcut(shortcutId) {
  try {
    // Find the shortcut in database
    const shortcut = shortcutsDb.find(s => s.id === shortcutId);
    if (!shortcut) {
      throw new Error('Shortcut not found');
    }
    
    // Notify the renderer
    if (mainWindow) {
      mainWindow.webContents.send('shortcut-launching', { name: shortcut.name });
    }
    
    // Launch the shortcut
    if (shortcut.path && fs.existsSync(shortcut.path)) {
      await shell.openPath(shortcut.path);
      return { success: true };
    } else {
      throw new Error('Shortcut file not found');
    }
  } catch (err) {
    console.error('Failed to launch shortcut:', err);
    return { success: false, error: err.message };
  }
}

// App lifecycle events
app.whenReady().then(() => {
  console.log('App ready, creating window...');
  createWindow();
  
  // For macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Clean up when app is quitting
app.on('before-quit', () => {
  stopSpeechRecognition();
});

// Quit app for all platforms except macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for Electron
ipcMain.handle('get-shortcuts', () => {
  return shortcutsDb;
});

ipcMain.handle('add-shortcut', async (event, { name, voiceCommand, fileData, fileName, originalPath }) => {
  try {
    if (!name || !voiceCommand || !fileData || !fileName) {
      throw new Error('Missing required information');
    }

    // Create a unique filename
    const uniqueFileName = `${Date.now()}-${fileName}`;
    const filePath = path.join(SHORTCUTS_DIR, uniqueFileName);
    
    // Convert base64 to buffer if needed
    const buffer = fileData.startsWith('data:') 
      ? Buffer.from(fileData.split(',')[1], 'base64') 
      : Buffer.from(fileData, 'base64');
    
    // Write the file
    fs.writeFileSync(filePath, buffer);
    
    // Create shortcut record
    const newShortcut = {
      id: generateId(),
      name,
      voiceCommand,
      iconColor: getRandomColor(),
      filename: uniqueFileName,
      originalName: fileName,
      originalPath,
      path: filePath,
      createdAt: new Date().toISOString()
    };
    
    // Add to database
    shortcutsDb.push(newShortcut);
    saveDatabase();
    
    return newShortcut;
  } catch (err) {
    console.error('Error adding shortcut:', err);
    throw err;
  }
});

function getRandomColor() {
  const colors = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
    '#1abc9c', '#d35400', '#34495e', '#16a085', '#c0392b'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

ipcMain.handle('update-shortcut', async (event, { id, name, voiceCommand }) => {
  try {
    if (!id || !name || !voiceCommand) {
      throw new Error('Missing required information');
    }
    
    // Find the shortcut
    const shortcutIndex = shortcutsDb.findIndex(s => s.id === id);
    if (shortcutIndex === -1) {
      throw new Error('Shortcut not found');
    }
    
    // Update the shortcut
    shortcutsDb[shortcutIndex] = {
      ...shortcutsDb[shortcutIndex],
      name,
      voiceCommand,
      updatedAt: new Date().toISOString()
    };
    
    saveDatabase();
    return { success: true, shortcut: shortcutsDb[shortcutIndex] };
  } catch (err) {
    console.error('Error updating shortcut:', err);
    throw err;
  }
});

ipcMain.handle('delete-shortcut', async (event, id) => {
  try {
    if (!id) {
      throw new Error('Missing shortcut ID');
    }
    
    // Find the shortcut
    const shortcutIndex = shortcutsDb.findIndex(s => s.id === id);
    if (shortcutIndex === -1) {
      throw new Error('Shortcut not found');
    }
    
    const shortcut = shortcutsDb[shortcutIndex];
    
    // Delete the file if it exists
    if (shortcut.path && fs.existsSync(shortcut.path)) {
      fs.unlinkSync(shortcut.path);
    }
    
    // Remove from database
    shortcutsDb.splice(shortcutIndex, 1);
    saveDatabase();
    
    return { success: true };
  } catch (err) {
    console.error('Error deleting shortcut:', err);
    throw err;
  }
});

ipcMain.handle('get-shortcut-file', async (event, id) => {
  try {
    const shortcut = shortcutsDb.find(s => s.id === id);
    if (!shortcut) {
      throw new Error('Shortcut not found');
    }
    
    if (!shortcut.path || !fs.existsSync(shortcut.path)) {
      throw new Error('Shortcut file not found');
    }
    
    const fileData = fs.readFileSync(shortcut.path);
    return { 
      success: true, 
      data: fileData.toString('base64'),
      filename: shortcut.originalName || shortcut.filename
    };
  } catch (err) {
    console.error('Error getting shortcut file:', err);
    throw err;
  }
});

ipcMain.handle('launch-shortcut', async (event, id) => {
  return await launchShortcut(id);
});

ipcMain.handle('select-file', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Shortcuts', extensions: ['lnk'] }]
    });
    
    if (canceled) {
      return { success: false, canceled: true };
    }

    const filePath = filePaths[0];
    const data = fs.readFileSync(filePath);
    
    return {
      success: true,
      fileName: path.basename(filePath),
      filePath,
      fileData: data.toString('base64')
    };
  } catch (err) {
    console.error('Error selecting file:', err);
    return { success: false, error: err.message };
  }
});

// Speech recognition control via IPC
ipcMain.handle('start-listening', async () => {
  try {
    if (!isListening) {
      startSpeechRecognition();
    }
    return { success: true, isListening };
  } catch (err) {
    console.error('Error starting listening:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-listening', () => {
  try {
    if (isListening) {
      stopSpeechRecognition();
    }
    return { success: true, isListening: false };
  } catch (err) {
    console.error('Error stopping listening:', err);
    return { success: false, error: err.message };
  }
});

// Vosk model operations
ipcMain.handle('get-vosk-model-path', () => {
  return getVoskModelPath();
});

ipcMain.handle('check-vosk-model', () => {
  return checkVoskModel();
});

// File system access for renderer
ipcMain.handle('read-file', async (event, filePath, options) => {
  try {
    return await fs.promises.readFile(filePath, options);
  } catch (err) {
    console.error('Error reading file:', err);
    throw err;
  }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    await fs.promises.writeFile(filePath, data);
    return { success: true };
  } catch (err) {
    console.error('Error writing file:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file-exists', (event, filePath) => fs.existsSync(filePath));
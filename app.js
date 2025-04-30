const appGrid = document.getElementById('appGrid');
const addAppBtn = document.getElementById('addAppBtn');
const configModal = document.getElementById('configModal');
const editModal = document.getElementById('editModal');
const closeModal = document.getElementById('closeModal');
const closeEditModal = document.getElementById('closeEditModal');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const appConfigForm = document.getElementById('appConfigForm');
const appNameInput = document.getElementById('appName');
const voiceCommandInput = document.getElementById('voiceCommand');
const appPathInput = document.getElementById('appPath');
const cancelConfigBtn = document.getElementById('cancelConfig');
const saveConfigBtn = document.getElementById('saveConfig');
const editAppNameInput = document.getElementById('editAppName');
const editVoiceCommandInput = document.getElementById('editVoiceCommand');
const editAppPathInput = document.getElementById('editAppPath');
const deleteAppBtn = document.getElementById('deleteApp');
const updateAppBtn = document.getElementById('updateApp');
const voiceStatusEl = document.getElementById('voiceStatus');
const spokenTextEl = document.getElementById('spokenText');

// ---- State ----
let selectedFile = null;
let currentEditAppId = null;
let apps = [];
// Speech recognition setup
let recognition = null;
let isListening = false;

// ---- Initialize ----
function init() {
  // Load apps from localStorage
  fetchAppsFromServer();

  setupSpeechRecognition();
}

// Call init to start the app
init();

// ---- Event Listeners ----

// Add App Button Click
addAppBtn.addEventListener('click', () => {
  showConfigModal();
});

// Close modals
closeModal.addEventListener('click', hideConfigModal);
closeEditModal.addEventListener('click', hideEditModal);

// Cancel button
cancelConfigBtn.addEventListener('click', hideConfigModal);

// Save App Configuration
saveConfigBtn.addEventListener('click', saveNewApp);

// Update App Configuration
updateAppBtn.addEventListener('click', updateApp);

// Delete App
deleteAppBtn.addEventListener('click', deleteApp);

// File input change
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && file.name.endsWith('.exe')) {
    handleFileSelection(file);
  } else if (file) {
    alert('Please select a valid .exe file');
    fileInput.value = '';
  }
});

// Drag and drop for upload area
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.exe')) {
    handleFileSelection(file);
  } else {
    alert('Please drop a valid .exe file');
  }
});

// ---- Functions ----
async function fetchAppsFromServer() {
  try {
    const res = await fetch('/api/apps');
    const data = await res.json();
    apps = data;
    renderApps();
  } catch (err) {
    console.error('Failed to load apps from server:', err);
  }
}


// Show/Hide Modals

function showConfigModal() {
  configModal.classList.add('active');
  
  // Reset form
  selectedFile = null;
  appNameInput.value = '';
  voiceCommandInput.value = '';
  appPathInput.value = '';
  appConfigForm.classList.remove('active');
  uploadArea.style.display = 'block';
}

function hideConfigModal() {
  configModal.classList.remove('active');
}

function showEditModal(appId) {
  const app = apps.find(app => app.id === appId);
  if (!app) return;
  
  currentEditAppId = appId;
  editAppNameInput.value = app.name;
  editVoiceCommandInput.value = app.voiceCommand;
  editAppPathInput.value = app.path;
  
  editModal.classList.add('active');
}

function hideEditModal() {
  editModal.classList.remove('active');
  currentEditAppId = null;
}

// Handle file selection
function handleFileSelection(file) {
  selectedFile = file;
  appPathInput.value = file.name; // For display purposes
  
  // Show the configuration form
  uploadArea.style.display = 'none';
  appConfigForm.classList.add('active');
  
  // Auto-fill app name based on file name (without .exe extension)
  const fileName = file.name.replace('.exe', '');
  appNameInput.value = fileName;
  
  // Suggest a voice command
  voiceCommandInput.value = `open ${fileName.toLowerCase()}`;
}

// Save new app
async function saveNewApp() {
  if (!selectedFile) {
    alert('Please select an executable file');
    return;
  }
  
  const appName = appNameInput.value.trim();
  const voiceCommand = voiceCommandInput.value.trim();
  
  if (!appName) {
    alert('Please enter an application name');
    return;
  }
  
  if (!voiceCommand) {
    alert('Please enter a voice command');
    return;
  }
  
  // Check for duplicate voice commands
  const isDuplicateCommand = apps.some(app => 
    app.voiceCommand.toLowerCase() === voiceCommand.toLowerCase()
  );
  
  if (isDuplicateCommand) {
    alert('This voice command is already in use. Please choose a different one.');
    return;
  }
  
  // Generate random ID
  const appId = 'app_' + Date.now();
  
  // In a production app, you would upload the file to server here
  // For now, we'll just store the file name and path
  const newApp = {
    id: appId,
    name: appName,
    voiceCommand: voiceCommand,
    path: selectedFile.name, // In real app, this would be the server path
    iconColor: getRandomColor()
  };
  
  // Add to apps array
  try {
  const res = await fetch('/api/apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newApp)
  });
  const result = await res.json();
  apps.push({ ...newApp, _id: result.insertedId }); // MongoDB returns insertedId
  addAppToGrid(newApp);
} catch (err) {
  console.error('Failed to save app to server:', err);
}

  
  // Hide modal
  hideConfigModal();
}

// Get random color for app icons
function getRandomColor() {
  const colors = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
    '#1abc9c', '#d35400', '#34495e', '#16a085', '#c0392b'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Update existing app
function updateApp() {
  if (!currentEditAppId) return;
  
  const appName = editAppNameInput.value.trim();
  const voiceCommand = editVoiceCommandInput.value.trim();
  
  if (!appName) {
    alert('Please enter an application name');
    return;
  }
  
  if (!voiceCommand) {
    alert('Please enter a voice command');
    return;
  }
  
  // Check for duplicate voice commands (excluding the current app)
  const isDuplicateCommand = apps.some(app => 
    app.id !== currentEditAppId && 
    app.voiceCommand.toLowerCase() === voiceCommand.toLowerCase()
  );
  
  if (isDuplicateCommand) {
    alert('This voice command is already in use. Please choose a different one.');
    return;
  }
  
  // Update app in array
  const appIndex = apps.findIndex(app => app.id === currentEditAppId);
  if (appIndex !== -1) {
    apps[appIndex].name = appName;
    apps[appIndex].voiceCommand = voiceCommand;
    
    // Save to storage
    saveApps();
    
    // Update UI
    renderApps();
    
    // Hide modal
    hideEditModal();
  }
}

// Delete app
function deleteApp() {
  if (!currentEditAppId) return;
  
  if (confirm('Are you sure you want to delete this app?')) {
    // Remove from array
    apps = apps.filter(app => app.id !== currentEditAppId);
    
    // Save to storage
    saveApps();
    
    // Update UI
    renderApps();
    
    // Hide modal
    hideEditModal();
  }
}

// Add app to grid
function addAppToGrid(app) {
  const appElement = document.createElement('div');
  appElement.className = 'app-icon';
  appElement.dataset.id = app.id;
  appElement.dataset.voiceCommand = app.voiceCommand.toLowerCase();
  
  appElement.innerHTML = `
    <div class="icon-wrapper" style="background-color: ${app.iconColor}">
      <i class="fas fa-window-maximize"></i>
    </div>
    <div class="app-name">${app.name}</div>
  `;
  
  // Click to edit
  appElement.addEventListener('click', () => {
    showEditModal(app.id);
  });
  
  // Add to grid (after the Add App button)
  appGrid.appendChild(appElement);
}

// Render all apps
function renderApps() {
  // Clear grid (except for Add App button)
  const appElements = appGrid.querySelectorAll('.app-icon:not(.add-app)');
  appElements.forEach(el => el.remove());
  
  // Add each app
  apps.forEach(app => {
    addAppToGrid(app);
  });
}

// Save apps to storage
function saveApps() {
  localStorage.setItem('apps', JSON.stringify(apps));
  console.log('Apps saved to localStorage.');
}

// Load apps from storage
function loadApps() {
  const savedApps = localStorage.getItem('apps');
  if (savedApps) {
    apps = JSON.parse(savedApps);
    renderApps();
  }
}

// Start listening for voice commands
function startListening() {
  try {
    if (recognition && !isListening) {
      recognition.start();
    }
  } catch (error) {
    console.error('Error starting speech recognition:', error);
    
    // If there's an error (e.g., already started), try resetting
    resetSpeechRecognition();
  }
}

// Stop listening for voice commands
function stopListening() {
  try {
    if (recognition && isListening) {
      recognition.stop();
    }
  } catch (error) {
    console.error('Error stopping speech recognition:', error);
  }
}

// Reset speech recognition in case of errors
function resetSpeechRecognition() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition during reset:', error);
    }
    
    isListening = false;
    
    // Brief delay before restarting
    setTimeout(() => {
      setupSpeechRecognition();
    }, 1000);
  }
}

// Process voice commands
function processVoiceCommand(text) {
  // Check if any app command matches
  const matchingApp = apps.find(app => 
    text.includes(app.voiceCommand.toLowerCase())
  );
  
  if (matchingApp) {
    // Highlight the app that was activated
    const appElement = document.querySelector(`.app-icon[data-id="${matchingApp.id}"]`);
    if (appElement) {
      appElement.classList.add('activated');
      setTimeout(() => {
        appElement.classList.remove('activated');
      }, 2000);
    }
    
    // In a real app, this would launch the application
    console.log(`Launching app: ${matchingApp.name} (${matchingApp.path})`);
    alert(`Launching ${matchingApp.name}`);
  }
  
  // Check for system commands
  if (text.includes('add new app') || text.includes('add app')) {
    showConfigModal();
  }
}

// Set up speech recognition
function setupSpeechRecognition() {
  // Check if browser supports speech recognition
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    voiceStatusEl.innerHTML = '<i class="fas fa-microphone-slash"></i> Speech recognition not supported';
    voiceStatusEl.style.color = 'var(--danger-color)';
    return;
  }
  
  // Create speech recognition instance
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  
  let currentTranscript = '';
  let silenceTimer = null;
  
  recognition.onstart = () => {
    isListening = true;
    voiceStatusEl.innerHTML = '<i class="fas fa-microphone"></i> Listening...';
    voiceStatusEl.style.color = 'var(--success-color)';
  };
  
  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        currentTranscript += result[0].transcript.trim() + ' ';
      }
    }
    
    if (silenceTimer) clearTimeout(silenceTimer);
    
    silenceTimer = setTimeout(() => {
      const finalText = currentTranscript.trim().toLowerCase();
      spokenTextEl.textContent = `"${finalText}"`;
      console.log('Speech detected:', finalText);
      
      // Check if the spoken text matches any app voice command
      processVoiceCommand(finalText);
      
      // Reset transcript
      currentTranscript = '';
    }, 1000);
  };
  
  recognition.onend = () => {
    isListening = false;
    voiceStatusEl.innerHTML = '<i class="fas fa-microphone-slash"></i> Not Listening';
    voiceStatusEl.style.color = 'var(--danger-color)';
    
    // Auto restart after a brief pause
    setTimeout(() => {
      if (!isListening) {
        startListening();
      }
    }, 500);
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    voiceStatusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error: ' + event.error;
    voiceStatusEl.style.color = 'var(--danger-color)';
    
    // Attempt to restart after error
    setTimeout(() => {
      if (!isListening) {
        startListening();
      }
    }, 3000);
  };
  
  // Start listening initially
  startListening();
}
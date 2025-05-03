// DOM Elements
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
let shortcuts = [];
// Speech recognition setup
let recognition = null;
let isListening = false;

// ---- Initialize ----
function init() {
  fetchShortcutsFromServer();
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
saveConfigBtn.addEventListener('click', saveNewShortcut);

// Update App Configuration
updateAppBtn.addEventListener('click', updateShortcut);

// Delete App
deleteAppBtn.addEventListener('click', deleteShortcut);

// File input change
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && file.name.toLowerCase().endsWith('.lnk')) {
    handleFileSelection(file);
  } else if (file) {
    alert('Please select a valid .lnk file');
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
  if (file && file.name.toLowerCase().endsWith('.lnk')) {
    handleFileSelection(file);
  } else {
    alert('Please drop a valid .lnk file');
  }
});

// ---- Functions ----
// API Functions
async function fetchShortcutsFromServer() {
  try {
    const res = await fetch('/api/shortcuts');
    const data = await res.json();
    shortcuts = data;
    renderShortcuts();
  } catch (err) {
    console.error('Failed to load shortcuts from server:', err);
    showErrorNotification('Failed to load shortcuts from server');
  }
}

async function saveShortcutToServer(formData) {
  try {
    const res = await fetch('/api/shortcuts', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to save shortcut');
    }
    
    return await res.json();
  } catch (err) {
    console.error('Failed to save shortcut to server:', err);
    showErrorNotification(err.message || 'Failed to save shortcut');
    return null;
  }
}

async function updateShortcutOnServer(shortcutId, data) {
  try {
    const res = await fetch(`/api/shortcuts/${shortcutId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to update shortcut');
    }
    
    return await res.json();
  } catch (err) {
    console.error('Failed to update shortcut on server:', err);
    showErrorNotification(err.message || 'Failed to update shortcut');
    return null;
  }
}

async function deleteShortcutFromServer(shortcutId) {
  try {
    const res = await fetch(`/api/shortcuts/${shortcutId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to delete shortcut');
    }
    
    return await res.json();
  } catch (err) {
    console.error('Failed to delete shortcut from server:', err);
    showErrorNotification(err.message || 'Failed to delete shortcut');
    return false;
  }
}

// This function will download and then launch the shortcut
async function launchShortcut(shortcutId) {
  try {
    // First, find the shortcut in our local array
    const shortcut = shortcuts.find(s => s.id === shortcutId);
    if (!shortcut) {
      throw new Error('Shortcut not found');
    }
    
    // Create a temporary anchor element to download the file
    const downloadLink = document.createElement('a');
    downloadLink.href = `/download/${shortcutId}`;
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    
    // Trigger the download - this will cause the browser to download the .lnk file
    downloadLink.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(downloadLink);
    }, 100);
    
    // Show notification
    showSuccessNotification(`Launching ${shortcut.name}...`);
    
    return { success: true };
  } catch (err) {
    console.error('Failed to launch shortcut:', err);
    showErrorNotification(err.message || 'Failed to launch shortcut');
    return { success: false };
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

function showEditModal(shortcutId) {
  const shortcut = shortcuts.find(s => s.id === shortcutId);
  if (!shortcut) return;
  
  currentEditAppId = shortcutId;
  editAppNameInput.value = shortcut.name;
  editVoiceCommandInput.value = shortcut.voiceCommand;
  editAppPathInput.value = shortcut.originalName || shortcut.filename;
  
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
  
  // Auto-fill app name based on file name (without .lnk extension)
  const fileName = file.name.replace('.lnk', '');
  appNameInput.value = fileName;
  
  // Suggest a voice command
  voiceCommandInput.value = `open ${fileName.toLowerCase()}`;
}

// Save new shortcut
async function saveNewShortcut() {
  if (!selectedFile) {
    alert('Please select a shortcut (.lnk) file');
    return;
  }
  
  const shortcutName = appNameInput.value.trim();
  const voiceCommand = voiceCommandInput.value.trim();
  
  if (!shortcutName) {
    alert('Please enter a shortcut name');
    return;
  }
  
  if (!voiceCommand) {
    alert('Please enter a voice command');
    return;
  }
  
  // Check for duplicate voice commands
  const isDuplicateCommand = shortcuts.some(shortcut => 
    shortcut.voiceCommand.toLowerCase() === voiceCommand.toLowerCase()
  );
  
  if (isDuplicateCommand) {
    alert('This voice command is already in use. Please choose a different one.');
    return;
  }

  // Create form data for file upload
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('name', shortcutName);
  formData.append('voiceCommand', voiceCommand);
  formData.append('iconColor', getRandomColor());
  
  // Show loading indicator
  saveConfigBtn.disabled = true;
  saveConfigBtn.textContent = 'Saving...';
  
  // Save to server
  const newShortcut = await saveShortcutToServer(formData);
  
  // Reset button
  saveConfigBtn.disabled = false;
  saveConfigBtn.textContent = 'Save Shortcut';
  
  if (newShortcut) {
    // Add to our local array
    shortcuts.push(newShortcut);
    
    // Add to UI
    renderShortcuts();
    
    // Hide modal
    hideConfigModal();
    
    // Show success notification
    showSuccessNotification(`Shortcut "${shortcutName}" added successfully`);
  }
}

// Get random color for app icons
function getRandomColor() {
  const colors = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
    '#1abc9c', '#d35400', '#34495e', '#16a085', '#c0392b'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Update existing shortcut
async function updateShortcut() {
  if (!currentEditAppId) return;
  
  const shortcutName = editAppNameInput.value.trim();
  const voiceCommand = editVoiceCommandInput.value.trim();
  
  if (!shortcutName) {
    alert('Please enter a shortcut name');
    return;
  }
  
  if (!voiceCommand) {
    alert('Please enter a voice command');
    return;
  }
  
  // Check for duplicate voice commands (excluding the current shortcut)
  const isDuplicateCommand = shortcuts.some(shortcut => 
    shortcut.id !== currentEditAppId && 
    shortcut.voiceCommand.toLowerCase() === voiceCommand.toLowerCase()
  );
  
  if (isDuplicateCommand) {
    alert('This voice command is already in use. Please choose a different one.');
    return;
  }
  
  // Prepare update data
  const updateData = {
    name: shortcutName,
    voiceCommand: voiceCommand
  };
  
  // Show loading
  updateAppBtn.disabled = true;
  updateAppBtn.textContent = 'Updating...';
  
  // Update on server
  const result = await updateShortcutOnServer(currentEditAppId, updateData);
  
  // Reset button
  updateAppBtn.disabled = false;
  updateAppBtn.textContent = 'Update Shortcut';
  
  if (result && result.success) {
    // Update shortcut in array
    const shortcutIndex = shortcuts.findIndex(s => s.id === currentEditAppId);
    if (shortcutIndex !== -1) {
      shortcuts[shortcutIndex].name = shortcutName;
      shortcuts[shortcutIndex].voiceCommand = voiceCommand;
    }
    
    // Update UI
    renderShortcuts();
    
    // Hide modal
    hideEditModal();
    
    // Show success notification
    showSuccessNotification(`Shortcut "${shortcutName}" updated successfully`);
  }
}

// Delete shortcut
async function deleteShortcut() {
  if (!currentEditAppId) return;
  
  const shortcutToDelete = shortcuts.find(s => s.id === currentEditAppId);
  if (!shortcutToDelete) return;
  
  if (confirm(`Are you sure you want to delete "${shortcutToDelete.name}"?`)) {
    // Show loading
    deleteAppBtn.disabled = true;
    deleteAppBtn.textContent = 'Deleting...';
    
    // Delete from server
    const result = await deleteShortcutFromServer(currentEditAppId);
    
    // Reset button
    deleteAppBtn.disabled = false;
    deleteAppBtn.textContent = 'Delete Shortcut';
    
    if (result && result.success) {
      // Remove from array
      shortcuts = shortcuts.filter(s => s.id !== currentEditAppId);
      
      // Update UI
      renderShortcuts();
      
      // Hide modal
      hideEditModal();
      
      // Show success notification
      showSuccessNotification(`Shortcut "${shortcutToDelete.name}" deleted successfully`);
    }
  }
}

// Add shortcut to grid
function addShortcutToGrid(shortcut) {
  const shortcutElement = document.createElement('div');
  shortcutElement.className = 'app-icon';
  shortcutElement.dataset.id = shortcut.id;
  shortcutElement.dataset.voiceCommand = shortcut.voiceCommand.toLowerCase();
  
  shortcutElement.innerHTML = `
    <div class="icon-wrapper" style="background-color: ${shortcut.iconColor || '#3498db'}">
      <i class="fas fa-link"></i>
    </div>
    <div class="app-name">${shortcut.name}</div>
  `;
  
  // Double click to launch
  shortcutElement.addEventListener('dblclick', () => {
    launchShortcut(shortcut.id);
  });
  
  // Click to edit
  shortcutElement.addEventListener('click', () => {
    showEditModal(shortcut.id);
  });
  
  // Add to grid (after the Add App button)
  appGrid.appendChild(shortcutElement);
}

// Render all shortcuts
function renderShortcuts() {
  // Clear grid (except for Add App button)
  const shortcutElements = appGrid.querySelectorAll('.app-icon:not(.add-app)');
  shortcutElements.forEach(el => el.remove());
  
  // Add each shortcut
  shortcuts.forEach(shortcut => {
    addShortcutToGrid(shortcut);
  });
}

// Notifications
function showSuccessNotification(message) {
  // Check if notification container exists, if not create it
  let notifContainer = document.querySelector('.notification-container');
  if (!notifContainer) {
    notifContainer = document.createElement('div');
    notifContainer.className = 'notification-container';
    document.body.appendChild(notifContainer);
  }
  
  const notification = document.createElement('div');
  notification.className = 'notification success';
  notification.innerHTML = `
    <i class="fas fa-check-circle"></i>
    <span>${message}</span>
  `;
  
  notifContainer.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

function showErrorNotification(message) {
  // Check if notification container exists, if not create it
  let notifContainer = document.querySelector('.notification-container');
  if (!notifContainer) {
    notifContainer = document.createElement('div');
    notifContainer.className = 'notification-container';
    document.body.appendChild(notifContainer);
  }
  
  const notification = document.createElement('div');
  notification.className = 'notification error';
  notification.innerHTML = `
    <i class="fas fa-exclamation-circle"></i>
    <span>${message}</span>
  `;
  
  notifContainer.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// Speech Recognition Functions
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

function stopListening() {
  try {
    if (recognition && isListening) {
      recognition.stop();
    }
  } catch (error) {
    console.error('Error stopping speech recognition:', error);
  }
}

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

function processVoiceCommand(text) {
  const lowerText = text.toLowerCase();
  
  // Check if any shortcut command matches
  const matchingShortcut = shortcuts.find(shortcut => 
    lowerText.includes(shortcut.voiceCommand.toLowerCase())
  );
  
  if (matchingShortcut) {
    // Highlight the shortcut that was activated
    const shortcutElement = document.querySelector(`.app-icon[data-id="${matchingShortcut.id}"]`);
    if (shortcutElement) {
      shortcutElement.classList.add('activated');
      setTimeout(() => {
        shortcutElement.classList.remove('activated');
      }, 2000);
    }
    
    // Launch the shortcut
    launchShortcut(matchingShortcut.id);
  }
  
  // Check for system commands
  if (lowerText.includes('add new shortcut') || lowerText.includes('add shortcut')) {
    showConfigModal();
  }
}

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
      } else {
        // Show interim results
        spokenTextEl.textContent = `"${result[0].transcript.trim()}"`;
      }
    }
    
    if (silenceTimer) clearTimeout(silenceTimer);
    
    silenceTimer = setTimeout(() => {
      const finalText = currentTranscript.trim().toLowerCase();
      if (finalText) {
        spokenTextEl.textContent = `"${finalText}"`;
        console.log('Speech detected:', finalText);
        
        // Check if the spoken text matches any shortcut voice command
        processVoiceCommand(finalText);
      }
      
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
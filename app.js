console.log("app.js loaded");

document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded and parsed");
  
  // Setup listeners for microphone status
  setupMicStatusListeners();
  
  /**
   * Sets up listeners for microphone status
   */
  function setupMicStatusListeners() {
    // Your existing event listeners
    if (window.electron) {
      // Handle Python debug logs
      window.electron.onPythonDebug((event, debugData) => {
        console.log('[🐍 Python Debug]', debugData);
        
        // Check for microphone status messages
        checkMicStatus(debugData);
      });

      // Handle general Python logs
      window.electron.onPythonLog((event, message) => {
        console.log('[🐍 Python Log]', message);
        
        // Also check these logs for mic status
        checkMicStatus(message);
      });
    }

    if (window.mainLogger) {
      window.mainLogger.onMainError((err) => {
        console.error(`[Main Error - ${err.tag}] ${err.message}`);
        console.error(err.stack);
      });
    }
  }
  
  /**
   * Checks for microphone status messages
   * @param {Object|string} data - The log data to check
   */
function checkMicStatus(data) {
  let message = data;
  if (typeof data === 'object') {
    message = JSON.stringify(data);
  }

  if (typeof message !== 'string') return;

  try {
    if (message.includes('{') && message.includes('}')) {
      const jsonMatch = message.match(/\{.*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);

        if (jsonData.status === "Mic not working, muted, or not capturing audio.") {
          console.log("Microphone issue detected!");
          showMicWarning();
        } else if (jsonData.status === "Mic is working and capturing sound!") {
          console.log("Microphone is working properly");
          hideMicWarning();
        } else if (jsonData.status === "ready") {
          console.log("Speech recognition ready");
          updateVoiceStatusUI({status: "ready", message: "Ready"});  // Change here
        } else if (jsonData.status === "listening") {
          console.log("Speech recognition listening");
          updateVoiceStatusUI({status: "listening", message: "Listening..."}); // Change here
        }
      }
    }
  } catch (e) {
    if (message.includes("Mic not working") || message.includes("muted") || message.includes("not capturing audio")) {
      console.log("Microphone issue detected from string match!");
      showMicWarning();
    } else if (message.includes("Mic is working") || message.includes("capturing sound")) {
      console.log("Microphone is working properly from string match");
      hideMicWarning();
    } else if (message.includes("Speech recognition ready")) {
      console.log("Speech recognition ready from string match");
      updateVoiceStatusUI({status: "ready", message: "Ready"});  // Change here
    } else if (message.includes("listening")) {
      console.log("Speech recognition listening from string match");
      updateVoiceStatusUI({status: "listening", message: "Listening..."}); // Change here
    }
  }
}


function hideMicWarning() {
  const warning = document.getElementById('mic-warning');
  if (warning) {
    document.body.removeChild(warning);
  }
}function showMicWarning() {
  const statusEl = document.getElementById("voiceStatus");
  const icon = statusEl.querySelector("i");
  statusEl.innerHTML = `<i class="fas fa-microphone-slash"></i> Mic not working`;

  // Change the icon color to red (or any color you prefer)
  icon.style.color = 'red';

  statusEl.classList.add("error");
  statusEl.classList.remove("ready");

  // Only create and add the warning if it doesn't already exist
  if (!document.getElementById('mic-warning')) {
    const warningElement = document.createElement('div');
    warningElement.id = 'mic-warning';
    warningElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      color: #ffc107;
      padding: 10px 15px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-weight: bold;
      z-index: 9999;
      height: 50px;
    `;

    const icon = document.createElement('span');
    icon.innerHTML = '⚠️';
    icon.className = 'icon';
    icon.style.marginRight = '8px';

    const message = document.createElement('span');
    message.textContent = 'Microphone not working or muted';
    message.style.marginRight = '10px';

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.className = 'close-btn';
    closeBtn.style.cssText = `
      margin-left: auto;
      cursor: pointer;
      font-size: 18px;
    `;
    closeBtn.onclick = function() {
      warningElement.remove();
    };

    warningElement.appendChild(icon);
    warningElement.appendChild(message);
    warningElement.appendChild(closeBtn);
    document.body.appendChild(warningElement);
  }
}


})
// Example: Sending a message from renderer to main
window.electron.log("Renderer Log: Application started.");
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
console.log("app.js loaded");
// app.js (renderer)
window.addEventListener('DOMContentLoaded', () => {
  if (window.api && window.api.onLogModelPath) {
    window.api.onLogModelPath((modelPath) => {
      console.log('🔍 Vosk model path (renderer):', modelPath);
    });
  }
});
// ---- State ----
let selectedFile = null;
let currentEditAppId = null;
let shortcuts = [];

// Get API base URL from Electron preload script
const API_BASE_URL = 'https://pat.ipo-servers.net';
console.log("API base URL:", API_BASE_URL);

// ---- Initialize ----
function init() {
  fetchShortcutsFromServer();
  
  // Log platform info if running in Electron
  if (window.electronAPI) {
    console.log("Running in Electron environment");
    setupElectronListeners();
  } else {
    console.log("Running in browser environment");
  }
  
  // Set initial voice status UI
  updateVoiceStatusUI();
  
  // Setup modal/popup event listeners
  setupModalListeners();
}

// Setup IPC event listeners for Electron
function setupElectronListeners() {
  if (!window.electronAPI) return;
  
  window.electronAPI.onVoiceStatus((data) => {
    updateVoiceStatusUI(data);
  });
  
  window.electronAPI.onVoskPartial((data) => {
    spokenTextEl.textContent = `"${data.text}"`;
  });
  
  window.electronAPI.onVoskTranscript((data) => {
    spokenTextEl.textContent = `"${data.text}"`;
  });
  
  window.electronAPI.onVoskCommandActivated((data) => {
    // Highlight the shortcut that was activated
    const shortcutElement = document.querySelector(`.app-icon[data-id="${data.id}"]`);
    if (shortcutElement) {
      shortcutElement.classList.add('activated');
      setTimeout(() => {
        shortcutElement.classList.remove('activated');
      }, 2000);
    }
  });
  
  window.electronAPI.onShortcutLaunching((data) => {
    showSuccessNotification(`Launching ${data.name}...`);
  });
  
  window.electronAPI.onShowConfigModal(() => {
    showConfigModal();
  });
}

// Setup modal event listeners
function setupModalListeners() {
  // Close modals when clicking outside the modal content
  configModal.addEventListener('click', (e) => {
    if (e.target === configModal) {
      hideConfigModal();
    }
  });
  
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      hideEditModal();
    }
  });
  
  // Close modals with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (configModal.classList.contains('active')) {
        hideConfigModal();
      }
      if (editModal.classList.contains('active')) {
        hideEditModal();
      }
    }
  });
}
/**
 * Hides the mic warning
 */
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
if (window.electronAPI) {
  // In Electron environment, use native dialog
  uploadArea.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevent triggering other listeners
    e.stopPropagation(); // Stop event bubbling
    
    const result = await window.electronAPI.selectFile();
    if (result.success) {
      // Create a file object from the result
      const binaryString = atob(result.fileData); // decode base64
      const byteArray = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        byteArray[i] = binaryString.charCodeAt(i);
      }
      const file = new File([byteArray], result.fileName, {
        type: 'application/octet-stream',
      });
      
      handleFileSelection(file, result.filePath);
    }
  });
} else {
  // In browser environment, use file input
  uploadArea.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default click behavior
    fileInput.click(); // Trigger file input
  });
}

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

// Update voice status UI based on Vosk status
function updateVoiceStatusUI(data) {
  if (!data) {
    // Initial state
    voiceStatusEl.innerHTML = '<p class="fas fa-microphone-slash"></p> Initializing...';
    voiceStatusEl.style.color = 'var(--warning-color)';
    return;
  }

  // Handle listening state
  if (data.status === 'listening') {
    voiceStatusEl.innerHTML = '<p class="fas fa-microphone"></p> Listening...';
    voiceStatusEl.style.color = '#34c759'; // Change to green or your preferred color for listening
  }
  // Handle ready state
  else if (data.status === 'ready') {
    voiceStatusEl.innerHTML = '<p class="fas fa-microphone"></p> Listening...';
    voiceStatusEl.style.color = '#34c759'; // Use blue or another color for ready state
  }
  // Handle error state
  else if (data.status === 'error') {
    voiceStatusEl.innerHTML = '<p class="fas fa-microphone-slash"></p> ' + data.message;
    voiceStatusEl.style.color = '#ff3b30'; // Set the color to red for error
  }
  // Handle default state when not listening
  else {
    voiceStatusEl.innerHTML = '<p class="fas fa-microphone-slash"></p> Not Listening';
    voiceStatusEl.style.color = '#6e6e73'; // Change to gray or your preferred color for not listening
  }
}



// API Functions
async function fetchShortcutsFromServer() {
  try {
    // First try to get shortcuts from Electron
    if (window.electronAPI) {
      try {
        const localShortcuts = await window.electronAPI.getShortcuts();
        if (localShortcuts && localShortcuts.length > 0) {
          shortcuts = localShortcuts;
          renderShortcuts();
          return;
        }
      } catch (err) {
        console.log("Couldn't get shortcuts from Electron, falling back to API");
      }
    }
    
    // Fall back to API server
    const res = await fetch(`${API_BASE_URL}/api/shortcuts`);
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
    const res = await fetch(`${API_BASE_URL}/api/shortcuts`, {
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
    // Try Electron first if available
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.updateShortcut({
          id: shortcutId,
          ...data
        });
        
        if (result && result.success) {
          return result;
        }
      } catch (err) {
        console.log("Couldn't update shortcut via Electron, falling back to API");
      }
    }
    
    // Fall back to API server
    const res = await fetch(`${API_BASE_URL}/api/shortcuts/${shortcutId}`, {
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
    // Try Electron first if available
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.deleteShortcut(shortcutId);
        if (result && result.success) {
          return result;
        }
      } catch (err) {
        console.log("Couldn't delete shortcut via Electron, falling back to API");
      }
    }
    
    // Fall back to API server
    const res = await fetch(`${API_BASE_URL}/api/shortcuts/${shortcutId}`, {
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
    
    // Show notification
    showSuccessNotification(`Launching ${shortcut.name}...`);
    
    if (window.electronAPI) {
      // In Electron environment, try to launch directly if possible
      try {
        const result = await window.electronAPI.launchShortcut(shortcutId);
        if (result.success) {
          return result;
        }
      } catch (err) {
        console.log("Direct launch failed, falling back to download & launch");
      }
      
      // If direct launch failed, download and launch the shortcut
      const response = await fetch(`${API_BASE_URL}/download/${shortcutId}`);
      const blob = await response.blob();
      
      // Convert blob to base64
      const reader = new FileReader();
      
      // Use a promise to handle the async reader
      const fileData = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      // Save the file locally and get the path
      const saveResult = await window.electronAPI.saveDownloadedFile(
        fileData, 
        shortcut.originalName || `${shortcut.name}.lnk`
      );
      
      if (saveResult.success) {
        // Launch the shortcut
        const launchResult = await window.electronAPI.launchShortcut(saveResult.filePath);
        return launchResult;
      } else {
        throw new Error('Failed to save shortcut file');
      }
    } else {
      // In browser environment, just trigger the download
      // Create a temporary element that will be removed after use
      const downloadLink = document.createElement('a');
      downloadLink.href = `${API_BASE_URL}/download/${shortcutId}`;
      downloadLink.style.display = 'none';
      downloadLink.setAttribute('download', shortcut.originalName || `${shortcut.name}.lnk`);
      
      // Add to document, trigger download, then remove
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      return { success: true };
    }
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
  
  // Focus trap inside modal for accessibility
  setTimeout(() => {
    fileInput.focus();
  }, 100);
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
  
  // Focus first input field
  setTimeout(() => {
    editAppNameInput.focus();
  }, 100);
}

function hideEditModal() {
  editModal.classList.remove('active');
  currentEditAppId = null;
}

// Handle file selection
// Replace the handleFileSelection function in app.js:
function handleFileSelection(file, filePath = null) {
  console.log('File selected:', file.name, 'Path:', filePath);
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
  
  // Store the file path if provided (from Electron file picker)
  if (filePath) {
    selectedFile.originalPath = filePath;
  }
  
  // Focus on the app name input
  appNameInput.focus();
  appNameInput.select();
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
    appNameInput.focus();
    return;
  }
  
  if (!voiceCommand) {
    alert('Please enter a voice command');
    voiceCommandInput.focus();
    return;
  }
  
  // Check for duplicate voice commands
  const isDuplicateCommand = shortcuts.some(shortcut => 
    shortcut.voiceCommand.toLowerCase() === voiceCommand.toLowerCase()
  );
  
  if (isDuplicateCommand) {
    alert('This voice command is already in use. Please choose a different one.');
    voiceCommandInput.focus();
    voiceCommandInput.select();
    return;
  }

  // Show loading indicator
  saveConfigBtn.disabled = true;
  saveConfigBtn.textContent = 'Saving...';
  
  // Try to save via Electron first if available
  if (window.electronAPI && selectedFile) {
    try {
      // Convert file to base64
      const reader = new FileReader();
      const fileData = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      
      console.log('Adding shortcut via Electron API');
      const newShortcut = await window.electronAPI.addShortcut({
        name: shortcutName,
        voiceCommand: voiceCommand,
        fileData: fileData,
        fileName: selectedFile.name,
        originalPath: selectedFile.originalPath || ''
      });
      
      if (newShortcut) {
        console.log('Shortcut added successfully:', newShortcut);
        // Add to our local array
        shortcuts.push(newShortcut);
        
        // Add to UI
        renderShortcuts();
        
        // Hide modal
        hideConfigModal();
        
        // Show success notification
        showSuccessNotification(`Shortcut "${shortcutName}" added successfully`);
        
        // Reset button
        saveConfigBtn.disabled = false;
        saveConfigBtn.textContent = 'Save Shortcut';
        
        return;
      }
    } catch (err) {
      console.error("Couldn't save via Electron, falling back to API:", err);
    }
  }
  
  // Fall back to API
  // Create form data for file upload
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('name', shortcutName);
  formData.append('voiceCommand', voiceCommand);
  formData.append('iconColor', getRandomColor());
  
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
    editAppNameInput.focus();
    return;
  }
  
  if (!voiceCommand) {
    alert('Please enter a voice command');
    editVoiceCommandInput.focus();
    return;
  }
  
  // Check for duplicate voice commands (excluding the current shortcut)
  const isDuplicateCommand = shortcuts.some(shortcut => 
    shortcut.id !== currentEditAppId && 
    shortcut.voiceCommand.toLowerCase() === voiceCommand.toLowerCase()
  );
  
  if (isDuplicateCommand) {
    alert('This voice command is already in use. Please choose a different one.');
    editVoiceCommandInput.focus();
    editVoiceCommandInput.select();
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
    notifContainer.style.position = 'fixed';
    notifContainer.style.bottom = '20px';
    notifContainer.style.right = '20px';
    notifContainer.style.zIndex = '9999';
    document.body.appendChild(notifContainer);
  }
  
  const notification = document.createElement('div');
  notification.className = 'notification success';
  notification.style.backgroundColor = 'var(--success-color)';
  notification.style.color = 'white';
  notification.style.padding = '12px 16px';
  notification.style.marginBottom = '10px';
  notification.style.borderRadius = '8px';
  notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  notification.style.display = 'flex';
  notification.style.alignItems = 'center';
  notification.style.transition = 'all 0.3s ease';
  notification.style.maxWidth = '300px';
  
  notification.innerHTML = `
    <i class="fas fa-check-circle" style="margin-right: 10px;"></i>
    <span>${message}</span>
    <i class="fas fa-times" style="margin-left: auto; cursor: pointer;"></i>
  `;
  
  // Add close button functionality
  const closeBtn = notification.querySelector('.fa-times');
  closeBtn.addEventListener('click', () => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
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
    notifContainer.style.position = 'fixed';
    notifContainer.style.bottom = '20px';
    notifContainer.style.right = '20px';
    notifContainer.style.zIndex = '9999';
    document.body.appendChild(notifContainer);
  }
  
  const notification = document.createElement('div');
  notification.className = 'notification error';
  notification.style.backgroundColor = 'var(--danger-color)';
  notification.style.color = 'white';
  notification.style.padding = '12px 16px';
  notification.style.marginBottom = '10px';
  notification.style.borderRadius = '8px';
  notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  notification.style.display = 'flex';
  notification.style.alignItems = 'center';
  notification.style.transition = 'all 0.3s ease';
  notification.style.maxWidth = '300px';
  
  notification.innerHTML = `
    <i class="fas fa-exclamation-circle" style="margin-right: 10px;"></i>
    <span>${message}</span>
    <i class="fas fa-times" style="margin-left: auto; cursor: pointer;"></i>
  `;
  
  // Add close button functionality
  const closeBtn = notification.querySelector('.fa-times');
  closeBtn.addEventListener('click', () => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  notifContainer.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// Clean up before unloading
window.addEventListener('beforeunload', () => {
  if (window.electronAPI) {
    window.electronAPI.cleanup();
    
    if (voskRecognizer) {
      voskRecognizer.reset();
      voskRecognizer = null;
    }
  }
});
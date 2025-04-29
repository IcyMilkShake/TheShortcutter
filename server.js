const express = require('express');
const path = require('path');  // To handle file paths
const { exec } = require('child_process');
const app = express();
const PORT = 8080;

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, '/')));

// Serve the index.html at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/', 'index.html'));  // Change to the path of your index.html
});

// Handle /open requests
app.get('/open', (req, res) => {
  const appName = req.query.app;
  console.log(`Request to open: ${appName}`);

  let command = '';

  if (appName === 'chrome') {
    command = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
  } else if (appName === 'arknights') {
    command = '"C:\\Arknights"';
  } else {
    return res.status(400).send('Unknown app');
  }

  exec(command, (err) => {
    if (err) {
      console.error('Failed to open app:', err);
      return res.status(500).send('Failed to open app');
    }
    res.send('App launched');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

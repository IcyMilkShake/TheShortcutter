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
const os = require('os');

app.get('/open', (req, res) => {
  const commandMap = {
    chrome: `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"`,
    arknights: `"C:\\Path\\To\\Arknights.exe"`
  };
  console.log(commandMap)
  const appName = req.query.app.toLowerCase();
  const command = commandMap[appName];
  
  if (!command) {
    return res.status(400).send('Unknown app');
  }
  
  exec(command, { shell: true }, (err) => {
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

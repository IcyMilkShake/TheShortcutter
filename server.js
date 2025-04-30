const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 8080;

// MongoDB connection essentials - add your own configuration here
// These will be defined by you directly in the server code
// Example: mongodb://localhost:27017
let mongoUri = 'mongodb+srv://milkshake:t5975878@cluster0.k5dmweu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
// Example: appLauncher
let dbName = 'TheShortcutter';
// Example: apps
let collectionName = 'Shortcuts';

// Middleware
app.use(express.static(path.join(__dirname, '/')));
app.use(express.json());

// Serve the index.html at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/', 'index.html'));
});

// Handle /open requests - launches applications
app.get('/open', (req, res) => {
  const appPath = req.query.app;
  
  if (!appPath) {
    return res.status(400).send('No application specified');
  }
  
  // Platform-specific command to open the application
  let command;
  
  if (os.platform() === 'win32') {
    // Windows
    command = `"${appPath}"`;
  } else if (os.platform() === 'darwin') {
    // macOS
    command = `open "${appPath}"`;
  } else {
    // Linux - Try wine for .exe files
    if (appPath.toLowerCase().endsWith('.exe')) {
      command = `wine "${appPath}"`;
    } else {
      command = `"${appPath}"`;
    }
  }
  
  console.log(`Executing command: ${command}`);
  
  exec(command, { shell: true }, (err) => {
    if (err) {
      console.error('Failed to open app:', err);
      return res.status(500).send(`Failed to open app: ${err.message}`);
    }
    res.send('App launched successfully');
  });
});

// API endpoints for app CRUD operations
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await getAppsFromDb();
    res.json(apps);
  } catch (err) {
    res.status(500).send(`Failed to fetch apps: ${err.message}`);
  }
});

app.post('/api/apps', async (req, res) => {
  try {
    const app = req.body;
    const result = await saveAppToDb(app);
    res.json(result);
  } catch (err) {
    res.status(500).send(`Failed to save app: ${err.message}`);
  }
});

app.put('/api/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const app = req.body;
    const result = await updateAppInDb(id, app);
    res.json(result);
  } catch (err) {
    res.status(500).send(`Failed to update app: ${err.message}`);
  }
});

app.delete('/api/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteAppFromDb(id);
    res.json(result);
  } catch (err) {
    res.status(500).send(`Failed to delete app: ${err.message}`);
  }
});

// MongoDB essential helper functions
async function getMongoClient() {
  if (!mongoUri) {
    throw new Error('MongoDB connection not configured');
  }
  
  const client = new MongoClient(mongoUri);
  await client.connect();
  return client;
}

async function getAppsFromDb() {
  let client;
  try {
    client = await getMongoClient();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    return await collection.find({}).toArray();
  } finally {
    if (client) await client.close();
  }
}

async function saveAppToDb(app) {
  let client;
  try {
    client = await getMongoClient();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    return await collection.insertOne(app);
  } finally {
    if (client) await client.close();
  }
}

async function updateAppInDb(id, app) {
  let client;
  try {
    client = await getMongoClient();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    return await collection.updateOne({ id }, { $set: app });
  } finally {
    if (client) await client.close();
  }
}

async function deleteAppFromDb(id) {
  let client;
  try {
    client = await getMongoClient();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    return await collection.deleteOne({ id });
  } finally {
    if (client) await client.close();
  }
}

// Helper function to check if MongoDB is configured
function isMongoConfigured() {
  return mongoUri && dbName && collectionName;
}

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  
  // Log MongoDB connection status
  if (!isMongoConfigured()) {
    console.log(`MongoDB is not configured. App will use localStorage for data storage.`);
    console.log(`To use MongoDB, set mongoUri, dbName, and collectionName variables in the server code.`);
  } else {
    console.log(`MongoDB is configured with database: ${dbName} and collection: ${collectionName}`);
  }
});
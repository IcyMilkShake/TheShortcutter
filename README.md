# 🗣️ TheShortcutter

**TheShortcutter** is a desktop app that lets you **control your computer with your voice**. Built with **Electron** and powered by **Vosk**, it listens for your speech and maps it to keyboard shortcuts, commands, or custom actions — making your workflow faster, hands-free, and just a little cooler.

---

## ✨ Features

- 🎙️ **Offline Voice Recognition** with [Vosk](https://alphacephei.com/vosk/)
- 🧠 Customizable voice commands mapped to:
  - Keyboard shortcuts (e.g. `"open browser"` → `Ctrl + Alt + B`)
  - File or app launches (e.g. `"open VS Code"`)
  - Shell scripts or system commands
- 🪟 Lightweight UI built with Electron
- 🖥️ Runs quietly in the background
- 📦 Easy-to-edit command config (JSON/YAML)

---

## 📸 Screenshot

> *(Include a screenshot of the UI if applicable)*

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/TheShortcutter.git
cd TheShortcutter
2. Install dependencies
Electron app
bash
Copy
Edit
npm install
Python backend (Vosk listener)
bash
Copy
Edit
cd backend
pip install -r requirements.txt
3. Download a Vosk model
Visit: https://alphacephei.com/vosk/models

Extract the model into backend/model/ so the path looks like:

bash
Copy
Edit
backend/model/<model files here>
🧪 Usage
Start the backend (Vosk listener)
bash
Copy
Edit
cd backend
python main.py
Start the Electron app
bash
Copy
Edit
npm start
⚙️ Configuration
Customize your voice commands in the commands.json file. Example:

json
Copy
Edit
{
  "open browser": {
    "type": "shortcut",
    "keys": ["ctrl", "alt", "b"]
  },
  "open vscode": {
    "type": "launch",
    "path": "C:/Users/You/AppData/Local/Programs/Microsoft VS Code/Code.exe"
  }
}
🔐 Permissions
Make sure to:

Allow microphone access

Run with permissions needed for system-level actions (like simulating keys or launching apps)

📦 Packaging
Electron App
bash
Copy
Edit
npm run build
Python Backend (Optional)
Bundle the listener with PyInstaller:

bash
Copy
Edit
pyinstaller --onefile main.py
You can then combine both into an installer using tools like Inno Setup, NSIS, or a custom bundler script.

🧰 Tech Stack
🎧 Vosk — Offline speech recognition

⚡ Electron — Cross-platform desktop app framework

🐍 Python — Speech backend and command dispatcher

📡 WebSocket / IPC — Communication between Electron and Python backend

🛠️ Roadmap Ideas
 Voice feedback ("Launching browser...")

 Auto-detect installed apps

 Command groups (e.g. "coding mode")

 Wake word support ("Hey shortcutter")

 System tray integration

🙌 Contribution
Pull requests and feature ideas are welcome!
If you enhance command mapping, build new features, or integrate better models — share them!

📄 License
MIT

yaml
Copy
Edit

---

### ✅ Paste this into a file named `README.md` and open it in:
- GitHub: formats automatically
- VS Code: use "Markdown Preview" (Ctrl+Shift+V)
- Obsidian, Typora, or any markdown app: perfect rendering
- Browser: convert with a markdown viewer/extension

Need help bundling this with an actual `.exe` installer or want a UI mockup next?








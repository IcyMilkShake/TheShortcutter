🗣️ TheShortcutter
TheShortcutter is a desktop app that lets you control your computer with your voice. Built with Electron and powered by Vosk, it listens for your speech and maps it to keyboard shortcuts, commands, or custom actions — making your workflow faster, hands-free, and just a little cooler.

✨ Features
🎙️ Offline Voice Recognition with Vosk

🧠 Customizable voice commands mapped to:

Keyboard shortcuts (e.g. "open browser" = Ctrl + Alt + B)

File or app launches (e.g. "open VS Code")

Shell scripts or system commands

🪟 Lightweight UI built with Electron

🖥️ Runs quietly in the background

📦 Easy-to-edit command config (JSON/YAML)

📸 Screenshot
(Include a screenshot of the UI if applicable)

🚀 Getting Started
1. Clone the repo
bash
Copy
Edit
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
You can customize commands in the commands.json file (or whatever format you're using). Example:

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
Make sure you give microphone access to the app and run with appropriate permissions for system actions.

📦 Packaging
To package the Electron app:

bash
Copy
Edit
npm run build
To bundle the Python backend, you can use pyinstaller:

bash
Copy
Edit
pyinstaller --onefile main.py
Then bundle both into a distributable installer with something like Inno Setup or a custom shell script.

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
PRs and ideas welcome! Feel free to fork and build your own version. If you improve the command mapping or add new models, share them!

📄 License
MIT

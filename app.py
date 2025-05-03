from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
import uuid
from pymongo import MongoClient
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static')

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {'lnk'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

# MongoDB configuration - update with your connection details
MONGO_URI = 'mongodb+srv://milkshake:t5975878@cluster0.k5dmweu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
DB_NAME = 'TheShortcutter'
COLLECTION_NAME = 'Shortcuts'

# Ensure uploads directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Helper functions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_db_connection():
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        return client, db
    except Exception as e:
        print(f"MongoDB connection error: {e}")
        return None, None

def get_shortcuts_from_db():
    client, db = get_db_connection()
    if db is None:
        return []
    
    try:
        shortcuts = list(db[COLLECTION_NAME].find())
        # Convert ObjectId to string for JSON serialization
        for shortcut in shortcuts:
            shortcut['_id'] = str(shortcut['_id'])
        return shortcuts
    except Exception as e:
        print(f"Error fetching shortcuts: {e}")
        return []
    finally:
        if client:
            client.close()

def get_shortcuts_from_file():
    try:
        if os.path.exists('shortcuts.json'):
            with open('shortcuts.json', 'r') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error reading shortcuts file: {e}")
        return []

def save_shortcuts_to_file(shortcuts):
    try:
        with open('shortcuts.json', 'w') as f:
            json.dump(shortcuts, f)
    except Exception as e:
        print(f"Error saving shortcuts file: {e}")

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/shortcuts', methods=['GET'])
def get_shortcuts():
    # Try to get shortcuts from MongoDB, fallback to local file
    shortcuts = get_shortcuts_from_db()
    if not shortcuts:
        shortcuts = get_shortcuts_from_file()
    return jsonify(shortcuts)

@app.route('/api/shortcuts', methods=['POST'])
def add_shortcut():
    print("Received POST request to add shortcut.")  # Log the request
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed. Please upload a .lnk file'}), 400
    
    try:
        # Get form data
        name = request.form.get('name', 'Unnamed Shortcut')
        voice_command = request.form.get('voiceCommand', 'open shortcut')
        print(f"Received form data - name: {name}, voice_command: {voice_command}")  # Log form data
        
        # Generate a unique filename to prevent overwriting
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Save the file
        print(f"Saving file to: {file_path}")  # Log file path
        file.save(file_path)
        
        # Create shortcut data
        shortcut_data = {
            'id': str(uuid.uuid4()),
            'name': name,
            'voiceCommand': voice_command,
            'path': file_path,
            'filename': unique_filename,
            'originalName': filename,  # Store the original filename for client display
            'iconColor': request.form.get('iconColor', '#3498db')
        }
        
        # Try to save to MongoDB
        client, db = get_db_connection()
        if db is not None:
            print(f"Inserting shortcut into MongoDB: {shortcut_data}")  # Log data to insert
            result = db[COLLECTION_NAME].insert_one(shortcut_data)
            shortcut_data['_id'] = str(result.inserted_id)
            client.close()
        else:
            # Fallback to local file storage
            print("MongoDB connection failed, saving shortcut to local file.")  # Log MongoDB failure
            shortcuts = get_shortcuts_from_file()
            shortcuts.append(shortcut_data)
            save_shortcuts_to_file(shortcuts)
        
        return jsonify(shortcut_data)
    
    except Exception as e:
        print(f"Error: {str(e)}")  # Log error
        return jsonify({'error': str(e)}), 500

@app.route('/api/shortcuts/<shortcut_id>', methods=['PUT'])
def update_shortcut(shortcut_id):
    data = request.json
    
    try:
        # Try to update in MongoDB
        client, db = get_db_connection()
        if db is not None:
            db[COLLECTION_NAME].update_one(
                {'id': shortcut_id},
                {'$set': {
                    'name': data['name'],
                    'voiceCommand': data['voiceCommand']
                }}
            )
            client.close()
        else:
            # Fallback to local file
            shortcuts = get_shortcuts_from_file()
            for shortcut in shortcuts:
                if shortcut['id'] == shortcut_id:
                    shortcut['name'] = data['name']
                    shortcut['voiceCommand'] = data['voiceCommand']
                    break
            save_shortcuts_to_file(shortcuts)
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/shortcuts/<shortcut_id>', methods=['DELETE'])
def delete_shortcut(shortcut_id):
    try:
        # Find the shortcut to get the filename
        shortcut_to_delete = None
        
        # Check MongoDB first
        client, db = get_db_connection()
        if db is not None:
            shortcut_to_delete = db[COLLECTION_NAME].find_one({'id': shortcut_id})
            if shortcut_to_delete:
                # Delete the file
                file_path = shortcut_to_delete.get('path')
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
                
                # Delete from database
                db[COLLECTION_NAME].delete_one({'id': shortcut_id})
            client.close()
        
        # If not found in MongoDB or no connection, check local file
        if shortcut_to_delete is None:
            shortcuts = get_shortcuts_from_file()
            for shortcut in shortcuts:
                if shortcut['id'] == shortcut_id:
                    shortcut_to_delete = shortcut
                    # Delete the file
                    file_path = shortcut['path']
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    
                    # Remove from list and save
                    shortcuts.remove(shortcut)
                    save_shortcuts_to_file(shortcuts)
                    break
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download/<shortcut_id>', methods=['GET'])
def download_shortcut(shortcut_id):
    # Find the shortcut
    shortcut = None
    
    # Check MongoDB first
    client, db = get_db_connection()
    if db is not None:
        shortcut = db[COLLECTION_NAME].find_one({'id': shortcut_id})
        client.close()
    
    # If not found in MongoDB, check local file
    if shortcut is None:
        shortcuts = get_shortcuts_from_file()
        for s in shortcuts:
            if s['id'] == shortcut_id:
                shortcut = s
                break
    
    if shortcut is None:
        return jsonify({'error': 'Shortcut not found'}), 404
    
    # Return the file for download
    return send_from_directory(
        app.config['UPLOAD_FOLDER'],
        os.path.basename(shortcut['path']),
        as_attachment=True,
        download_name=shortcut.get('originalName', os.path.basename(shortcut['path']))
    )

if __name__ == '__main__':
    # For development only - in production use NGINX with gunicorn/uwsgi
    app.run(host='0.0.0.0', port=8080, debug=True)
print(">>> Python script started", flush=True)

import os
import sys
import json
import time
import queue
import signal
import argparse
import threading
import traceback
import numpy as np
import sounddevice as sd
from vosk import Model, KaldiRecognizer
print(json.dumps({
    "status": "debug",
    "python_path": sys.executable,
    
}), flush=True)
# Constants
DEFAULT_SAMPLE_RATE = 16000
DEFAULT_DEVICE = None
DEFAULT_MODEL_PATH = None  # Will be set from command-line or environment variable
CHUNK_SIZE = 4000  # Number of audio samples per chunk
COMMAND_QUEUE = queue.Queue()
EXIT_EVENT = threading.Event()

def has_working_microphone(threshold=0.01):
    try:
        duration = 1  # seconds
        fs = 44100

        # Record short audio snippet
        audio = sd.rec(int(duration * fs), samplerate=fs, channels=1, blocking=True)
        volume_norm = np.linalg.norm(audio)

        return volume_norm > threshold
    except Exception as e:
        print("Mic error:", e)
        return False

status = "Mic is working and capturing sound!" if has_working_microphone() else "Mic not working, muted, or not capturing audio."
print(json.dumps({"status": status}))

def parse_args():
    parser = argparse.ArgumentParser(description='Voice Recognition with Vosk')
    parser.add_argument('--model-path', type=str, default=os.environ.get('VOSK_MODEL_PATH', DEFAULT_MODEL_PATH),
                        help='Path to Vosk model directory')
    parser.add_argument('--device', type=int, default=DEFAULT_DEVICE,
                        help='Input audio device (numeric ID)')
    parser.add_argument('--list-devices', action='store_true',
                        help='List available audio devices and exit')
    parser.add_argument('--sample-rate', type=int, default=DEFAULT_SAMPLE_RATE,
                        help='Sample rate for audio input')
    return parser.parse_args()

def list_audio_devices():
    """List all available audio input devices"""
    devices = sd.query_devices()
    print(json.dumps({
        "devices": [
            {
                "index": i,
                "name": d['name'],
                "channels": d.get('max_input_channels', 0),
                "default": sd.default.device[0] == i,
                "sample_rates": getattr(d, 'sample_rates', [])
            }
            for i, d in enumerate(devices) if d.get('max_input_channels', 0) > 0
        ]
    }))
    sys.exit(0)

def init_model(model_path, sample_rate):
    """Initialize the Vosk model and recognizer"""
    log(f"Initializing model from path: {model_path}")
    if not os.path.exists(model_path):
        error_msg = {"status": "error", "message": f"Model path not found: {model_path}"}
        log(json.dumps(error_msg))
        sys.exit(1)
    
    try:
        model = Model(model_path)
        recognizer = KaldiRecognizer(model, sample_rate)
        log(f"Model loaded successfully.")
        return model, recognizer
    except Exception as e:
        error_msg = {"status": "error", "message": f"Failed to initialize model: {str(e)}"}
        log(json.dumps(error_msg))
        sys.exit(1)

# Add this at the start of the script to log paths
def log(message):
    """Helper function to log messages with timestamp."""
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {message}")

def audio_callback(indata, frames, time, status):
    """This is called for each audio block"""
    if status:
        # Handle audio input errors
        error_msg = {"status": "warn", "message": f"Audio input error: {status}"}
        print(json.dumps(error_msg), flush=True)
    
    if not EXIT_EVENT.is_set():
        # Add audio data to the command queue
        COMMAND_QUEUE.put(bytes(indata))

def recognize_thread(recognizer, sample_rate):
    """Thread that processes audio from the queue and sends recognition results"""
    try:
        print(json.dumps({"status": "listening", "message": "Starting speech recognition"}), flush=True)
        
        # Main recognition loop
        while not EXIT_EVENT.is_set():
            try:
                # Get audio data from queue with timeout
                data = COMMAND_QUEUE.get(timeout=1)
                
                if recognizer.AcceptWaveform(data):
                    # Full result
                    result = json.loads(recognizer.Result())
                    if result.get('text'):
                        print(json.dumps({
                            "type": "transcript", 
                            "text": result['text'],
                            "timestamp": time.time()
                        }), flush=True)
                else:
                    # Partial result
                    partial = json.loads(recognizer.PartialResult())
                    if partial.get('partial'):
                        print(json.dumps({
                            "type": "partial", 
                            "text": partial['partial'],
                            "timestamp": time.time()
                        }), flush=True)
            
            except queue.Empty:
                # Queue timeout, just continue
                continue
            except Exception as e:
                # Error processing audio
                error_msg = {"status": "error", "message": f"Recognition error: {str(e)}"}
                print(json.dumps(error_msg), flush=True)
                
    except Exception as e:
        error_msg = {"status": "error", "message": f"Recognition thread error: {str(e)}"}
        print(json.dumps(error_msg), flush=True)

def signal_handler(sig, frame):
    """Handle termination signals"""
    EXIT_EVENT.set()
    print(json.dumps({"status": "stopping", "message": "Stopping speech recognition"}), flush=True)

def main():
    """Main function to start the voice recognition system"""
    args = parse_args()
    
    # List audio devices if requested
    if args.list_devices:
        list_audio_devices()
    
    # Check if model path is provided
    if not args.model_path:
        error_msg = {"status": "error", "message": "Model path not specified. Use --model-path or set VOSK_MODEL_PATH environment variable."}
        print(json.dumps(error_msg), flush=True)
        sys.exit(1)
    
    # Initialize model and recognizer
    model, recognizer = init_model(args.model_path, args.sample_rate)
    
    # Set up signal handlers for graceful termination
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start recognition thread
    rec_thread = threading.Thread(target=recognize_thread, args=(recognizer, args.sample_rate))
    rec_thread.daemon = True
    rec_thread.start()
    
    try:
        # Start audio stream
        with sd.RawInputStream(
            samplerate=args.sample_rate,
            blocksize=CHUNK_SIZE,
            device=args.device,
            dtype='int16',
            channels=1,
            callback=audio_callback
        ):
            # Send ready status
            ready_msg = {
                "status": "ready", 
                "message": "Speech recognition ready", 
                "model_path": args.model_path,
                "sample_rate": args.sample_rate,
                "device": args.device if args.device is not None else "default"
            }
            print(json.dumps(ready_msg), flush=True)
            
            # Keep main thread alive until EXIT_EVENT is set
            while not EXIT_EVENT.is_set():
                time.sleep(0.1)
                
    except Exception as e:
        error_msg = {
            "status": "error",
            "message": f"Audio stream error: {str(e)}",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_msg), flush=True)
    
    # Wait for recognition thread to finish
    EXIT_EVENT.set()
    if rec_thread.is_alive():
        rec_thread.join(timeout=2.0)
    
    print(json.dumps({"status": "stopped", "message": "Speech recognition stopped"}), flush=True)

if __name__ == "__main__":
    main()
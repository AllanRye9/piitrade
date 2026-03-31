#!/usr/bin/env python3
import sys
import time
import datetime
import re
import threading
import queue
import logging
from pathlib import Path

# --- Dependency Check ---
REQUIRED = [
    ('win32com.client', 'pywin32'),
    ('pyautogui', 'pyautogui'), 
    ('speech_recognition', 'SpeechRecognition'),
    ('thefuzz', 'thefuzz')  # NEW: For fuzzy string matching
]

def check_deps():
    missing = []
    for mod, pkg in REQUIRED:
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"CRITICAL: Missing packages: {', '.join(missing)}")
        print(f"Run: pip install {' '.join(missing)}")
        sys.exit(1)

check_deps()

import win32com.client
import pythoncom
import pyautogui
import speech_recognition as sr
from thefuzz import fuzz, process

# ============================================================================
# CONFIGURATION & COMMANDS
# ============================================================================

# FUZZY_THRESHOLD: How close the match needs to be (0-100). 
# 80 allows for minor errors ("nex" vs "next"), 60 is too loose.
FUZZY_THRESHOLD = 80

COMMANDS = {
    "next_slide": {
        "patterns": [r"next", r"forward", r"advance", r"go right", r"next slide"],
        "key": "right",
        "fuzzy_target": "next slide" 
    },
    "prev_slide": {
        "patterns": [r"previous", r"back", r"go back", r"return", r"last slide"],
        "key": "left",
        "fuzzy_target": "previous slide"
    },
    "jump_slide": {
        # Regex captures the number explicitly
        "patterns": [r"(?:jump to|go to|slide|page)\s*(\d+)", r"number\s*(\d+)"],
        "key": None,
        "fuzzy_target": None # Regex only for safety
    },
    "start_show": {
        "patterns": [r"start presentation", r"begin show", r"present now"],
        "key": "f5",
        "fuzzy_target": "start presentation"
    },
    "end_show": {
        "patterns": [r"stop presentation", r"end show", r"exit show", r"close powerpoint"],
        "key": "esc",
        "fuzzy_target": "end presentation"
    },
    "blackout": {
        "patterns": [r"black screen", r"darken screen", r"turn off screen"],
        "key": "b",
        "fuzzy_target": "black screen"
    },
    "exit_program": {
        "patterns": [r"terminate program", r"kill system", r"shutdown voice"],
        "key": None,
        "fuzzy_target": "terminate program"
    }
}

# ============================================================================
# CORE ENGINE
# ============================================================================

class PPTController:
    def __init__(self):
        self.running = True
        self.command_queue = queue.Queue()
        self._setup_paths()
        self._init_logger()
        self._compile_regex()
        
        self.ppt_app = None
        self.presentation = None
        
        # Stats
        self.stats = {"total": 0, "success": 0, "fuzzy_rescues": 0}

    def _setup_paths(self):
        self.log_dir = Path("logs")
        self.log_dir.mkdir(exist_ok=True)
        self.log_file = self.log_dir / f"ppt_{datetime.datetime.now().strftime('%Y%m%d')}.log"

    def _init_logger(self):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] %(message)s',
            handlers=[
                logging.FileHandler(self.log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger("PPTVoice")

    def _compile_regex(self):
        self.patterns = []
        for cmd, data in COMMANDS.items():
            for p in data['patterns']:
                self.patterns.append({
                    're': re.compile(p, re.IGNORECASE),
                    'cmd': cmd,
                    'is_regex': r'(\d+)' in p
                })

    def check_microphone(self):
        try:
            mics = sr.Microphone.list_microphone_names()
            if not mics:
                raise OSError("No microphones found")
            return True
        except Exception as e:
            self.logger.error(f"Microphone Error: {e}")
            print("ERROR: No microphone detected. Please check your system settings.")
            return False

    def connect(self):
        """Connects to PowerPoint via COM."""
        try:
            pythoncom.CoInitialize()
            try:
                self.ppt_app = win32com.client.GetActiveObject("PowerPoint.Application")
                self.presentation = self.ppt_app.ActivePresentation
                self.logger.info(f"Connected to: {self.presentation.Name}")
                return True
            except Exception:
                # If GetActiveObject fails, try dispatching (opens app if closed)
                self.logger.warning("No active presentation found. Waiting...")
                return False
        except Exception as e:
            self.logger.error(f"Connection failed: {e}")
            return False

    def _focus_window(self):
        """Forces PowerPoint window to foreground."""
        try:
            shell = win32com.client.Dispatch("WScript.Shell")
            shell.AppActivate("PowerPoint")
            return True
        except:
            return False

    def listen_loop(self):
        recognizer = sr.Recognizer()
        recognizer.dynamic_energy_threshold = True
        recognizer.pause_threshold = 0.8  # Faster response time
        
        while self.running:
            try:
                with sr.Microphone() as source:
                    recognizer.adjust_for_ambient_noise(source, duration=0.5)
                    print("Listening...", end="\r", flush=True)
                    audio = recognizer.listen(source, timeout=2, phrase_time_limit=4)
                    
                    try:
                        text = recognizer.recognize_google(audio).lower()
                        self.command_queue.put(text)
                    except sr.UnknownValueError:
                        pass # Squelch silence errors
                    except sr.RequestError as e:
                        self.logger.error(f"API Error: {e}")

            except (sr.WaitTimeoutError):
                continue
            except Exception as e:
                self.logger.error(f"Listener Error: {e}")

    def match_command(self, text):
        """Hybrid Matching: Regex First -> Fuzzy Second"""
        
        # 1. Regex Exact/Parametric Match
        for p in self.patterns:
            match = p['re'].search(text)
            if match:
                params = match.groups()[0] if p['is_regex'] else None
                return p['cmd'], params, 100, "Regex"

        # 2. Fuzzy Match fallback
        best_cmd = None
        best_score = 0
        
        for cmd, data in COMMANDS.items():
            if not data['fuzzy_target']: continue
            
            # Partial ratio handles "can you go to the next slide please" matching "next slide"
            score = fuzz.partial_ratio(data['fuzzy_target'], text)
            
            if score > best_score:
                best_score = score
                best_cmd = cmd

        if best_score >= FUZZY_THRESHOLD:
            return best_cmd, None, best_score, "Fuzzy"
            
        return None, None, 0, None

    def execute(self, text):
        self.stats["total"] += 1
        cmd, params, score, method = self.match_command(text)

        if not cmd:
            print(f"❌ Ignored: '{text}'")
            return

        self._focus_window()
        time.sleep(0.1)

        try:
            action_map = {
                "next_slide": lambda: pyautogui.press('right'),
                "prev_slide": lambda: pyautogui.press('left'),
                "start_show": lambda: pyautogui.press('f5'),
                "end_show":   lambda: pyautogui.press('esc'),
                "blackout":   lambda: pyautogui.press('b'),
                "jump_slide": lambda: self._jump_to(params),
                "exit_program": lambda: self._shutdown()
            }

            if cmd in action_map:
                action_map[cmd]()
                
                # Visual Feedback
                print(f"✅ {cmd.upper()} | '{text}' (Score: {score} via {method})")
                
                self.stats["success"] += 1
                if method == "Fuzzy":
                    self.stats["fuzzy_rescues"] += 1
            
        except Exception as e:
            self.logger.error(f"Execution Error: {e}")

    def _jump_to(self, slide_num):
        if slide_num:
            pyautogui.write(slide_num)
            pyautogui.press('enter')

    def _shutdown(self):
        self.running = False
        print("\n👋 Shutting down...")

    def run(self):
        if not self.check_microphone(): return

        print("\n" + "="*50)
        print(" 🗣️  VOICE CONTROLLER v5.3 (Fuzzy Enhanced)")
        print(f" 🎯 Fuzzy Threshold: {FUZZY_THRESHOLD}%")
        print("="*50)
        print(" Commands: 'Next', 'Back', 'Jump to 5', 'Blackout', 'Exit'\n")

        if not self.connect():
            print("⚠️  WARNING: PowerPoint not found. Open a presentation to begin.")
        
        # Start Listener Thread
        t = threading.Thread(target=self.listen_loop, daemon=True)
        t.start()

        try:
            while self.running:
                try:
                    text = self.command_queue.get(timeout=0.5)
                    self.execute(text)
                except queue.Empty:
                    continue
        except KeyboardInterrupt:
            self.running = False
        
        print(f"\nStats: {self.stats['success']}/{self.stats['total']} commands.")
        print(f"Fuzzy Logic rescued {self.stats['fuzzy_rescues']} commands.")

if __name__ == "__main__":
    app = PPTController()
    app.run()

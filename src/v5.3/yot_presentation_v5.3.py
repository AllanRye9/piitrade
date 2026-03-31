#!/usr/bin/env python3

import sys
import time
import datetime
import re
import threading
import queue
import logging
import json
import sqlite3
import hashlib
import tarfile
from pathlib import Path
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass, asdict
from collections import defaultdict

# --- Dependency Check ---
REQUIRED = [
    ('win32com.client', 'pywin32'),
    ('pyautogui', 'pyautogui'), 
    ('speech_recognition', 'SpeechRecognition'),
    ('thefuzz', 'thefuzz')
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
# CONFIGURATION
# ============================================================================

@dataclass
class Config:
    """Configuration for PowerPoint Voice Controller v5.2"""
    ENABLE_TRAINING: bool = True
    TRAINING_DATA_DIR: Path = Path("training_data")
    LOG_CONFIDENCE_THRESHOLD: float = 0.70
    ENABLE_FALLBACK: bool = True
    FALLBACK_CONFIDENCE: float = 0.80
    FUZZY_THRESHOLD: int = 80
    
    def __post_init__(self):
        if isinstance(self.TRAINING_DATA_DIR, str):
            self.TRAINING_DATA_DIR = Path(self.TRAINING_DATA_DIR)

# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class AudioTextRecord:
    """Single training example (text only)"""
    id: str
    text: str
    command_matched: str
    confidence: float
    timestamp: str
    source: str  # 'google', 'fallback', or 'app'
    user_id: str = "default"
    
    @staticmethod
    def create(text: str, command: str, confidence: float, source: str = "google", 
               user_id: str = "default") -> 'AudioTextRecord':
        """Create a new record with auto-generated ID and timestamp"""
        record_id = hashlib.sha256(
            f"{text}{command}{time.time()}".encode()
        ).hexdigest()[:16]
        
        timestamp = datetime.datetime.now().isoformat()
        
        return AudioTextRecord(
            id=record_id,
            text=text,
            command_matched=command,
            confidence=confidence,
            timestamp=timestamp,
            source=source,
            user_id=user_id
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)
    
    def to_json(self) -> str:
        """Convert to JSON string"""
        return json.dumps(self.to_dict())
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'AudioTextRecord':
        """Create from dictionary"""
        return AudioTextRecord(**data)

# ============================================================================
# FALLBACK CACHE
# ============================================================================

class FallbackCache:
    """Local text-only cache for offline fallback"""
    
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.cache_file = data_dir / "fallback_cache.json"
        self.cache: Dict[str, str] = {}
        self._load()
    
    def _load(self):
        """Load cache from file"""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    self.cache = json.load(f)
            except Exception:
                self.cache = {}
    
    def _save(self):
        """Save cache to file"""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with open(self.cache_file, 'w', encoding='utf-8') as f:
            json.dump(self.cache, f, indent=2)
    
    def set(self, key: str, text: str):
        """Cache text"""
        self.cache[key] = text
        self._save()
    
    def get(self, key: str) -> Optional[str]:
        """Retrieve cached text"""
        return self.cache.get(key)
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        cache_size = 0
        if self.cache_file.exists():
            cache_size = self.cache_file.stat().st_size / 1024  # KB
        
        return {
            'items': len(self.cache),
            'size_kb': round(cache_size, 2)
        }

# ============================================================================
# LOCAL TRAINING DATA LOGGER
# ============================================================================

class LocalTrainingDataLogger:
    """Stores text records in SQLite + JSONL"""
    
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.db_file = data_dir / "training_data.db"
        self.jsonl_file = data_dir / "training_data.jsonl"
        self._init_db()
    
    def _init_db(self):
        """Initialize SQLite database"""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS training_data (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                command_matched TEXT NOT NULL,
                confidence REAL NOT NULL,
                timestamp TEXT NOT NULL,
                source TEXT NOT NULL,
                user_id TEXT NOT NULL
            )
        ''')
        
        # Create indexes for common queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_command 
            ON training_data(command_matched)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_source 
            ON training_data(source)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_timestamp 
            ON training_data(timestamp)
        ''')
        
        conn.commit()
        conn.close()
    
    def log_text(self, record: AudioTextRecord):
        """Log a text record"""
        # SQLite storage
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO training_data
                (id, text, command_matched, confidence, timestamp, source, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.id,
                record.text,
                record.command_matched,
                record.confidence,
                record.timestamp,
                record.source,
                record.user_id
            ))
            conn.commit()
        finally:
            conn.close()
        
        # JSONL storage (append mode)
        with open(self.jsonl_file, 'a', encoding='utf-8') as f:
            f.write(record.to_json() + '\n')
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get training data statistics"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            # Total entries
            cursor.execute('SELECT COUNT(*) FROM training_data')
            total = cursor.fetchone()[0]
            
            # By command
            cursor.execute('''
                SELECT command_matched, COUNT(*) 
                FROM training_data 
                GROUP BY command_matched
            ''')
            by_command = dict(cursor.fetchall())
            
            # By source
            cursor.execute('''
                SELECT source, COUNT(*) 
                FROM training_data 
                GROUP BY source
            ''')
            by_source = dict(cursor.fetchall())
            
            # Confidence stats
            cursor.execute('''
                SELECT AVG(confidence), MIN(confidence), MAX(confidence)
                FROM training_data
            ''')
            avg_conf, min_conf, max_conf = cursor.fetchone()
            
            # Database size
            db_size = 0
            if self.db_file.exists():
                db_size = self.db_file.stat().st_size / (1024 * 1024)  # MB
            
            return {
                'total_entries': total,
                'database_size_mb': round(db_size, 2),
                'by_command': by_command,
                'by_source': by_source,
                'confidence': {
                    'average': round(avg_conf or 0, 2),
                    'minimum': round(min_conf or 0, 2),
                    'maximum': round(max_conf or 0, 2)
                }
            }
        finally:
            conn.close()
    
    def export_training_set(self, output_path: Path, 
                           threshold: float = 0.80) -> Dict[str, Any]:
        """Export training dataset for ML"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT text, command_matched, confidence, timestamp, source
                FROM training_data
                WHERE confidence >= ?
                ORDER BY timestamp DESC
            ''', (threshold,))
            
            training_examples = []
            for row in cursor.fetchall():
                training_examples.append({
                    'text': row[0],
                    'label': row[1],
                    'confidence': row[2],
                    'timestamp': row[3],
                    'source': row[4]
                })
            
            export_data = {
                'metadata': {
                    'exported_at': datetime.datetime.now().isoformat(),
                    'total_examples': len(training_examples),
                    'confidence_threshold': threshold,
                    'version': '5.2'
                },
                'training_examples': training_examples
            }
            
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2)
            
            return export_data
        finally:
            conn.close()
    
    def archive_data(self) -> Path:
        """Archive old data with compression"""
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        archive_dir = self.data_dir / "archives"
        archive_dir.mkdir(parents=True, exist_ok=True)
        
        archive_path = archive_dir / f"training_data_{timestamp}.tar.gz"
        
        with tarfile.open(archive_path, 'w:gz') as tar:
            tar.add(self.db_file, arcname=self.db_file.name)
            tar.add(self.jsonl_file, arcname=self.jsonl_file.name)
        
        return archive_path

# ============================================================================
# ENHANCED SPEECH ENGINE
# ============================================================================

class EnhancedSpeechEngine:
    """Speech recognition with fallback + logging"""
    
    def __init__(self, logger: logging.Logger, 
                 training_logger: Optional[LocalTrainingDataLogger] = None,
                 fallback_cache: Optional[FallbackCache] = None,
                 config: Optional[Config] = None):
        self.logger = logger
        self.training_logger = training_logger
        self.fallback_cache = fallback_cache
        self.config = config or Config()
        self.recognizer = sr.Recognizer()
        
        # Statistics
        self.stats = {
            'google_success': 0,
            'fallback_success': 0,
            'failed': 0,
            'total': 0
        }
    
    def recognize(self, audio) -> Tuple[Optional[str], float, str]:
        """
        Recognize speech with fallback support
        
        Returns:
            (text, confidence, source) where source is 'google', 'fallback', or 'failed'
        """
        self.stats['total'] += 1
        
        # Try Google API first
        try:
            text = self.recognizer.recognize_google(audio).lower()
            self.stats['google_success'] += 1
            
            # Cache the successful result
            if self.fallback_cache:
                # Generate a content-based hash for cache key
                # In a real implementation, this would use audio features
                # For now, we use text + timestamp as cache key
                cache_key = hashlib.sha256(
                    f"{text}{time.time()}".encode()
                ).hexdigest()[:16]
                self.fallback_cache.set(cache_key, text)
            
            return (text, 0.95, "google")
            
        except sr.UnknownValueError:
            # Could not understand audio
            self.stats['failed'] += 1
            return (None, 0.0, "failed")
            
        except sr.RequestError as e:
            self.logger.warning(f"Google API unavailable: {e}")
            
            # Try fallback cache
            if self.fallback_cache and self.config.ENABLE_FALLBACK:
                # In real scenario, we'd need some way to match audio to cache
                # For now, we'll mark as failed since we can't retrieve without key
                self.stats['failed'] += 1
                return (None, 0.0, "failed")
            else:
                self.stats['failed'] += 1
                return (None, 0.0, "failed")
    
    def get_stats(self) -> Dict[str, int]:
        """Get recognition statistics"""
        return self.stats.copy()

# ============================================================================
# TRAINING DATA MANAGER
# ============================================================================

class TrainingDataManager:
    """High-level API for training data management"""
    
    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir or Path("training_data")
        self.logger = LocalTrainingDataLogger(self.data_dir)
        self.fallback_cache = FallbackCache(self.data_dir)
    
    def log_text(self, text: str, command: str, confidence: float, 
                 source: str = "google", user_id: str = "default"):
        """Log a text conversion"""
        record = AudioTextRecord.create(text, command, confidence, source, user_id)
        self.logger.log_text(record)
    
    def export(self, output_path: Path, threshold: float = 0.80) -> Dict[str, Any]:
        """Export training dataset"""
        return self.logger.export_training_set(output_path, threshold)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get comprehensive statistics"""
        return {
            'training_data': self.logger.get_statistics(),
            'fallback_cache': self.fallback_cache.stats()
        }
    
    def create_batch(self, batch_size: int = 1000) -> List[Dict[str, Any]]:
        """Create training batch for ML frameworks"""
        conn = sqlite3.connect(self.logger.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT text, command_matched, confidence
                FROM training_data
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (batch_size,))
            
            batch = []
            for row in cursor.fetchall():
                batch.append({
                    'input': row[0],
                    'label': row[1],
                    'confidence': row[2]
                })
            
            return batch
        finally:
            conn.close()
    
    def archive(self) -> Path:
        """Archive training data"""
        return self.logger.archive_data()

# ============================================================================
# COMMANDS CONFIGURATION
# ============================================================================

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
        "patterns": [r"(?:jump to|go to|slide|page)\s*(\d+)", r"number\s*(\d+)"],
        "key": None,
        "fuzzy_target": None
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
    "zoom_in": {
        "patterns": [r"zoom in", r"magnify", r"enlarge"],
        "key": None,
        "fuzzy_target": "zoom in"
    },
    "pen_tool": {
        "patterns": [r"pen tool", r"draw", r"annotation"],
        "key": "ctrl+p",
        "fuzzy_target": "pen tool"
    },
    "exit_program": {
        "patterns": [r"terminate program", r"kill system", r"shutdown voice"],
        "key": None,
        "fuzzy_target": "terminate program"
    }
}

# ============================================================================
# POWERPOINT CONTROLLER V5.2
# ============================================================================

class PowerPointControllerV52:
    """PowerPoint Voice Controller with Training Data Collection"""
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.running = True
        self.command_queue = queue.Queue()
        
        self._setup_paths()
        self._init_logger()
        self._compile_regex()
        
        # Initialize training components
        if self.config.ENABLE_TRAINING:
            self.training_manager = TrainingDataManager(self.config.TRAINING_DATA_DIR)
            self.speech_engine = EnhancedSpeechEngine(
                self.logger,
                self.training_manager.logger,
                self.training_manager.fallback_cache,
                self.config
            )
        else:
            self.training_manager = None
            self.speech_engine = None
        
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
        self.logger = logging.getLogger("PPTVoiceV52")
    
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
        recognizer.pause_threshold = 0.8
        
        while self.running:
            try:
                with sr.Microphone() as source:
                    recognizer.adjust_for_ambient_noise(source, duration=0.5)
                    print("Listening...", end="\r", flush=True)
                    audio = recognizer.listen(source, timeout=2, phrase_time_limit=4)
                    
                    try:
                        text = recognizer.recognize_google(audio).lower()
                        self.command_queue.put(('text', text, 0.95, 'google'))
                    except sr.UnknownValueError:
                        pass
                    except sr.RequestError as e:
                        self.logger.error(f"API Error: {e}")
            
            except sr.WaitTimeoutError:
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
            if not data['fuzzy_target']:
                continue
            
            score = fuzz.partial_ratio(data['fuzzy_target'], text)
            
            if score > best_score:
                best_score = score
                best_cmd = cmd
        
        if best_score >= self.config.FUZZY_THRESHOLD:
            return best_cmd, None, best_score, "Fuzzy"
        
        return None, None, 0, None
    
    def execute(self, text, confidence, source):
        self.stats["total"] += 1
        cmd, params, score, method = self.match_command(text)
        
        # Log to training data if enabled and confidence above threshold
        if (self.config.ENABLE_TRAINING and 
            self.training_manager and 
            confidence >= self.config.LOG_CONFIDENCE_THRESHOLD and
            cmd):
            # confidence is already in range 0.0-1.0, no need to divide
            self.training_manager.log_text(text, cmd, confidence, source)
        
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
                "end_show": lambda: pyautogui.press('esc'),
                "blackout": lambda: pyautogui.press('b'),
                "jump_slide": lambda: self._jump_to(params),
                "zoom_in": lambda: pyautogui.hotkey('ctrl', 'plus'),
                "pen_tool": lambda: pyautogui.hotkey('ctrl', 'p'),
                "exit_program": lambda: self._shutdown()
            }
            
            if cmd in action_map:
                action_map[cmd]()
                
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
        
        # Print statistics before exit
        if self.training_manager:
            print("\n" + "="*50)
            print(" 📊 TRAINING DATA STATISTICS")
            print("="*50)
            stats = self.training_manager.get_statistics()
            print(f" Total entries logged: {stats['training_data']['total_entries']}")
            print(f" Database size: {stats['training_data']['database_size_mb']:.2f} MB")
            print(f" Cache items: {stats['fallback_cache']['items']}")
    
    def run(self):
        if not self.check_microphone():
            return
        
        print("\n" + "="*60)
        print(" 🗣️  POWERPOINT VOICE CONTROLLER v5.2")
        print(" 📊  LOCAL TRAINING DATA - No Server, No Audio Files")
        print("="*60)
        print(f" 🎯 Fuzzy Threshold: {self.config.FUZZY_THRESHOLD}%")
        if self.config.ENABLE_TRAINING:
            print(f" 📝 Training: ENABLED (logging to {self.config.TRAINING_DATA_DIR})")
        else:
            print(" 📝 Training: DISABLED")
        print("="*60)
        print(" Commands: 'Next', 'Back', 'Jump to 5', 'Zoom in', 'Pen tool'\n")
        
        if not self.connect():
            print("⚠️  WARNING: PowerPoint not found. Open a presentation to begin.")
        
        # Start Listener Thread
        t = threading.Thread(target=self.listen_loop, daemon=True)
        t.start()
        
        try:
            while self.running:
                try:
                    item = self.command_queue.get(timeout=0.5)
                    if item[0] == 'text':
                        _, text, confidence, source = item
                        self.execute(text, confidence, source)
                except queue.Empty:
                    continue
        except KeyboardInterrupt:
            self.running = False
        
        print(f"\nStats: {self.stats['success']}/{self.stats['total']} commands.")
        print(f"Fuzzy Logic rescued {self.stats['fuzzy_rescues']} commands.")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    config = Config(
        ENABLE_TRAINING=True,
        TRAINING_DATA_DIR=Path("training_data"),
        LOG_CONFIDENCE_THRESHOLD=0.70,
        ENABLE_FALLBACK=True
    )
    
    app = PowerPointControllerV52(config=config)
    app.run()

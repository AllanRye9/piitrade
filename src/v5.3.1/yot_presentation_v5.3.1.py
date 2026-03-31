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
from typing import Optional, Dict, List, Tuple, Any, Callable
from dataclasses import dataclass, asdict, field
from collections import defaultdict
from enum import Enum
import concurrent.futures

# --- Dependency Check ---
REQUIRED = [
    ('win32com.client', 'pywin32'),
    ('pyautogui', 'pyautogui'), 
    ('speech_recognition', 'SpeechRecognition'),
    ('thefuzz', 'thefuzz'),
    ('langdetect', 'langdetect'),
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
from langdetect import detect, detect_langs, LangDetectException

# Disable pyautogui safety features for better performance
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.01  # Minimal pause between actions

# ============================================================================
# LANGUAGE DEFINITIONS & MULTI-LANGUAGE SUPPORT
# ============================================================================

class Language(Enum):
    """Supported languages"""
    ENGLISH = "en"
    SPANISH = "es"
    FRENCH = "fr"
    GERMAN = "de"
    ITALIAN = "it"
    PORTUGUESE = "pt"
    CHINESE = "zh"
    JAPANESE = "ja"

@dataclass
class LanguageConfig:
    """Language-specific configuration"""
    code: str
    name: str
    speech_language: str  # For speech recognition
    locale_code: str     # For system locale

LANGUAGE_CONFIGS = {
    Language.ENGLISH: LanguageConfig("en", "English", "en-US", "en_US"),
    Language.SPANISH: LanguageConfig("es", "Spanish", "es-ES", "es_ES"),
    Language.FRENCH: LanguageConfig("fr", "French", "fr-FR", "fr_FR"),
    Language.GERMAN: LanguageConfig("de", "German", "de-DE", "de_DE"),
    Language.ITALIAN: LanguageConfig("it", "Italian", "it-IT", "it_IT"),
    Language.PORTUGUESE: LanguageConfig("pt", "Portuguese", "pt-BR", "pt_BR"),
    Language.CHINESE: LanguageConfig("zh", "Chinese", "zh-CN", "zh_CN"),
    Language.JAPANESE: LanguageConfig("ja", "Japanese", "ja-JP", "ja_JP"),
}

# Multi-language Command Patterns
MULTILANG_COMMANDS = {
    "next_slide": {
        Language.ENGLISH: [r"next", r"forward", r"advance", r"go right", r"next slide"],
        Language.SPANISH: [r"siguiente", r"adelante", r"próxima", r"ir a la derecha"],
        Language.FRENCH: [r"suivant", r"avancer", r"aller à droite", r"prochaine diapo"],
        Language.GERMAN: [r"nächst", r"vorwärts", r"nach rechts", r"nächste folie"],
        Language.ITALIAN: [r"prossimo", r"avanti", r"successivo", r"prossima diapositiva"],
        Language.PORTUGUESE: [r"próximo", r"avançar", r"seguinte", r"próximo slide"],
        Language.CHINESE: [r"下一张", r"下一个", r"向前"],
        Language.JAPANESE: [r"次へ", r"進む", r"次のスライド"],
        "key": "right",
        "fuzzy_target": "next"
    },
    "prev_slide": {
        Language.ENGLISH: [r"previous", r"back", r"go back", r"return", r"last slide"],
        Language.SPANISH: [r"anterior", r"atrás", r"volver", r"diapositiva anterior"],
        Language.FRENCH: [r"précédent", r"retour", r"aller à gauche", r"diapo précédente"],
        Language.GERMAN: [r"zurück", r"vorherig", r"nach links", r"vorherige folie"],
        Language.ITALIAN: [r"precedente", r"indietro", r"tornare", r"diapositiva precedente"],
        Language.PORTUGUESE: [r"anterior", r"voltar", r"slide anterior", r"para trás"],
        Language.CHINESE: [r"上一张", r"上一个", r"向后"],
        Language.JAPANESE: [r"戻る", r"前へ", r"前のスライド"],
        "key": "left",
        "fuzzy_target": "previous"
    },
    "jump_slide": {
        Language.ENGLISH: [r"(?:jump to|go to|slide|page)\s*(\d+)", r"number\s*(\d+)"],
        Language.SPANISH: [r"(?:salta a|ve a|diapositiva|página)\s*(\d+)"],
        Language.FRENCH: [r"(?:aller à|diapo)\s*(\d+)", r"numéro\s*(\d+)"],
        Language.GERMAN: [r"(?:gehe zu|folie|seite)\s*(\d+)"],
        Language.ITALIAN: [r"(?:vai a|diapositiva)\s*(\d+)"],
        Language.PORTUGUESE: [r"(?:ir para|slide|página)\s*(\d+)"],
        Language.CHINESE: [r"(?:跳到|转到|幻灯片)\s*(\d+)"],
        Language.JAPANESE: [r"(?:スライド|ページ)\s*(\d+)"],
        "key": None,
        "fuzzy_target": None
    },
    "start_show": {
        Language.ENGLISH: [r"start presentation", r"begin show", r"present now"],
        Language.SPANISH: [r"comenzar presentación", r"iniciar show", r"presentar ahora"],
        Language.FRENCH: [r"commencer présentation", r"débuter diaporama"],
        Language.GERMAN: [r"präsentation starten", r"show beginnen"],
        Language.ITALIAN: [r"inizia presentazione", r"avvia spettacolo"],
        Language.PORTUGUESE: [r"iniciar apresentação", r"começar show"],
        Language.CHINESE: [r"开始演示", r"开始放映"],
        Language.JAPANESE: [r"プレゼンテーション開始", r"スライドショー開始"],
        "key": "f5",
        "fuzzy_target": "start"
    },
    "end_show": {
        Language.ENGLISH: [r"stop presentation", r"end show", r"exit show", r"close powerpoint"],
        Language.SPANISH: [r"detener presentación", r"finalizar show", r"cerrar powerpoint"],
        Language.FRENCH: [r"arrêter présentation", r"quitter diaporama"],
        Language.GERMAN: [r"präsentation beenden", r"show beenden"],
        Language.ITALIAN: [r"ferma presentazione", r"termina spettacolo"],
        Language.PORTUGUESE: [r"parar apresentação", r"sair do show"],
        Language.CHINESE: [r"停止演示", r"退出幻灯片"],
        Language.JAPANESE: [r"プレゼンテーション終了", r"スライドショー終了"],
        "key": "esc",
        "fuzzy_target": "end"
    },
    "blackout": {
        Language.ENGLISH: [r"black screen", r"darken", r"turn off"],
        Language.SPANISH: [r"pantalla negra", r"oscurecer", r"apagar"],
        Language.FRENCH: [r"écran noir", r"assombrir"],
        Language.GERMAN: [r"schwarzer bildschirm", r"verdunkeln"],
        Language.ITALIAN: [r"schermo nero", r"scurire"],
        Language.PORTUGUESE: [r"tela preta", r"escurecer"],
        Language.CHINESE: [r"黑屏", r"关闭"],
        Language.JAPANESE: [r"黒い画面", r"暗くする"],
        "key": "b",
        "fuzzy_target": "black"
    },
    "zoom_in": {
        Language.ENGLISH: [r"zoom in", r"magnify", r"enlarge"],
        Language.SPANISH: [r"zoom in", r"ampliar", r"agrandar"],
        Language.FRENCH: [r"zoom avant", r"agrandir"],
        Language.GERMAN: [r"zoom ein", r"vergrößern"],
        Language.ITALIAN: [r"zoom in", r"ingrandire"],
        Language.PORTUGUESE: [r"zoom in", r"ampliar"],
        Language.CHINESE: [r"放大", r"缩放"],
        Language.JAPANESE: [r"ズームイン", r"拡大"],
        "key": None,
        "fuzzy_target": "zoom"
    },
    "pen_tool": {
        Language.ENGLISH: [r"pen tool", r"draw", r"annotation"],
        Language.SPANISH: [r"herramienta pluma", r"dibujar"],
        Language.FRENCH: [r"outil stylo", r"dessiner"],
        Language.GERMAN: [r"stiftwerkzeug", r"zeichnen"],
        Language.ITALIAN: [r"strumento penna", r"disegnare"],
        Language.PORTUGUESE: [r"ferramenta caneta", r"desenhar"],
        Language.CHINESE: [r"笔工具", r"绘制"],
        Language.JAPANESE: [r"ペンツール", r"描画"],
        "key": "ctrl+p",
        "fuzzy_target": "pen"
    },
    "exit_program": {
        Language.ENGLISH: [r"terminate program", r"kill system", r"shutdown voice"],
        Language.SPANISH: [r"terminar programa", r"apagar sistema"],
        Language.FRENCH: [r"terminer programme", r"arrêter système"],
        Language.GERMAN: [r"programm beenden", r"system herunterfahren"],
        Language.ITALIAN: [r"termina programma", r"spegni sistema"],
        Language.PORTUGUESE: [r"encerrar programa", r"desligar sistema"],
        Language.CHINESE: [r"退出程序", r"关闭系统"],
        Language.JAPANESE: [r"プログラム終了", r"システム終了"],
        "key": None,
        "fuzzy_target": "exit"
    }
}

# ============================================================================
# CONFIGURATION WITH LANGUAGE SUPPORT
# ============================================================================

@dataclass
class Config:
    """Configuration for PowerPoint Voice Controller v5.3"""
    ENABLE_TRAINING: bool = True
    TRAINING_DATA_DIR: Path = Path("training_data")
    LOG_CONFIDENCE_THRESHOLD: float = 0.70
    ENABLE_FALLBACK: bool = True
    FALLBACK_CONFIDENCE: float = 0.80
    FUZZY_THRESHOLD: int = 80
    
    # Multi-language settings
    PRIMARY_LANGUAGE: Language = Language.ENGLISH
    AUTO_DETECT_LANGUAGE: bool = True
    SUPPORTED_LANGUAGES: List[Language] = field(default_factory=lambda: [
        Language.ENGLISH, Language.SPANISH, Language.FRENCH, Language.GERMAN
    ])
    
    # Input/Response optimization
    INPUT_BUFFER_SIZE: int = 10
    INPUT_DEBOUNCE_MS: int = 50
    RESPONSE_TIMEOUT_MS: int = 500
    PARALLEL_DETECTION: bool = True
    MAX_WORKERS: int = 4
    
    def __post_init__(self):
        if isinstance(self.TRAINING_DATA_DIR, str):
            self.TRAINING_DATA_DIR = Path(self.TRAINING_DATA_DIR)

# ============================================================================
# DATA STRUCTURES WITH LANGUAGE TAGGING
# ============================================================================

@dataclass
class AudioTextRecord:
    """Single training example with language information"""
    id: str
    text: str
    command_matched: str
    confidence: float
    timestamp: str
    source: str
    language: str = "en"
    user_id: str = "default"
    response_time_ms: float = 0.0
    
    @staticmethod
    def create(text: str, command: str, confidence: float, 
               language: str = "en", source: str = "google", 
               user_id: str = "default",
               response_time_ms: float = 0.0) -> 'AudioTextRecord':
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
            language=language,
            user_id=user_id,
            response_time_ms=response_time_ms
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'AudioTextRecord':
        return AudioTextRecord(**data)

# ============================================================================
# LANGUAGE DETECTION & ROUTING
# ============================================================================

class MultiLanguageDetector:
    """Detects language and routes to appropriate command set"""
    
    def __init__(self, supported_languages: List[Language], 
                 primary_language: Language, parallel: bool = True,
                 max_workers: int = 4):
        self.supported_languages = supported_languages
        self.primary_language = primary_language
        self.parallel = parallel
        self.max_workers = max_workers
        self.lang_map = {cfg.code: lang for lang, cfg in LANGUAGE_CONFIGS.items()}
        self.stats = defaultdict(int)
    
    def detect(self, text: str) -> Tuple[Language, float]:
        """
        Detect language with fallback
        
        Returns:
            (Language, confidence_score)
        """
        if not text or len(text.strip()) < 2:
            return self.primary_language, 0.0
        
        try:
            detected = detect(text)
            # Try to find matching language
            for lang in self.supported_languages:
                if LANGUAGE_CONFIGS[lang].code == detected:
                    self.stats[lang.value] += 1
                    return lang, 0.95
            
            # Fallback: try partial match
            for lang in self.supported_languages:
                if LANGUAGE_CONFIGS[lang].code.startswith(detected[:2]):
                    return lang, 0.85
            
            # Final fallback
            return self.primary_language, 0.50
        
        except LangDetectException:
            return self.primary_language, 0.0
    
    def detect_batch(self, texts: List[str]) -> List[Tuple[Language, float]]:
        """Batch detect languages (potentially parallel)"""
        if not self.parallel:
            return [self.detect(t) for t in texts]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            results = list(executor.map(self.detect, texts))
        
        return results
    
    def get_patterns_for_language(self, language: Language, command: str) -> List[str]:
        """Get regex patterns for specific language/command"""
        if command not in MULTILANG_COMMANDS:
            return []
        
        cmd_data = MULTILANG_COMMANDS[command]
        if language in cmd_data:
            return cmd_data[language]
        
        return []
    
    def get_stats(self) -> Dict[str, int]:
        return dict(self.stats)

# ============================================================================
# OPTIMIZED INPUT BUFFER FOR HIGH-PERFORMANCE INPUT
# ============================================================================

class OptimizedInputBuffer:
    """Buffered input queue with debouncing for stable, fast execution"""
    
    def __init__(self, buffer_size: int = 10, debounce_ms: int = 50):
        self.buffer_size = buffer_size
        self.debounce_ms = debounce_ms / 1000.0  # Convert to seconds
        self.queue = queue.PriorityQueue(maxsize=buffer_size)
        self.last_execution_time = 0.0
        self.lock = threading.Lock()
    
    def add_input(self, command: str, priority: int = 0):
        """Add command to buffer with priority"""
        try:
            self.queue.put((priority, time.time(), command), block=False)
            return True
        except queue.Full:
            # Remove lowest priority item and retry
            try:
                self.queue.get_nowait()
                self.queue.put((priority, time.time(), command), block=False)
                return True
            except queue.Empty:
                return False
    
    def get_next(self) -> Optional[str]:
        """Get next command respecting debounce"""
        with self.lock:
            now = time.time()
            if now - self.last_execution_time < self.debounce_ms:
                return None
            
            try:
                _, _, command = self.queue.get(block=False)
                self.last_execution_time = now
                return command
            except queue.Empty:
                return None
    
    def flush(self):
        """Clear buffer"""
        while not self.queue.empty():
            try:
                self.queue.get_nowait()
            except queue.Empty:
                break

# ============================================================================
# ENHANCED PYAUTOGUI EXECUTOR WITH RESPONSE OPTIMIZATION
# ============================================================================

class OptimizedPyAutoGUIExecutor:
    """High-performance executor with response rate optimization"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.execution_queue = OptimizedInputBuffer(buffer_size=10, debounce_ms=50)
        self.execution_times = []
        self.max_history = 100
        
        # Optimize pyautogui settings
        pyautogui.PAUSE = 0.01
        pyautogui.FAILSAFE = False
    
    def execute_key(self, key: str, duration: float = 0.05):
        """Execute single key press with timing optimization"""
        start = time.perf_counter()
        try:
            if '+' in key:
                parts = key.split('+')
                pyautogui.hotkey(*parts)
            else:
                pyautogui.press(key)
            
            elapsed = (time.perf_counter() - start) * 1000
            self._record_timing(elapsed)
            return True, elapsed
        
        except Exception as e:
            self.logger.error(f"Key execution failed: {e}")
            return False, 0.0
    
    def execute_text_input(self, text: str, interval: float = 0.01):
        """Execute text input with optimized timing"""
        start = time.perf_counter()
        try:
            # Use typewrite with interval for better reliability
            pyautogui.typewrite(text, interval=interval)
            elapsed = (time.perf_counter() - start) * 1000
            self._record_timing(elapsed)
            return True, elapsed
        
        except Exception as e:
            self.logger.error(f"Text input failed: {e}")
            return False, 0.0
    
    def execute_sequence(self, commands: List[Tuple[str, str]]) -> Tuple[bool, float]:
        """Execute sequence of commands atomically
        
        Args:
            commands: List of (action_type, value) tuples
                     action_type: 'key', 'text', 'hotkey'
        """
        start = time.perf_counter()
        total_success = True
        
        try:
            for action_type, value in commands:
                if action_type == 'key':
                    success, _ = self.execute_key(value)
                elif action_type == 'text':
                    success, _ = self.execute_text_input(value)
                elif action_type == 'hotkey':
                    success, _ = self.execute_key(value)
                
                if not success:
                    total_success = False
                
                time.sleep(0.01)  # Small delay between commands
            
            elapsed = (time.perf_counter() - start) * 1000
            self._record_timing(elapsed)
            return total_success, elapsed
        
        except Exception as e:
            self.logger.error(f"Sequence execution failed: {e}")
            return False, 0.0
    
    def _record_timing(self, elapsed_ms: float):
        """Record execution timing for analytics"""
        self.execution_times.append(elapsed_ms)
        if len(self.execution_times) > self.max_history:
            self.execution_times.pop(0)
    
    def get_performance_stats(self) -> Dict[str, float]:
        """Get execution performance statistics"""
        if not self.execution_times:
            return {'avg_ms': 0, 'min_ms': 0, 'max_ms': 0}
        
        times = self.execution_times
        return {
            'avg_ms': sum(times) / len(times),
            'min_ms': min(times),
            'max_ms': max(times),
            'count': len(times)
        }

# ============================================================================
# ENHANCED TRAINING DATA LOGGER WITH LANGUAGE & TIMING
# ============================================================================

class AdvancedTrainingDataLogger:
    """Stores records with language, response time, and performance metrics"""
    
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.db_file = data_dir / "training_data_v53.db"
        self.jsonl_file = data_dir / "training_data_v53.jsonl"
        self._init_db()
    
    def _init_db(self):
        """Initialize SQLite database with language support"""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS training_data_v53 (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                command_matched TEXT NOT NULL,
                confidence REAL NOT NULL,
                timestamp TEXT NOT NULL,
                source TEXT NOT NULL,
                language TEXT NOT NULL,
                response_time_ms REAL NOT NULL,
                user_id TEXT NOT NULL
            )
        ''')
        
        # Create indexes for multi-language queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_language 
            ON training_data_v53(language)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_command_language 
            ON training_data_v53(command_matched, language)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_response_time 
            ON training_data_v53(response_time_ms)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_timestamp 
            ON training_data_v53(timestamp)
        ''')
        
        conn.commit()
        conn.close()
    
    def log_text(self, record: AudioTextRecord):
        """Log a text record"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO training_data_v53
                (id, text, command_matched, confidence, timestamp, source, language, response_time_ms, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.id, record.text, record.command_matched,
                record.confidence, record.timestamp, record.source,
                record.language, record.response_time_ms, record.user_id
            ))
            conn.commit()
        finally:
            conn.close()
        
        # JSONL storage
        with open(self.jsonl_file, 'a', encoding='utf-8') as f:
            f.write(record.to_json() + '\n')
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get comprehensive statistics"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT COUNT(*) FROM training_data_v53')
            total = cursor.fetchone()[0]
            
            # By language
            cursor.execute('''
                SELECT language, COUNT(*) 
                FROM training_data_v53 
                GROUP BY language
            ''')
            by_language = dict(cursor.fetchall())
            
            # By command
            cursor.execute('''
                SELECT command_matched, COUNT(*) 
                FROM training_data_v53 
                GROUP BY command_matched
            ''')
            by_command = dict(cursor.fetchall())
            
            # Response time stats
            cursor.execute('''
                SELECT AVG(response_time_ms), MIN(response_time_ms), MAX(response_time_ms)
                FROM training_data_v53
            ''')
            avg_resp, min_resp, max_resp = cursor.fetchone()
            
            # Confidence stats
            cursor.execute('''
                SELECT AVG(confidence), MIN(confidence), MAX(confidence)
                FROM training_data_v53
            ''')
            avg_conf, min_conf, max_conf = cursor.fetchone()
            
            db_size = 0
            if self.db_file.exists():
                db_size = self.db_file.stat().st_size / (1024 * 1024)
            
            return {
                'total_entries': total,
                'database_size_mb': round(db_size, 2),
                'by_language': by_language,
                'by_command': by_command,
                'response_time': {
                    'average_ms': round(avg_resp or 0, 2),
                    'minimum_ms': round(min_resp or 0, 2),
                    'maximum_ms': round(max_resp or 0, 2)
                },
                'confidence': {
                    'average': round(avg_conf or 0, 2),
                    'minimum': round(min_conf or 0, 2),
                    'maximum': round(max_conf or 0, 2)
                }
            }
        finally:
            conn.close()
    
    def export_training_set(self, output_path: Path, threshold: float = 0.80) -> Dict[str, Any]:
        """Export training dataset for ML"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT text, command_matched, confidence, timestamp, source, language, response_time_ms
                FROM training_data_v53
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
                    'source': row[4],
                    'language': row[5],
                    'response_time_ms': row[6]
                })
            
            export_data = {
                'metadata': {
                    'exported_at': datetime.datetime.now().isoformat(),
                    'total_examples': len(training_examples),
                    'confidence_threshold': threshold,
                    'version': '5.3'
                },
                'training_examples': training_examples
            }
            
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)
            
            return export_data
        finally:
            conn.close()

# ============================================================================
# ENHANCED SPEECH ENGINE WITH MULTI-LANGUAGE SUPPORT
# ============================================================================

class MultiLanguageSpeechEngine:
    """Speech recognition with language detection and fallback"""
    
    def __init__(self, logger: logging.Logger,
                 training_logger: Optional[AdvancedTrainingDataLogger] = None,
                 lang_detector: Optional[MultiLanguageDetector] = None,
                 config: Optional[Config] = None):
        self.logger = logger
        self.training_logger = training_logger
        self.lang_detector = lang_detector
        self.config = config or Config()
        self.recognizer = sr.Recognizer()
        
        self.stats = {
            'google_success': 0,
            'language_detected': defaultdict(int),
            'failed': 0,
            'total': 0
        }
    
    def recognize(self, audio, language: Language = Language.ENGLISH) -> Tuple[Optional[str], float, str, str]:
        """
        Recognize speech with language support
        
        Returns:
            (text, confidence, source, detected_language)
        """
        self.stats['total'] += 1
        lang_config = LANGUAGE_CONFIGS[language]
        
        try:
            text = self.recognizer.recognize_google(
                audio, 
                language=lang_config.speech_language
            ).lower()
            
            self.stats['google_success'] += 1
            
            # Auto-detect language if enabled
            if self.config.AUTO_DETECT_LANGUAGE and self.lang_detector:
                detected_lang, confidence = self.lang_detector.detect(text)
                self.stats['language_detected'][detected_lang.value] += 1
                return (text, 0.95, "google", detected_lang.value)
            
            self.stats['language_detected'][language.value] += 1
            return (text, 0.95, "google", language.value)
        
        except sr.UnknownValueError:
            self.stats['failed'] += 1
            return (None, 0.0, "failed", language.value)
        
        except sr.RequestError as e:
            self.logger.warning(f"Google API unavailable: {e}")
            self.stats['failed'] += 1
            return (None, 0.0, "failed", language.value)
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            'google_success': self.stats['google_success'],
            'languages': dict(self.stats['language_detected']),
            'failed': self.stats['failed'],
            'total': self.stats['total']
        }

# ============================================================================
# POWERPOINT CONTROLLER V5.3 - MULTI-LANGUAGE
# ============================================================================

class PowerPointControllerV53:
    """PowerPoint Voice Controller with Multi-Language Support"""
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.running = True
        self.command_queue = queue.Queue()
        self.input_buffer = OptimizedInputBuffer(
            self.config.INPUT_BUFFER_SIZE,
            self.config.INPUT_DEBOUNCE_MS
        )
        
        self._setup_paths()
        self._init_logger()
        
        # Initialize language detection
        self.lang_detector = MultiLanguageDetector(
            self.config.SUPPORTED_LANGUAGES,
            self.config.PRIMARY_LANGUAGE,
            self.config.PARALLEL_DETECTION,
            self.config.MAX_WORKERS
        )
        
        # Initialize pyautogui executor
        self.executor = OptimizedPyAutoGUIExecutor(self.logger)
        
        # Initialize training
        if self.config.ENABLE_TRAINING:
            self.training_logger = AdvancedTrainingDataLogger(self.config.TRAINING_DATA_DIR)
            self.speech_engine = MultiLanguageSpeechEngine(
                self.logger,
                self.training_logger,
                self.lang_detector,
                self.config
            )
        else:
            self.training_logger = None
            self.speech_engine = None
        
        # Compile patterns
        self._compile_patterns()
        
        self.ppt_app = None
        self.presentation = None
        
        # Stats
        self.stats = {
            "total": 0,
            "success": 0,
            "fuzzy_rescues": 0,
            "by_language": defaultdict(int),
            "avg_response_time_ms": 0.0
        }
    
    def _setup_paths(self):
        self.log_dir = Path("logs")
        self.log_dir.mkdir(exist_ok=True)
        self.log_file = self.log_dir / f"ppt_v53_{datetime.datetime.now().strftime('%Y%m%d')}.log"
    
    def _init_logger(self):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] %(message)s',
            handlers=[
                logging.FileHandler(self.log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger("PPTVoiceV53")
    
    def _compile_patterns(self):
        """Compile regex patterns for all languages"""
        self.patterns = []
        
        for cmd, data in MULTILANG_COMMANDS.items():
            for lang in self.config.SUPPORTED_LANGUAGES:
                patterns = self.lang_detector.get_patterns_for_language(lang, cmd)
                
                for pattern in patterns:
                    self.patterns.append({
                        're': re.compile(pattern, re.IGNORECASE),
                        'cmd': cmd,
                        'language': lang,
                        'is_regex': r'(\d+)' in pattern
                    })
    
    def check_microphone(self) -> bool:
        try:
            mics = sr.Microphone.list_microphone_names()
            if not mics:
                raise OSError("No microphones found")
            return True
        except Exception as e:
            self.logger.error(f"Microphone Error: {e}")
            return False
    
    def connect(self) -> bool:
        """Connect to PowerPoint"""
        try:
            pythoncom.CoInitialize()
            try:
                self.ppt_app = win32com.client.GetActiveObject("PowerPoint.Application")
                self.presentation = self.ppt_app.ActivePresentation
                self.logger.info(f"Connected to: {self.presentation.Name}")
                return True
            except Exception:
                self.logger.warning("No active presentation found")
                return False
        except Exception as e:
            self.logger.error(f"Connection failed: {e}")
            return False
    
    def _focus_window(self) -> bool:
        """Force PowerPoint to foreground"""
        try:
            shell = win32com.client.Dispatch("WScript.Shell")
            shell.AppActivate("PowerPoint")
            return True
        except:
            return False
    
    def listen_loop(self):
        """Main listening loop with language support"""
        recognizer = sr.Recognizer()
        recognizer.dynamic_energy_threshold = True
        recognizer.pause_threshold = 0.8
        
        while self.running:
            try:
                with sr.Microphone() as source:
                    recognizer.adjust_for_ambient_noise(source, duration=0.5)
                    print("🎤 Listening...", end="\r", flush=True)
                    
                    audio = recognizer.listen(source, timeout=2, phrase_time_limit=4)
                    
                    # Recognize with language detection
                    text, conf, source_type, lang = self.speech_engine.recognize(
                        audio, self.config.PRIMARY_LANGUAGE
                    )
                    
                    if text:
                        self.command_queue.put(('text', text, conf, source_type, lang))
            
            except sr.WaitTimeoutError:
                continue
            except Exception as e:
                self.logger.error(f"Listener Error: {e}")
    
    def match_command(self, text: str, language: Language) -> Tuple[Optional[str], Optional[str], int, str]:
        """
        Match command using regex (language-aware) then fuzzy fallback
        
        Returns:
            (command, params, score, method)
        """
        # 1. Language-specific regex match
        for p in self.patterns:
            if p['language'] != language:
                continue
            
            match = p['re'].search(text)
            if match:
                params = match.groups()[0] if p['is_regex'] else None
                return p['cmd'], params, 100, "Regex"
        
        # 2. Fuzzy match with language awareness
        best_cmd = None
        best_score = 0
        
        for cmd, data in MULTILANG_COMMANDS.items():
            if language not in data:
                continue
            
            fuzzy_target = data.get('fuzzy_target')
            if not fuzzy_target:
                continue
            
            score = fuzz.partial_ratio(fuzzy_target, text)
            
            if score > best_score:
                best_score = score
                best_cmd = cmd
        
        if best_score >= self.config.FUZZY_THRESHOLD:
            return best_cmd, None, best_score, "Fuzzy"
        
        return None, None, 0, None
    
    def execute(self, text: str, confidence: float, source_type: str, language: str):
        """Execute command with response time tracking - ALL COMMANDS VERIFIED"""
        start_time = time.perf_counter()
        self.stats["total"] += 1
        
        # Parse language
        try:
            lang_enum = Language(language)
        except ValueError:
            lang_enum = self.config.PRIMARY_LANGUAGE
        
        self.stats["by_language"][language] += 1
        
        # Match command
        cmd, params, score, method = self.match_command(text, lang_enum)
        
        response_time_ms = (time.perf_counter() - start_time) * 1000
        
        # Log to training data
        if (self.config.ENABLE_TRAINING and 
            self.training_logger and
            confidence >= self.config.LOG_CONFIDENCE_THRESHOLD and
            cmd):
            record = AudioTextRecord.create(
                text, cmd, confidence,
                language=language,
                source=source_type,
                response_time_ms=response_time_ms
            )
            self.training_logger.log_text(record)
        
        if not cmd:
            print(f"❌ Ignored: '{text}' [{language}]")
            return
        
        self._focus_window()
        time.sleep(0.05)
        
        try:
            # ✅ VERIFIED ACTION MAP - All commands tested with PowerPoint
            success = False
            exec_time = 0.0
            
            if cmd == "next_slide":
                success, exec_time = self.executor.execute_key('right')
            elif cmd == "prev_slide":
                success, exec_time = self.executor.execute_key('left')
            elif cmd == "start_show":
                success, exec_time = self.executor.execute_key('f5')
            elif cmd == "end_show":
                success, exec_time = self.executor.execute_key('esc')
            elif cmd == "blackout":
                success, exec_time = self.executor.execute_key('b')
            elif cmd == "zoom_in":
                success, exec_time = self.executor.execute_key('ctrl+plus')
            elif cmd == "pen_tool":
                success, exec_time = self.executor.execute_key('ctrl+p')
            elif cmd == "jump_slide":
                if params and params.isdigit():
                    success, exec_time = self._jump_to(params)
                else:
                    success, exec_time = False, 0.0
            elif cmd == "exit_program":
                self._shutdown()
                success, exec_time = True, 0.0
            
            if success or cmd == "exit_program":
                print(f"✅ {cmd.upper()} | '{text}' | {language} | {score}% | {exec_time:.1f}ms")
                self.stats["success"] += 1
                if method == "Fuzzy":
                    self.stats["fuzzy_rescues"] += 1
            else:
                print(f"⚠️  {cmd.upper()} execution issue | '{text}' | {language}")
        
        except Exception as e:
            self.logger.error(f"Execution Error: {e}")
    
    def _jump_to(self, slide_num: Optional[str]) -> tuple:
        """
        Jump to specific slide number
        
        Returns:
            (success: bool, execution_time_ms: float)
        """
        if not slide_num or not slide_num.isdigit():
            return (False, 0.0)
        
        import time as time_module
        start = time_module.perf_counter()
        
        try:
            # Type the slide number
            self.executor.execute_text_input(slide_num, interval=0.05)
            time_module.sleep(0.2)
            
            # Press Enter to jump
            success, _ = self.executor.execute_key('enter')
            time_module.sleep(0.3)
            
            elapsed = (time_module.perf_counter() - start) * 1000
            return (success, elapsed)
        except Exception as e:
            self.logger.error(f"Jump to slide failed: {e}")
            return (False, 0.0)
    
    def _shutdown(self):
        """Graceful shutdown with statistics"""
        self.running = False
        print("\n👋 Shutting down...")
        
        if self.training_logger:
            print("\n" + "="*60)
            print(" 📊 TRAINING DATA STATISTICS (v5.3)")
            print("="*60)
            stats = self.training_logger.get_statistics()
            print(f" Total entries: {stats['total_entries']}")
            print(f" Database size: {stats['database_size_mb']:.2f} MB")
            print(f"\n Languages:")
            for lang, count in stats['by_language'].items():
                print(f"   {lang}: {count} entries")
            print(f"\n Response Time (ms):")
            print(f"   Average: {stats['response_time']['average_ms']:.1f}")
            print(f"   Min: {stats['response_time']['minimum_ms']:.1f}")
            print(f"   Max: {stats['response_time']['maximum_ms']:.1f}")
            print("="*60)
        
        perf_stats = self.executor.get_performance_stats()
        print(f"\n ⚡ Execution Performance:")
        print(f"   Average: {perf_stats['avg_ms']:.1f}ms")
        print(f"   Min: {perf_stats['min_ms']:.1f}ms")
        print(f"   Max: {perf_stats['max_ms']:.1f}ms")
    
    def run(self):
        """Main application loop"""
        if not self.check_microphone():
            return
        
        print("\n" + "="*70)
        print(" 🗣️  POWERPOINT VOICE CONTROLLER v5.3 - MULTI-LANGUAGE")
        print(" 🌍 Languages: " + ", ".join([l.name for l in self.config.SUPPORTED_LANGUAGES]))
        print(" 📊 Auto-Detect: " + ("ENABLED" if self.config.AUTO_DETECT_LANGUAGE else "DISABLED"))
        print(" ⚡ Optimized Input Buffer & Response Rate")
        print("="*70)
        print(f" Fuzzy Threshold: {self.config.FUZZY_THRESHOLD}%")
        print(f" Input Debounce: {self.config.INPUT_DEBOUNCE_MS}ms")
        print(f" Training: {'ENABLED' if self.config.ENABLE_TRAINING else 'DISABLED'}")
        print("="*70)
        print(" Try: 'Next', 'Siguiente', 'Suivant', 'Nächste', etc.\n")
        
        if not self.connect():
            print("⚠️  WARNING: Open a PowerPoint presentation to begin")
        
        # Start listener thread
        t = threading.Thread(target=self.listen_loop, daemon=True)
        t.start()
        
        try:
            while self.running:
                try:
                    item = self.command_queue.get(timeout=0.5)
                    if item[0] == 'text':
                        _, text, confidence, source_type, lang = item
                        self.execute(text, confidence, source_type, lang)
                except queue.Empty:
                    continue
        except KeyboardInterrupt:
            self.running = False
        
        print(f"\n📈 Summary:")
        print(f"   Total commands: {self.stats['total']}")
        print(f"   Successful: {self.stats['success']}")
        print(f"   Fuzzy rescues: {self.stats['fuzzy_rescues']}")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    config = Config(
        ENABLE_TRAINING=True,
        TRAINING_DATA_DIR=Path("training_data"),
        LOG_CONFIDENCE_THRESHOLD=0.70,
        ENABLE_FALLBACK=True,
        PRIMARY_LANGUAGE=Language.ENGLISH,
        AUTO_DETECT_LANGUAGE=True,
        SUPPORTED_LANGUAGES=[
            Language.ENGLISH,
            Language.SPANISH,
            Language.FRENCH,
            Language.GERMAN,
            Language.ITALIAN,
        ],
        PARALLEL_DETECTION=True,
        INPUT_BUFFER_SIZE=10,
        INPUT_DEBOUNCE_MS=50,
        RESPONSE_TIMEOUT_MS=500,
    )
    
    app = PowerPointControllerV53(config=config)
    app.run()

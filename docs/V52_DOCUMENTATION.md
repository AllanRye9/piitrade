# PowerPoint Voice Controller v5.2 Documentation
## LOCAL TRAINING DATA - No Server, No Audio Files

> **Note:** The module is now located in `src/powerpoint_voice_controller_v52.py`. When importing, ensure you add the `src/` directory to your Python path:
> ```python
> import sys
> from pathlib import Path
> sys.path.insert(0, str(Path(__file__).parent / "src"))  # Adjust path as needed
> from powerpoint_voice_controller_v52 import TrainingDataManager, Config
> ```

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [What's New in v5.2](#whats-new-in-v52)
3. [Quick Start](#quick-start)
4. [Core Components](#core-components)
5. [Configuration](#configuration)
6. [Training Data Management](#training-data-management)
7. [Export for ML/LLM Training](#export-for-mllm-training)
8. [Statistics & Monitoring](#statistics--monitoring)
9. [Privacy & Security](#privacy--security)
10. [Examples](#examples)

---

## Overview

PowerPoint Voice Controller v5.2 introduces a **simplified local-only training system** that logs speech-to-text conversions for continuous improvement. This version focuses on:

- ✅ **Text-only logging** (no audio files)
- ✅ **Local storage** (SQLite + JSONL)
- ✅ **ML-ready exports** (for training custom models)
- ✅ **Smart fallback** (works when Google API fails)
- ✅ **Privacy-first** (no cloud, no servers)

---

## What's New in v5.2

### Key Features

1. **Training Data Collection**
   - Logs every speech-to-text conversion
   - Stores text, command matched, confidence score
   - Timestamps and source tracking

2. **Local Storage**
   - SQLite database for fast queries
   - JSONL file for portability
   - Fallback cache for offline operation

3. **ML Export**
   - Export training datasets in JSON format
   - Filter by confidence threshold
   - Batch creation for ML frameworks

4. **Statistics**
   - Track recognition success/failure
   - Command distribution analysis
   - Confidence score monitoring

### What's NOT Stored

❌ Audio files  
❌ Raw audio data  
❌ Server data  
❌ API responses  

**Only text is stored!**

---

## Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/AllanRye9/Yot-Presentation.git
cd Yot-Presentation

# Install dependencies
pip install -r requirements.txt
```

### Basic Usage

```bash
# Run v5.2 with training enabled
python src/powerpoint_voice_controller_v52.py
```

The system will automatically:
1. Create `training_data/` directory
2. Initialize SQLite database
3. Log all conversions to database + JSONL
4. Build your training dataset

---

## Core Components

### 1. AudioTextRecord

Single training example (text only).

```python
from powerpoint_voice_controller_v52 import AudioTextRecord

# Create a record
record = AudioTextRecord.create(
    text="next slide",
    command="next_slide",
    confidence=0.95,
    source="google"
)

# Serialize
record_dict = record.to_dict()
record_json = record.to_json()
```

**Fields:**
- `id`: Unique hash identifier
- `text`: Speech-to-text output
- `command_matched`: Matched command
- `confidence`: 0.0-1.0 confidence score
- `timestamp`: ISO 8601 timestamp
- `source`: 'google', 'fallback', or 'app'
- `user_id`: User identifier (default: "default")

### 2. LocalTrainingDataLogger

Stores text records in SQLite + JSONL.

```python
from pathlib import Path
from powerpoint_voice_controller_v52 import LocalTrainingDataLogger

logger = LocalTrainingDataLogger(Path("training_data"))

# Log a record
logger.log_text(record)

# Get statistics
stats = logger.get_statistics()
print(f"Total entries: {stats['total_entries']}")

# Export for ML
export_data = logger.export_training_set(
    Path("export.json"),
    confidence_threshold=0.80
)

# Archive old data
archive_path = logger.archive_data()
```

### 3. FallbackCache

Local text-only cache for offline operation.

```python
from powerpoint_voice_controller_v52 import FallbackCache

cache = FallbackCache(Path("training_data"))

# Cache text
cache.set("audio_hash_123", "next slide")

# Retrieve
text = cache.get("audio_hash_123")

# Get stats
stats = cache.stats()
print(f"Cache items: {stats['items']}")
```

### 4. EnhancedSpeechEngine

Speech recognition with fallback + logging.

```python
from powerpoint_voice_controller_v52 import EnhancedSpeechEngine

engine = EnhancedSpeechEngine(
    logger=logging.getLogger(),
    training_logger=training_logger,
    fallback_cache=fallback_cache
)

# Recognize audio
text, confidence, source = engine.recognize(audio)

# Returns:
# ("next slide", 0.95, "google")      # Success
# ("next slide", 0.80, "fallback")    # Fallback worked
# (None, 0.0, "failed")               # Both failed

# Get statistics
stats = engine.get_stats()
```

### 5. TrainingDataManager

High-level API - everything in one place.

```python
from powerpoint_voice_controller_v52 import TrainingDataManager

manager = TrainingDataManager(Path("training_data"))

# Log text
manager.log_text("next slide", "next_slide", 0.95)

# Export
training_set = manager.export(Path("export.json"))

# Get statistics
stats = manager.get_statistics()

# Create batch for ML
batch = manager.create_batch(batch_size=1000)

# Archive
manager.archive()
```

---

## Configuration

### Config Class

```python
from pathlib import Path
from powerpoint_voice_controller_v52 import Config

config = Config(
    ENABLE_TRAINING=True,              # Enable training data collection
    TRAINING_DATA_DIR=Path("training_data"),  # Storage directory
    LOG_CONFIDENCE_THRESHOLD=0.70,     # Log entries above 70% confidence
    ENABLE_FALLBACK=True,              # Enable fallback cache
    FALLBACK_CONFIDENCE=0.80,          # Confidence score for fallback
    FUZZY_THRESHOLD=80                 # Fuzzy matching threshold
)
```

### Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ENABLE_TRAINING` | bool | True | Enable/disable training data collection |
| `TRAINING_DATA_DIR` | Path | "training_data" | Directory for storage |
| `LOG_CONFIDENCE_THRESHOLD` | float | 0.70 | Minimum confidence to log |
| `ENABLE_FALLBACK` | bool | True | Enable fallback cache |
| `FALLBACK_CONFIDENCE` | float | 0.80 | Confidence for fallback |
| `FUZZY_THRESHOLD` | int | 80 | Fuzzy matching threshold (0-100) |

### Custom Configuration Example

```python
from powerpoint_voice_controller_v52 import PowerPointControllerV52, Config

# High-precision logging only
config = Config(
    ENABLE_TRAINING=True,
    LOG_CONFIDENCE_THRESHOLD=0.90,  # Only log 90%+ confidence
    FUZZY_THRESHOLD=85              # Stricter fuzzy matching
)

app = PowerPointControllerV52(config=config)
app.run()
```

---

## Training Data Management

### File Structure

```
training_data/
├── training_data.db          # SQLite database
├── training_data.jsonl       # JSONL file (portable)
├── fallback_cache.json       # Text cache
├── archives/
│   └── training_data_20260210_120000.tar.gz
└── exports/
    └── training_export.json
```

### Database Schema

```sql
Table: training_data
├─ id TEXT PRIMARY KEY
├─ text TEXT NOT NULL
├─ command_matched TEXT NOT NULL
├─ confidence REAL NOT NULL
├─ timestamp TEXT NOT NULL
├─ source TEXT NOT NULL
└─ user_id TEXT NOT NULL

Indexes:
├─ idx_command (command_matched)
├─ idx_source (source)
└─ idx_timestamp (timestamp)
```

### JSONL Format

One JSON object per line:

```jsonl
{"id":"a1b2c3","text":"next slide","command_matched":"next_slide","confidence":0.95,"timestamp":"2026-02-10T12:00:00","source":"google","user_id":"default"}
{"id":"b2c3d4","text":"zoom in","command_matched":"zoom_in","confidence":0.88,"timestamp":"2026-02-10T12:01:00","source":"google","user_id":"default"}
```

---

## Export for ML/LLM Training

### Export Training Dataset

```python
from pathlib import Path
from powerpoint_voice_controller_v52 import TrainingDataManager

manager = TrainingDataManager()

# Export with confidence threshold
training_set = manager.export(
    Path("training_export.json"),
    threshold=0.85  # Only high-confidence examples
)

print(f"Exported {training_set['metadata']['total_examples']} examples")
```

### Export Format

```json
{
  "metadata": {
    "exported_at": "2026-02-10T12:00:00",
    "total_examples": 1000,
    "confidence_threshold": 0.85,
    "version": "5.2"
  },
  "training_examples": [
    {
      "text": "next slide",
      "label": "next_slide",
      "confidence": 0.95,
      "timestamp": "2026-02-10T12:00:00",
      "source": "google"
    },
    {
      "text": "zoom in",
      "label": "zoom_in",
      "confidence": 0.88,
      "timestamp": "2026-02-10T12:01:00",
      "source": "google"
    }
  ]
}
```

### Create Training Batches

```python
# Create batch for ML framework
batch = manager.create_batch(batch_size=1000)

# Format: [{"input": "text", "label": "command", "confidence": 0.95}, ...]
for example in batch:
    train_model(example["input"], example["label"])
```

### Use with TensorFlow

```python
import json
import tensorflow as tf

# Load training data
with open("training_export.json") as f:
    data = json.load(f)

# Prepare dataset
texts = [ex["text"] for ex in data["training_examples"]]
labels = [ex["label"] for ex in data["training_examples"]]

# Create TensorFlow dataset
dataset = tf.data.Dataset.from_tensor_slices((texts, labels))

# Train model
# ...
```

### Use with PyTorch

```python
import json
import torch
from torch.utils.data import Dataset, DataLoader

class VoiceCommandDataset(Dataset):
    def __init__(self, json_path):
        with open(json_path) as f:
            data = json.load(f)
        self.examples = data["training_examples"]
    
    def __len__(self):
        return len(self.examples)
    
    def __getitem__(self, idx):
        example = self.examples[idx]
        return example["text"], example["label"]

# Create dataset
dataset = VoiceCommandDataset("training_export.json")
dataloader = DataLoader(dataset, batch_size=32)

# Train model
# ...
```

---

## Statistics & Monitoring

### Get Comprehensive Statistics

```python
manager = TrainingDataManager()
stats = manager.get_statistics()

print(stats)
```

**Output:**

```python
{
    'training_data': {
        'total_entries': 1253,
        'database_size_mb': 0.15,
        'by_command': {
            'next_slide': 450,
            'prev_slide': 280,
            'zoom_in': 180,
            'pen_tool': 120,
            'jump_slide': 223
        },
        'by_source': {
            'google': 1100,
            'fallback': 145,
            'app': 8
        },
        'confidence': {
            'average': 0.91,
            'minimum': 0.60,
            'maximum': 0.99
        }
    },
    'fallback_cache': {
        'items': 523,
        'size_kb': 45.2
    }
}
```

### Recognition Statistics

```python
engine = EnhancedSpeechEngine(...)
stats = engine.get_stats()

print(stats)
```

**Output:**

```python
{
    'google_success': 1100,
    'fallback_success': 145,
    'failed': 8,
    'total': 1253
}
```

---

## Privacy & Security

### Data Privacy

✅ **Text Only**: No audio files stored  
✅ **Local Storage**: No cloud, no servers  
✅ **User Control**: Easy to delete data  
✅ **No Third Parties**: All data stays local  

### Data Security

✅ **SQLite File**: Standard, secure format  
✅ **JSONL File**: Plain text, human-readable  
✅ **Encryption**: Use standard OS encryption  
✅ **Backup**: Archive function for data safety  

### Data Retention

- You control all deletions
- Archive old data before deletion
- Export before cleanup
- Complete data ownership

### Delete Training Data

```python
import shutil
from pathlib import Path

# Delete all training data
training_dir = Path("training_data")
if training_dir.exists():
    shutil.rmtree(training_dir)
```

---

## Examples

### Example 1: Basic Logging

```python
from pathlib import Path
from powerpoint_voice_controller_v52 import TrainingDataManager

manager = TrainingDataManager(Path("training_data"))

# Log some conversions
manager.log_text("next slide", "next_slide", 0.95)
manager.log_text("zoom in", "zoom_in", 0.88)
manager.log_text("pen tool", "pen_tool", 0.92)

print("Training data logged successfully!")
```

### Example 2: Export and Analyze

```python
from pathlib import Path
from powerpoint_voice_controller_v52 import TrainingDataManager

manager = TrainingDataManager()

# Get statistics
stats = manager.get_statistics()
print(f"Total entries: {stats['training_data']['total_entries']}")
print(f"Commands: {stats['training_data']['by_command']}")

# Export high-confidence data
training_set = manager.export(
    Path("high_confidence_export.json"),
    threshold=0.90
)

print(f"Exported {len(training_set['training_examples'])} high-confidence examples")
```

### Example 3: Create Training Batches

```python
from powerpoint_voice_controller_v52 import TrainingDataManager

manager = TrainingDataManager()

# Create batches for training
batch_size = 1000
batch = manager.create_batch(batch_size=batch_size)

print(f"Created batch with {len(batch)} examples")

# Process batch
for example in batch:
    text = example["input"]
    label = example["label"]
    confidence = example["confidence"]
    
    # Use for training
    process_training_example(text, label, confidence)
```

### Example 4: Archive Old Data

```python
from pathlib import Path
from powerpoint_voice_controller_v52 import TrainingDataManager

manager = TrainingDataManager()

# Archive current data
archive_path = manager.archive()
print(f"Data archived to: {archive_path}")

# Now you can safely delete or reset the database
```

### Example 5: Custom Configuration

```python
from pathlib import Path
from powerpoint_voice_controller_v52 import PowerPointControllerV52, Config

# Production configuration - high precision
prod_config = Config(
    ENABLE_TRAINING=True,
    TRAINING_DATA_DIR=Path("production_training"),
    LOG_CONFIDENCE_THRESHOLD=0.90,  # Only log very confident
    ENABLE_FALLBACK=True,
    FUZZY_THRESHOLD=85
)

app = PowerPointControllerV52(config=prod_config)
app.run()
```

### Example 6: Monitor Statistics in Real-Time

```python
import time
from powerpoint_voice_controller_v52 import TrainingDataManager

manager = TrainingDataManager()

while True:
    stats = manager.get_statistics()
    
    print("\n" + "="*50)
    print(f"Total Entries: {stats['training_data']['total_entries']}")
    print(f"Database Size: {stats['training_data']['database_size_mb']:.2f} MB")
    print(f"Top Commands: {list(stats['training_data']['by_command'].items())[:5]}")
    print(f"Avg Confidence: {stats['training_data']['confidence']['average']:.2f}")
    
    time.sleep(60)  # Update every minute
```

---

## Workflow

### Day 1: Deploy

1. Run v5.2 with training enabled
2. Use voice commands normally
3. Google converts audio to text
4. Text automatically logged to database

### Week 1: Monitor

1. Check statistics regularly
2. Verify 500+ training examples collected
3. Monitor quality metrics
4. Review command distribution

### Month 1: Export & Train

1. Export training dataset:
   ```python
   training_set = manager.export(Path("month1_export.json"))
   ```

2. Dataset contains:
   - 1000+ examples
   - Various commands
   - Confidence scores
   - Timestamps

3. Train ML model:
   ```python
   with open("month1_export.json") as f:
       data = json.load(f)
   
   X = [ex["text"] for ex in data["training_examples"]]
   y = [ex["label"] for ex in data["training_examples"]]
   
   model = train_model(X, y)
   ```

### Month 2+: Continuous Improvement

1. Deploy improved model
2. Continue collecting data
3. Regular exports and retraining
4. Monitor performance improvements

---

## Troubleshooting

### Database locked error

If you get "database is locked" errors:

```python
# Close any existing connections
import sqlite3
conn = sqlite3.connect("training_data/training_data.db")
conn.close()
```

### Large database file

Archive and start fresh:

```python
manager = TrainingDataManager()
archive_path = manager.archive()
print(f"Archived to: {archive_path}")

# Delete old database
import os
os.remove("training_data/training_data.db")
os.remove("training_data/training_data.jsonl")
```

### Export fails

Check permissions and disk space:

```python
from pathlib import Path

export_dir = Path("training_data/exports")
export_dir.mkdir(parents=True, exist_ok=True)

# Try export again
manager.export(export_dir / "export.json")
```

---

## Comparison: v5.1 vs v5.2

| Feature | v5.1 | v5.2 |
|---------|------|------|
| **Voice Control** | ✅ | ✅ |
| **Fuzzy Matching** | ✅ | ✅ |
| **Training Data Logging** | ❌ | **✅** |
| **ML Export** | ❌ | **✅** |
| **Fallback Cache** | Basic | **Smart** |
| **Statistics** | Basic | **Comprehensive** |
| **Privacy** | Good | **Excellent** |
| **Storage** | Logs only | **SQLite + JSONL** |

---

## Summary

**v5.2 provides:**

✅ Text-only training data logging  
✅ Local SQLite + JSONL storage  
✅ ML/LLM export ready  
✅ Smart fallback recognition  
✅ Comprehensive statistics  
✅ Zero server complexity  
✅ Complete privacy  
✅ Easy ML integration  

**Perfect for:**

- Training custom voice models
- Accent adaptation
- Command optimization
- Continuous improvement
- Local-only deployments
- Privacy-conscious users

---

## Additional Resources

- **Main Script**: `powerpoint_voice_controller_v52.py`
- **Tests**: `test_standalone.py`, `test_v52_components.py`
- **Requirements**: `requirements.txt`
- **Original Version**: `yot presentation.py` (v5.3)

---

## Support

For issues, questions, or contributions, visit:
- **GitHub**: [AllanRye9/Yot-Presentation](https://github.com/AllanRye9/Yot-Presentation)

---

**Made with ❤️ for continuous improvement and privacy-first AI training**

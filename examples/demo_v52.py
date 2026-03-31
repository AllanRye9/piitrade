#!/usr/bin/env python3
"""
Standalone Example for PowerPoint Voice Controller v5.2
Demonstrates training data features without requiring external dependencies
Run this to see how v5.2 training data collection works!
"""

import json
import sqlite3
import hashlib
import time
from pathlib import Path
from datetime import datetime

print("\n" + "="*70)
print(" PowerPoint Voice Controller v5.2 - Training Data Demo")
print("="*70)
print("\n This demo shows how v5.2 collects and manages training data")
print(" (Running in standalone mode - no PowerPoint or microphone needed)\n")

# Setup
demo_dir = Path("demo_training_data")
demo_dir.mkdir(exist_ok=True)
db_file = demo_dir / "training_data.db"
jsonl_file = demo_dir / "training_data.jsonl"

# Initialize database
print("📦 Step 1: Initializing SQLite Database...")
conn = sqlite3.connect(db_file)
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
conn.commit()
print("   ✓ Database initialized")

# Simulate logging voice commands
print("\n🎤 Step 2: Simulating Voice Commands...")
commands = [
    ("next slide", "next_slide", 0.95, "google"),
    ("go back", "prev_slide", 0.88, "google"),
    ("zoom in", "zoom_in", 0.92, "google"),
    ("start presentation", "start_show", 0.97, "google"),
    ("jump to slide 5", "jump_slide", 0.89, "google"),
    ("pen tool", "pen_tool", 0.85, "google"),
    ("black screen", "blackout", 0.91, "google"),
    ("next", "next_slide", 0.93, "google"),
]

for text, command, confidence, source in commands:
    # Generate unique ID
    record_id = hashlib.sha256(f"{text}{command}{time.time()}".encode()).hexdigest()[:16]
    timestamp = datetime.now().isoformat()
    
    # Store in SQLite
    cursor.execute('''
        INSERT INTO training_data
        (id, text, command_matched, confidence, timestamp, source, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (record_id, text, command, confidence, timestamp, source, "default"))
    
    # Store in JSONL
    record = {
        "id": record_id,
        "text": text,
        "command_matched": command,
        "confidence": confidence,
        "timestamp": timestamp,
        "source": source,
        "user_id": "default"
    }
    with open(jsonl_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps(record) + '\n')
    
    print(f"   ✓ Logged: '{text}' -> {command} ({confidence*100:.0f}%)")
    time.sleep(0.1)

conn.commit()

# Show statistics
print("\n📊 Step 3: Training Data Statistics...")
cursor.execute('SELECT COUNT(*) FROM training_data')
total = cursor.fetchone()[0]

cursor.execute('''
    SELECT command_matched, COUNT(*) 
    FROM training_data 
    GROUP BY command_matched
''')
by_command = dict(cursor.fetchall())

cursor.execute('SELECT AVG(confidence), MIN(confidence), MAX(confidence) FROM training_data')
avg_conf, min_conf, max_conf = cursor.fetchone()

db_size = db_file.stat().st_size / 1024

print(f"   Total Entries: {total}")
print(f"   Database Size: {db_size:.2f} KB")
print(f"   Average Confidence: {avg_conf:.2f}")
print(f"\n   Commands Distribution:")
for cmd, count in sorted(by_command.items(), key=lambda x: x[1], reverse=True):
    print(f"     - {cmd}: {count}")

# Export for ML
print("\n🤖 Step 4: Exporting for ML Training...")
export_path = demo_dir / "training_export.json"

cursor.execute('''
    SELECT text, command_matched, confidence, timestamp, source
    FROM training_data
    WHERE confidence >= 0.80
    ORDER BY timestamp DESC
''')

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
        'exported_at': datetime.now().isoformat(),
        'total_examples': len(training_examples),
        'confidence_threshold': 0.80,
        'version': '5.2'
    },
    'training_examples': training_examples
}

with open(export_path, 'w', encoding='utf-8') as f:
    json.dump(export_data, f, indent=2)

print(f"   ✓ Exported {len(training_examples)} examples")
print(f"   ✓ File: {export_path}")

# Show sample export
print("\n   Sample Training Examples:")
for i, ex in enumerate(training_examples[:3], 1):
    print(f"     {i}. '{ex['text']}' -> {ex['label']} (confidence: {ex['confidence']:.2f})")

conn.close()

# Summary
print("\n" + "="*70)
print(" ✅ Demo Complete!")
print("="*70)
print(f"\n Files created in '{demo_dir}/':")
print(f"   - training_data.db     (SQLite database)")
print(f"   - training_data.jsonl  (Portable JSONL format)")
print(f"   - training_export.json (ML-ready export)")
print(f"\n These files can be used to train ML models with TensorFlow,")
print(f" PyTorch, or any other machine learning framework.")
print("\n For complete documentation, see: V52_DOCUMENTATION.md")

# Cleanup option
cleanup_choice = input("\n Do you want to cleanup demo data? (y/n): ")
if cleanup_choice.lower() == 'y':
    import shutil
    shutil.rmtree(demo_dir)
    print(" ✓ Demo data cleaned up")
else:
    print(f" Demo data kept in: {demo_dir}/")

print("\n" + "="*70 + "\n")

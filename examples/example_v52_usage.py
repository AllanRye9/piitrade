#!/usr/bin/env python3
"""
Example Usage Script for PowerPoint Voice Controller v5.2
Demonstrates training data collection and export features
"""

import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from powerpoint_voice_controller_v52 import TrainingDataManager, Config

def example_1_basic_logging():
    """Example 1: Basic Training Data Logging"""
    print("\n" + "="*60)
    print(" Example 1: Basic Training Data Logging")
    print("="*60)
    
    manager = TrainingDataManager(Path("example_training_data"))
    
    # Simulate logging some voice commands
    commands = [
        ("next slide", "next_slide", 0.95),
        ("go back", "prev_slide", 0.88),
        ("zoom in", "zoom_in", 0.92),
        ("start presentation", "start_show", 0.97),
        ("jump to slide 5", "jump_slide", 0.89),
    ]
    
    for text, command, confidence in commands:
        manager.log_text(text, command, confidence)
        print(f"  ✓ Logged: '{text}' -> {command} ({confidence*100:.0f}%)")
    
    print(f"\n  Total entries logged: {len(commands)}")

def example_2_statistics():
    """Example 2: View Statistics"""
    print("\n" + "="*60)
    print(" Example 2: View Statistics")
    print("="*60)
    
    manager = TrainingDataManager(Path("example_training_data"))
    stats = manager.get_statistics()
    
    print(f"\n  📊 Training Data Statistics:")
    print(f"     Total Entries: {stats['training_data']['total_entries']}")
    print(f"     Database Size: {stats['training_data']['database_size_mb']:.2f} MB")
    print(f"     Average Confidence: {stats['training_data']['confidence']['average']:.2f}")
    print(f"\n  📈 Commands Distribution:")
    for cmd, count in stats['training_data']['by_command'].items():
        print(f"     {cmd}: {count}")

def example_3_export():
    """Example 3: Export Training Dataset"""
    print("\n" + "="*60)
    print(" Example 3: Export Training Dataset for ML")
    print("="*60)
    
    manager = TrainingDataManager(Path("example_training_data"))
    
    # Export with confidence threshold
    export_path = Path("example_training_data/exports/training_export.json")
    training_set = manager.export(export_path, threshold=0.80)
    
    print(f"\n  📦 Exported Dataset:")
    print(f"     File: {export_path}")
    print(f"     Total Examples: {training_set['metadata']['total_examples']}")
    print(f"     Confidence Threshold: {training_set['metadata']['confidence_threshold']}")
    print(f"\n  Sample Examples:")
    for example in training_set['training_examples'][:3]:
        print(f"     '{example['text']}' -> {example['label']} ({example['confidence']:.2f})")

def example_4_batch_creation():
    """Example 4: Create Training Batches"""
    print("\n" + "="*60)
    print(" Example 4: Create Training Batches for ML")
    print("="*60)
    
    manager = TrainingDataManager(Path("example_training_data"))
    
    # Create batch
    batch = manager.create_batch(batch_size=5)
    
    print(f"\n  🎯 Training Batch Created:")
    print(f"     Batch Size: {len(batch)}")
    print(f"\n  Batch Contents:")
    for i, example in enumerate(batch, 1):
        print(f"     {i}. Input: '{example['input']}' -> Label: {example['label']}")

def example_5_archive():
    """Example 5: Archive Training Data"""
    print("\n" + "="*60)
    print(" Example 5: Archive Training Data")
    print("="*60)
    
    manager = TrainingDataManager(Path("example_training_data"))
    
    # Archive current data
    archive_path = manager.archive()
    
    print(f"\n  📦 Data Archived:")
    print(f"     Archive Path: {archive_path}")
    print(f"     Archive Size: {archive_path.stat().st_size / 1024:.2f} KB")

def cleanup():
    """Cleanup example data"""
    print("\n" + "="*60)
    print(" Cleanup")
    print("="*60)
    
    import shutil
    example_dir = Path("example_training_data")
    if example_dir.exists():
        shutil.rmtree(example_dir)
        print("  ✓ Example training data cleaned up")

def main():
    """Run all examples"""
    print("\n" + "="*70)
    print(" PowerPoint Voice Controller v5.2 - Usage Examples")
    print("="*70)
    print("\n This script demonstrates the training data features of v5.2")
    
    try:
        # Run examples
        example_1_basic_logging()
        example_2_statistics()
        example_3_export()
        example_4_batch_creation()
        example_5_archive()
        
        # Cleanup
        print("\n")
        cleanup_choice = input("  Do you want to cleanup example data? (y/n): ")
        if cleanup_choice.lower() == 'y':
            cleanup()
        else:
            print(f"\n  Example data kept in: example_training_data/")
        
        print("\n" + "="*70)
        print(" ✅ All Examples Completed Successfully!")
        print("="*70)
        print("\n For more information, see V52_DOCUMENTATION.md")
        
    except Exception as e:
        print(f"\n ❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

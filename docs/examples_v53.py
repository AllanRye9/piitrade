"""
PowerPoint Voice Controller v5.3 - Configuration Examples
Quick-start templates for different use cases
"""

from pathlib import Path
from ppt_voice_controller_v53_multilang import (
    Config, Language, PowerPointControllerV53, MultiLanguageDetector
)

# =============================================================================
# EXAMPLE 1: Basic English Setup (Simplest)
# =============================================================================

def example_1_english_only():
    """Minimal setup - English only, optimized response time"""
    
    config = Config(
        ENABLE_TRAINING=True,
        TRAINING_DATA_DIR=Path("training_data"),
        PRIMARY_LANGUAGE=Language.ENGLISH,
        AUTO_DETECT_LANGUAGE=False,  # Single language
        SUPPORTED_LANGUAGES=[Language.ENGLISH],
        FUZZY_THRESHOLD=80,
        INPUT_DEBOUNCE_MS=50,
        RESPONSE_TIMEOUT_MS=500,
    )
    
    app = PowerPointControllerV53(config=config)
    print("🎤 Starting English-only mode...")
    app.run()


# =============================================================================
# EXAMPLE 2: Multi-Language with Auto-Detection
# =============================================================================

def example_2_multilingual_auto():
    """Automatic language detection - speak in any supported language"""
    
    config = Config(
        ENABLE_TRAINING=True,
        TRAINING_DATA_DIR=Path("training_data_multilang"),
        PRIMARY_LANGUAGE=Language.ENGLISH,
        AUTO_DETECT_LANGUAGE=True,  # Auto-detect language
        SUPPORTED_LANGUAGES=[
            Language.ENGLISH,
            Language.SPANISH,
            Language.FRENCH,
            Language.GERMAN,
            Language.ITALIAN,
        ],
        PARALLEL_DETECTION=True,        # Fast detection
        MAX_WORKERS=4,
        FUZZY_THRESHOLD=80,
        INPUT_DEBOUNCE_MS=50,
    )
    
    app = PowerPointControllerV53(config=config)
    print("🌍 Starting multi-language mode with auto-detection...")
    print("Languages:", ", ".join(l.name for l in config.SUPPORTED_LANGUAGES))
    app.run()


# =============================================================================
# EXAMPLE 3: Performance-Optimized Setup
# =============================================================================

def example_3_performance_optimized():
    """Tuned for fastest possible response times"""
    
    config = Config(
        ENABLE_TRAINING=True,
        TRAINING_DATA_DIR=Path("training_data_fast"),
        PRIMARY_LANGUAGE=Language.ENGLISH,
        AUTO_DETECT_LANGUAGE=False,  # Disable detection overhead
        SUPPORTED_LANGUAGES=[Language.ENGLISH],
        
        # Performance tuning
        PARALLEL_DETECTION=True,
        INPUT_BUFFER_SIZE=5,           # Smaller buffer
        INPUT_DEBOUNCE_MS=30,          # Shorter debounce
        RESPONSE_TIMEOUT_MS=300,       # Stricter timeout
        
        # Matching tuning
        FUZZY_THRESHOLD=85,            # Stricter fuzzy matching
        LOG_CONFIDENCE_THRESHOLD=0.80, # Higher confidence requirement
    )
    
    app = PowerPointControllerV53(config=config)
    print("⚡ Starting performance-optimized mode...")
    print("Target response time: <50ms")
    app.run()


# =============================================================================
# EXAMPLE 4: Enterprise Multi-Language Setup
# =============================================================================

def example_4_enterprise_multilang():
    """Full multi-language support for international presentations"""
    
    config = Config(
        ENABLE_TRAINING=True,
        TRAINING_DATA_DIR=Path("training_data_enterprise"),
        
        PRIMARY_LANGUAGE=Language.ENGLISH,
        AUTO_DETECT_LANGUAGE=True,
        SUPPORTED_LANGUAGES=[
            Language.ENGLISH,
            Language.SPANISH,
            Language.FRENCH,
            Language.GERMAN,
            Language.ITALIAN,
            Language.PORTUGUESE,
            Language.CHINESE,
            Language.JAPANESE,
        ],
        
        PARALLEL_DETECTION=True,
        MAX_WORKERS=6,
        
        # Balanced performance/reliability
        INPUT_BUFFER_SIZE=10,
        INPUT_DEBOUNCE_MS=50,
        RESPONSE_TIMEOUT_MS=500,
        FUZZY_THRESHOLD=75,            # More permissive
        LOG_CONFIDENCE_THRESHOLD=0.65,
    )
    
    app = PowerPointControllerV53(config=config)
    print("🌐 Starting enterprise multi-language mode...")
    print(f"Supported: {len(config.SUPPORTED_LANGUAGES)} languages")
    app.run()


# =============================================================================
# EXAMPLE 5: Language Detection Testing
# =============================================================================

def example_5_test_language_detection():
    """Test and benchmark language detection"""
    
    from ppt_voice_controller_v53_multilang import MultiLanguageDetector
    import time
    
    detector = MultiLanguageDetector(
        supported_languages=[
            Language.ENGLISH,
            Language.SPANISH,
            Language.FRENCH,
            Language.GERMAN,
        ],
        primary_language=Language.ENGLISH,
        parallel=True,
        max_workers=4
    )
    
    # Test cases
    test_samples = [
        ("Next slide", Language.ENGLISH),
        ("Siguiente", Language.SPANISH),
        ("Suivant", Language.FRENCH),
        ("Nächste", Language.GERMAN),
        ("Go to 5", Language.ENGLISH),
        ("Salta a 5", Language.SPANISH),
        ("Aller à 5", Language.FRENCH),
        ("Gehe zu 5", Language.GERMAN),
    ]
    
    print("🔍 Language Detection Benchmark")
    print("=" * 60)
    
    # Single detection
    print("\nSingle Detection (sequential):")
    start = time.time()
    for text, expected_lang in test_samples:
        detected_lang, confidence = detector.detect(text)
        status = "✓" if detected_lang == expected_lang else "✗"
        print(f"  {status} '{text}' -> {detected_lang.name} ({confidence:.2f})")
    single_time = time.time() - start
    print(f"  Total time: {single_time*1000:.1f}ms")
    
    # Batch detection (parallel)
    print("\nBatch Detection (parallel):")
    texts = [t[0] for t in test_samples]
    start = time.time()
    results = detector.detect_batch(texts)
    batch_time = time.time() - start
    print(f"  Total time: {batch_time*1000:.1f}ms")
    print(f"  Speed-up: {single_time/batch_time:.1f}x")
    
    print("\n" + "=" * 60)
    print(f"Average detection time: {batch_time*1000/len(texts):.1f}ms per sample")


# =============================================================================
# EXAMPLE 6: Training Data Analysis
# =============================================================================

def example_6_analyze_training_data():
    """Analyze and export training data with language breakdown"""
    
    from ppt_voice_controller_v53_multilang import AdvancedTrainingDataLogger
    
    logger = AdvancedTrainingDataLogger(Path("training_data"))
    
    print("📊 Training Data Analysis")
    print("=" * 60)
    
    stats = logger.get_statistics()
    
    print(f"\nTotal Entries: {stats['total_entries']}")
    print(f"Database Size: {stats['database_size_mb']:.2f} MB")
    
    print("\nBy Language:")
    for lang, count in sorted(stats['by_language'].items()):
        print(f"  {lang}: {count} entries")
    
    print("\nBy Command:")
    for cmd, count in sorted(stats['by_command'].items()):
        print(f"  {cmd}: {count} times")
    
    print("\nResponse Time (ms):")
    resp = stats['response_time']
    print(f"  Average: {resp['average_ms']:.1f}")
    print(f"  Min: {resp['minimum_ms']:.1f}")
    print(f"  Max: {resp['maximum_ms']:.1f}")
    
    print("\nConfidence Metrics:")
    conf = stats['confidence']
    print(f"  Average: {conf['average']:.2f}")
    print(f"  Min: {conf['minimum']:.2f}")
    print(f"  Max: {conf['maximum']:.2f}")
    
    # Export training data
    print("\n📤 Exporting training set...")
    export_path = Path("training_export_v53.json")
    export_data = logger.export_training_set(export_path, threshold=0.80)
    print(f"  Exported: {export_data['metadata']['total_examples']} examples")
    print(f"  Saved to: {export_path}")
    
    print("\n" + "=" * 60)


# =============================================================================
# EXAMPLE 7: Performance Monitoring
# =============================================================================

def example_7_monitor_performance():
    """Real-time performance monitoring during execution"""
    
    from ppt_voice_controller_v53_multilang import PowerPointControllerV53, Config
    import threading
    import time
    
    config = Config(
        ENABLE_TRAINING=True,
        PRIMARY_LANGUAGE=Language.ENGLISH,
        AUTO_DETECT_LANGUAGE=True,
        SUPPORTED_LANGUAGES=[
            Language.ENGLISH,
            Language.SPANISH,
            Language.FRENCH,
        ],
        PARALLEL_DETECTION=True,
    )
    
    app = PowerPointControllerV53(config=config)
    
    # Monitor thread
    def monitor():
        while app.running:
            time.sleep(5)
            
            print("\n" + "="*60)
            print(" ⚡ PERFORMANCE METRICS (every 5s)")
            print("="*60)
            
            # Execution performance
            perf = app.executor.get_performance_stats()
            print(f"Execution Times (ms):")
            print(f"  Average: {perf['avg_ms']:.1f}")
            print(f"  Min: {perf['min_ms']:.1f}")
            print(f"  Max: {perf['max_ms']:.1f}")
            print(f"  Samples: {perf['count']}")
            
            # Language detection
            lang_stats = app.lang_detector.get_stats()
            print(f"\nLanguage Detection:")
            for lang, count in lang_stats.items():
                print(f"  {lang}: {count}")
            
            # Speech engine
            speech_stats = app.speech_engine.get_stats()
            print(f"\nSpeech Recognition:")
            print(f"  Google Success: {speech_stats['google_success']}")
            print(f"  Failed: {speech_stats['failed']}")
            print(f"  Total: {speech_stats['total']}")
            
            # Command stats
            print(f"\nCommand Execution:")
            print(f"  Total: {app.stats['total']}")
            print(f"  Success: {app.stats['success']}")
            print(f"  Fuzzy Rescues: {app.stats['fuzzy_rescues']}")
    
    # Start monitor in background
    monitor_thread = threading.Thread(target=monitor, daemon=True)
    monitor_thread.start()
    
    print("🚀 Starting app with performance monitoring...")
    app.run()


# =============================================================================
# EXAMPLE 8: Custom Language Configuration
# =============================================================================

def example_8_custom_language_setup():
    """Create custom language configuration for specific needs"""
    
    config = Config(
        # Use Spanish as primary for Spanish-speaking presenter
        PRIMARY_LANGUAGE=Language.SPANISH,
        
        # But support English fallback for Q&A
        AUTO_DETECT_LANGUAGE=True,
        SUPPORTED_LANGUAGES=[
            Language.SPANISH,    # Primary
            Language.ENGLISH,    # Fallback
        ],
        
        # Optimize for longer speeches
        FUZZY_THRESHOLD=75,    # More lenient
        INPUT_BUFFER_SIZE=15,  # Larger buffer for rapid commands
        INPUT_DEBOUNCE_MS=100, # Longer debounce for stability
        
        # Training setup
        ENABLE_TRAINING=True,
        TRAINING_DATA_DIR=Path("training_spanish_english"),
        LOG_CONFIDENCE_THRESHOLD=0.75,
    )
    
    app = PowerPointControllerV53(config=config)
    print("🇪🇸 Starting Spanish-primary mode...")
    print("Fallback: English")
    app.run()


# =============================================================================
# EXAMPLE 9: High-Reliability Setup
# =============================================================================

def example_9_high_reliability():
    """Tuned for reliability over speed (no false positives)"""
    
    config = Config(
        ENABLE_TRAINING=True,
        PRIMARY_LANGUAGE=Language.ENGLISH,
        AUTO_DETECT_LANGUAGE=False,  # Disable to prevent false detections
        SUPPORTED_LANGUAGES=[Language.ENGLISH],
        
        # Reliability tuning
        FUZZY_THRESHOLD=90,              # Very strict fuzzy matching
        LOG_CONFIDENCE_THRESHOLD=0.90,   # Only log high-confidence
        
        # Slower but more stable
        INPUT_DEBOUNCE_MS=150,           # Longer debounce
        INPUT_BUFFER_SIZE=5,             # Smaller buffer
        RESPONSE_TIMEOUT_MS=1000,        # Longer timeout
    )
    
    app = PowerPointControllerV53(config=config)
    print("🛡️ Starting high-reliability mode...")
    print("Focus: Zero false positives, stable execution")
    app.run()


# =============================================================================
# EXAMPLE 10: Benchmark Comparison
# =============================================================================

def example_10_benchmark_comparison():
    """Compare different configuration settings"""
    
    import time
    from ppt_voice_controller_v53_multilang import AudioTextRecord
    
    print("📈 Configuration Comparison Benchmark")
    print("=" * 70)
    
    configs = [
        ("Fast (Single Lang)", {
            'PRIMARY_LANGUAGE': Language.ENGLISH,
            'AUTO_DETECT_LANGUAGE': False,
            'SUPPORTED_LANGUAGES': [Language.ENGLISH],
            'PARALLEL_DETECTION': False,
            'FUZZY_THRESHOLD': 75,
        }),
        ("Balanced Multi-Lang", {
            'PRIMARY_LANGUAGE': Language.ENGLISH,
            'AUTO_DETECT_LANGUAGE': True,
            'SUPPORTED_LANGUAGES': [Language.ENGLISH, Language.SPANISH, Language.FRENCH],
            'PARALLEL_DETECTION': True,
            'FUZZY_THRESHOLD': 80,
        }),
        ("Full Multi-Lang (8)", {
            'PRIMARY_LANGUAGE': Language.ENGLISH,
            'AUTO_DETECT_LANGUAGE': True,
            'SUPPORTED_LANGUAGES': list(Language),
            'PARALLEL_DETECTION': True,
            'FUZZY_THRESHOLD': 75,
        }),
        ("High Reliability", {
            'PRIMARY_LANGUAGE': Language.ENGLISH,
            'AUTO_DETECT_LANGUAGE': False,
            'SUPPORTED_LANGUAGES': [Language.ENGLISH],
            'PARALLEL_DETECTION': False,
            'FUZZY_THRESHOLD': 90,
        }),
    ]
    
    for name, kwargs in configs:
        config = Config(**kwargs)
        
        print(f"\n{name}:")
        print(f"  Languages: {len(config.SUPPORTED_LANGUAGES)}")
        print(f"  Fuzzy Threshold: {config.FUZZY_THRESHOLD}")
        print(f"  Auto-Detect: {config.AUTO_DETECT_LANGUAGE}")
        print(f"  Parallel Detection: {config.PARALLEL_DETECTION}")
        print(f"  Debounce: {config.INPUT_DEBOUNCE_MS}ms")
        
        # Estimate timing
        base_time = 40  # Base execution time
        lang_time = 10 * (len(config.SUPPORTED_LANGUAGES) - 1)  # Add for each language
        parallel_reduction = 0.7 if config.PARALLEL_DETECTION else 1.0
        
        estimated = base_time + (lang_time * parallel_reduction)
        print(f"  Est. Response Time: ~{estimated:.0f}ms")
    
    print("\n" + "=" * 70)


# =============================================================================
# MAIN - RUN EXAMPLES
# =============================================================================

if __name__ == "__main__":
    import sys
    
    examples = {
        '1': ('English Only', example_1_english_only),
        '2': ('Multi-Language Auto', example_2_multilingual_auto),
        '3': ('Performance Optimized', example_3_performance_optimized),
        '4': ('Enterprise Multi-Lang', example_4_enterprise_multilang),
        '5': ('Test Language Detection', example_5_test_language_detection),
        '6': ('Analyze Training Data', example_6_analyze_training_data),
        '7': ('Monitor Performance', example_7_monitor_performance),
        '8': ('Custom Language Setup', example_8_custom_language_setup),
        '9': ('High Reliability', example_9_high_reliability),
        '10': ('Benchmark Comparison', example_10_benchmark_comparison),
    }
    
    print("\n" + "="*70)
    print(" PowerPoint Voice Controller v5.3 - Configuration Examples")
    print("="*70 + "\n")
    
    print("Available Examples:\n")
    for key, (name, _) in examples.items():
        print(f"  {key}. {name}")
    
    print("\n  0. Exit\n")
    
    choice = input("Select example (0-10): ").strip()
    
    if choice == '0':
        print("Goodbye!")
        sys.exit(0)
    
    if choice in examples:
        name, func = examples[choice]
        print(f"\n▶️  Running: {name}\n")
        try:
            func()
        except KeyboardInterrupt:
            print("\n\n⏹️  Interrupted by user")
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("❌ Invalid selection")

import 'package:permission_handler/permission_handler.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

typedef OnResult = void Function(String transcript);
typedef OnStatusChange = void Function(bool isListening);

/// Wraps [SpeechToText] and provides a simple start/stop API.
class VoiceService {
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _available = false;
  bool _initializing = false;

  /// Requests the microphone permission and initialises the STT engine.
  /// Returns `true` if the engine is ready to use.
  /// Concurrent calls are coalesced — only one initialisation runs at a time.
  Future<bool> initialize() async {
    if (_available) return true;
    if (_initializing) return false;
    _initializing = true;
    try {
      final status = await Permission.microphone.request();
      if (!status.isGranted) {
        _available = false;
        return false;
      }
      _available = await _speech.initialize(
        onError: (error) {},
        onStatus: (_) {},
      );
      return _available;
    } finally {
      _initializing = false;
    }
  }

  bool get isAvailable => _available;
  bool get isListening => _speech.isListening;

  /// Returns `true` if the microphone permission has been granted.
  Future<bool> hasMicrophonePermission() async {
    return Permission.microphone.isGranted;
  }

  Future<void> startListening({
    required OnResult onResult,
    required OnStatusChange onStatusChange,
    String localeId = 'en_US',
  }) async {
    if (!_available) {
      // Re-try initialisation in case the user granted permission after launch.
      // initialize() is already guarded against concurrent calls.
      final ok = await initialize();
      if (!ok) return;
    }
    onStatusChange(true);
    await _speech.listen(
      onResult: (result) {
        if (result.finalResult) {
          onStatusChange(false);
          onResult(result.recognizedWords);
        }
      },
      localeId: localeId,
      listenFor: const Duration(seconds: 10),
      pauseFor: const Duration(seconds: 3),
      cancelOnError: true,
    );
  }

  Future<void> stopListening({required OnStatusChange onStatusChange}) async {
    await _speech.stop();
    onStatusChange(false);
  }

  Future<List<stt.LocaleName>> availableLocaleNames() async {
    return _speech.locales();
  }

  Future<List<String>> availableLocales() async {
    final locales = await _speech.locales();
    return locales.map((l) => l.localeId).toList();
  }
}

import 'package:flutter/material.dart';
import '../models/presentation_file.dart';
import '../models/slide.dart';
import '../services/api_service.dart';
import '../services/voice_service.dart';
import '../widgets/slide_view.dart';
import '../widgets/voice_button.dart';

/// Full-screen presentation viewer with swipe navigation, slide progress
/// bar and voice control.
class PresentationScreen extends StatefulWidget {
  final String serverUrl;
  final PresentationFile file;
  final String voiceLocale;

  const PresentationScreen({
    super.key,
    required this.serverUrl,
    required this.file,
    this.voiceLocale = 'en_US',
  });

  @override
  State<PresentationScreen> createState() => _PresentationScreenState();
}

class _PresentationScreenState extends State<PresentationScreen> {
  late final ApiService _api;
  final VoiceService _voice = VoiceService();
  late final PageController _pageController;

  List<Slide> _slides = [];
  int _currentIndex = 0;
  bool _loading = true;
  bool _listening = false;
  bool _voiceUnavailable = false;
  String? _error;
  String _lastTranscript = '';
  String _commandFeedback = '';

  @override
  void initState() {
    super.initState();
    _api = ApiService(widget.serverUrl);
    _pageController = PageController();
    _loadSlides();
    _initVoice();
  }

  @override
  void dispose() {
    _voice.stopListening(onStatusChange: (_) {});
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _initVoice() async {
    final ok = await _voice.initialize();
    if (mounted && !ok) {
      setState(() => _voiceUnavailable = true);
    }
  }

  Future<void> _loadSlides() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final slides = await _api.getSlides(widget.file.id);
      if (mounted) {
        setState(() {
          _slides = slides;
          _currentIndex = 0;
        });
        // Ensure the PageView starts at the first page
        if (_pageController.hasClients) {
          _pageController.jumpToPage(0);
        }
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── navigation ────────────────────────────────────────────────────────

  void _goTo(int index) {
    if (index < 0 || index >= _slides.length) return;
    setState(() => _currentIndex = index);
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  void _next() => _goTo(_currentIndex + 1);
  void _previous() => _goTo(_currentIndex - 1);

  // ── voice control ─────────────────────────────────────────────────────

  Future<void> _toggleListening() async {
    if (_voiceUnavailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Microphone permission denied. '
            'Enable it in your device Settings.',
          ),
        ),
      );
      return;
    }

    if (_listening) {
      await _voice.stopListening(onStatusChange: (v) {
        if (mounted) setState(() => _listening = v);
      });
    } else {
      await _voice.startListening(
        onResult: _handleVoiceResult,
        onStatusChange: (v) {
          if (mounted) setState(() => _listening = v);
        },
        localeId: widget.voiceLocale,
      );
    }
  }

  Future<void> _handleVoiceResult(String transcript) async {
    if (transcript.isEmpty) return;
    setState(() => _lastTranscript = transcript);
    try {
      final result = await _api.processCommand(transcript);
      final action = result['action'] as String? ?? 'none';
      final targetSlide = result['slide'] as int?;
      final confidence = (result['confidence'] as num?)?.toDouble() ?? 0.0;

      String feedback;
      if (action == 'next') {
        _next();
        feedback = '▶ Next slide';
      } else if (action == 'previous') {
        _previous();
        feedback = '◀ Previous slide';
      } else if (action == 'goto' && targetSlide != null) {
        _goTo(targetSlide - 1);
        feedback = '➡ Slide $targetSlide';
      } else if (action == 'first') {
        _goTo(0);
        feedback = '⏮ First slide';
      } else if (action == 'last') {
        _goTo(_slides.length - 1);
        feedback = '⏭ Last slide';
      } else {
        feedback = '🤷 No command matched';
      }

      if (mounted) setState(() => _commandFeedback = feedback);

      // Record for ML learning
      if (action != 'none') {
        await _api.recordCommand(
          command: action,
          text: transcript,
          lang: result['lang'] as String? ?? 'en',
          confidence: confidence,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _commandFeedback = 'Error: $e');
      }
    }
  }

  // ── build ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black87,
        foregroundColor: Colors.white,
        title: Text(
          widget.file.filename,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 14),
        ),
        actions: [
          if (_slides.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Center(
                child: Text(
                  '${_currentIndex + 1} / ${_slides.length}',
                  style: const TextStyle(color: Colors.white70),
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError(cs)
              : _buildContent(cs),
    );
  }

  Widget _buildError(ColorScheme cs) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, color: cs.error, size: 48),
          const SizedBox(height: 8),
          Text(_error!, style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 12),
          TextButton(onPressed: _loadSlides, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildContent(ColorScheme cs) {
    return Column(
      children: [
        // ── slide progress bar ───────────────────────────────────────
        if (_slides.isNotEmpty)
          _SlideProgressBar(
            current: _currentIndex,
            total: _slides.length,
            onChanged: _goTo,
            primaryColor: cs.primary,
          ),

        // ── slide area (swipeable) ───────────────────────────────────
        Expanded(
          child: _slides.isEmpty
              ? const Center(
                  child: Text('No slides',
                      style: TextStyle(color: Colors.white54)))
              : PageView.builder(
                  controller: _pageController,
                  itemCount: _slides.length,
                  onPageChanged: (i) => setState(() => _currentIndex = i),
                  itemBuilder: (_, i) => SlideView(slide: _slides[i]),
                ),
        ),

        // ── feedback banner ──────────────────────────────────────────
        if (_commandFeedback.isNotEmpty || _lastTranscript.isNotEmpty)
          Container(
            color: Colors.black87,
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_lastTranscript.isNotEmpty)
                  Text('"$_lastTranscript"',
                      style: const TextStyle(
                          color: Colors.white54, fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                if (_commandFeedback.isNotEmpty)
                  Text(_commandFeedback,
                      style: TextStyle(
                          color: cs.primary,
                          fontWeight: FontWeight.w600)),
              ],
            ),
          ),

        // ── controls bar ─────────────────────────────────────────────
        Container(
          color: Colors.black87,
          padding:
              const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // previous
              IconButton(
                icon: const Icon(Icons.arrow_back_ios_new,
                    color: Colors.white70),
                onPressed: _currentIndex > 0 ? _previous : null,
              ),

              // voice button
              VoiceButton(
                listening: _listening,
                unavailable: _voiceUnavailable,
                onTap: _toggleListening,
              ),

              // next
              IconButton(
                icon: const Icon(Icons.arrow_forward_ios,
                    color: Colors.white70),
                onPressed:
                    _currentIndex < _slides.length - 1 ? _next : null,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── slide progress bar ────────────────────────────────────────────────────────

class _SlideProgressBar extends StatelessWidget {
  final int current;
  final int total;
  final ValueChanged<int> onChanged;
  final Color primaryColor;

  const _SlideProgressBar({
    required this.current,
    required this.total,
    required this.onChanged,
    required this.primaryColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black87,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Row(
        children: [
          Text(
            '${current + 1}',
            style: const TextStyle(
                color: Colors.white70, fontSize: 12),
          ),
          Expanded(
            child: Slider(
              value: current.toDouble(),
              min: 0,
              max: (total - 1).toDouble(),
              divisions: total > 1 ? total - 1 : null,
              activeColor: primaryColor,
              inactiveColor: Colors.white24,
              onChanged: (v) => onChanged(v.round()),
            ),
          ),
          Text(
            '$total',
            style: const TextStyle(
                color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

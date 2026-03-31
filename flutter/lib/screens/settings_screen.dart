import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/voice_service.dart';

/// Settings screen for configuring the Yot-Presentation server URL
/// and voice-recognition locale.
class SettingsScreen extends StatefulWidget {
  final String serverUrl;
  final ValueChanged<String> onServerUrlChanged;

  const SettingsScreen({
    super.key,
    required this.serverUrl,
    required this.onServerUrlChanged,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _urlController;
  final _formKey = GlobalKey<FormState>();
  final VoiceService _voiceService = VoiceService();

  // Voice locale state
  List<_LocaleItem> _locales = [];
  String _selectedLocaleId = 'en_US';
  bool _loadingLocales = true;

  // A small set of well-known locales shown when STT initialisation fails
  // or the device returns an empty locale list.
  static const List<_LocaleItem> _fallbackLocales = [
    _LocaleItem('en_US', 'English (US)'),
    _LocaleItem('en_GB', 'English (UK)'),
    _LocaleItem('es_ES', 'Spanish'),
    _LocaleItem('fr_FR', 'French'),
    _LocaleItem('de_DE', 'German'),
    _LocaleItem('it_IT', 'Italian'),
    _LocaleItem('pt_BR', 'Portuguese (BR)'),
    _LocaleItem('zh_CN', 'Chinese (Simplified)'),
    _LocaleItem('ja_JP', 'Japanese'),
  ];

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: widget.serverUrl);
    _loadLocalePreference();
    _loadAvailableLocales();
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _loadLocalePreference() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('voice_locale') ?? 'en_US';
    if (mounted) setState(() => _selectedLocaleId = saved);
  }

  Future<void> _loadAvailableLocales() async {
    try {
      await _voiceService.initialize();
      final names = await _voiceService.availableLocaleNames();
      if (names.isNotEmpty && mounted) {
        setState(() {
          _locales = names.map((l) => _LocaleItem(l.localeId, l.name)).toList();
          _loadingLocales = false;
        });
        return;
      }
    } catch (_) {
      // STT init failed (e.g. permission denied or engine unavailable).
      // Fall through to display the built-in fallback locale list.
    }
    if (mounted) {
      setState(() {
        _locales = _fallbackLocales;
        _loadingLocales = false;
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final url = _urlController.text.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', url);
    await prefs.setString('voice_locale', _selectedLocaleId);
    widget.onServerUrlChanged(url);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Settings saved')),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Server URL ─────────────────────────────────────────
                Text(
                  'Server URL',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Enter the address of your Yot-Presentation Flask server '
                  '(e.g. http://192.168.1.100:5000).',
                  style: TextStyle(
                      color: cs.onSurface.withValues(alpha: 0.6)),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _urlController,
                  keyboardType: TextInputType.url,
                  decoration: InputDecoration(
                    labelText: 'Server URL',
                    hintText: 'http://localhost:5000',
                    prefixIcon: const Icon(Icons.link),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter a URL';
                    }
                    final uri = Uri.tryParse(value.trim());
                    if (uri == null || !uri.hasScheme) {
                      return 'Enter a valid URL starting with http:// or https://';
                    }
                    return null;
                  },
                ),

                // ── Voice language ─────────────────────────────────────
                const SizedBox(height: 32),
                const Divider(),
                const SizedBox(height: 16),
                Text(
                  'Voice Language',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Select the language used for voice commands.',
                  style: TextStyle(
                      color: cs.onSurface.withValues(alpha: 0.6)),
                ),
                const SizedBox(height: 16),
                _loadingLocales
                    ? const Center(child: CircularProgressIndicator())
                    : DropdownButtonFormField<String>(
                        value: _locales.any(
                                (l) => l.id == _selectedLocaleId)
                            ? _selectedLocaleId
                            : (_locales.isNotEmpty
                                ? _locales.first.id
                                : null),
                        decoration: InputDecoration(
                          labelText: 'Voice language',
                          prefixIcon: const Icon(Icons.language),
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        items: _locales
                            .map((l) => DropdownMenuItem(
                                  value: l.id,
                                  child: Text(l.name,
                                      overflow: TextOverflow.ellipsis),
                                ))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) {
                            setState(() => _selectedLocaleId = v);
                          }
                        },
                      ),

                // ── Save button ────────────────────────────────────────
                const SizedBox(height: 24),
                FilledButton.icon(
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Save'),
                  onPressed: _save,
                ),

                // ── About ──────────────────────────────────────────────
                const SizedBox(height: 32),
                const Divider(),
                const SizedBox(height: 16),
                Text(
                  'About',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Yot-Presentation Mobile v1.0\n'
                  'Voice-controlled presentations on Android & iOS.\n\n'
                  'Supported file types: PDF, Word, Excel, Text, Images.',
                  style: TextStyle(
                      color: cs.onSurface.withValues(alpha: 0.6)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

class _LocaleItem {
  final String id;
  final String name;
  const _LocaleItem(this.id, this.name);
}

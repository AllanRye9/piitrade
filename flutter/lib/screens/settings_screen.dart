import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/color_compat.dart';

/// Settings screen for configuring the PiiTrade Forex backend server URL.
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

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: widget.serverUrl);
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final url = _urlController.text.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', url);
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
                  'Enter the address of your PiiTrade Forex backend server '
                  '(e.g. https://piitrade.com).',
                  style: TextStyle(
                      color: cs.onSurface.withValues(alpha: 0.6)),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _urlController,
                  keyboardType: TextInputType.url,
                  decoration: InputDecoration(
                    labelText: 'Server URL',
                    hintText: 'https://piitrade.com',
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
                  'PiiTrade AI Forex Signal Hub v1.0\n'
                  'AI & ML backed financial market analysis, news and signals.\n\n'
                  'Supported pairs: Major, Cross, and Commodity (XAU/USD).',
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

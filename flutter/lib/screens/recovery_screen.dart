import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

const _kPiiDataUrl = String.fromEnvironment('PIIDATA');

enum _RecoveryStep { request, token, reset, done }

/// 3-step account recovery screen matching the web site's flow:
///
///  1. **Request** – enter username to generate a recovery code.
///  2. **Token**   – display the recovery code with a copy button.
///  3. **Reset**   – enter the code + new password to reset.
///  4. **Done**    – success state with a "Go to Login" button.
class RecoveryScreen extends StatefulWidget {
  final VoidCallback? onLoginTap;

  const RecoveryScreen({super.key, this.onLoginTap});

  @override
  State<RecoveryScreen> createState() => _RecoveryScreenState();
}

class _RecoveryScreenState extends State<RecoveryScreen>
    with SingleTickerProviderStateMixin {
  _RecoveryStep _step = _RecoveryStep.request;

  // Step 1 – request
  final _requestFormKey = GlobalKey<FormState>();
  final _usernameCtrl = TextEditingController();

  // Step 2 – token display
  String _recoveryToken = '';
  bool _tokenCopied = false;

  // Step 3 – reset
  final _resetFormKey = GlobalKey<FormState>();
  final _tokenCtrl = TextEditingController();
  final _newPassCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  bool _loading = false;
  String? _error;
  String? _success;

  late final AnimationController _fadeCtrl;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    _usernameCtrl.dispose();
    _tokenCtrl.dispose();
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  Future<String> _getServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('server_url') ??
        (_kPiiDataUrl.isNotEmpty ? _kPiiDataUrl : 'https://piitrade.onrender.com');
  }

  Future<void> _requestCode() async {
    if (!_requestFormKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final serverUrl = await _getServerUrl();
      final api = ApiService(serverUrl);
      final token = await api.requestRecovery(
          username: _usernameCtrl.text.trim());
      if (!mounted) return;
      setState(() {
        _loading = false;
        _recoveryToken = token;
        _tokenCtrl.text = token;
        _step = _RecoveryStep.token;
        _success =
            'Recovery code generated. Copy it and use it to reset your password.';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to connect. Check your network or server URL.';
      });
    }
  }

  Future<void> _resetPassword() async {
    if (!_resetFormKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final serverUrl = await _getServerUrl();
      final api = ApiService(serverUrl);
      await api.resetPassword(
        token: _tokenCtrl.text.trim(),
        newPassword: _newPassCtrl.text,
        confirmPassword: _confirmPassCtrl.text,
      );
      if (!mounted) return;
      setState(() {
        _loading = false;
        _step = _RecoveryStep.done;
        _success = 'Password reset successfully! You can now log in.';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to connect. Check your network or server URL.';
      });
    }
  }

  void _copyToken() {
    Clipboard.setData(ClipboardData(text: _recoveryToken));
    setState(() => _tokenCopied = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _tokenCopied = false);
    });
  }

  // ── Build helpers ─────────────────────────────────────────────────────

  Widget _stepIndicator() {
    const bg = Color(0xFF0d1117);
    const primary = Color(0xFF6C63FF);
    const cardBg = Color(0xFF161b22);
    const borderColor = Color(0xFF30363d);
    const textMuted = Color(0xFF8b949e);

    final steps = [
      (label: 'Request Code', step: _RecoveryStep.request),
      (label: 'Get Code', step: _RecoveryStep.token),
      (label: 'Reset Password', step: _RecoveryStep.reset),
    ];

    final currentIdx = _RecoveryStep.values.indexOf(_step);

    return Row(
      children: [
        for (int i = 0; i < steps.length; i++) ...[
          _StepBubble(
            number: i + 1,
            label: steps[i].label,
            isActive: currentIdx == i,
            isDone: currentIdx > i,
            primary: primary,
            textMuted: textMuted,
            cardBg: cardBg,
            borderColor: borderColor,
            bg: bg,
          ),
          if (i < steps.length - 1)
            Expanded(
              child: Container(
                height: 2,
                color: currentIdx > i
                    ? primary.withValues(alpha: 0.6)
                    : borderColor,
              ),
            ),
        ],
      ],
    );
  }

  InputDecoration _fieldDeco({
    required String label,
    required String hint,
    required IconData icon,
    Widget? suffix,
  }) {
    const bg = Color(0xFF0d1117);
    const primary = Color(0xFF6C63FF);
    const borderColor = Color(0xFF30363d);
    const textMuted = Color(0xFF8b949e);

    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: textMuted),
      hintText: hint,
      hintStyle: const TextStyle(color: textMuted),
      prefixIcon: Icon(icon, color: textMuted),
      suffixIcon: suffix,
      filled: true,
      fillColor: bg,
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: borderColor),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFf85149)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide:
            const BorderSide(color: Color(0xFFf85149), width: 1.5),
      ),
    );
  }

  Widget _alertBanner(String message, {bool isError = true}) {
    final color = isError ? const Color(0xFFf85149) : const Color(0xFF3fb950);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.check_circle_outline,
            color: color,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: color, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  // ── Step views ────────────────────────────────────────────────────────

  Widget _buildRequestStep() {
    const primary = Color(0xFF6C63FF);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Form(
          key: _requestFormKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _usernameCtrl,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _requestCode(),
                style: const TextStyle(color: Colors.white),
                decoration: _fieldDeco(
                  label: 'Username',
                  hint: 'Enter your username',
                  icon: Icons.person_outline,
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Username is required' : null,
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                _alertBanner(_error!),
              ],
              const SizedBox(height: 24),
              SizedBox(
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _loading ? null : _requestCode,
                  child: _loading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text(
                          'Generate Recovery Code',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTokenStep() {
    const primary = Color(0xFF6C63FF);
    const cardBg = Color(0xFF161b22);
    const borderColor = Color(0xFF30363d);
    const textMuted = Color(0xFF8b949e);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_success != null) ...[
          _alertBanner(_success!, isError: false),
          const SizedBox(height: 16),
        ],
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Your recovery code (copy it now – expires in 30 minutes):',
                style: TextStyle(color: textMuted, fontSize: 13),
              ),
              const SizedBox(height: 12),
              SelectableText(
                _recoveryToken,
                style: const TextStyle(
                  color: Colors.white,
                  fontFamily: 'monospace',
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                icon: Icon(
                  _tokenCopied
                      ? Icons.check_circle_outline
                      : Icons.content_copy,
                  size: 18,
                ),
                label: Text(_tokenCopied ? 'Copied!' : 'Copy Code'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: primary,
                  side: BorderSide(
                      color: primary.withValues(alpha: 0.5)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _copyToken,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Row(
          children: [
            Expanded(child: Divider(color: Color(0xFF30363d))),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                'Then use the code below to reset your password',
                style: TextStyle(color: textMuted, fontSize: 12),
              ),
            ),
            Expanded(child: Divider(color: Color(0xFF30363d))),
          ],
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: 48,
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => setState(() {
              _step = _RecoveryStep.reset;
              _success = null;
              _error = null;
            }),
            child: const Text(
              '→ Reset Password',
              style:
                  TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResetStep() {
    const primary = Color(0xFF6C63FF);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Form(
          key: _resetFormKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Recovery code field (pre-filled)
              TextFormField(
                controller: _tokenCtrl,
                textInputAction: TextInputAction.next,
                style: const TextStyle(
                    color: Colors.white,
                    fontFamily: 'monospace',
                    fontSize: 13),
                decoration: _fieldDeco(
                  label: 'Recovery Code',
                  hint: 'Paste your recovery code here',
                  icon: Icons.vpn_key_outlined,
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty)
                        ? 'Recovery code is required'
                        : null,
              ),
              const SizedBox(height: 16),

              // New password
              TextFormField(
                controller: _newPassCtrl,
                obscureText: _obscureNew,
                textInputAction: TextInputAction.next,
                style: const TextStyle(color: Colors.white),
                decoration: _fieldDeco(
                  label: 'New Password',
                  hint: 'At least 8 characters',
                  icon: Icons.lock_outline,
                  suffix: IconButton(
                    icon: Icon(
                      _obscureNew
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      color: const Color(0xFF8b949e),
                      size: 20,
                    ),
                    onPressed: () =>
                        setState(() => _obscureNew = !_obscureNew),
                  ),
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'New password is required';
                  if (v.length < 8) {
                    return 'Password must be at least 8 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Confirm new password
              TextFormField(
                controller: _confirmPassCtrl,
                obscureText: _obscureConfirm,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _resetPassword(),
                style: const TextStyle(color: Colors.white),
                decoration: _fieldDeco(
                  label: 'Confirm New Password',
                  hint: 'Repeat new password',
                  icon: Icons.lock_outline,
                  suffix: IconButton(
                    icon: Icon(
                      _obscureConfirm
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      color: const Color(0xFF8b949e),
                      size: 20,
                    ),
                    onPressed: () =>
                        setState(() => _obscureConfirm = !_obscureConfirm),
                  ),
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) {
                    return 'Please confirm your password';
                  }
                  if (v != _newPassCtrl.text) {
                    return 'Passwords do not match';
                  }
                  return null;
                },
              ),

              if (_error != null) ...[
                const SizedBox(height: 14),
                _alertBanner(_error!),
              ],

              const SizedBox(height: 24),
              SizedBox(
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _loading ? null : _resetPassword,
                  child: _loading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text(
                          'Reset Password',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDoneStep() {
    const primary = Color(0xFF6C63FF);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_success != null) _alertBanner(_success!, isError: false),
        const SizedBox(height: 24),
        SizedBox(
          height: 48,
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: widget.onLoginTap,
            child: const Text(
              '→ Go to Login',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    const bg = Color(0xFF0d1117);
    const primary = Color(0xFF6C63FF);
    const cardBg = Color(0xFF161b22);
    const borderColor = Color(0xFF30363d);
    const textMuted = Color(0xFF8b949e);

    Widget stepContent;
    switch (_step) {
      case _RecoveryStep.request:
        stepContent = _buildRequestStep();
      case _RecoveryStep.token:
        stepContent = _buildTokenStep();
      case _RecoveryStep.reset:
        stepContent = _buildResetStep();
      case _RecoveryStep.done:
        stepContent = _buildDoneStep();
    }

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Logo ─────────────────────────────────────────────
                    const Center(
                      child: Text('🔑', style: TextStyle(fontSize: 56)),
                    ),
                    const SizedBox(height: 16),
                    const Center(
                      child: Text(
                        'Account Recovery',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Center(
                      child: Text(
                        'Recover access to your PiiTrade account',
                        style: TextStyle(fontSize: 13, color: textMuted),
                      ),
                    ),
                    const SizedBox(height: 28),

                    // ── Step indicator ────────────────────────────────────
                    _stepIndicator(),
                    const SizedBox(height: 28),

                    // ── Card ─────────────────────────────────────────────
                    Container(
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: borderColor),
                      ),
                      padding: const EdgeInsets.all(24),
                      child: stepContent,
                    ),

                    // ── Login link ────────────────────────────────────────
                    const SizedBox(height: 24),
                    Center(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'Remember your password? ',
                            style: TextStyle(color: textMuted, fontSize: 14),
                          ),
                          GestureDetector(
                            onTap: widget.onLoginTap,
                            child: const Text(
                              'Sign in',
                              style: TextStyle(
                                color: primary,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Step bubble widget ────────────────────────────────────────────────────────

class _StepBubble extends StatelessWidget {
  final int number;
  final String label;
  final bool isActive;
  final bool isDone;
  final Color primary;
  final Color textMuted;
  final Color cardBg;
  final Color borderColor;
  final Color bg;

  const _StepBubble({
    required this.number,
    required this.label,
    required this.isActive,
    required this.isDone,
    required this.primary,
    required this.textMuted,
    required this.cardBg,
    required this.borderColor,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    final circleColor = isDone
        ? primary.withValues(alpha: 0.7)
        : isActive
            ? primary
            : cardBg;
    final borderCol = (isDone || isActive) ? primary : borderColor;
    final textColor = (isDone || isActive) ? Colors.white : textMuted;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: circleColor,
            shape: BoxShape.circle,
            border: Border.all(color: borderCol, width: 1.5),
          ),
          child: Center(
            child: isDone
                ? const Icon(Icons.check, color: Colors.white, size: 16)
                : Text(
                    '$number',
                    style: TextStyle(
                        color: textColor,
                        fontSize: 13,
                        fontWeight: FontWeight.bold),
                  ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: isActive ? primary : textMuted,
            fontSize: 10,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

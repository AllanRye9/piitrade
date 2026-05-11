import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../theme/app_theme.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  String? _error;
  bool _loading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _usernameCtrl.text.trim();
    final password = _passwordCtrl.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'Please enter username and password.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).login(username, password);
      if (mounted) Navigator.pop(context);
    } on DioException catch (e) {
      final data = e.response?.data;
      final msg = (data is Map
              ? (data['detail'] ?? data['message'])?.toString()
              : null) ??
          'Invalid credentials';
      if (mounted) setState(() => _error = msg);
    } catch (e) {
      if (mounted) setState(() => _error = 'Invalid credentials');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign In')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const SizedBox(height: 32),
            const Text('📈', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 16),
            const Text('Sign in to PiiTrade',
                style: TextStyle(
                    color: PiiColors.text,
                    fontSize: 22,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('Access your account and settings',
                style:
                    TextStyle(color: PiiColors.textMuted, fontSize: 14)),
            const SizedBox(height: 32),

            if (_error != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: PiiColors.sell.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                  border:
                      Border.all(color: PiiColors.sell.withOpacity(0.35)),
                ),
                child: Text(_error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: PiiColors.sell, fontSize: 13)),
              ),
              const SizedBox(height: 16),
            ],

            TextField(
              controller: _usernameCtrl,
              style: const TextStyle(color: PiiColors.text),
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Username',
                hintText: 'your username',
              ),
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passwordCtrl,
              obscureText: _obscurePassword,
              style: const TextStyle(color: PiiColors.text),
              decoration: InputDecoration(
                labelText: 'Password',
                hintText: '••••••••',
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_off
                        : Icons.visibility,
                    color: PiiColors.textMuted,
                    size: 20,
                  ),
                  onPressed: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor:
                              AlwaysStoppedAnimation(PiiColors.bg),
                        ),
                      )
                    : const Text('Sign In'),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'By signing in, you agree to our Disclaimer and Privacy Policy.',
              textAlign: TextAlign.center,
              style: TextStyle(color: PiiColors.textMuted, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/forex_screen.dart';
import 'screens/settings_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final serverUrl = prefs.getString('server_url') ?? 'http://localhost:5000';
  runApp(PiiTradeApp(initialServerUrl: serverUrl));
}

class PiiTradeApp extends StatefulWidget {
  final String initialServerUrl;

  const PiiTradeApp({
    super.key,
    required this.initialServerUrl,
  });

  @override
  State<PiiTradeApp> createState() => _PiiTradeAppState();
}

class _PiiTradeAppState extends State<PiiTradeApp> {
  final _navigatorKey = GlobalKey<NavigatorState>();
  late String _serverUrl;

  @override
  void initState() {
    super.initState();
    _serverUrl = widget.initialServerUrl;
  }

  void _updateServerUrl(String url) {
    setState(() => _serverUrl = url);
  }

  Future<void> _reloadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _serverUrl = prefs.getString('server_url') ?? _serverUrl;
      });
    }
  }

  void _openSettings() async {
    await _navigatorKey.currentState?.push(
      MaterialPageRoute(
        builder: (_) => SettingsScreen(
          serverUrl: _serverUrl,
          onServerUrlChanged: _updateServerUrl,
        ),
      ),
    );
    await _reloadPreferences();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AI Forex Signal Hub',
      navigatorKey: _navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C63FF),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: _SplashScreen(
        serverUrl: _serverUrl,
        onSettingsTap: _openSettings,
      ),
    );
  }
}

// ── Splash / loading screen ────────────────────────────────────────────────────

const Duration _kSplashDuration = Duration(milliseconds: 2600);
const Duration _kSplashFadeDuration = Duration(milliseconds: 600);

class _SplashScreen extends StatefulWidget {
  final String serverUrl;
  final VoidCallback onSettingsTap;

  const _SplashScreen({
    required this.serverUrl,
    required this.onSettingsTap,
  });

  @override
  State<_SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<_SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _fadeCtrl;
  late final AnimationController _scaleCtrl;
  late final AnimationController _pulseCtrl;

  late final Animation<double> _fadeAnim;
  late final Animation<double> _scaleAnim;
  late final Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();

    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _scaleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);

    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);
    _scaleAnim = Tween<double>(begin: 0.75, end: 1.0).animate(
      CurvedAnimation(parent: _scaleCtrl, curve: Curves.elasticOut),
    );
    _pulseAnim = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _fadeCtrl.forward();
    _scaleCtrl.forward();

    Future.delayed(_kSplashDuration, _navigateToForex);
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    _scaleCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  void _navigateToForex() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => ForexScreen(
          serverUrl: widget.serverUrl,
          onSettingsTap: widget.onSettingsTap,
        ),
        transitionDuration: _kSplashFadeDuration,
        transitionsBuilder: (_, anim, __, child) => FadeTransition(
          opacity: CurvedAnimation(parent: anim, curve: Curves.easeIn),
          child: child,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const bg = Color(0xFF0d1117);
    const primary = Color(0xFF6C63FF);
    const cardBg = Color(0xFF161b22);
    const borderColor = Color(0xFF30363d);

    return Scaffold(
      backgroundColor: bg,
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: ScaleTransition(
            scale: _scaleAnim,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo container
                AnimatedBuilder(
                  animation: _pulseAnim,
                  builder: (_, __) => Container(
                    width: 110,
                    height: 110,
                    decoration: BoxDecoration(
                      color: cardBg,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: primary.withValues(alpha: _pulseAnim.value),
                        width: 2.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: primary.withValues(
                              alpha: _pulseAnim.value * 0.35),
                          blurRadius: 32,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text('📈', style: TextStyle(fontSize: 52)),
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                // Title
                const Text(
                  'AI Forex Signal Hub',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Powered by Machine Learning',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white.withValues(alpha: 0.45),
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 48),
                // Loading indicator
                SizedBox(
                  width: 44,
                  height: 44,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: primary.withValues(alpha: 0.8),
                    backgroundColor: borderColor,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Loading signals…',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withValues(alpha: 0.35),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

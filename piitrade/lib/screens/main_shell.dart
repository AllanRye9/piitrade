import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_theme.dart';
import '../providers/auth_provider.dart';
import 'home_screen.dart';
import 'forex_screen.dart';
import 'advance_screen.dart';
import 'movers_screen.dart';
import 'risk_calculator_screen.dart';
import 'login_screen.dart';
import 'profile_screen.dart';

class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    // Each screen is its own Scaffold (with its own AppBar).
    // MainShell contributes only the persistent BottomNavigationBar via a
    // wrapping Scaffold that has no AppBar of its own.
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _HomeTab(
            onSignIn: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const LoginScreen())),
            onProfile: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const ProfileScreen())),
          ),
          const ForexScreen(),
          const AdvanceScreen(),
          const MoversScreen(),
          const RiskCalculatorScreen(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: PiiColors.border)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          items: const [
            BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined),
                activeIcon: Icon(Icons.home),
                label: 'Home'),
            BottomNavigationBarItem(
                icon: Icon(Icons.show_chart),
                activeIcon: Icon(Icons.show_chart),
                label: 'Dashboard'),
            BottomNavigationBarItem(
                icon: Icon(Icons.bar_chart),
                activeIcon: Icon(Icons.bar_chart),
                label: 'Advanced'),
            BottomNavigationBarItem(
                icon: Icon(Icons.trending_up),
                activeIcon: Icon(Icons.trending_up),
                label: 'Movers'),
            BottomNavigationBarItem(
                icon: Icon(Icons.calculate_outlined),
                activeIcon: Icon(Icons.calculate),
                label: 'Risk'),
          ],
        ),
      ),
    );
  }
}

/// A thin wrapper around HomeScreen that passes nav callbacks
/// so the AppBar can show auth-aware actions.
class _HomeTab extends ConsumerWidget {
  final VoidCallback onSignIn;
  final VoidCallback onProfile;
  const _HomeTab({required this.onSignIn, required this.onProfile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Text('📈', style: TextStyle(fontSize: 22)),
            SizedBox(width: 8),
            Text('PiiTrade',
                style: TextStyle(
                    color: PiiColors.accent,
                    fontWeight: FontWeight.bold,
                    fontSize: 18)),
          ],
        ),
        actions: [
          if (auth.isLoggedIn)
            IconButton(
              icon: CircleAvatar(
                backgroundColor: PiiColors.accent,
                radius: 14,
                child: Text(
                  auth.username.isNotEmpty
                      ? auth.username[0].toUpperCase()
                      : '?',
                  style: const TextStyle(
                      color: PiiColors.bg,
                      fontSize: 13,
                      fontWeight: FontWeight.bold),
                ),
              ),
              onPressed: onProfile,
            )
          else
            TextButton(
              onPressed: onSignIn,
              child: const Text('Sign In',
                  style: TextStyle(color: PiiColors.accent)),
            ),
        ],
      ),
      body: const HomeBody(),
    );
  }
}


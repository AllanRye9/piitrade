import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';

class AuthState {
  final Map<String, dynamic>? user;
  final bool loading;
  final String? error;

  const AuthState({this.user, this.loading = false, this.error});

  bool get isLoggedIn => user != null;
  String get username => user?['username'] as String? ?? '';
  String get role => user?['role'] as String? ?? '';

  AuthState copyWith({
    Map<String, dynamic>? user,
    bool? loading,
    String? error,
    bool clearUser = false,
    bool clearError = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    _checkAuth();
    return const AuthState(loading: true);
  }

  Future<void> _checkAuth() async {
    final user = await ApiService.getMe();
    state = AuthState(user: user, loading: false);
  }

  Future<void> login(String username, String password) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final data = await ApiService.login(username, password);
      state = AuthState(
        user: {'username': data['username'], 'role': data['role']},
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: _extractError(e),
        clearUser: true,
      );
      rethrow;
    }
  }

  Future<void> logout() async {
    await ApiService.logout();
    state = const AuthState();
  }

  String _extractError(Object e) {
    if (e.toString().contains('detail')) {
      return e.toString();
    }
    return 'Invalid credentials';
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

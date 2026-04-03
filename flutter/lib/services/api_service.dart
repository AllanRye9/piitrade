import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/forex_signal.dart';
import '../models/forex_technical.dart';
import '../models/forex_news.dart';

/// Default timeout for all outbound HTTP requests.
const _kRequestTimeout = Duration(seconds: 15);

/// Communicates with the PiiTrade Forex FastAPI backend.
class ApiService {
  final String serverUrl;

  /// Persistent HTTP client – reuses connections across requests for lower
  /// latency and reduced resource usage.
  final http.Client _client;

  ApiService(this.serverUrl) : _client = http.Client();

  /// Release the underlying HTTP connection pool.  Call this when the service
  /// is no longer needed (e.g. inside [State.dispose]).
  void dispose() => _client.close();

  String get _base => serverUrl.endsWith('/')
      ? serverUrl.substring(0, serverUrl.length - 1)
      : serverUrl;

  // ── Forex ─────────────────────────────────────────────────────────────

  /// Returns the current signal + 30-day history for [pair].
  Future<ForexSignal> getForexSignal(String pair) async {
    final uri = Uri.parse('$_base/api/forex/signals')
        .replace(queryParameters: {'pair': pair});
    final response = await _client.get(uri).timeout(_kRequestTimeout);
    _assertOk(response);
    return ForexSignal.fromJson(
        jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// Returns technical analysis data for [pair].
  Future<ForexTechnical> getForexTechnical(String pair) async {
    final uri = Uri.parse('$_base/api/forex/technical')
        .replace(queryParameters: {'pair': pair});
    final response = await _client.get(uri).timeout(_kRequestTimeout);
    _assertOk(response);
    return ForexTechnical.fromJson(
        jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// Returns the latest forex news sentiment items.
  Future<List<ForexNewsItem>> getForexNews() async {
    final response = await _client
        .get(Uri.parse('$_base/api/forex/news'))
        .timeout(_kRequestTimeout);
    _assertOk(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final items = data['news'] as List<dynamic>? ?? [];
    return items
        .map((e) => ForexNewsItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Returns volatile pairs ranked by price-range movement for [timeframe].
  /// Valid timeframes: '1h', '4h', '24h'.
  Future<Map<String, dynamic>> getForexVolatile(String timeframe) async {
    final uri = Uri.parse('$_base/api/forex/volatile')
        .replace(queryParameters: {'timeframe': timeframe});
    final response = await _client.get(uri).timeout(_kRequestTimeout);
    _assertOk(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Returns pairs with detected potential trend reversals.
  Future<Map<String, dynamic>> getForexReversals() async {
    final response = await _client
        .get(Uri.parse('$_base/api/forex/reversals'))
        .timeout(_kRequestTimeout);
    _assertOk(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Returns FVG status for all pairs, grouped by approaching/reached/passed/rejected.
  Future<Map<String, dynamic>> getForexFvgScanner() async {
    final response = await _client
        .get(Uri.parse('$_base/api/forex/fvg-scanner'))
        .timeout(_kRequestTimeout);
    _assertOk(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Returns pairs that have recently broken through major support or resistance.
  Future<Map<String, dynamic>> getForexSrBreakouts() async {
    final response = await _client
        .get(Uri.parse('$_base/api/forex/sr-breakouts'))
        .timeout(_kRequestTimeout);
    _assertOk(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Subscribes [email] to signal alerts for the given [pairs].
  Future<Map<String, dynamic>> subscribeForexAlerts({
    required String email,
    required List<String> pairs,
  }) async {
    final response = await _client
        .post(
          Uri.parse('$_base/api/forex/subscribe'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email, 'pairs': pairs}),
        )
        .timeout(_kRequestTimeout);
    // Subscribe returns 200 on success or 400 on validation error —
    // don't throw for 400 so the caller can inspect the body.
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 500) {
      throw ApiException(body['error'] ?? 'HTTP ${response.statusCode}');
    }
    return body;
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  /// Authenticates [username] / [password] against the backend.
  /// Returns the user profile map on success.
  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    final response = await _client
        .post(
          Uri.parse('$_base/api/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'username': username, 'password': password}),
        )
        .timeout(_kRequestTimeout);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 200) return body;
    throw ApiException(body['error'] ?? 'HTTP ${response.statusCode}');
  }

  /// Registers a new account. Throws [ApiException] on failure.
  Future<void> register({
    required String username,
    required String email,
    required String password,
    required String confirmPassword,
  }) async {
    final response = await _client
        .post(
          Uri.parse('$_base/api/auth/register'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'username': username,
            'email': email,
            'password': password,
            'confirm_password': confirmPassword,
          }),
        )
        .timeout(_kRequestTimeout);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 200) return;
    throw ApiException(body['error'] ?? 'HTTP ${response.statusCode}');
  }

  /// Requests a password-recovery token for [username].
  /// Returns the token string.
  Future<String> requestRecovery({required String username}) async {
    final response = await _client
        .post(
          Uri.parse('$_base/api/auth/recovery/request'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'username': username}),
        )
        .timeout(_kRequestTimeout);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 200) {
      return body['token'] as String? ?? '';
    }
    throw ApiException(body['error'] ?? 'HTTP ${response.statusCode}');
  }

  /// Resets the password using the provided recovery [token].
  Future<void> resetPassword({
    required String token,
    required String newPassword,
    required String confirmPassword,
  }) async {
    final response = await _client
        .post(
          Uri.parse('$_base/api/auth/recovery/reset'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'token': token,
            'new_password': newPassword,
            'confirm_password': confirmPassword,
          }),
        )
        .timeout(_kRequestTimeout);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 200) return;
    throw ApiException(body['error'] ?? 'HTTP ${response.statusCode}');
  }

  // ── helpers ───────────────────────────────────────────────────────────

  void _assertOk(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      Map<String, dynamic> body = {};
      try {
        body = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {}
      throw ApiException(body['error'] ?? 'HTTP ${response.statusCode}');
    }
  }
}

class ApiException implements Exception {
  final String message;
  const ApiException(this.message);

  @override
  String toString() => 'ApiException: $message';
}

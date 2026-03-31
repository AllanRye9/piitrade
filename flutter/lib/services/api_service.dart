import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/forex_signal.dart';
import '../models/forex_technical.dart';
import '../models/forex_news.dart';

/// Communicates with the PiiTrade Forex Flask backend.
class ApiService {
  final String serverUrl;

  ApiService(this.serverUrl);

  String get _base => serverUrl.endsWith('/')
      ? serverUrl.substring(0, serverUrl.length - 1)
      : serverUrl;

  // ── Forex ─────────────────────────────────────────────────────────────

  /// Returns the current signal + 30-day history for [pair].
  Future<ForexSignal> getForexSignal(String pair) async {
    final uri = Uri.parse('$_base/api/forex/signals')
        .replace(queryParameters: {'pair': pair});
    final response = await http.get(uri);
    _assertOk(response);
    return ForexSignal.fromJson(
        jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// Returns technical analysis data for [pair].
  Future<ForexTechnical> getForexTechnical(String pair) async {
    final uri = Uri.parse('$_base/api/forex/technical')
        .replace(queryParameters: {'pair': pair});
    final response = await http.get(uri);
    _assertOk(response);
    return ForexTechnical.fromJson(
        jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// Returns the latest forex news sentiment items.
  Future<List<ForexNewsItem>> getForexNews() async {
    final response = await http.get(Uri.parse('$_base/api/forex/news'));
    _assertOk(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final items = data['news'] as List<dynamic>? ?? [];
    return items
        .map((e) => ForexNewsItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Subscribes [email] to signal alerts for the given [pairs].
  Future<Map<String, dynamic>> subscribeForexAlerts({
    required String email,
    required List<String> pairs,
  }) async {
    final response = await http.post(
      Uri.parse('$_base/api/forex/subscribe'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'pairs': pairs}),
    );
    // Subscribe returns 200 on success or 400 on validation error —
    // don't throw for 400 so the caller can inspect the body.
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 500) {
      throw ApiException(body['error'] ?? 'HTTP ${response.statusCode}');
    }
    return body;
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

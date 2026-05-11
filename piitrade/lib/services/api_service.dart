import 'package:dio/dio.dart';

const String _baseUrl = 'https://piitrade.co.uk';

class ApiService {
  static final Dio _dio = Dio(
    BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json'},
    ),
  );

  static Dio get dio => _dio;

  // ── Auth ──────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>?> getMe() async {
    try {
      final res = await _dio.get('/api/auth/me');
      return res.data as Map<String, dynamic>;
    } on DioException {
      return null;
    }
  }

  static Future<Map<String, dynamic>> login(
      String username, String password) async {
    final res = await _dio.post('/api/auth/login',
        data: {'username': username, 'password': password});
    return res.data as Map<String, dynamic>;
  }

  static Future<void> logout() async {
    try {
      await _dio.post('/api/auth/logout');
    } on DioException {
      // ignore
    }
  }

  // ── Forex pairs ───────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getPairs() async {
    final res = await _dio.get('/api/forex/pairs');
    return res.data as Map<String, dynamic>;
  }

  // ── Signals ───────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getSignal(String pair) async {
    final res =
        await _dio.get('/api/forex/signals', queryParameters: {'pair': pair});
    return res.data as Map<String, dynamic>;
  }

  // ── Technical analysis ────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getTechnical(String pair) async {
    final res = await _dio
        .get('/api/forex/technical', queryParameters: {'pair': pair});
    return res.data as Map<String, dynamic>;
  }

  // ── News ──────────────────────────────────────────────────────────────────
  static Future<List<dynamic>> getNews() async {
    final res = await _dio.get('/api/forex/news');
    final data = res.data as Map<String, dynamic>;
    return data['news'] as List<dynamic>? ?? [];
  }

  // ── Economic calendar ─────────────────────────────────────────────────────
  static Future<List<dynamic>> getEconomicCalendar() async {
    final res = await _dio.get('/api/forex/economic-calendar');
    final data = res.data as Map<String, dynamic>;
    return data['events'] as List<dynamic>? ?? [];
  }

  // ── FVG scanner ───────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getFvgScanner() async {
    final res = await _dio.get('/api/forex/fvg-scanner');
    return res.data as Map<String, dynamic>;
  }

  // ── S/R breakouts ─────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getSrBreakouts() async {
    final res = await _dio.get('/api/forex/sr-breakouts');
    return res.data as Map<String, dynamic>;
  }

  // ── Pattern scanner ───────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getPatternScanner(
      String timeframe) async {
    final res = await _dio.get('/api/forex/pattern-scanner',
        queryParameters: {'timeframe': timeframe});
    return res.data as Map<String, dynamic>;
  }

  // ── Volatile pairs ────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getVolatile(String timeframe) async {
    final res = await _dio.get('/api/forex/volatile',
        queryParameters: {'timeframe': timeframe});
    return res.data as Map<String, dynamic>;
  }

  // ── Reversal signals ──────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getReversals() async {
    final res = await _dio.get('/api/forex/reversals');
    return res.data as Map<String, dynamic>;
  }
}

import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../models/presentation_file.dart';
import '../models/slide.dart';
import '../models/forex_signal.dart';
import '../models/forex_technical.dart';
import '../models/forex_news.dart';

/// Communicates with the Yot-Presentation Flask backend.
class ApiService {
  final String serverUrl;

  ApiService(this.serverUrl);

  String get _base => serverUrl.endsWith('/')
      ? serverUrl.substring(0, serverUrl.length - 1)
      : serverUrl;

  // ── File upload ───────────────────────────────────────────────────────

  /// Uploads [bytes] with the given [filename] and returns the registered
  /// [PresentationFile] on success, or throws on error.
  Future<PresentationFile> uploadFile(
    Uint8List bytes,
    String filename,
  ) async {
    final uri = Uri.parse('$_base/upload');
    final request = http.MultipartRequest('POST', uri)
      ..files.add(http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: filename,
      ));
    final streamedResponse = await request.send();
    final body = await streamedResponse.stream.bytesToString();
    final json = jsonDecode(body) as Map<String, dynamic>;

    if (streamedResponse.statusCode != 200) {
      throw ApiException(json['error'] ?? 'Upload failed');
    }
    return PresentationFile.fromJson(json);
  }

  // ── File listing ──────────────────────────────────────────────────────

  /// Returns all files currently registered on the server.
  Future<List<PresentationFile>> listFiles() async {
    final response = await http.get(Uri.parse('$_base/api/files'));
    _assertOk(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final files = data['files'] as List<dynamic>? ?? [];
    return files
        .map((e) => PresentationFile.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Slide fetching ────────────────────────────────────────────────────

  /// Returns the full slide list for the given [fileId].
  Future<List<Slide>> getSlides(String fileId) async {
    final response =
        await http.get(Uri.parse('$_base/api/files/$fileId'));
    _assertOk(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final raw = data['slides'] as List<dynamic>? ?? [];
    return raw
        .map((e) => Slide.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── File deletion ─────────────────────────────────────────────────────

  Future<void> deleteFile(String fileId) async {
    final response =
        await http.delete(Uri.parse('$_base/api/files/$fileId'));
    _assertOk(response);
  }

  // ── Voice command ─────────────────────────────────────────────────────

  /// Sends a voice-command [transcript] to the server and returns the
  /// matched action map (action, slide, confidence, …).
  Future<Map<String, dynamic>> processCommand(String transcript) async {
    final response = await http.post(
      Uri.parse('$_base/api/command'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'text': transcript}),
    );
    _assertOk(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  // ── ML learning ───────────────────────────────────────────────────────

  /// Records a successfully executed command for ML learning.
  Future<void> recordCommand({
    required String command,
    required String text,
    required String lang,
    required double confidence,
  }) async {
    await http.post(
      Uri.parse('$_base/api/learn'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'command': command,
        'text': text,
        'lang': lang,
        'confidence': confidence,
      }),
    );
  }

  /// Returns personalised command suggestions from the ML model.
  Future<List<String>> getSuggestions() async {
    final response =
        await http.get(Uri.parse('$_base/api/suggestions'));
    _assertOk(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['suggestions'] as List<dynamic>? ?? [])
        .map((e) => e.toString())
        .toList();
  }

  // ── AI text analysis ──────────────────────────────────────────────────

  /// Analyses [text] and returns AI insights (keywords, summary, …).
  Future<Map<String, dynamic>> analyzeText(String text) async {
    final response = await http.post(
      Uri.parse('$_base/api/ai/analyze'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'text': text}),
    );
    _assertOk(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

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

import 'package:flutter_test/flutter_test.dart';
import 'package:piitrade/services/api_service.dart';
import 'package:piitrade/models/forex_signal.dart';
import 'package:piitrade/models/forex_technical.dart';
import 'package:piitrade/models/forex_news.dart';

void main() {
  group('ApiService base URL normalisation', () {
    test('serverUrl is stored as-is (trailing slash stripping is internal)', () {
      final api = ApiService('http://localhost:5000/');
      // The public field retains the original value; the private _base getter
      // strips the slash internally before building request URIs.
      expect(api.serverUrl, 'http://localhost:5000/');
    });

    test('serverUrl without trailing slash is unchanged', () {
      final api = ApiService('http://192.168.1.10:5000');
      expect(api.serverUrl, 'http://192.168.1.10:5000');
    });
  });

  group('ForexSignal model', () {
    test('fromJson parses full signal response', () {
      final s = ForexSignal.fromJson({
        'pair': 'EUR/USD',
        'direction': 'BUY',
        'confidence': 78.5,
        'entry_price': 1.0854,
        'take_profit': 1.0920,
        'stop_loss': 1.0820,
        'accuracy_30d': 66.7,
        'model_version': 'LightGBM v2.3',
        'features_used': ['RSI-14', 'MACD'],
        'generated_at': '2026-03-30T09:00:00Z',
        'is_live': true,
        'data_source': 'Frankfurter API',
        'history': [
          {
            'day': '2026-03-01',
            'entry': 1.0800,
            'exit': 1.0830,
            'correct': true,
            'predicted': 'BUY',
          }
        ],
      });
      expect(s.pair, 'EUR/USD');
      expect(s.direction, 'BUY');
      expect(s.confidence, 78.5);
      expect(s.entryPrice, 1.0854);
      expect(s.takeProfit, 1.0920);
      expect(s.stopLoss, 1.0820);
      expect(s.accuracy30d, 66.7);
      expect(s.modelVersion, 'LightGBM v2.3');
      expect(s.featuresUsed, ['RSI-14', 'MACD']);
      expect(s.isLive, true);
      expect(s.dataSource, 'Frankfurter API');
      expect(s.history.length, 1);
      expect(s.history.first.correct, true);
      expect(s.history.first.direction, 'BUY');
    });

    test('fromJson handles missing optional fields gracefully', () {
      final s = ForexSignal.fromJson({'pair': 'GBP/USD'});
      expect(s.pair, 'GBP/USD');
      expect(s.direction, 'HOLD');
      expect(s.confidence, 0.0);
      expect(s.isLive, false);
      expect(s.featuresUsed, isEmpty);
      expect(s.history, isEmpty);
    });
  });

  group('ForexHistory model', () {
    test('fromJson reads predicted field as direction', () {
      final h = ForexHistory.fromJson({
        'day': '2026-03-15',
        'entry': 1.0800,
        'exit': 1.0850,
        'correct': true,
        'predicted': 'BUY',
      });
      expect(h.day, '2026-03-15');
      expect(h.entry, 1.0800);
      expect(h.exit, 1.0850);
      expect(h.correct, true);
      expect(h.direction, 'BUY');
    });

    test('fromJson falls back to direction field', () {
      final h = ForexHistory.fromJson({
        'day': '2026-03-16',
        'entry': 1.0820,
        'exit': 1.0810,
        'correct': false,
        'direction': 'SELL',
      });
      expect(h.direction, 'SELL');
      expect(h.correct, false);
    });
  });

  group('ForexTechnical model', () {
    test('fromJson parses full technical analysis response', () {
      final t = ForexTechnical.fromJson({
        'pair': 'EUR/USD',
        'current_price': 1.0854,
        'support_resistance': {
          'support': [1.0800, 1.0750],
          'resistance': [1.0900, 1.0950],
        },
        'fvg': [
          {
            'type': 'bullish',
            'top': 1.0826,
            'bottom': 1.0810,
            'filled': false,
            'created': '2026-03-29',
            'description': 'Unmitigated bullish FVG',
          }
        ],
        'bos': [
          {
            'type': 'bullish',
            'level': 1.0776,
            'date': '2026-03-28',
            'description': 'Bullish BOS confirmed',
          }
        ],
        'choch': [
          {
            'type': 'bullish',
            'level': 1.0792,
            'date': '2026-03-29',
            'description': 'CHoCH bullish shift',
          }
        ],
        'high_volume_zones': [
          {
            'top': 1.0876,
            'bottom': 1.0840,
            'strength': 'high',
            'description': 'Major liquidity pool',
          }
        ],
      });
      expect(t.pair, 'EUR/USD');
      expect(t.currentPrice, 1.0854);
      expect(t.supportResistance.support, [1.0800, 1.0750]);
      expect(t.supportResistance.resistance, [1.0900, 1.0950]);
      expect(t.fvg.length, 1);
      expect(t.fvg.first.type, 'bullish');
      expect(t.fvg.first.filled, false);
      expect(t.bos.length, 1);
      expect(t.bos.first.type, 'bullish');
      expect(t.choch.length, 1);
      expect(t.choch.first.type, 'bullish');
      expect(t.highVolumeZones.length, 1);
      expect(t.highVolumeZones.first.strength, 'high');
    });

    test('fromJson handles missing fields gracefully', () {
      final t = ForexTechnical.fromJson({'pair': 'USD/JPY'});
      expect(t.pair, 'USD/JPY');
      expect(t.currentPrice, 0.0);
      expect(t.supportResistance.support, isEmpty);
      expect(t.fvg, isEmpty);
      expect(t.bos, isEmpty);
      expect(t.choch, isEmpty);
      expect(t.highVolumeZones, isEmpty);
    });
  });

  group('ForexNewsItem model', () {
    test('fromJson parses news item', () {
      final item = ForexNewsItem.fromJson({
        'headline': 'Fed holds rates steady',
        'sentiment': 'neutral',
        'source': 'Reuters',
        'published_at': '2026-03-30T08:00:00Z',
      });
      expect(item.headline, 'Fed holds rates steady');
      expect(item.sentiment, 'neutral');
      expect(item.source, 'Reuters');
      expect(item.publishedAt, '2026-03-30T08:00:00Z');
    });

    test('fromJson defaults missing fields', () {
      final item = ForexNewsItem.fromJson({});
      expect(item.headline, '');
      expect(item.sentiment, 'neutral');
      expect(item.source, '');
    });
  });
}

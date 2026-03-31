/// Data model for a Forex news sentiment item.
class ForexNewsItem {
  final String headline;
  final String sentiment;
  final String source;
  final String publishedAt;

  const ForexNewsItem({
    required this.headline,
    required this.sentiment,
    required this.source,
    required this.publishedAt,
  });

  factory ForexNewsItem.fromJson(Map<String, dynamic> j) => ForexNewsItem(
        headline: j['headline'] as String? ?? '',
        sentiment: j['sentiment'] as String? ?? 'neutral',
        source: j['source'] as String? ?? '',
        publishedAt: j['published_at'] as String? ?? '',
      );
}

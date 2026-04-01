/// Data model for a presentation slide.
class Slide {
  final int index;
  final String type;
  final String? content;
  final String? title;

  const Slide({
    required this.index,
    required this.type,
    this.content,
    this.title,
  });

  factory Slide.fromJson(Map<String, dynamic> j) => Slide(
        index: j['index'] as int? ?? 0,
        type: j['type'] as String? ?? '',
        content: j['content'] as String?,
        title: j['title'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'index': index,
        'type': type,
        if (content != null) 'content': content,
        if (title != null) 'title': title,
      };
}

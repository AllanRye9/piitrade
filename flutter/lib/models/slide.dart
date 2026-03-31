/// Represents a single presentation slide returned by the API.
class Slide {
  final int index;
  final String type; // 'image' | 'text' | 'html' | ...
  final String? content; // base64-encoded image or raw text/HTML
  final String? title;

  const Slide({
    required this.index,
    required this.type,
    this.content,
    this.title,
  });

  factory Slide.fromJson(Map<String, dynamic> json) {
    return Slide(
      index: (json['index'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'text',
      content: json['content'] as String?,
      title: json['title'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'index': index,
        'type': type,
        if (content != null) 'content': content,
        if (title != null) 'title': title,
      };
}

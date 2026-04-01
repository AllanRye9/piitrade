/// Data model for an uploaded presentation file.
class PresentationFile {
  final String id;
  final String filename;
  final int totalSlides;
  final String? thumbnail;
  final String? createdAt;

  const PresentationFile({
    required this.id,
    required this.filename,
    required this.totalSlides,
    this.thumbnail,
    this.createdAt,
  });

  /// Accepts both `file_id` (canonical) and `id` (legacy fallback) from the
  /// server response. `toJson` always serialises with the canonical `file_id`
  /// key.
  factory PresentationFile.fromJson(Map<String, dynamic> j) =>
      PresentationFile(
        id: (j['file_id'] as String?) ?? (j['id'] as String?) ?? '',
        filename: j['filename'] as String? ?? '',
        totalSlides: j['total_slides'] as int? ?? 0,
        thumbnail: j['thumbnail'] as String?,
        createdAt: j['created_at'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'file_id': id,
        'filename': filename,
        'total_slides': totalSlides,
        if (thumbnail != null) 'thumbnail': thumbnail,
        if (createdAt != null) 'created_at': createdAt,
      };
}

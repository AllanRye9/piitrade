/// Represents a presentation file registered on the server.
class PresentationFile {
  final String id;
  final String filename;
  final int totalSlides;
  final String? thumbnail; // base64 PNG thumbnail
  final String? createdAt;

  const PresentationFile({
    required this.id,
    required this.filename,
    required this.totalSlides,
    this.thumbnail,
    this.createdAt,
  });

  factory PresentationFile.fromJson(Map<String, dynamic> json) {
    return PresentationFile(
      id: json['file_id'] as String? ?? json['id'] as String? ?? '',
      filename: json['filename'] as String? ?? 'Untitled',
      totalSlides: (json['total_slides'] as num?)?.toInt() ?? 0,
      thumbnail: json['thumbnail'] as String?,
      createdAt: json['created_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'file_id': id,
        'filename': filename,
        'total_slides': totalSlides,
        if (thumbnail != null) 'thumbnail': thumbnail,
        if (createdAt != null) 'created_at': createdAt,
      };
}

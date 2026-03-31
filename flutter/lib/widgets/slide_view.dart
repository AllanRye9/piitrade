import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import '../models/slide.dart';

/// Renders a single [Slide] — image slides use [PhotoView] for
/// pinch-to-zoom; text/HTML slides render as scrollable text.
class SlideView extends StatelessWidget {
  final Slide slide;

  const SlideView({super.key, required this.slide});

  @override
  Widget build(BuildContext context) {
    if (slide.type == 'image' && slide.content != null) {
      return _ImageSlide(base64Data: slide.content!);
    }
    return _TextSlide(slide: slide);
  }
}

class _ImageSlide extends StatefulWidget {
  final String base64Data;
  const _ImageSlide({required this.base64Data});

  @override
  State<_ImageSlide> createState() => _ImageSlideState();
}

class _ImageSlideState extends State<_ImageSlide> {
  Uint8List? _bytes;

  @override
  void initState() {
    super.initState();
    _decode();
  }

  void _decode() {
    try {
      // Strip data-URL prefix if present (data:image/png;base64,<data>)
      String data = widget.base64Data;
      final commaIdx = data.indexOf(',');
      if (commaIdx != -1) data = data.substring(commaIdx + 1);
      setState(() => _bytes = base64Decode(data));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_bytes == null) {
      return const Center(
          child: CircularProgressIndicator());
    }
    return PhotoView(
      imageProvider: MemoryImage(_bytes!),
      backgroundDecoration: const BoxDecoration(color: Colors.black),
      minScale: PhotoViewComputedScale.contained,
      maxScale: PhotoViewComputedScale.covered * 3,
    );
  }
}

class _TextSlide extends StatelessWidget {
  final Slide slide;
  const _TextSlide({required this.slide});

  @override
  Widget build(BuildContext context) {
    final content = slide.content ?? '';
    final title = slide.title;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null && title.isNotEmpty) ...[
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 16),
          ],
          Text(
            content,
            style: const TextStyle(color: Colors.white70, fontSize: 15, height: 1.6),
          ),
        ],
      ),
    );
  }
}

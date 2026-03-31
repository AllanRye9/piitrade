import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../services/api_service.dart';
import '../models/presentation_file.dart';
import 'presentation_screen.dart';
import 'forex_screen.dart';

/// Initial screen that lets the user upload a file or select from the
/// list of files already available on the server.
class UploadScreen extends StatefulWidget {
  final String serverUrl;
  final String voiceLocale;
  final VoidCallback onSettingsTap;

  const UploadScreen({
    super.key,
    required this.serverUrl,
    required this.voiceLocale,
    required this.onSettingsTap,
  });

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  late ApiService _api;
  List<PresentationFile> _files = [];
  bool _loadingFiles = false;
  bool _uploading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api = ApiService(widget.serverUrl);
    _loadFiles();
  }

  @override
  void didUpdateWidget(UploadScreen old) {
    super.didUpdateWidget(old);
    if (old.serverUrl != widget.serverUrl) {
      _api = ApiService(widget.serverUrl);
      _loadFiles();
    }
  }

  Future<void> _loadFiles() async {
    setState(() {
      _loadingFiles = true;
      _error = null;
    });
    try {
      final files = await _api.listFiles();
      if (mounted) setState(() => _files = files);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loadingFiles = false);
    }
  }

  Future<void> _pickAndUpload() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: [
        'pdf', 'docx', 'doc', 'xlsx', 'xls',
        'txt', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp',
      ],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    final picked = result.files.first;
    if (picked.bytes == null) return;

    setState(() => _uploading = true);
    try {
      final file = await _api.uploadFile(picked.bytes!, picked.name);
      if (!mounted) return;
      await _openPresentation(file);
      await _loadFiles();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _openPresentation(PresentationFile file) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PresentationScreen(
          serverUrl: widget.serverUrl,
          file: file,
          voiceLocale: widget.voiceLocale,
        ),
      ),
    );
    await _loadFiles();
  }

  Future<void> _deleteFile(PresentationFile file) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete file?'),
        content: Text('Remove "${file.filename}" from the server?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete',
                  style: TextStyle(color: Colors.redAccent))),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.deleteFile(file.id);
      await _loadFiles();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: cs.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('🎤', style: TextStyle(fontSize: 22)),
            SizedBox(width: 8),
            Flexible(
              child: Text('Yot-Presentation',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Text('📈', style: TextStyle(fontSize: 20)),
            tooltip: 'Forex Hub',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ForexScreen(serverUrl: widget.serverUrl),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh files',
            onPressed: _loadFiles,
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Settings',
            onPressed: widget.onSettingsTap,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _UploadCard(
                uploading: _uploading,
                onTap: _pickAndUpload,
              ),
              const SizedBox(height: 24),
              _buildFileList(cs),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFileList(ColorScheme cs) {
    if (_loadingFiles) {
      return const Expanded(
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return Expanded(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, color: cs.error, size: 48),
              const SizedBox(height: 8),
              Text('Cannot reach server', style: TextStyle(color: cs.error)),
              const SizedBox(height: 4),
              Text(widget.serverUrl,
                  style: TextStyle(
                      color: cs.onSurface.withValues(alpha: 0.5),
                      fontSize: 12)),
              const SizedBox(height: 12),
              TextButton(
                  onPressed: _loadFiles, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_files.isEmpty) {
      return Expanded(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.folder_open_outlined,
                  size: 64,
                  color: cs.onSurface.withValues(alpha: 0.3)),
              const SizedBox(height: 12),
              Text('No files yet – upload one above',
                  style: TextStyle(
                      color: cs.onSurface.withValues(alpha: 0.5))),
            ],
          ),
        ),
      );
    }

    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Files on server',
              style: Theme.of(context)
                  .textTheme
                  .titleSmall
                  ?.copyWith(
                      color: cs.onSurface.withValues(alpha: 0.6))),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.separated(
              itemCount: _files.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final f = _files[i];
                return _FileCard(
                  file: f,
                  onOpen: () => _openPresentation(f),
                  onDelete: () => _deleteFile(f),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── private widgets ──────────────────────────────────────────────────────────

class _UploadCard extends StatelessWidget {
  final bool uploading;
  final VoidCallback onTap;
  const _UploadCard({required this.uploading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: uploading ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
        decoration: BoxDecoration(
          color: cs.primaryContainer.withValues(alpha: 0.15),
          border: Border.all(
              color: cs.primary.withValues(alpha: 0.5),
              width: 1.5,
              style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(16),
        ),
        child: uploading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.cloud_upload_outlined,
                      size: 48, color: cs.primary),
                  const SizedBox(height: 12),
                  Text('Tap to upload a file',
                      style: TextStyle(
                          color: cs.primary,
                          fontWeight: FontWeight.w600,
                          fontSize: 16)),
                  const SizedBox(height: 4),
                  Text('PDF · Word · Excel · Image · Text',
                      style: TextStyle(
                          color: cs.onSurface.withValues(alpha: 0.5),
                          fontSize: 12)),
                ],
              ),
      ),
    );
  }
}

class _FileCard extends StatelessWidget {
  final PresentationFile file;
  final VoidCallback onOpen;
  final VoidCallback onDelete;

  const _FileCard({
    required this.file,
    required this.onOpen,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      color: cs.surfaceContainerHighest,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: _buildLeading(cs),
        title: Text(file.filename,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w500)),
        subtitle: Text(
            '${file.totalSlides} slide${file.totalSlides == 1 ? '' : 's'}',
            style: TextStyle(
                color: cs.onSurface.withValues(alpha: 0.5))),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextButton(
                onPressed: onOpen,
                child:
                    Text('Open', style: TextStyle(color: cs.primary))),
            IconButton(
                icon: const Icon(Icons.delete_outline),
                color: cs.error.withValues(alpha: 0.7),
                tooltip: 'Delete',
                onPressed: onDelete),
          ],
        ),
      ),
    );
  }

  /// Shows a base64-decoded thumbnail when available, falling back to an icon.
  Widget _buildLeading(ColorScheme cs) {
    if (file.thumbnail != null && file.thumbnail!.isNotEmpty) {
      try {
        String data = file.thumbnail!;
        final commaIdx = data.indexOf(',');
        if (commaIdx != -1) data = data.substring(commaIdx + 1);
        final bytes = base64Decode(data);
        return ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.memory(
            bytes,
            width: 48,
            height: 48,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _iconAvatar(cs),
          ),
        );
      } catch (_) {
        // Ignore malformed base64 thumbnail data and fall back to icon.
      }
    }
    return _iconAvatar(cs);
  }

  Widget _iconAvatar(ColorScheme cs) {
    return CircleAvatar(
      backgroundColor: cs.primaryContainer,
      child: Icon(_iconForFile(file.filename), color: cs.primary),
    );
  }

  IconData _iconForFile(String name) {
    final ext = name.split('.').last.toLowerCase();
    switch (ext) {
      case 'pdf':
        return Icons.picture_as_pdf_outlined;
      case 'docx':
      case 'doc':
        return Icons.description_outlined;
      case 'xlsx':
      case 'xls':
        return Icons.table_chart_outlined;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
      case 'bmp':
        return Icons.image_outlined;
      default:
        return Icons.insert_drive_file_outlined;
    }
  }
}

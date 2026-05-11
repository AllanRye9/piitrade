import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_theme.dart';
import '../providers/auth_provider.dart';
import '../widgets/common_widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SectionCard(
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: PiiColors.accent,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        auth.username.isNotEmpty
                            ? auth.username[0].toUpperCase()
                            : '?',
                        style: const TextStyle(
                            color: PiiColors.bg,
                            fontSize: 28,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(auth.username,
                      style: const TextStyle(
                          color: PiiColors.text,
                          fontSize: 18,
                          fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: auth.role == 'admin'
                          ? PiiColors.hold.withOpacity(0.15)
                          : PiiColors.accent.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      auth.role.isEmpty ? 'User' : auth.role.toUpperCase(),
                      style: TextStyle(
                          color: auth.role == 'admin'
                              ? PiiColors.hold
                              : PiiColors.accent,
                          fontSize: 12,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Account Details',
                      style: TextStyle(
                          color: PiiColors.text,
                          fontWeight: FontWeight.w600,
                          fontSize: 15)),
                  const SizedBox(height: 12),
                  _ProfileRow(label: 'Username', value: auth.username),
                  _ProfileRow(
                      label: 'Role',
                      value: auth.role.isEmpty ? 'User' : auth.role),
                  _ProfileRow(
                      label: 'Status',
                      value: 'Active',
                      valueColor: PiiColors.buy),
                ],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: PiiColors.sell.withOpacity(0.15),
                foregroundColor: PiiColors.sell,
                side: const BorderSide(color: PiiColors.sell),
                elevation: 0,
              ),
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: PiiColors.surface,
                    title: const Text('Sign Out',
                        style: TextStyle(color: PiiColors.text)),
                    content: const Text(
                        'Are you sure you want to sign out?',
                        style: TextStyle(color: PiiColors.textMuted)),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancel',
                              style: TextStyle(color: PiiColors.textMuted))),
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Sign Out',
                              style: TextStyle(color: PiiColors.sell))),
                    ],
                  ),
                );
                if (confirm == true) {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) Navigator.pop(context);
                }
              },
              child: const Text('Sign Out'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _ProfileRow(
      {required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  color: PiiColors.textMuted, fontSize: 13)),
          Text(value,
              style: TextStyle(
                  color: valueColor ?? PiiColors.text,
                  fontWeight: FontWeight.w500,
                  fontSize: 13)),
        ],
      ),
    );
  }
}

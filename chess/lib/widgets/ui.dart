import "package:flutter/material.dart";
import "../theme.dart";

class MenuButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final bool primary;

  const MenuButton({super.key, required this.label, required this.onPressed, this.primary = false});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          backgroundColor: primary ? accent : Colors.transparent,
          foregroundColor: primary ? Colors.black : Colors.white,
          side: primary ? null : const BorderSide(color: Colors.white38),
          shape: const RoundedRectangleBorder(),
        ),
        child: Text(label.toUpperCase(), style: const TextStyle(letterSpacing: 2, fontWeight: FontWeight.bold)),
      ),
    );
  }
}

class BrandTitle extends StatelessWidget {
  const BrandTitle({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("CHESS", style: TextStyle(fontSize: 36, letterSpacing: 10, fontWeight: FontWeight.bold)),
        SizedBox(height: 8),
        SizedBox(width: 48, height: 3, child: ColoredBox(color: accent)),
      ],
    );
  }
}

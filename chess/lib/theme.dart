import "package:flutter/material.dart";

const accent = Color(0xFFFFB000);
const dim = Color(0xFF8A8A8A);
const line = Color(0xFF2A2A2A);

const _sharp = RoundedRectangleBorder();

final appTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  scaffoldBackgroundColor: Colors.black,
  fontFamily: "monospace",
  fontFamilyFallback: const ["Menlo", "Courier"],
  colorScheme: const ColorScheme.dark(primary: accent, surface: Colors.black),
  inputDecorationTheme: const InputDecorationTheme(
    labelStyle: TextStyle(color: dim, letterSpacing: 2, fontSize: 12),
    enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: line)),
    focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: accent)),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(foregroundColor: dim, shape: _sharp),
  ),
  dialogTheme: const DialogThemeData(
    backgroundColor: Colors.black,
    shape: RoundedRectangleBorder(side: BorderSide(color: Colors.white38)),
  ),
  snackBarTheme: const SnackBarThemeData(
    backgroundColor: Colors.black,
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(side: BorderSide(color: accent)),
    contentTextStyle: TextStyle(color: Colors.white),
  ),
);

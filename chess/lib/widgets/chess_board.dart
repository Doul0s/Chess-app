import "package:flutter/material.dart";
import "../models/board.dart";
import "../theme.dart";

class ChessBoard extends StatelessWidget {
  final Board board;
  final String orientation;
  final String? selected;
  final String? lastMove;
  final void Function(String square) onTap;

  const ChessBoard({
    super.key,
    required this.board,
    required this.orientation,
    required this.selected,
    required this.lastMove,
    required this.onTap,
  });

  static const _label = TextStyle(fontSize: 9, color: dim);

  List<String> get _squares {
    final files = "abcdefgh".split("");
    final ranks = List.generate(8, (i) => "${8 - i}");
    if (orientation == "black") {
      files.replaceRange(0, 8, files.reversed);
      ranks.replaceRange(0, 8, ranks.reversed);
    }
    return [for (final r in ranks) for (final f in files) "$f$r"];
  }

  Widget _cell(String square, int i, double size) {
    final piece = board.at(square);
    final row = i ~/ 8;
    final col = i % 8;
    final isSelected = square == selected;
    final isLast = lastMove != null && (square == lastMove!.substring(0, 2) || square == lastMove!.substring(2, 4));
    final fill = isSelected
        ? accent.withValues(alpha: 0.35)
        : isLast
            ? accent.withValues(alpha: 0.18)
            : (row + col) % 2 == 0
                ? const Color(0xFF161616)
                : Colors.black;

    return GestureDetector(
      onTap: () => onTap(square),
      child: Container(
        decoration: BoxDecoration(color: fill, border: isSelected ? Border.all(color: accent, width: 2) : null),
        child: Stack(
          children: [
            if (col == 0) Positioned(left: 2, top: 1, child: Text(square[1], style: _label)),
            if (row == 7) Positioned(right: 2, bottom: 1, child: Text(square[0], style: _label)),
            if (piece != null)
              Center(
                child: Text(
                  piece.glyph,
                  style: TextStyle(
                    fontSize: size * 0.72,
                    height: 1,
                    color: piece.color == "white" ? Colors.white : dim,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final squares = _squares;
    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        decoration: BoxDecoration(border: Border.all(color: Colors.white38)),
        child: LayoutBuilder(
          builder: (context, c) => GridView.count(
            crossAxisCount: 8,
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            children: [for (var i = 0; i < 64; i++) _cell(squares[i], i, c.maxWidth / 8)],
          ),
        ),
      ),
    );
  }
}
